import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";

import { DayRow } from "@/components/admin/DayRow";
import type { PassageModelChoice } from "@/components/admin/ModelRadio";
import { Button } from "@/components/admin/ui";
import type { Day } from "@/types/microcms";

// days のページング一覧。文章管理タブの主要部。
// ページサイズ 30 / 50 / 100、お気に入り (featured) 状態での絞り込み、
// ID での完全一致検索。各行 (DayRow) の編集・再生成は行内で完結し、
// 一覧の再取得は伴わない (ページ送り・フィルタ・検索・再試行時のみ取得)。

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
  // 検索ボックスの入力値 (query) と、確定した検索 ID (searchId) を分ける。
  // searchId が空でないあいだは ID 検索モード (favorite / ページング無効)。
  const [query, setQuery] = useState("");
  const [searchId, setSearchId] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<ListState>("loading");

  const fetchPage = useCallback(
    async (p: number, size: number, fav: FavoriteFilter, sid: string) => {
      setState("loading");
      const res = await actions.listDaysPage({
        offset: p * size,
        limit: size,
        favorite: fav,
        id: sid || undefined,
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
    void fetchPage(page, pageSize, favorite, searchId);
  }, [page, pageSize, favorite, searchId, fetchPage]);

  const refetch = useCallback(() => {
    void fetchPage(page, pageSize, favorite, searchId);
  }, [fetchPage, page, pageSize, favorite, searchId]);

  const searching = searchId !== "";
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
            disabled={searching}
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
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setSearchId(query.trim());
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ID で検索"
            className="input input-sm input-bordered w-40"
          />
          <Button variant="neutral" className="btn-sm" type="submit">
            検索
          </Button>
          {searching && (
            <Button
              variant="ghost"
              className="btn-sm"
              onClick={() => {
                setQuery("");
                setSearchId("");
                setPage(0);
              }}
            >
              クリア
            </Button>
          )}
        </form>
        <span className="text-sm opacity-60">
          {from}–{to} / {total}
        </span>
      </div>

      {state === "error" ? (
        <div className="alert alert-error text-sm">
          <span>一覧の取得に失敗しました。</span>
          <Button variant="neutral" className="btn-sm" onClick={refetch}>
            再試行
          </Button>
        </div>
      ) : state === "loading" ? (
        <p className="m-0 py-6 text-center text-sm opacity-60">読み込み中…</p>
      ) : days.length === 0 ? (
        <p className="m-0 py-6 text-center text-sm opacity-60">
          {searching
            ? `ID「${searchId}」の写真が見つかりません。`
            : "写真がありません。"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {days.map((day) => (
            <DayRow key={day.id} day={day} model={model} />
          ))}
        </div>
      )}

      {!searching && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="neutral"
            className="btn-sm"
            disabled={page <= 0 || state === "loading"}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← 前
          </Button>
          <span className="text-sm opacity-60">
            {page + 1} / {lastPage + 1}
          </span>
          <Button
            variant="neutral"
            className="btn-sm"
            disabled={page >= lastPage || state === "loading"}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            次 →
          </Button>
        </div>
      )}
    </section>
  );
}

export default DaysList;
