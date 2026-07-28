// 台湾時間 (UTC+8 固定・DST なし) の表示/入力ヘルパ。server・client 両方
// から使う純関数のみ (Intl のタイムゾーン DB に依存せず単純オフセットで
// 変換できるのは +8 固定だから)。

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

// "7/29 21:05" 形式 (台湾時間)。一覧のバッジ・ダッシュボード表示用。
export function formatTaipei(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t + TAIPEI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// <input type="datetime-local"> 用の値 ("YYYY-MM-DDTHH:mm"、台湾時間)。
export function isoToTaipeiInput(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + TAIPEI_OFFSET_MS).toISOString().slice(0, 16);
}

// datetime-local の値 (台湾時間) → UTC ISO。不正なら null。
export function taipeiInputToIso(value: string): string | null {
  const t = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(t)) return null;
  return new Date(t - TAIPEI_OFFSET_MS).toISOString();
}
