import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/header";
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
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased pb-20 md:pb-0">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
