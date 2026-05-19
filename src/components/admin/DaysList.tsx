import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";

import { DayRow } from "@/components/admin/DayRow";
import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import type { Day } from "@/types/microcms";

// days のページング一覧。文章管理タブの主要部。
// ページサイズ 30 / 50 / 100、お気に入り (featured) 状態での絞り込み。
// 再生成後はそのページを再取得して反映する。

const PAGE_SIZES = [30, 50, 100] as const;
type ListState = "loading" | "ready" | "error";
type FavoriteFilter = "all" | "featured" | "unfeatured";

const FAVORITE_OPTIONS: readonly [FavoriteFilter, string][] = [
  ["all", "すべて"],
  ["featured", "お気に入りのみ"],
  ["unfeatured", "未お気に入りのみ"],
];

export function DaysList({ model }: { model: PassageModelChoice }) {
  const [pageSize, setPageSize] = useState<number>(30);
  const [page, setPage] = useState(0); // 0 始まり
  const [favorite, setFavorite] = useState<FavoriteFilter>("all");
  const [days, setDays] = useState<Day[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<ListState>("loading");

  const fetchPage = useCallback(
    async (p: number, size: number, fav: FavoriteFilter) => {
      setState("loading");
      const res = await actions.listDaysPage({
        offset: p * size,
        limit: size,
        favorite: fav,
      });
      if (res.error || !res.data) {
        setState("error");
        return;
      }
      setDays(res.data.days);
      setTotal(res.data.total);
      setState("ready");
    },
    [],
  );

  useEffect(() => {
    void fetchPage(page, pageSize, favorite);
  }, [page, pageSize, favorite, fetchPage]);

  const refetch = useCallback(() => {
    void fetchPage(page, pageSize, favorite);
  }, [fetchPage, page, pageSize, favorite]);

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-sm font-semibold">写真一覧</h2>
        <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          表示件数
          <select
            className="select select-sm select-bordered"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          お気に入り
          <select
            className="select select-sm select-bordered"
            value={favorite}
            onChange={(e) => {
              setFavorite(e.target.value as FavoriteFilter);
              setPage(0);
            }}
          >
            {FAVORITE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm opacity-60">
          {from}–{to} / {total}
        </span>
      </div>

      {state === "error" ? (
        <div className="alert alert-error text-sm">
          <span>一覧の取得に失敗しました。</span>
          <button type="button" className="btn btn-sm" onClick={refetch}>
            再試行
          </button>
        </div>
      ) : state === "loading" ? (
        <p className="m-0 py-6 text-center text-sm opacity-60">読み込み中…</p>
      ) : days.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm opacity-60">
          写真がありません。
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((day) => (
            <DayRow key={day.id} day={day} model={model} onChanged={refetch} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-sm"
          disabled={page <= 0 || state === "loading"}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          ← 前
        </button>
        <span className="text-sm opacity-60">
          {page + 1} / {lastPage + 1}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={page >= lastPage || state === "loading"}
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
        >
          次 →
        </button>
      </div>
    </section>
  );
}

export default DaysList;
