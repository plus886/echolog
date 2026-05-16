import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

// Astro Island。
//
// 毎回 full page navigation で本コンポーネントは新規 mount されるため、
// useIsoLayoutEffect の依存は [] で十分 — mount 時に 1 度だけ
// window.location.pathname を読めば足りる。(phase 5 で <ClientRouter /> を
// 入れたら astro:after-swap を listen して再評価する想定。)
//
// 役割: pathname に応じて .k-shell の .is-scrolled を管理する。
//  - "/" (home): ScrollWordmark と ScrollMemory に任せて何もしない。
//  - それ以外 (/tweets/[id] など): nav を常時表示したいので .is-scrolled
//    を付与する。slide-in animation を抑止するため .no-shell-transitions
//    を一瞬挟む。
export function NavState() {
  useIsoLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    const pathname = window.location.pathname;
    if (pathname === "/") return;
    if (shell.classList.contains("is-scrolled")) return;

    shell.classList.add("no-shell-transitions");
    shell.classList.add("is-scrolled");
    const t = setTimeout(() => {
      shell.classList.remove("no-shell-transitions");
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return null;
}

export default NavState;
