// 決定論的 PRNG + 文字列ハッシュ。gallery レイアウト / compose で seed
// 固定の乱数として使う (同じ seed なら同じ結果)。

// mulberry32 PRNG (https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// djb2-xor 風の決定論的文字列ハッシュ。tweet id を seed に変換する用。
export function hashStringToSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}
