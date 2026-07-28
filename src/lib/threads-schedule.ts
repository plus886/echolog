// Threads 予約投稿のスロット割当。台湾時間 (UTC+8 固定・DST なし) の
// 20:00–22:00 のどこかにランダムで置き、同日は 60 分以上あける。1 日 2 件が
// 上限で、埋まっていれば翌日以降へ繰り越す。副作用のない純関数なので
// テストしやすく、cron でも action でも同じ結果になる。

const TAIPEI_OFFSET_MIN = 8 * 60;
const WINDOW_START_HOUR = 20; // 台湾時間 20:00
const WINDOW_MINUTES = 120; // 20:00–22:00 (両端含む)
const MIN_GAP_MS = 60 * 60 * 1000; // 同日 2 件目は 60 分以上あける
export const MAX_POSTS_PER_DAY = 2;
const SEARCH_DAYS = 400; // 繰り越しの探索上限 (事実上の無限ループ防止)

// UTC ミリ秒 → 台湾時間の日付キー ("YYYY-MM-DD")。
export function taipeiDateKey(utcMs: number): string {
  return new Date(utcMs + TAIPEI_OFFSET_MIN * 60_000)
    .toISOString()
    .slice(0, 10);
}

// 台湾時間の日付 + 枠内の分位置 → UTC ミリ秒。
function slotToUtcMs(dateKey: string, minuteInWindow: number): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const localMs =
    Date.UTC(y, m - 1, d, WINDOW_START_HOUR) + minuteInWindow * 60_000;
  return localMs - TAIPEI_OFFSET_MIN * 60_000;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 既存の予約時刻 (UTC ISO) を踏まえて次の空き枠を返す。翌日から順に探し、
// 「その日の件数 < 2」かつ「既存すべてと 60 分以上あく」分を候補にして
// ランダムに 1 つ選ぶ。手動で枠外へ動かされた予約も、件数・間隔の判定には
// 同じように参加する (ダッシュボードで日時を編集できるため)。
export function pickScheduleSlot(
  existingIso: readonly string[],
  nowMs: number,
): string {
  const existing = existingIso
    .map((iso) => Date.parse(iso))
    .filter((t) => Number.isFinite(t));
  const todayKey = taipeiDateKey(nowMs);

  for (let offset = 1; offset <= SEARCH_DAYS; offset++) {
    const dateKey = addDays(todayKey, offset);
    const sameDay = existing.filter((t) => taipeiDateKey(t) === dateKey);
    if (sameDay.length >= MAX_POSTS_PER_DAY) continue;

    const allowed: number[] = [];
    for (let minute = 0; minute <= WINDOW_MINUTES; minute++) {
      const ms = slotToUtcMs(dateKey, minute);
      if (ms <= nowMs) continue;
      if (existing.every((t) => Math.abs(t - ms) >= MIN_GAP_MS)) {
        allowed.push(minute);
      }
    }
    if (allowed.length === 0) continue;

    const picked = allowed[Math.floor(Math.random() * allowed.length)];
    return new Date(slotToUtcMs(dateKey, picked)).toISOString();
  }

  throw new Error("空き枠が見つかりませんでした");
}
