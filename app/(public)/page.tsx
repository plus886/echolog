import { Cormorant_Garamond, Inter_Tight } from "next/font/google";
import Link from "next/link";

import { PortfolioNav } from "./portfolio-nav";
import "./portfolio.css";

// Webfonts replacing the system fallback. Body uses Inter Tight at a
// single weight; em swaps to Cormorant Garamond italic at thin weight,
// which lands close to the Miller Display feel without the licence.
// Trim weights and disable preload so Turbopack doesn't grow its
// dev-time font cache (it OOM'd at 12GB last time we loaded too many).
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

// Mockup that mirrors the structural skeleton of elkevandenende.com:
//  - Sans body in tiny editorial sizes; em → display serif as the only
//    italic accent
//  - Cream paper background, near-black ink (#383838 not pure black)
//  - 24-column grid, but the gallery uses absolute positioning so each
//    plate sits where the editor put it (not a masonry algorithm)
//  - Massive vertical whitespace between blocks
//  - Top-right tiny postcard hero (not full-bleed) + centered wordmark
//  - Footer of 4 + credits columns with parenthetical labels
// All text and images are placeholders.

const HERO_IMAGE = "https://picsum.photos/seed/k-hero/420/520";

// 28 plates scattered across the gallery surface. left is a percentage of
// the gallery width; top is the absolute pixel offset; w is the rendered
// width in px. The mix of small/large + sparse top values produces the
// editorial scatter rhythm.
type Plate = { src: string; left: string; top: number; w: number };
const PLATES: Plate[] = [
  { src: "https://picsum.photos/seed/k-01/600/780", left: "70%", top: 280,  w: 150 },
  { src: "https://picsum.photos/seed/k-02/600/450", left: "33%", top: 460,  w: 180 },
  { src: "https://picsum.photos/seed/k-03/600/780", left: "78%", top: 720,  w: 170 },
  { src: "https://picsum.photos/seed/k-04/600/780", left: "26%", top: 980,  w: 160 },
  { src: "https://picsum.photos/seed/k-05/600/780", left: "55%", top: 1180, w: 145 },
  { src: "https://picsum.photos/seed/k-06/600/450", left: "10%", top: 1380, w: 195 },
  { src: "https://picsum.photos/seed/k-07/600/780", left: "76%", top: 1500, w: 130 },
  { src: "https://picsum.photos/seed/k-08/600/780", left: "44%", top: 1720, w: 175 },
  { src: "https://picsum.photos/seed/k-09/600/780", left: "82%", top: 1960, w: 155 },
  { src: "https://picsum.photos/seed/k-10/600/780", left: "18%", top: 2120, w: 165 },
  { src: "https://picsum.photos/seed/k-11/600/450", left: "60%", top: 2300, w: 200 },
  { src: "https://picsum.photos/seed/k-12/600/780", left: "30%", top: 2520, w: 140 },
  { src: "https://picsum.photos/seed/k-13/600/780", left: "78%", top: 2700, w: 170 },
  { src: "https://picsum.photos/seed/k-14/600/780", left: "10%", top: 2900, w: 160 },
  { src: "https://picsum.photos/seed/k-15/600/450", left: "48%", top: 3060, w: 200 },
  { src: "https://picsum.photos/seed/k-16/600/780", left: "76%", top: 3260, w: 145 },
  { src: "https://picsum.photos/seed/k-17/600/780", left: "26%", top: 3420, w: 175 },
  { src: "https://picsum.photos/seed/k-18/600/780", left: "55%", top: 3640, w: 155 },
  { src: "https://picsum.photos/seed/k-19/600/450", left: "12%", top: 3820, w: 190 },
  { src: "https://picsum.photos/seed/k-20/600/780", left: "70%", top: 4000, w: 165 },
  { src: "https://picsum.photos/seed/k-21/600/780", left: "33%", top: 4180, w: 145 },
  { src: "https://picsum.photos/seed/k-22/600/780", left: "82%", top: 4380, w: 155 },
  { src: "https://picsum.photos/seed/k-23/600/780", left: "18%", top: 4560, w: 170 },
  { src: "https://picsum.photos/seed/k-24/600/450", left: "50%", top: 4740, w: 200 },
  { src: "https://picsum.photos/seed/k-25/600/780", left: "76%", top: 4940, w: 145 },
  { src: "https://picsum.photos/seed/k-26/600/780", left: "30%", top: 5120, w: 160 },
  { src: "https://picsum.photos/seed/k-27/600/780", left: "10%", top: 5320, w: 175 },
  { src: "https://picsum.photos/seed/k-28/600/780", left: "60%", top: 5500, w: 150 },
];

const GALLERY_HEIGHT = 5800;

const EXPLORE = [
  "https://picsum.photos/seed/k-e1/420/520",
  "https://picsum.photos/seed/k-e2/420/520",
  "https://picsum.photos/seed/k-e3/420/520",
  "https://picsum.photos/seed/k-e4/420/520",
];

export default function HomePage() {
  const wrapperClass = [
    "k-shell",
    interTight.variable,
    cormorant.variable,
  ].join(" ");

  return (
    <div className={wrapperClass}>
      {/* Top navigation (fixed, mix-blend-mode: difference) */}
      <PortfolioNav />

      {/* Tiny postcard hero, top right corner — not full-bleed */}
      <figure className="k-tiny-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMAGE} alt="" />
      </figure>

      {/* Page wordmark, dead center, just below the chrome */}
      <h1 className="k-wordmark">KOKAIJI</h1>

      {/* Italic intro paragraph, narrow column, sits to the left */}
      <section className="k-intro">
        <p>
          On <em>stillness</em>. I tend to make pictures that lean into the
          quiet places of a day &mdash; the moment <em>just before</em> a
          window opens, the breath after a sentence. Not a curated polish.
          A patient kind of attention.
        </p>
      </section>

      {/* The gallery: 28 plates scattered absolutely within a tall surface */}
      <section id="portfolio" className="k-gallery" style={{ height: GALLERY_HEIGHT }}>
        {PLATES.map((plate, i) => (
          <figure
            key={plate.src}
            className="k-plate"
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
            />
          </figure>
        ))}
      </section>

      {/* Inline CTA — short paragraph, narrow column on the left */}
      <section id="about" className="k-cta">
        <p>
          Eager to create artist reading photography? I&apos;d love to hear
          from you &mdash; visit my <Link href="#contact">contact page</Link>
          {" "}to reach out.
        </p>
        <p>
          For a more spontaneous exploration, head over to my{" "}
          <Link href="#portfolio">portfolio</Link>.
        </p>
      </section>

      {/* (explore) — small parenthetical label + 4 tiny teaser cards */}
      <section className="k-explore">
        <p className="k-explore-label">(explore)</p>
        <div className="k-explore-row">
          {EXPLORE.map((src, i) => (
            <Link key={src} href="#portfolio" className="k-explore-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Project ${i + 1}`} loading="lazy" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer — 4 columns of links + credits row at the bottom */}
      <footer id="contact" className="k-footer">
        <div className="k-footer-row">
          <div className="k-footer-col">
            <p className="k-footer-label">(menu)</p>
            <ul>
              <li><Link href="#portfolio">portfolio</Link></li>
              <li><Link href="#portfolio">information</Link></li>
              <li><Link href="#about">about</Link></li>
              <li><Link href="#contact">contact</Link></li>
            </ul>
          </div>
          <div className="k-footer-col">
            <p className="k-footer-label">(subscribe)</p>
            <p>
              Not a generic letter. A short note four times a year on what
              I am quietly looking at.{" "}
              <Link href="#" className="k-link-underlined">Join here</Link>.
            </p>
          </div>
          <div className="k-footer-col">
            <p className="k-footer-label">(contact me)</p>
            <p>
              To enquire about commissions, prints, or a slow conversation
              about borders.{" "}
              <a href="mailto:cubicberry@gmail.com" className="k-link-underlined">
                cubicberry@gmail.com
              </a>
            </p>
          </div>
        </div>

        <div className="k-footer-credits">
          <div className="k-footer-credits-col">
            <p className="k-footer-label">(follow)</p>
            <p>
              <a href="#" className="k-link-underlined">Instagram</a>
            </p>
            <p>
              <a href="https://github.com/cubicberry" className="k-link-underlined">
                GitHub
              </a>
            </p>
          </div>
          <div className="k-footer-credits-col">
            <p>Designed in Taipei.</p>
            <p>
              <em>© {new Date().getFullYear()} Ko Kaiji.</em>
            </p>
          </div>
          <div className="k-footer-credits-col">
            <p className="k-footer-label">(legal stuff)</p>
            <p>
              <Link href="#" className="k-link-underlined">Privacy policy</Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
