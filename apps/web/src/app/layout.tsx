import type { Metadata, Viewport } from "next";
import "./globals.css";
import * as React from "react";
import { QueryProvider } from "../lib/query/query-provider";
import { AnalyticsProvider } from "../lib/observability/analytics-provider";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster, TooltipProvider, themes } from "@playora/ui";
import { THEME_BOOTSTRAP } from "../lib/theme";
import { SIDEBAR_BOOTSTRAP } from "../components/shell/sidebar-bootstrap";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, siteUrl, siteJsonLd } from "../lib/seo";

/*
 * Self-hosted by next/font: no external request, no layout shift. Each one
 * becomes a CSS variable that Tailwind's `font-display` / `font-sans` /
 * `font-mono` and globals.css read (docs/DESIGN_SYSTEM.md, "Type").
 *
 * Sora for headings, Inter for everything else (variable, so any weight),
 * JetBrains Mono for clocks and room codes, where every character must take
 * the same width and 0/O must not be confusable.
 */
const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

/*
 * Site-wide metadata.
 *
 * The description used to name the stack — Next.js, Durable Objects, Supabase
 * — which is the wrong audience entirely: it is what a search result shows to
 * someone looking for a game to play. `metadataBase` matters more than it
 * looks, because without it every relative OG image resolves against the
 * crawler's guess rather than the site.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // Game pages supply their own title; this frames it.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "free online games",
    "browser games",
    "no download games",
    "multiplayer games",
    "play chess online",
    "play UNO online",
    "racing games",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: siteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

/*
 * `viewportFit: "cover"` lets the page run under the notch and home
 * indicator, which the shell then pads back by the safe-area insets (header,
 * bottom tab bar, the game shell). Without it the insets are all zero and an
 * installed app shows bars of white around the frame.
 *
 * The browser chrome takes the header's colour. These follow the OS; the
 * shell corrects them to the theme actually chosen once it mounts.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: themes.dark.surface },
    { media: "(prefers-color-scheme: light)", color: themes.light.surface },
  ],
};

import { AppShell } from "../components/shell/app-shell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` because the bootstrap below rewrites the class
     * and `color-scheme` before React hydrates, which is the point of it.
     */
    <html
      lang="en"
      className={`dark ${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint, so choosing Light
            survives a reload and does not flash dark on the way in. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* Same idea for the sidebar: a collapsed rail is collapsed on the
            first frame, so the page does not shift sideways on load. */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOTSTRAP }} />
        {/* Site-level structured data: names the site and declares the search
            endpoint, which is what produces a sitelinks search box. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
      </head>
      {/* Colours come from tokens, never hardcoded hex (design brief). */}
      <body className="min-h-screen bg-background text-foreground antialiased relative">
        <QueryProvider>
          <AnalyticsProvider>
            {/* One provider for the app, so tooltips share a delay group:
                once one has opened, moving to the next opens it at once. */}
            <TooltipProvider>
              <AppShell>{children}</AppShell>
            </TooltipProvider>
          </AnalyticsProvider>
        </QueryProvider>
        {/* The only toaster; `toast()` from anywhere renders here. */}
        <Toaster />
      </body>
    </html>
  );
}

