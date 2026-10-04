"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import {
  Avatar,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { BrandLink } from "./brand";
import { NavPanelForRoute } from "./nav-panel";

/**
 * The menu below lg: the sidebar's own panel in a sheet from the left, with
 * who you are at the top. Built on Sheet (Radix Dialog), so it is portalled
 * out of the header — the hand-built drawer it replaces was laid out inside
 * the blurred header and its backdrop collapsed to nothing — and it traps
 * focus, closes on Escape, and hands focus back to the menu button.
 */
export function MobileMenuSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Back/forward and links that do not go through the panel close it too.
  React.useEffect(() => {
    close();
  }, [pathname, close]);

  /*
   * Radix opens a dialog on its first tabbable control that is not a link,
   * which in this all-links menu is the theme toggle at the very bottom: a
   * keyboard or switch user started there, and Enter flipped the theme.
   * Start on the current page's link instead, or the top of the menu.
   */
  const focusStart = React.useCallback((event: Event) => {
    const panel = contentRef.current;
    const start =
      panel?.querySelector<HTMLElement>('a[aria-current="page"]') ?? panel?.querySelector<HTMLElement>("a[href]");
    if (!start) return;
    event.preventDefault();
    start.focus({ preventScroll: true });
    start.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side="left"
        onOpenAutoFocus={focusStart}
        className="w-[min(85vw,20rem)] gap-0 bg-surface p-0 pl-[env(safe-area-inset-left)]"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Pages, your recent games and genres.</SheetDescription>

        <NavPanelForRoute
          variant="sheet"
          onNavigate={close}
          header={
            <div className="space-y-4 border-b border-border px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <BrandLink onClick={close} className="h-10 w-fit" />
              {user ? (
                <Link
                  href="/profile"
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.04]"
                >
                  <Avatar src={user.avatarUrl} alt="" fallbackText={user.displayName} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{user.displayName}</span>
                    <span className="block text-meta text-muted-foreground">
                      {user.isGuest ? "Playing as a guest" : "View profile"}
                    </span>
                  </span>
                </Link>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/login" onClick={close}>
                    <LogIn className="h-4 w-4" aria-hidden />
                    Sign in
                  </Link>
                </Button>
              )}
            </div>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
