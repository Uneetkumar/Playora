import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "../components/shell/app-header";
import * as React from "react";
import { QueryProvider } from "../lib/query/query-provider";
import { AnalyticsProvider } from "../lib/observability/analytics-provider";
import { AppSidebar } from "../components/shell/app-sidebar";
import { Footer } from "../components/footer";

import { Poppins, Inter } from "next/font/google";
import { MobileNav } from "../components/mobile-nav";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable}`}>
      {/* Colours come from tokens, never hardcoded hex (design brief). */}
      <body className="min-h-screen bg-background text-foreground antialiased">
        <QueryProvider>
        <AnalyticsProvider>
          <AppHeader />
          {/* useSearchParams needs a boundary, or every page using this layout
              is forced out of static rendering. */}
          <React.Suspense fallback={null}>
            <AppSidebar />
          </React.Suspense>
          <main className="min-h-screen pt-16 pb-20 lg:pb-0 lg:pl-16">{children}</main>
          <Footer />
          <MobileNav />
        </AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
