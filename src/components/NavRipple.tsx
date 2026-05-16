import type { FocusEvent, MouseEvent } from "react";

// Nav・KO KAIJI ワードマークで共有する per-character opacity ripple。
// label の各文字を .k-nav-char で包み、mouseenter / focus 時に
// cursor の x 座標との距離に応じた --ripple-delay を仕込んで
// .is-rippling class を一瞬付与する。CSS 側 (portfolio.css) で
// k-ripple-dip animation (opacity 1 → 0.2 → 1) が流れる。

export function RippleLabel({ children }: { children: string }) {
  return (
    <span className="k-nav-text">
      {[...children].map((ch, i) => (
        <span key={i} className="k-nav-char">
          {/* スペース 1 文字だけだと inline-block の whitespace collapsing
              で 0 幅に潰れるため NBSP に置換。"KO KAIJI" の間隔保持。 */}
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export function dispatchRipple(link: HTMLElement, originX: number) {
  const chars = link.querySelectorAll<HTMLElement>(".k-nav-char");
  chars.forEach((c) => {
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const d = Math.abs(cx - originX);
    c.style.setProperty("--ripple-delay", `${d * 5}ms`);
    c.classList.remove("is-rippling");
    void c.offsetWidth;
    c.classList.add("is-rippling");
  });
}

export const onRippleEnter = (e: MouseEvent<HTMLElement>) => {
  dispatchRipple(e.currentTarget, e.clientX);
};

export const onRippleFocus = (e: FocusEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  dispatchRipple(e.currentTarget, r.left);
};
