import { Cormorant_Garamond, Inter_Tight } from "next/font/google";

import { NavState } from "./nav-state";
import { PortfolioNav } from "./portfolio-nav";
import { WordmarkLink } from "./wordmark-link";
import "./portfolio.css";

// (public) ルート全体の chrome。.k-shell・PortfolioNav・KO KAIJI pin を
// layout 側で保持して、ページ遷移 (home ↔ /tweets/[id]) の度に
// unmount/mount しないようにする。これにより:
// - .is-scrolled の状態が遷移をまたいで自然に持続する
// - 戻り遷移時に nav の slide-in が誤発火しない
// - View Transitions の crossfade 中も nav 要素が同じ DOM を共有して
//   ブレない
//
// .is-scrolled の管理:
// - "/" (home): ScrollWordmark (home の中) と ScrollMemory が制御
// - それ以外 (/tweets/[id] 等): NavState が pathname を見て付与

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

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shellClass = [
    "k-shell",
    interTight.variable,
    cormorant.variable,
    "relative min-h-screen overflow-x-hidden text-[15px] leading-[1.45] antialiased",
  ].join(" ");

  return (
    <div className={shellClass}>
      <PortfolioNav />
      <WordmarkLink className="k-wordmark-pin fixed left-1/2 top-9 z-20 -translate-x-1/2 mix-blend-difference text-[12px] uppercase tracking-[0.16em] text-(--grey-light) no-underline">
        KO KAIJI
      </WordmarkLink>
      {children}
      <NavState />
    </div>
  );
}
