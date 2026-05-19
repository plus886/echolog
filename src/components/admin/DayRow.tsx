import { actions } from "astro:actions";
import { useState } from "react";

import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { RegenerateDialog } from "@/components/admin/RegenerateDialog";
import type { Day } from "@/types/microcms";

// days 一覧の 1 行 (DaisyUI card)。サムネイル + passageJa/Zh +
// お気に入りトグル + 再生成ボタン。

type Props = {
  day: Day;
  model: PassageModelChoice;
  // 再生成成功時に一覧を再取得させるためのコールバック。
  onChanged: () => void;
};

export function DayRow({ day, model, onChanged }: Props) {
  const [featured, setFeatured] = useState(Boolean(day.featured));
  const [favBusy, setFavBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleFavorite = async () => {
    if (favBusy) return;
    const next = !featured;
    setFeatured(next); // 楽観更新
    setFavBusy(true);
    const res = await actions.setDayFeatured({ id: day.id, featured: next });
    setFavBusy(false);
    if (res.error) {
      setFeatured(!next); // 失敗 → 元に戻す
    }
  };

  return (
    <div className="card card-border bg-base-100">
      {/* 縦積み: 上段にサムネイル + 操作ボタン、下段に passage を全幅で。
          card-body は既定で flex-col。横並びにすると狭幅で本文が
          1 文字幅に潰れるため縦積みにする。 */}
      <div className="card-body gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* サムネイルは本番ギャラリーの該当ページへのリンク */}
          <a
            href={`https://photo.kokaiji.tw/days/${day.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex-none"
          >
            <img
              src={`${day.image.url}?w=160&fm=webp`}
              alt=""
              className="h-14 w-14 rounded-md object-cover"
            />
          </a>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void toggleFavorite()}
            disabled={favBusy}
            aria-pressed={featured}
            aria-label="お気に入り"
            className={`btn btn-ghost btn-sm btn-circle text-lg ${
              featured ? "text-amber-500" : "text-base-content/40"
            }`}
          >
            {featured ? "★" : "☆"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDialogOpen(true)}
          >
            再生成
          </button>
        </div>

        <p className="m-0 text-sm whitespace-pre-wrap">
          <span className="opacity-50">JA</span>{" "}
          {day.passageJa || <span className="opacity-50">（未生成）</span>}
        </p>
        <p className="m-0 text-sm whitespace-pre-wrap">
          <span className="opacity-50">ZH</span>{" "}
          {day.passageZh || <span className="opacity-50">（未生成）</span>}
        </p>
      </div>

      {dialogOpen && (
        <RegenerateDialog
          day={{ id: day.id, imageUrl: day.image.url }}
          model={model}
          onClose={() => setDialogOpen(false)}
          onRegenerated={onChanged}
        />
      )}
    </div>
  );
}

export default DayRow;
