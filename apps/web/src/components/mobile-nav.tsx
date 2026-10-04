"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { cn, focusRingClass } from "@playora/ui";
import { BOTTOM_TABS, isNavActive, type NavItem } from "./shell/nav";
import { useShellActions } from "./shell/shell-actions";

/**
 * The phone's bottom tab bar (below md): Home, Browse, Play, Friends,
 * Profile, from the shared nav model. Play is raised in the middle and opens
 * the quick-play drawer instead of navigating.
 *
 * It used to give the centre slot to a cyan Scan QR button, which made a
 * niche way of joining the most prominent control in the app and left
 * Browse out of the bar entirely. Scanning is one tap into Play now.
 *
 * Padded by the safe-area inset so the home indicator never sits on a label;
 * the shell pads the page by the bar's height plus the same inset.
 */
export function MobileNav() {
  const pathname = usePathname() ?? "/";
  const { openQuickPlay } = useShellActions();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-header border-t border-border bg-surface/90 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/80 md:hidden",
        "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
      )}
    >
      <ul className="grid h-16 grid-cols-5 items-stretch">
        {BOTTOM_TABS.start.map((item) => (
          <Tab key={item.id} item={item} active={isNavActive(item, pathname)} />
        ))}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={openQuickPlay}
            aria-haspopup="dialog"
            className={cn("group flex flex-col items-center gap-1 rounded-xl px-2 pb-1.5", focusRingClass)}
          >
            <span
              className={cn(
                "-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised ring-4 ring-surface",
                "transition-[transform,background-color] duration-hover ease-out-expo group-hover:bg-primary-hover group-active:scale-95 group-active:duration-press",
                "motion-reduce:group-active:scale-100 [.reduce-motion_&]:group-active:scale-100",
              )}
            >
              <Gamepad2 className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-[11px] font-semibold text-foreground">Play</span>
          </button>
        </li>
        {BOTTOM_TABS.end.map((item) => (
          <Tab key={item.id} item={item} active={isNavActive(item, pathname)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li className="flex">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold",
          "transition-colors duration-hover ease-out-expo",
          focusRingClass,
          active ? "text-primary-accent" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />}
        <Icon className="h-5 w-5" aria-hidden />
        {item.shortLabel ?? item.label}
      </Link>
    </li>
  );
}
