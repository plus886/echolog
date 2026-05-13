// View Transitions API ナビゲーション中は OLD ページ (home) の snapshot が
// 見えているため、ここで skeleton bar / border を描くと NEW snapshot として
// 一瞬挟まり「枠線のフラッシュ」になる。レイアウト寸法だけ確保した空の
// article を返し、視覚的には何も挟まないようにする。
// 直接 URL 叩きの場合も、microCMS のレスポンスはたいてい速いので、
// 短時間の空白で十分。
export default function Loading() {
  return (
    <article
      aria-busy="true"
      aria-live="polite"
      className="mx-auto mt-40 mb-24 w-full max-w-[844px] px-6 min-[880px]:px-10"
    />
  );
}
