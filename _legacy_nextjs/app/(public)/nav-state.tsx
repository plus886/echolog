"use client";

import { usePathname } from "next/navigation";

import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

// pathname に応じて .k-shell の .is-scrolled を管理する。
// - "/" (home): ScrollWordmark と ScrollMemory に任せて何もしない。
// - それ以外 (/tweets/[id] など): nav を常時表示したいので .is-scrolled
//   を付与する。初回 attach 時に nav の slide-in animation が発火しない
//   よう、.no-shell-transitions を一瞬挟んでから外す。
export function NavState() {
  const pathname = usePathname();

  useIsoLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;
    if (pathname === "/") return;
    if (shell.classList.contains("is-scrolled")) return;

    shell.classList.add("no-shell-transitions");
    shell.classList.add("is-scrolled");
    const t = setTimeout(() => {
      shell.classList.remove("no-shell-transitions");
    }, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
