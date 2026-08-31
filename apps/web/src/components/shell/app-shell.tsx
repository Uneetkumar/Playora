"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { Footer } from "../footer";
import { MobileNav } from "../mobile-nav";
import { cn } from "@playora/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Full-screen immersive routes where the game owns the entire viewport
  const isGameRoute =
    pathname?.startsWith("/play") ||
    (pathname?.startsWith("/rooms/") && pathname !== "/rooms");

  return (
    <>
      {!isGameRoute && <AppHeader />}
      {!isGameRoute && (
        <React.Suspense fallback={null}>
          <AppSidebar />
        </React.Suspense>
      )}

      <main
        className={cn(
          "relative z-10",
          isGameRoute
            ? "h-[100dvh] w-full overflow-hidden p-0 m-0"
            : "min-h-screen pt-16 pb-20 lg:pb-0 lg:pl-16"
        )}
      >
        {children}
      </main>

      {!isGameRoute && <Footer />}
      {!isGameRoute && <MobileNav />}
    </>
  );
}
