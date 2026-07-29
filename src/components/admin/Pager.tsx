import { useEffect, useState } from "react";

import { Button, cx } from "@/components/admin/ui";

// ページ番号付きのページャ。前後 1 ページずつしか動けないと、529 件を
// 30 件ずつ見る運用では目的のページに辿り着けないため、番号ボタン +
// 最初/最後 + 直接入力を用意する。
//
// 番号は現在ページの前後 2 つまでを出し、離れたところは省略記号にする
// (…, 1 … 7 8 [9] 10 11 … 18)。狭い画面でも折り返さない程度の個数。

const SIBLINGS = 2;

// 表示するページ番号 (0 始まり)。null は省略記号。
function pageItems(page: number, lastPage: number): (number | null)[] {
  if (lastPage <= 0) return [0];
  const items: (number | null)[] = [];
  const start = Math.max(0, page - SIBLINGS);
  const end = Math.min(lastPage, page + SIBLINGS);

  if (start > 0) {
    items.push(0);
    if (start > 1) items.push(null);
  }
  for (let i = start; i <= end; i++) items.push(i);
  if (end < lastPage) {
    if (end < lastPage - 1) items.push(null);
    items.push(lastPage);
  }
  return items;
}

export function Pager({
  page,
  lastPage,
  disabled = false,
  onChange,
}: {
  page: number; // 0 始まり
  lastPage: number; // 0 始まりの最終ページ
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  // 直接入力は 1 始まりで扱う (表示と揃える)。ページ移動のたびに同期。
  const [jump, setJump] = useState(String(page + 1));
  useEffect(() => setJump(String(page + 1)), [page]);

  const go = (next: number) => {
    const clamped = Math.min(lastPage, Math.max(0, next));
    if (clamped !== page) onChange(clamped);
  };

  const submitJump = () => {
    const n = Number.parseInt(jump, 10);
    if (Number.isNaN(n)) {
      setJump(String(page + 1)); // 不正入力は現在ページに戻す
      return;
    }
    go(n - 1);
  };

  if (lastPage <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Button
        variant="neutral"
        className="btn-sm"
        disabled={disabled || page <= 0}
        onClick={() => go(0)}
        aria-label="最初のページ"
      >
        «
      </Button>
      <Button
        variant="neutral"
        className="btn-sm"
        disabled={disabled || page <= 0}
        onClick={() => go(page - 1)}
      >
        ← 前
      </Button>

      {pageItems(page, lastPage).map((item, i) =>
        item === null ? (
          <span key={`gap-${i}`} className="px-1 text-sm opacity-40">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant="neutral"
            className={cx("btn-sm", item === page && "btn-active")}
            disabled={disabled}
            aria-current={item === page ? "page" : undefined}
            onClick={() => go(item)}
          >
            {item + 1}
          </Button>
        ),
      )}

      <Button
        variant="neutral"
        className="btn-sm"
        disabled={disabled || page >= lastPage}
        onClick={() => go(page + 1)}
      >
        次 →
      </Button>
      <Button
        variant="neutral"
        className="btn-sm"
        disabled={disabled || page >= lastPage}
        onClick={() => go(lastPage)}
        aria-label="最後のページ"
      >
        »
      </Button>

      <form
        className="ml-2 flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          submitJump();
        }}
      >
        <input
          type="number"
          min={1}
          max={lastPage + 1}
          value={jump}
          disabled={disabled}
          onChange={(e) => setJump(e.target.value)}
          onBlur={submitJump}
          aria-label="ページ番号を指定"
          className="input input-sm input-bordered w-16"
        />
        <span className="text-sm opacity-60">/ {lastPage + 1}</span>
      </form>
    </div>
  );
}

export default Pager;
