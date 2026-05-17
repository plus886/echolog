import { getAdminTweet } from "@/lib/microcms-management";
import type { AdminTweet } from "@/types/microcms";

// admin 一覧をスレッド化する server 専用ヘルパ。
// recent 一覧を起点に parent を root まで辿り (不足分の祖先は fetch)、
// スレッドの森を組む。子孫側は recent 一覧に含まれる範囲のみ。

export type ThreadNode = {
  tweet: AdminTweet;
  depth: number;
  children: ThreadNode[];
};

// 祖先 fetch の暴走を防ぐ上限。
const MAX_ANCESTOR_FETCHES = 60;

function timeOf(t: AdminTweet): number {
  const s = t.publishedAt ?? t.createdAt ?? t.updatedAt;
  return s ? new Date(s).getTime() : 0;
}

export async function buildThreads(
  tweets: AdminTweet[],
): Promise<ThreadNode[]> {
  const byId = new Map<string, AdminTweet>();
  for (const t of tweets) byId.set(t.id, t);

  // 祖先解決: parent.id が未取得なら fetch、その親も…と root まで遡る。
  const queue: string[] = [];
  for (const t of tweets) {
    if (t.parent && !byId.has(t.parent.id)) queue.push(t.parent.id);
  }
  let fetched = 0;
  while (queue.length > 0 && fetched < MAX_ANCESTOR_FETCHES) {
    const id = queue.shift();
    if (!id || byId.has(id)) continue;
    fetched += 1;
    try {
      const anc = await getAdminTweet(id);
      byId.set(anc.id, anc);
      if (anc.parent && !byId.has(anc.parent.id)) queue.push(anc.parent.id);
    } catch {
      // 取得失敗したチェーンはそこで途切れ、子が root 扱いになる。
    }
  }

  // 森を組む。parent が解決できないツイートは root。
  const childrenOf = new Map<string, AdminTweet[]>();
  const roots: AdminTweet[] = [];
  for (const t of byId.values()) {
    const pid = t.parent?.id;
    if (pid && byId.has(pid)) {
      const arr = childrenOf.get(pid);
      if (arr) arr.push(t);
      else childrenOf.set(pid, [t]);
    } else {
      roots.push(t);
    }
  }

  const seen = new Set<string>();
  const build = (t: AdminTweet, depth: number): ThreadNode => {
    seen.add(t.id);
    const kids = (childrenOf.get(t.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort((a, b) => timeOf(a) - timeOf(b)); // スレッド内は古い順
    return {
      tweet: t,
      depth,
      children: kids.map((c) => build(c, depth + 1)),
    };
  };
  const nodes = roots.map((r) => build(r, 0));

  // スレッドはその中の最新ツイート時刻で降順 (活動が新しい順)。
  const latest = (n: ThreadNode): number => {
    let m = timeOf(n.tweet);
    for (const c of n.children) m = Math.max(m, latest(c));
    return m;
  };
  return nodes.sort((a, b) => latest(b) - latest(a));
}

// スレッド化しない一覧 (下書き等) を ThreadNode[] の形に揃える。
export function flatThreads(tweets: AdminTweet[]): ThreadNode[] {
  return tweets.map((t) => ({ tweet: t, depth: 0, children: [] }));
}
