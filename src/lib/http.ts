// API ルート / webhook 共通の HTTP ヘルパー。

// JSON Response を組み立てる。Content-Type を付け、呼び出し側の init を尊重。
export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

// SSR ページ共通の edge cache ポリシー。s-maxage=3600 で Cloudflare edge に
// 1 時間 cache し、stale-while-revalidate=86400 で 1 日間は古い HTML を返し
// つつ裏で再生成する (旧 Next.js の ISR revalidate=3600 相当)。
export function setEdgeCache(response: Response): void {
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
}
