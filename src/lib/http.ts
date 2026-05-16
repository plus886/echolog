// API ルート / webhook 共通の HTTP ヘルパー。

// JSON Response を組み立てる。Content-Type を付け、呼び出し側の init を尊重。
export const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
