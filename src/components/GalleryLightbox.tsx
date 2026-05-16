import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useScrollLock } from "@/lib/use-scroll-lock";
import {
  supportsViewTransition,
  type ViewTransitionDocument,
} from "@/lib/view-transition";

// Astro Island。トップページ Gallery (index.astro) の写真を click すると
// 全 photo を横並びにした carousel + lightbox を開く。tweet 詳細で動いている
// QuoteImages と「単発 morph」だけ共通で、navigation 体験は別物 (本コンポは
// 上下スクロール → カルーセル横スライド)。
//
// QuoteImages との実装上の違い:
//   - サムネイル要素は Astro 側で <figure data-lightbox-photo
//     data-lightbox-src="..."> として静的に出力されている (React 管理外)。
//     よって click 検知は document への delegation、view-transition-name の
//     付与は thumbnail <img> への DOM 直接操作で行う。
//   - 同時に morph するのは1枚だけなので、VT name は単一 "gimg-active" を
//     使い回す (q 側のように qimg-N で per-index 確保しない)。
//   - open / close は VT、carousel の前後 navigation は CSS transform
//     transition だけ。snapshot のオーバーヘッドを毎スワップでは払わない。
//
// 共有点 (portfolio.css の VT ルール):
//   - gimg-active   → 写真の morph (qimg-0..7 と同じ duration/easing)
//   - gimg-overlay  → 背景フェード (qimg-overlay と同列の挙動)
//   - z-index は overlay を下、active を上に固定 (qimg- 側と同じ)

type Item = {
  // 元 <figure data-lightbox-photo>。前後 navigation の index lookup に使う。
  el: HTMLElement;
  src: string;
  alt: string;
  // 閉じる時に morph 戻す先 (sample に取り直さず元の <img> 参照を保持)
  thumbImg: HTMLImageElement;
  // microCMS Day の id (= 外部 gallery サイトの /days/:id slug)。
  // 右余白の外部リンク用にだけ使う。なければ link を出さない。
  id?: string;
};

type Session = {
  items: Item[];
  currentIdx: number;
};

// el から Item を組み立てる。open / 前後 navigation 両方で使う。
function buildItem(el: HTMLElement): Item | null {
  const thumbImg = el.querySelector<HTMLImageElement>("img");
  const src = el.dataset.lightboxSrc;
  if (!thumbImg || !src) return null;
  return {
    el,
    src,
    alt: thumbImg.alt ?? "",
    thumbImg,
    id: el.dataset.lightboxId || undefined,
  };
}

// 右余白に出す外部 gallery (https://photo.kokaiji.tw/days/:id/) のリンク先。
// id 未設定の item では link を出さない。
const GALLERY_BASE = "https://photo.kokaiji.tw/days";

// Lenis virtual-scroll callback の payload (型定義は library 側にあるが
// 直接 import する代わりに最小 shape だけ手書き)。
type VirtualScrollPayload = { deltaY?: number };

const VT_NAME = "gimg-active";
const SELECTOR = "[data-lightbox-photo]";

// 何 px 相当 scroll したら次の photo に snap するか。
const SNAP_THRESHOLD = 80;
// Carousel slide 演出時間。CSS transition と navigation cooldown の両方で参照。
const SLIDE_DURATION_MS = 600;

export function GalleryLightbox() {
  const [session, setSession] = useState<Session | null>(null);
  // Slide animation 中フラグ。scroll cue の opacity を制御するためだけに
  // state にしている。SLIDE_DURATION_MS 経過後に setTimeout で false に戻す
  // (transitionend に頼らないのは img 側の transform/filter/opacity が
  // bubble してきて propertyName 判定が必要になるのを避けるため)。
  const [isSliding, setIsSliding] = useState(false);
  const slidingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);
  // 入力 (wheel / virtual-scroll) の累積。session の effect 再 attach を
  // またいで持続させたいので useRef で持つ。
  const accumRef = useRef(0);
  // 直近 navigate 成功時刻。SLIDE_DURATION_MS 経過するまで次の navigate
  // をブロックする (急発進・連続発火防止)。
  const lastNavigateAtRef = useRef(0);

  useScrollLock(session !== null);

  const open = useCallback((el: HTMLElement) => {
    if (isAnimatingRef.current) return;
    // 新しい session の最初は cue を見せたいので、前回 close 時に残っていた
    // sliding 状態を必ず初期化する。
    setIsSliding(false);
    if (slidingTimeoutRef.current !== null) {
      clearTimeout(slidingTimeoutRef.current);
      slidingTimeoutRef.current = null;
    }
    // gallery 内の photo を DOM 順で全部集める ([data-lightbox-photo] が
    // ついていない quote は自動で除外される)。
    const allEls = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
    const items = allEls.map(buildItem).filter((x): x is Item => x !== null);
    const currentIdx = items.findIndex((it) => it.el === el);
    if (currentIdx < 0) return;
    const newSession: Session = { items, currentIdx };
    if (!supportsViewTransition()) {
      setSession(newSession);
      return;
    }
    isAnimatingRef.current = true;
    const thumbImg = items[currentIdx].thumbImg;
    // OLD snapshot: thumbnail だけが VT_NAME を持つ。
    thumbImg.style.viewTransitionName = VT_NAME;
    const doc = document as ViewTransitionDocument;
    const t = doc.startViewTransition!(() => {
      // NEW snapshot 前: thumbnail から外し、carousel を mount。
      // carousel 側 current slide の <img> は React render で VT_NAME を持つ。
      thumbImg.style.viewTransitionName = "";
      flushSync(() => setSession(newSession));
    });
    const cleanup = () => {
      isAnimatingRef.current = false;
    };
    t.finished?.then(cleanup).catch(cleanup);
  }, []);

  const close = useCallback(() => {
    if (isAnimatingRef.current || !session) return;
    const item = session.items[session.currentIdx];
    if (!item) return;

    // Lightbox 内で navigate した結果、戻り先 thumbnail が画面外にいる
    // ことがあるので、close VT を起動する前に page scroll を合わせて
    // thumbnail を viewport 中央付近に持ってくる。overlay は fixed なので
    // この scroll 自体は user の目に触れない (immediate scroll で一瞬)。
    // VT は scrollTo 後に startViewTransition するため、NEW snapshot の
    // thumbnail 位置は新 scroll 反映後の位置になり、morph が画面内に着地する。
    const rect = item.el.getBoundingClientRect();
    const VISIBLE_MARGIN = 80;
    const alreadyVisible =
      rect.top >= VISIBLE_MARGIN &&
      rect.bottom <= window.innerHeight - VISIBLE_MARGIN;
    if (!alreadyVisible) {
      const targetY =
        window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2;
      const lenis = window.__lenis;
      if (lenis) {
        // lifecycle effect で stop されているので、scrollTo を効かせるために
        // 一度 start しておく (effect cleanup で再度 start するが idempotent)。
        lenis.start();
        lenis.scrollTo(targetY, { immediate: true });
      } else {
        window.scrollTo({ top: Math.max(0, targetY), behavior: "auto" });
      }
    }

    if (!supportsViewTransition()) {
      setSession(null);
      return;
    }
    isAnimatingRef.current = true;
    const thumbImg = item.thumbImg;
    const doc = document as ViewTransitionDocument;
    const t = doc.startViewTransition!(() => {
      // NEW snapshot 前: carousel を unmount + 戻り先 thumbnail に VT_NAME。
      flushSync(() => setSession(null));
      thumbImg.style.viewTransitionName = VT_NAME;
    });
    const cleanup = () => {
      thumbImg.style.viewTransitionName = "";
      isAnimatingRef.current = false;
    };
    t.finished?.then(cleanup).catch(cleanup);
  }, [session]);

  // session 内 navigation。currentIdx を ±1 して再 render → CSS transition
  // が transform を slide させる。VT は呼ばない (snapshot のオーバーヘッド
  // を毎 swap で払わない)。同時に scroll cue を一旦隠し、SLIDE_DURATION_MS
  // 経過後に表示状態に戻す (cue の opacity transition は隠す: 速く / 出す:
  // ゆっくり に分けてあるので、戻りが余韻として効く)。
  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (!session) return;
      const nextIdx = session.currentIdx + direction;
      if (nextIdx < 0 || nextIdx >= session.items.length) return;
      setIsSliding(true);
      setSession({ items: session.items, currentIdx: nextIdx });
      if (slidingTimeoutRef.current !== null) {
        clearTimeout(slidingTimeoutRef.current);
      }
      slidingTimeoutRef.current = setTimeout(() => {
        setIsSliding(false);
        slidingTimeoutRef.current = null;
      }, SLIDE_DURATION_MS);
    },
    [session],
  );

  // Unmount で setTimeout を残さない。
  useEffect(
    () => () => {
      if (slidingTimeoutRef.current !== null) {
        clearTimeout(slidingTimeoutRef.current);
        slidingTimeoutRef.current = null;
      }
    },
    [],
  );

  // 全 [data-lightbox-photo] への click delegation。
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        SELECTOR,
      );
      if (!el) return;
      e.preventDefault();
      open(el);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  // Esc / 矢印キー / wheel-driven carousel navigation。背景スクロールの
  // ロックは useScrollLock が担当する。
  // Lenis は stop しても virtual-scroll event は input ベースで fire し続ける
  // ので、その deltaY を accumulate して SNAP_THRESHOLD を超えた瞬間に前後へ
  // navigate する。
  useEffect(() => {
    if (!session) return;
    accumRef.current = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") navigate(1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") navigate(-1);
    };
    document.addEventListener("keydown", onKey);

    const lenis = window.__lenis;

    const tryNavigate = (deltaY: number) => {
      // slide 中はクールダウン: 入力を捨てて accum も 0 にしておく。
      if (Date.now() - lastNavigateAtRef.current < SLIDE_DURATION_MS) {
        accumRef.current = 0;
        return;
      }
      accumRef.current += deltaY;
      if (Math.abs(accumRef.current) < SNAP_THRESHOLD) return;
      const dir: 1 | -1 = accumRef.current > 0 ? 1 : -1;
      accumRef.current = 0;
      lastNavigateAtRef.current = Date.now();
      navigate(dir);
    };

    let detachScroll: () => void;
    if (lenis) {
      const off = lenis.on("virtual-scroll", (info: VirtualScrollPayload) => {
        if (typeof info.deltaY === "number") tryNavigate(info.deltaY);
      });
      detachScroll = () => off();
    } else {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        tryNavigate(e.deltaY);
      };
      window.addEventListener("wheel", onWheel, { passive: false });
      detachScroll = () => window.removeEventListener("wheel", onWheel);
    }

    return () => {
      detachScroll();
      document.removeEventListener("keydown", onKey);
    };
  }, [session, close, navigate]);

  if (!session) return null;
  const { items, currentIdx } = session;
  const N = items.length;

  // cue 共通スタイル。slide 中は素早く隠し、止まったらゆっくり戻す非対称
  // transition。top / bottom / 左右リンクの全てで同じ計算を使うので外で構築。
  // scale 300ms も列挙しておくのは、左右マージンの文字ボタンに hover:scale-105
  // を当てた時に inline transition が Tailwind の class transition を上書き
  // して animate しなくなるのを防ぐため (cue 自身は scale を使わないので無害)。
  const cueStyle: CSSProperties = {
    opacity: isSliding ? 0 : 1,
    transition: isSliding
      ? "opacity 120ms ease-out, scale 300ms ease-out"
      : "opacity 400ms ease-out, scale 300ms ease-out",
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-(--paper) p-8"
      style={{ viewTransitionName: "gimg-overlay" } as CSSProperties}
    >
      {/* Carousel は overlay 全体を viewport にして slide させる (= アニメ
          ーションは画面の縦幅すべてを使う)。各 slide は overlay 内の 1 画面
          分の高さ。slide 中に画像が画面端まで流れていく見え方になる。 */}
      <div
        className="flex w-full flex-col"
        style={{
          height: `${N * 100}%`,
          transform: `translateY(${-currentIdx * (100 / N)}%)`,
          transition: `transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.85, 0.09, 0.15, 0.91)`,
        }}
      >
        {items.map((item, idx) => {
          const isCurrent = idx === currentIdx;

          // Scale + blur + opacity の複合パララックス。current 以外を
          // 「奥でぼんやり」状態にしておき、slide の transform と同じ
          // duration で 3 つを同期して transition させる。slide 中、出ていく
          // 写真は scale↓ + blur↑ + opacity↓ (奥に下がる)、入ってくる写真は
          // 逆方向 (前に出てフォーカス) で動く。
          const SCALE_REST = 0.7;
          const BLUR_PX_REST = 36;
          const OPACITY_REST = 0.3;
          const ease = "cubic-bezier(0.85, 0.09, 0.15, 1)";
          const imgStyle: CSSProperties = {
            transform: isCurrent ? "scale(1)" : `scale(${SCALE_REST})`,
            filter: isCurrent ? "blur(0)" : `blur(${BLUR_PX_REST}px)`,
            opacity: isCurrent ? 1 : OPACITY_REST,
            transition: [
              `transform ${SLIDE_DURATION_MS}ms ${ease}`,
              `filter ${SLIDE_DURATION_MS}ms ${ease}`,
              `opacity ${SLIDE_DURATION_MS}ms ${ease}`,
            ].join(", "),
          };
          if (isCurrent) imgStyle.viewTransitionName = VT_NAME;

          return (
            <div
              key={idx}
              className="flex w-full flex-none items-center justify-center"
              style={{ height: `${100 / N}%` }}
            >
              {/* 画像は slide 中央寄せ。`max-h-[calc(100vh-12rem)]` で画像
                  の上下に 96px ずつの余白を確保する (overlay の p-8 32px +
                  cue の高さ 48px + マージン 16px ≒ 96px)。これで absolute
                  配置の scroll cue (top-6 / bottom-6 = 24px から ~72px) と
                  画像の bounding box が論理的に交わらない。
                  current の写真クリックで close。それ以外の slide の画像は
                  click 対象外 (navigate で current になってから click 可能)。 */}
              <img
                src={item.src}
                alt={item.alt}
                className={`block max-h-[calc(100vh-18rem)] max-w-full object-contain ${
                  isCurrent ? "cursor-zoom-out" : ""
                }`}
                onClick={isCurrent ? close : undefined}
                style={imgStyle}
              />
            </div>
          );
        })}
      </div>

      {/* Scroll cue: absolute 配置で overlay の上下端寄りに固定。画像側で
          max-h を絞ってあるので、cue の表示領域 (~24-72px 範囲) と画像の
          bounding box は決して重ならない。slide 中は opacity 0 で隠し、
          slide 後に fade in (隠す 120ms / 出す 400ms の非対称)。 */}
      {currentIdx > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-(--ink-50)"
          style={cueStyle}
        >
          <span
            className="animate-scroll-cue block h-6 w-px bg-current"
            style={{ transformOrigin: "bottom center" }}
          />
          <span className="text-[10px] tracking-[0.3em] lowercase">scroll</span>
        </div>
      )}
      {currentIdx < N - 1 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-(--ink-50)"
          style={cueStyle}
        >
          <span className="text-[10px] tracking-[0.3em] lowercase">scroll</span>
          <span className="animate-scroll-cue block h-6 w-px bg-current" />
        </div>
      )}

      {/* 右余白の gallery 外部リンク。現 item に id があれば
          https://photo.kokaiji.tw/days/:id/ に飛ばす。縦書きで right edge に
          固定し、scroll cue と同様 slide 中は opacity 0、止まったら fade in。
          target=_blank + noreferrer (外部ドメイン)。 */}
      {items[currentIdx]?.id && (
        <a
          href={`${GALLERY_BASE}/${items[currentIdx].id}/`}
          target="_blank"
          rel="noreferrer"
          className="absolute top-1/2 right-6 -translate-y-1/2 text-[11px] tracking-[0.3em] text-(--ink-30) uppercase no-underline [writing-mode:vertical-rl] hover:scale-105 hover:text-(--ink-50)"
          style={cueStyle}
        >
          (gallery / {items[currentIdx].id})
        </a>
      )}

      {/* 左余白の close ボタン。右の外部リンクと対称配置で sideways-lr
          (テキスト全体を -90° 回転)。スタイルは右側に揃える。 */}
      <button
        type="button"
        onClick={close}
        className="absolute top-1/2 left-6 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[11px] tracking-[0.3em] text-(--ink-30) uppercase [writing-mode:sideways-lr] hover:scale-105 hover:text-(--ink-50)"
        aria-label="Close lightbox"
        style={cueStyle}
      >
        (close)
      </button>
    </div>
  );
}

export default GalleryLightbox;
