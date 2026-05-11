import { Cormorant_Garamond, Inter_Tight } from "next/font/google";
import Link from "next/link";

import { PortfolioNav } from "./portfolio-nav";
import { ScrollReveal } from "./scroll-reveal";
import { ScrollWordmark } from "./scroll-wordmark";
import "./portfolio.css";

// next/font: Inter Tight 400 for body / nav / footer; Cormorant Garamond
// italic 300 sits behind the FontPlus-loaded FOT 筑紫 mincho as a fallback
// for em phrases. Both have preload:false so Turbopack's dev-time font
// cache stays small.
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

const HERO_IMAGE = "https://picsum.photos/seed/k-hero/420/520";

// 28 plates scattered across the gallery surface; each carries its own
// hand-positioned (left%, top px, width px) so the editor controls the
// composition instead of a masonry algorithm.
type Plate = { src: string; left: string; top: number; w: number };
const PLATES: Plate[] = [
  {
    src: "https://picsum.photos/seed/k-01/600/780",
    left: "70%",
    top: 280,
    w: 150,
  },
  {
    src: "https://picsum.photos/seed/k-02/600/450",
    left: "33%",
    top: 460,
    w: 180,
  },
  {
    src: "https://picsum.photos/seed/k-03/600/780",
    left: "78%",
    top: 720,
    w: 170,
  },
  {
    src: "https://picsum.photos/seed/k-04/600/780",
    left: "26%",
    top: 980,
    w: 160,
  },
  {
    src: "https://picsum.photos/seed/k-05/600/780",
    left: "55%",
    top: 1180,
    w: 145,
  },
  {
    src: "https://picsum.photos/seed/k-06/600/450",
    left: "10%",
    top: 1380,
    w: 195,
  },
  {
    src: "https://picsum.photos/seed/k-07/600/780",
    left: "76%",
    top: 1500,
    w: 130,
  },
  {
    src: "https://picsum.photos/seed/k-08/600/780",
    left: "44%",
    top: 1720,
    w: 175,
  },
  {
    src: "https://picsum.photos/seed/k-09/600/780",
    left: "82%",
    top: 1960,
    w: 155,
  },
  {
    src: "https://picsum.photos/seed/k-10/600/780",
    left: "18%",
    top: 2120,
    w: 165,
  },
  {
    src: "https://picsum.photos/seed/k-11/600/450",
    left: "60%",
    top: 2300,
    w: 200,
  },
  {
    src: "https://picsum.photos/seed/k-12/600/780",
    left: "30%",
    top: 2520,
    w: 140,
  },
  {
    src: "https://picsum.photos/seed/k-13/600/780",
    left: "78%",
    top: 2700,
    w: 170,
  },
  {
    src: "https://picsum.photos/seed/k-14/600/780",
    left: "10%",
    top: 2900,
    w: 160,
  },
  {
    src: "https://picsum.photos/seed/k-15/600/450",
    left: "48%",
    top: 3060,
    w: 200,
  },
  {
    src: "https://picsum.photos/seed/k-16/600/780",
    left: "76%",
    top: 3260,
    w: 145,
  },
  {
    src: "https://picsum.photos/seed/k-17/600/780",
    left: "26%",
    top: 3420,
    w: 175,
  },
  {
    src: "https://picsum.photos/seed/k-18/600/780",
    left: "55%",
    top: 3640,
    w: 155,
  },
  {
    src: "https://picsum.photos/seed/k-19/600/450",
    left: "12%",
    top: 3820,
    w: 190,
  },
  {
    src: "https://picsum.photos/seed/k-20/600/780",
    left: "70%",
    top: 4000,
    w: 165,
  },
  {
    src: "https://picsum.photos/seed/k-21/600/780",
    left: "33%",
    top: 4180,
    w: 145,
  },
  {
    src: "https://picsum.photos/seed/k-22/600/780",
    left: "82%",
    top: 4380,
    w: 155,
  },
  {
    src: "https://picsum.photos/seed/k-23/600/780",
    left: "18%",
    top: 4560,
    w: 170,
  },
  {
    src: "https://picsum.photos/seed/k-24/600/450",
    left: "50%",
    top: 4740,
    w: 200,
  },
  {
    src: "https://picsum.photos/seed/k-25/600/780",
    left: "76%",
    top: 4940,
    w: 145,
  },
  {
    src: "https://picsum.photos/seed/k-26/600/780",
    left: "30%",
    top: 5120,
    w: 160,
  },
  {
    src: "https://picsum.photos/seed/k-27/600/780",
    left: "10%",
    top: 5320,
    w: 175,
  },
  {
    src: "https://picsum.photos/seed/k-28/600/780",
    left: "60%",
    top: 5500,
    w: 150,
  },
];

const GALLERY_HEIGHT = 5800;

const EXPLORE = [
  "https://picsum.photos/seed/k-e1/420/520",
  "https://picsum.photos/seed/k-e2/420/520",
  "https://picsum.photos/seed/k-e3/420/520",
  "https://picsum.photos/seed/k-e4/420/520",
];

export default function HomePage() {
  // .k-shell carries: design-token CSS vars, body font-family, paper bg.
  // next/font CSS vars stack onto the same element so that var() chains
  // resolve. Most everything else is Tailwind utilities.
  const shellClass = [
    "k-shell",
    interTight.variable,
    cormorant.variable,
    "relative min-h-screen overflow-x-hidden text-[15px] leading-[1.45] antialiased",
  ].join(" ");

  return (
    <div className={shellClass}>
      {/* Top navigation (fixed, mix-blend-difference). Hidden initially;
          ScrollWordmark toggles .is-scrolled on the shell to slide it in. */}
      <PortfolioNav />

      {/* Full-viewport hero — wordmark centered, scroll cue at the bottom */}
      <section className="relative flex h-screen min-h-[560px] items-center justify-center">
        <h1 className="m-0 text-center font-normal uppercase flex flex-col items-center gap-8">
          <span className="text-[clamp(24px,2.4vw,32px)] tracking-[0.55em] indent-[0.55em] font-serif [writing-mode:vertical-rl]">
            康凱爾
          </span>
          <span className="k-wordmark tracking-[0.16em] text-[12px]">
            KO KAIJI
          </span>
        </h1>
        <div
          className="k-scroll-cue pointer-events-none absolute bottom-14 left-1/2 flex -translate-x-1/2 flex-col items-center gap-4 text-(--ink-50)"
          aria-hidden="true"
        >
          <span className="text-[11px] tracking-[0.32em] lowercase">
            scroll
          </span>
          <span className="block h-11 w-px bg-current animate-scroll-cue" />
        </div>
      </section>

      {/* Sticky clone of the hero KO KAIJI wordmark. Always fixed at the
          nav line; visibility flipped by .is-scrolled so it lights up
          exactly where the hero copy was at the threshold. */}
      <div
        className="k-wordmark-pin pointer-events-none fixed left-1/2 top-9 z-20 -translate-x-1/2 mix-blend-difference text-[12px] uppercase tracking-[0.16em] text-(--grey-light)"
        aria-hidden="true"
      >
        KO KAIJI
      </div>

      {/* Intro — narrow column, sits to the left, sans body */}
      <section className="ml-col-2 mt-10 w-col-20 min-w-0 min-[880px]:w-col-6 min-[880px]:min-w-[260px] min-[880px]:mt-10">
        <p className="m-0 text-[16px] leading-[1.8] font-serif tracking-wider">
          台湾研究者。
          <br />
          日本名は出田康一郎。
          <br />
          専門は台湾思想・台湾文化論。
          <br />
          1981年東京生まれ。
          <br />
          東京芸術大学音楽学部楽理科卒業。
          <br />
          國立台灣師範大學台灣語文學系修了。
          <br />
          2011年から台湾在住。
          <br />
        </p>
      </section>

      {/* Gallery — 28 plates, each absolutely positioned, fade in via
          the [data-reveal] attribute + ScrollReveal. */}
      <section
        id="portfolio"
        className="relative mt-16 w-full min-[880px]:mt-30"
        style={{ height: GALLERY_HEIGHT }}
      >
        {PLATES.map((plate, i) => (
          <figure
            key={plate.src}
            data-reveal
            className="absolute m-0 -translate-x-1/2 bg-(--paper-2)"
            style={{
              left: plate.left,
              top: plate.top,
              width: plate.w,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plate.src}
              alt={`Plate ${String(i + 1).padStart(2, "0")}`}
              loading="lazy"
              className="block h-auto w-full"
            />
          </figure>
        ))}
      </section>

      {/* Inline CTA — short paragraph, narrow left column */}
      <section
        id="about"
        data-reveal
        className="ml-col-2 mt-35 w-col-20 min-[880px]:mt-55 min-[880px]:w-col-8"
      >
        <p className="mb-4 text-[13px] leading-[1.7]">
          If a project is brewing on your end and you think the way I see might
          suit it, send a note via the{" "}
          <Link
            href="#contact"
            className="border-b border-current pb-px transition-opacity hover:opacity-60"
          >
            contact page
          </Link>
          .
        </p>
        <p className="text-[13px] leading-[1.7]">
          For something more wandering, the long{" "}
          <Link
            href="#portfolio"
            className="border-b border-current pb-px transition-opacity hover:opacity-60"
          >
            portfolio
          </Link>{" "}
          is upstairs.
        </p>
      </section>

      {/* (explore) — small parenthetical label + 4 tiny teaser cards */}
      <section
        data-reveal
        className="mt-35 flex flex-col items-end gap-3.5 px-col-2 min-[880px]:mt-55"
      >
        <p className="text-[12px] tracking-[0.04em] text-(--ink-50)">
          (explore)
        </p>
        <div className="flex gap-2">
          {EXPLORE.map((src, i) => (
            <Link
              key={src}
              href="#portfolio"
              className="block w-[78px] flex-none transition-opacity hover:opacity-60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Project ${i + 1}`}
                loading="lazy"
                className="block aspect-[4/5] w-full object-cover bg-(--paper-2)"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer — 3-col link row + 3-col credits row */}
      <footer
        id="contact"
        data-reveal
        className="mt-25 px-col-2 pb-15 text-[12px] leading-[1.7] min-[880px]:mt-40"
      >
        <div className="mb-15 grid grid-cols-1 gap-9 min-[880px]:grid-cols-[3fr_7fr_7fr] min-[880px]:gap-x-[calc(1/22*100%)] min-[880px]:gap-y-0">
          <FooterCol label="(menu)">
            <ul>
              <li className="mb-0.5 lowercase">
                <Link href="#portfolio">portfolio</Link>
              </li>
              <li className="mb-0.5 lowercase">
                <Link href="#portfolio">information</Link>
              </li>
              <li className="mb-0.5 lowercase">
                <Link href="#about">about</Link>
              </li>
              <li className="mb-0.5 lowercase">
                <Link href="#contact">contact</Link>
              </li>
            </ul>
          </FooterCol>
          <FooterCol label="(subscribe)">
            <p className="mb-1.5">
              Not a generic letter. A short note four times a year on what I am
              quietly looking at.{" "}
              <Link href="#" className="border-b border-current pb-px">
                Join here
              </Link>
              .
            </p>
          </FooterCol>
          <FooterCol label="(contact me)">
            <p className="mb-1.5">
              To enquire about commissions, prints, or a slow conversation about
              borders.{" "}
              <a
                href="mailto:cubicberry@gmail.com"
                className="border-b border-current pb-px"
              >
                cubicberry@gmail.com
              </a>
            </p>
          </FooterCol>
        </div>

        <div className="grid grid-cols-1 items-end gap-4.5 border-t border-(--ink-15) pt-7 text-[11px] text-(--ink-70) min-[880px]:grid-cols-3 min-[880px]:gap-0">
          <FooterCreditsCol>
            <p className="mb-1 text-(--ink-50) italic">(follow)</p>
            <p className="mb-1">
              <a href="#" className="border-b border-current pb-px">
                Instagram
              </a>
            </p>
            <p className="mb-1">
              <a
                href="https://github.com/cubicberry"
                className="border-b border-current pb-px"
              >
                GitHub
              </a>
            </p>
          </FooterCreditsCol>
          <FooterCreditsCol className="min-[880px]:text-center">
            <p className="mb-1">Designed in Taipei.</p>
            <p className="mb-1">
              <em>© {new Date().getFullYear()} Ko Kaiji.</em>
            </p>
          </FooterCreditsCol>
          <FooterCreditsCol className="min-[880px]:text-right">
            <p className="mb-1 text-(--ink-50) italic">(legal stuff)</p>
            <p className="mb-1">
              <Link href="#" className="border-b border-current pb-px">
                Privacy policy
              </Link>
            </p>
          </FooterCreditsCol>
        </div>
      </footer>

      <ScrollReveal />
      <ScrollWordmark />
    </div>
  );
}

function FooterCol({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2.5 italic text-(--ink-50)">{label}</p>
      {children}
    </div>
  );
}

function FooterCreditsCol({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`text-left ${className}`}>{children}</div>;
}
