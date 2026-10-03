import type { Metadata } from "next";
import "./globals.css";
import * as React from "react";
import { QueryProvider } from "../lib/query/query-provider";
import { AnalyticsProvider } from "../lib/observability/analytics-provider";
import { Poppins, Inter } from "next/font/google";
import { AnimatedBackground } from "../components/shell/animated-background";
import { THEME_BOOTSTRAP } from "../lib/theme";
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, siteUrl, siteJsonLd } from "../lib/seo";

// Self-hosted by next/font: no external request, no layout shift.
const display = Poppins({
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

import { AppShell } from "../components/shell/app-shell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` because the bootstrap below rewrites the class
     * and `color-scheme` before React hydrates, which is the point of it.
     */
    <html
      lang="en"
      className={`dark ${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint, so choosing Light
            survives a reload and does not flash dark on the way in. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* Site-level structured data: names the site and declares the search
            endpoint, which is what produces a sitelinks search box. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()) }}
        />
      </head>
      {/* Colours come from tokens, never hardcoded hex (design brief). */}
      <body className="min-h-screen bg-background text-foreground antialiased relative">
        <AnimatedBackground />
        <QueryProvider>
          <AnalyticsProvider>
            <AppShell>{children}</AppShell>
          </AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

