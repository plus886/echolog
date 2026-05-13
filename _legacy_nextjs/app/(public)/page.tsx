import Link from "next/link";

import { composeGalleryItems, type GalleryQuote } from "@/lib/gallery-compose";
import { generateGalleryLayout, type LayoutItem } from "@/lib/gallery-layout";
import { listRootTweets, loadGalleryDays } from "@/lib/microcms";
import type { Day } from "@/types/microcms";

import { GalleryParallax } from "./gallery-parallax";
import { ScrollMemory } from "./scroll-memory";
import { ScrollReveal } from "./scroll-reveal";
import { ScrollWordmark } from "./scroll-wordmark";
import { TransitionLink } from "./transition-link";
import { WordmarkLink } from "./wordmark-link";

export const revalidate = 3600;

const EXPLORE = [
  "https://picsum.photos/seed/k-e1/420/520",
  "https://picsum.photos/seed/k-e2/420/520",
  "https://picsum.photos/seed/k-e3/420/520",
  "https://picsum.photos/seed/k-e4/420/520",
];

export default async function HomePage() {
  let days: Day[] = [];
  let tweets: GalleryQuote[] = [];
  const [daysResult, tweetsResult] = await Promise.allSettled([
    loadGalleryDays(),
    listRootTweets({ limit: 10, orders: "-publishedAt" }),
  ]);
  if (daysResult.status === "fulfilled") {
    days = daysResult.value;
  } else {
    console.error("[home] loadGalleryDays failed", daysResult.reason);
  }
  if (tweetsResult.status === "fulfilled") {
    tweets = tweetsResult.value.contents
      .filter((t): t is typeof t & { body: string } =>
        Boolean(t.body && t.body.trim().length > 0),
      )
      .slice(0, 10)
      .map((t) => ({ id: t.id, text: t.body }));
  } else {
    console.error("[home] listRootTweets failed", tweetsResult.reason);
  }
  const items = composeGalleryItems(days, tweets);
  const layoutItems: LayoutItem[] = items.map((it) =>
    it.kind === "photo"
      ? {
          kind: "photo",
          image: {
            width: it.day.image.width ?? 0,
            height: it.day.image.height ?? 0,
          },
        }
      : { kind: "quote", chars: it.text.length },
  );
  const { slots, totalHeight } = generateGalleryLayout(layoutItems);

  return (
    <>
      {/* Full-viewport hero — wordmark centered, scroll cue at the bottom */}
      <section className="relative flex h-screen min-h-[560px] items-center justify-center">
        <h1 className="m-0 text-center font-normal uppercase flex flex-col items-center gap-8">
          <span className="text-[clamp(24px,2.4vw,32px)] tracking-[0.55em] indent-[0.55em] font-serif [writing-mode:vertical-rl] [font-feature-settings:initial]">
            康凱爾
          </span>
          <WordmarkLink className="k-wordmark tracking-[0.16em] text-[12px] no-underline text-(--ink)">
            KO KAIJI
          </WordmarkLink>
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

      {/* Gallery — microCMS /days と (今はモックの) tweet 引用が混ざった
          スクロール面。各 slot は generateGalleryLayout() で絶対座標化され、
          ScrollReveal の [data-reveal] で順次フェードイン。*/}
      {items.length > 0 && (
        <section
          id="portfolio"
          className="relative mt-16 w-full min-[880px]:mt-30"
          style={{ height: totalHeight }}
        >
          {items.map((item, i) => {
            const slot = slots[i];
            if (!slot) return null;
            if (item.kind === "photo") {
              return (
                <figure
                  key={item.day.id}
                  data-reveal
                  className="k-pos absolute m-0 -translate-x-1/2 bg-(--paper-2)"
                  style={
                    {
                      "--w": `${slot.w}px`,
                      "--ideal-left": slot.leftPct,
                      top: slot.top,
                      width: slot.w,
                      height: slot.h,
                    } as React.CSSProperties
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${item.day.image.url}?w=400`}
                    alt={item.day.date ?? ""}
                    loading="lazy"
                    className="block h-full w-full object-cover"
                  />
                </figure>
              );
            }
            return (
              <TransitionLink
                key={`q-${item.id}`}
                href={`/tweets/${item.id}`}
                className="k-quote-wrap k-pos block no-underline"
                style={
                  {
                    "--w": `${slot.w}px`,
                    "--ideal-left": slot.leftPct,
                    top: slot.top,
                    width: slot.w,
                    height: slot.h,
                  } as React.CSSProperties
                }
              >
                <blockquote
                  data-reveal
                  className={[
                    "k-quote m-0 font-serif text-[16px] leading-[1.85] text-(--ink-70)",
                    slot.vertical && "k-quote-v",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.text}
                </blockquote>
              </TransitionLink>
            );
          })}
        </section>
      )}

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
      <GalleryParallax />
      <ScrollMemory />
    </>
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
