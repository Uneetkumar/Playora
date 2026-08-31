import type { Metadata } from "next";
import "./globals.css";
import * as React from "react";
import { QueryProvider } from "../lib/query/query-provider";
import { AnalyticsProvider } from "../lib/observability/analytics-provider";
import { Poppins, Inter } from "next/font/google";
import { AnimatedBackground } from "../components/shell/animated-background";

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

export const metadata: Metadata = {
  title: "Playora — Play. Connect. Compete.",
  description:
    "Scalable realtime multiplayer gaming platform powered by Next.js, Cloudflare Durable Objects, and Supabase.",
};

import { AppShell } from "../components/shell/app-shell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable}`}>
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

