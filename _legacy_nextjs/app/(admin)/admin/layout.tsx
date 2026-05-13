import { headers } from "next/headers";
import Link from "next/link";
import { Cormorant_Garamond, Inter_Tight } from "next/font/google";

import "../../(public)/portfolio.css";

// Admin chrome は public 側と同じ design token (paper bg、ink ink、明朝、
// 24-col grid helper) を共有する。.k-shell でラップしておけば、portfolio.css
// にスコープされたトークンが効くようになる。
// 一方で nav slide / wordmark pin / scroll-cue といった "演出" は admin では
// 使わないので、portfolio-nav 等は import しない。最小限のヘッダだけ自前で
// 描く。

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--k-font-sans",
  preload: false,
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300"],
  style: ["italic"],
  display: "swap",
  variable: "--k-font-serif",
  preload: false,
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const email = h.get("x-echolog-user-email") ?? "";
  const bypassed = h.get("x-echolog-bypassed") === "true";

  const shellClass = [
    "k-shell",
    interTight.variable,
    cormorant.variable,
    "relative min-h-screen overflow-x-hidden text-[15px] leading-[1.45] antialiased",
  ].join(" ");

  return (
    <div className={shellClass}>
      <header className="px-col-1 pt-9 pb-6">
        <div className="flex items-baseline justify-between gap-6 text-[12px] uppercase tracking-[0.1em]">
          <nav className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Link
              href="/admin"
              className="font-serif text-[15px] normal-case tracking-[0.02em] italic text-(--ink)"
            >
              echolog <span className="not-italic text-(--ink-50)">/ admin</span>
            </Link>
            <Link
              href="/admin"
              className="lowercase text-(--ink-70) transition-opacity hover:opacity-60"
            >
              compose
            </Link>
            <Link
              href="/admin/drafts"
              className="lowercase text-(--ink-70) transition-opacity hover:opacity-60"
            >
              drafts
            </Link>
            <Link
              href="/"
              className="lowercase text-(--ink-70) transition-opacity hover:opacity-60"
            >
              site
            </Link>
          </nav>
          <div className="flex items-baseline gap-3 text-[11px] normal-case tracking-normal text-(--ink-50)">
            {email && <span>{email}</span>}
            {bypassed && (
              <span className="border border-(--ink-30) px-2 py-0.5 uppercase tracking-[0.1em] italic text-(--ink-70)">
                bypass
              </span>
            )}
          </div>
        </div>
        <div className="mt-7 h-px bg-(--ink-15)" />
      </header>
      <div className="px-col-1 pb-20">{children}</div>
    </div>
  );
}
