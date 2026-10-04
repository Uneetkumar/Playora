"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { AmbientBackground } from "./ambient-background";
import { ShellActionsProvider } from "./shell-actions";
import { isImmersiveRoute } from "./nav";
import { useResolvedTheme } from "./use-shell-prefs";
import { Footer } from "../footer";
import { MobileNav } from "../mobile-nav";

export const MAIN_CONTENT_ID = "main-content";

/**
 * Keeps the browser's own chrome (the address bar on Android, the status bar
 * of an installed app) the colour of the header. The layout's media-query
 * `themeColor` follows the OS; this follows the theme actually chosen, read
 * from the `--surface` token so no colour is written down twice.
 */
function useThemeColorSync() {
  const theme = useResolvedTheme();
  React.useEffect(() => {
    const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
    if (!surface) return;
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", `hsl(${surface})`));
  }, [theme]);
}

/**
 * The frame around every page: header on top, sidebar on the left from lg,
 * tab bar along the bottom below md, and the page in between.
 *
 * Game routes (/play, a room's lobby and match) get none of it: the game owns
 * the whole viewport and draws its own bar. The tree keeps the same shape on
 * both kinds of route — chrome is dropped in place, <main> never moves — so
 * moving between them does not remount whatever shared layout sits inside.
 *
 * `--shell-header-h` is the header's real height, including the notch inset
 * an installed app gets with `viewportFit: "cover"`; the sticky sidebar hangs
 * from it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = isImmersiveRoute(pathname);
  const initialize = useAuthStore((s) => s.initialize);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  useThemeColorSync();

  return (
    <ShellActionsProvider shortcuts={!immersive}>
      {!immersive && (
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only z-toast rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
      )}
      {!immersive && <AmbientBackground />}
      {!immersive && <AppHeader />}
      <div
        className={immersive ? "contents" : "flex flex-1 [--shell-header-h:calc(4rem+env(safe-area-inset-top))]"}
      >
        {!immersive && <AppSidebar />}
        <div
          className={cn(
            immersive
              ? "contents"
              : "flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
          )}
        >
          <main
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className={cn(
              "relative focus:outline-none",
              immersive ? "h-[100dvh] w-full overflow-hidden" : "flex-1",
            )}
          >
            {children}
          </main>
          {!immersive && <Footer />}
        </div>
      </div>
      {!immersive && <MobileNav />}
    </ShellActionsProvider>
  );
}
