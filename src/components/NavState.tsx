import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

// Astro Island。旧 app/(public)/nav-state.tsx の移植。
//
// 旧版は usePathname() (next/navigation) で reactive に pathname を購読し、
// SPA 風遷移でも追従できた。Astro phase 3 段階では <ClientRouter /> を
// まだ入れていないため、毎回 full page navigation で本コンポーネントは
// 新規 mount される。よって useIsoLayoutEffect の依存は [] で十分で、
// mount 時に 1 度だけ window.location.pathname を読めば足りる。
// (phase 5 で <ClientRouter /> を入れたときは astro:after-swap イベント
// を listen して再評価するパターンに切り替える想定。)
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
