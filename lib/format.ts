import { format, formatDistanceToNow, isThisYear, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export function formatTweetTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ja });
  }
  if (isThisYear(date)) {
    return format(date, "M月d日 HH:mm", { locale: ja });
  }
  return format(date, "yyyy年M月d日", { locale: ja });
}
