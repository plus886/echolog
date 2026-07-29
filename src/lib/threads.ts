import { getEnv } from "@/lib/env";

// Threads Graph API の server 専用薄ラッパ (現状は OAuth + プロフィール)。
// 投稿系 (コンテナ作成 → publish → URL リプライ) は予約配信フェーズで足す。
// 注意: トークン・app secret を error message や log に含めないこと。

const THREADS_AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const THREADS_GRAPH = "https://graph.threads.net";

// OAuth の state cookie 名 (oauth/start で設置、oauth/callback で照合)。
export const THREADS_STATE_COOKIE = "threads_oauth_state";

// 必要スコープ: 投稿 + URL リプライ + 返信閲覧/返信 + 表示回数 + 削除。
// Meta アプリ側でも同じ権限を有効化しておく必要がある (docs/threads.md)。
export const THREADS_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_read_replies",
  "threads_manage_replies",
  "threads_manage_insights",
  "threads_delete",
];

export type ThreadsAppConfig = { appId: string; appSecret: string };

export function getThreadsAppConfig(): ThreadsAppConfig | null {
  const env = getEnv();
  if (!env.THREADS_APP_ID || !env.THREADS_APP_SECRET) return null;
  return { appId: env.THREADS_APP_ID, appSecret: env.THREADS_APP_SECRET };
}

function requireAppConfig(): ThreadsAppConfig {
  const config = getThreadsAppConfig();
  if (!config) {
    throw new Error("THREADS_APP_ID / THREADS_APP_SECRET is not set");
  }
  return config;
}

// Meta アプリに登録するリダイレクト URI。/admin 配下に置くことで
// Cloudflare Access + middleware の保護をそのまま受ける (コールバックは
// オーナーのブラウザ経由で戻るため Access のセッションが乗る)。
export function threadsRedirectUri(): string {
  return new URL(
    "/admin/threads/oauth/callback",
    getEnv().PUBLIC_SITE_URL,
  ).toString();
}

export function buildThreadsAuthorizeUrl(state: string): string {
  const { appId } = requireAppConfig();
  const url = new URL(THREADS_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", threadsRedirectUri());
  url.searchParams.set("scope", THREADS_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

async function parseJsonResponse(
  res: Response,
  label: string,
): Promise<Record<string, unknown>> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${label}: ${res.status} ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// 認可コード → 短期トークン。redirect_uri は認可時と完全一致が必要。
export async function exchangeCodeForToken(
  code: string,
): Promise<{ accessToken: string; userId: string }> {
  const { appId, appSecret } = requireAppConfig();
  const res = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: threadsRedirectUri(),
      code,
    }),
  });
  const data = await parseJsonResponse(res, "threads code exchange failed");
  const accessToken =
    typeof data.access_token === "string" ? data.access_token : "";
  const userId = data.user_id != null ? String(data.user_id) : "";
  if (!accessToken || !userId) {
    throw new Error("threads code exchange failed: unexpected response shape");
  }
  return { accessToken, userId };
}

// 短期 → 長期トークン (約 60 日)。Threads API の仕様で client_secret を
// クエリに載せる (server-to-server のみ。URL をログに出さないこと)。
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  const { appSecret } = requireAppConfig();
  const url = new URL(`${THREADS_GRAPH}/access_token`);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);
  const data = await parseJsonResponse(
    await fetch(url),
    "threads long-lived exchange failed",
  );
  return toTokenResult(data, "threads long-lived exchange failed");
}

// 長期トークンのリフレッシュ。発行から 24 時間経過後・失効前のみ可能。
export async function refreshLongLivedToken(
  token: string,
): Promise<{ accessToken: string; expiresInSec: number }> {
  const url = new URL(`${THREADS_GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", token);
  const data = await parseJsonResponse(
    await fetch(url),
    "threads token refresh failed",
  );
  return toTokenResult(data, "threads token refresh failed");
}

function toTokenResult(
  data: Record<string, unknown>,
  label: string,
): { accessToken: string; expiresInSec: number } {
  const accessToken =
    typeof data.access_token === "string" ? data.access_token : "";
  const expiresInSec =
    typeof data.expires_in === "number" ? data.expires_in : 0;
  if (!accessToken || expiresInSec <= 0) {
    throw new Error(`${label}: unexpected response shape`);
  }
  return { accessToken, expiresInSec };
}

// ---- 投稿 (コンテナ作成 → publish の 2 段階) ----

// 公式ドキュメントは publish 前に「平均 30 秒」の待機を推奨している。
// 固定待機ではなくコンテナの status を見に行き、上限をその 30 秒に取る。
const CONTAINER_POLL_INTERVAL_MS = 2_000;
const CONTAINER_POLL_MAX = 15;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Threads API は access_token をパラメータで受け取る流儀 (公式 curl 例)。
// Bearer ヘッダも解釈されるが、ドキュメントに合わせて両方送る。
async function postForm(
  path: string,
  token: string,
  params: Record<string, string>,
  label: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${THREADS_GRAPH}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return parseJsonResponse(res, label);
}

// GET 系も同様。URL に token が載るのでこの URL はログへ出さないこと。
async function getGraph(
  path: string,
  token: string,
  fields: string,
  label: string,
): Promise<Record<string, unknown>> {
  const url = new URL(`${THREADS_GRAPH}${path}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonResponse(res, label);
}

function requireId(data: Record<string, unknown>, label: string): string {
  const id = data.id != null ? String(data.id) : "";
  if (!id) throw new Error(`${label}: no id in response`);
  return id;
}

// 画像 + 本文のメディアコンテナを作る。alt_text は上限 1000 字。
export async function createImageContainer(
  userId: string,
  token: string,
  params: {
    imageUrl: string;
    text: string;
    altText?: string;
    topicTag?: string;
  },
): Promise<string> {
  const body: Record<string, string> = {
    media_type: "IMAGE",
    image_url: params.imageUrl,
    text: params.text,
  };
  if (params.altText) body.alt_text = params.altText.slice(0, 1000);
  // topic_tag は # なし・1〜50 文字。ぶら下げる URL リプライには付けない
  // (1 スレッドにつき本体ポストのタグだけで足りる)。
  if (params.topicTag) body.topic_tag = params.topicTag.slice(0, 50);
  const data = await postForm(
    `/v1.0/${userId}/threads`,
    token,
    body,
    "threads image container failed",
  );
  return requireId(data, "threads image container failed");
}

// 既存ポストへのテキスト返信コンテナ (URL のぶら下げに使う)。
export async function createReplyTextContainer(
  userId: string,
  token: string,
  params: { text: string; replyToId: string },
): Promise<string> {
  const data = await postForm(
    `/v1.0/${userId}/threads`,
    token,
    {
      media_type: "TEXT",
      text: params.text,
      reply_to_id: params.replyToId,
    },
    "threads reply container failed",
  );
  return requireId(data, "threads reply container failed");
}

// コンテナの処理完了を待つ。画像は通常すぐ FINISHED になる。
export async function waitForContainerReady(
  containerId: string,
  token: string,
): Promise<void> {
  for (let i = 0; i < CONTAINER_POLL_MAX; i++) {
    const data = await getGraph(
      `/v1.0/${containerId}`,
      token,
      "status,error_message",
      "threads container status failed",
    );
    const status = typeof data.status === "string" ? data.status : "";
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      const message =
        typeof data.error_message === "string" ? data.error_message : status;
      throw new Error(`threads container failed: ${message}`);
    }
    await sleep(CONTAINER_POLL_INTERVAL_MS);
  }
  throw new Error("threads container failed: timed out waiting FINISHED");
}

// コンテナを publish してメディア ID を得る。
export async function publishContainer(
  userId: string,
  token: string,
  creationId: string,
): Promise<string> {
  const data = await postForm(
    `/v1.0/${userId}/threads_publish`,
    token,
    { creation_id: creationId },
    "threads publish failed",
  );
  return requireId(data, "threads publish failed");
}

// 公開ポストの permalink。失敗しても致命ではないので caller 側で catch する。
export async function fetchPostPermalink(
  mediaId: string,
  token: string,
): Promise<string | null> {
  const data = await getGraph(
    `/v1.0/${mediaId}`,
    token,
    "permalink",
    "threads permalink fetch failed",
  );
  return typeof data.permalink === "string" ? data.permalink : null;
}

// ---- 公開後の運用 (返信・表示回数・削除) ----

export type ThreadsReply = {
  id: string;
  text: string;
  username: string | null;
  permalink: string | null;
  timestamp: string | null;
  isReplyOwnedByMe: boolean;
};

const REPLY_FIELDS =
  "id,text,username,permalink,timestamp,is_reply_owned_by_me,has_replies";

// あるポストに付いた返信。conversation は深さに関係なく全返信を平坦化
// して返すので、スレッド全体を一覧するこの用途に合う (replies だと
// トップレベルのみ)。chronological (reverse=false) で古い順。
export async function fetchPostReplies(
  mediaId: string,
  token: string,
): Promise<ThreadsReply[]> {
  const url = new URL(`${THREADS_GRAPH}/v1.0/${mediaId}/conversation`);
  url.searchParams.set("fields", REPLY_FIELDS);
  url.searchParams.set("reverse", "false");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(res, "threads replies fetch failed");
  const list = Array.isArray(data.data) ? data.data : [];
  return list.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      text: typeof r.text === "string" ? r.text : "",
      username: typeof r.username === "string" ? r.username : null,
      permalink: typeof r.permalink === "string" ? r.permalink : null,
      timestamp: typeof r.timestamp === "string" ? r.timestamp : null,
      isReplyOwnedByMe: r.is_reply_owned_by_me === true,
    };
  });
}

// 表示回数。views は Meta 側で "in development" 扱いのメトリクスなので、
// 取れないことがあっても致命ではない (呼び出し側で null 表示)。
export async function fetchPostViews(
  mediaId: string,
  token: string,
): Promise<number | null> {
  const url = new URL(`${THREADS_GRAPH}/v1.0/${mediaId}/insights`);
  url.searchParams.set("metric", "views");
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonResponse(res, "threads insights fetch failed");
  const list = Array.isArray(data.data) ? data.data : [];
  for (const raw of list) {
    const entry = raw as Record<string, unknown>;
    if (entry.name !== "views") continue;
    // views は単一値 (total_value.value) で返る。
    const total = entry.total_value as Record<string, unknown> | undefined;
    if (typeof total?.value === "number") return total.value;
    const values = Array.isArray(entry.values) ? entry.values : [];
    const first = values[0] as Record<string, unknown> | undefined;
    if (typeof first?.value === "number") return first.value;
  }
  return null;
}

// 自分のポスト (または返信) を削除する。アカウントあたり 100 件/日。
export async function deleteThreadsMedia(
  mediaId: string,
  token: string,
): Promise<void> {
  const url = new URL(`${THREADS_GRAPH}/v1.0/${mediaId}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  await parseJsonResponse(res, "threads delete failed");
}

// トークンの持ち主のプロフィール。接続確認・手動トークン検証に使う。
export async function fetchThreadsProfile(
  token: string,
): Promise<{ id: string; username: string | null }> {
  const data = await getGraph(
    "/v1.0/me",
    token,
    "id,username",
    "threads profile fetch failed",
  );
  const id = data.id != null ? String(data.id) : "";
  if (!id) throw new Error("threads profile fetch failed: no id");
  return {
    id,
    username: typeof data.username === "string" ? data.username : null,
  };
}
