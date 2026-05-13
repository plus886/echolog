import type { Metadata } from "next";
import "./globals.css";

import { env } from "@/lib/env";

const SITE_NAME = "echolog";
const SITE_DESCRIPTION = "echo + log — 自分の発信が積み重なっていく場所";
const DEFAULT_OG_IMAGE = "/og-default.png";

// FontPlus loader — injects the licensed FOT-筑紫Cオールド明朝 Pr6N R
// face. Rendered as a raw <script> in <head> so it runs in the order the
// FontPlus scanner expects (without next/script wrapping it in async +
// data-nscript=... which broke its DOMContentLoaded scan in some setups).
const FONTPLUS_SRC =
  "https://webfont.fontplus.jp/accessor/script/fontplus.js?3Tt6wldHrYg%3D&box=TZoH12Fyg3w%3D&aa=1&ab=2";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: env.NEXT_PUBLIC_SITE_URL,
    locale: "ja_JP",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <script src={FONTPLUS_SRC} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
