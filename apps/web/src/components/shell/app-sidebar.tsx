"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@playora/ui";
import {
  History,
  Award,
  Home, Clock, Sparkles, Flame, Swords, Users, Trophy,
  Gamepad2, Zap, User, Settings,
} from "lucide-react";

/**
 * Collapsed icon rail that expands on hover.
 *
 * Keeps the full width of the page for games — which is the point of a games
 * platform — while still giving every destination a visible label the moment
 * the pointer arrives. Hidden below `lg`, where the bottom nav takes over.
 */
const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/play", label: "Play", icon: Zap },
  { href: "/games", label: "All games", icon: Gamepad2 },
  { href: "/rooms", label: "Rooms", icon: Swords },
  { href: "/history", label: "History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
] as const;

const DISCOVER = [
  { href: "/games?sort=recent", label: "Recently played", icon: Clock },
  { href: "/games?sort=new", label: "New games", icon: Sparkles },
  { href: "/games?sort=popular", label: "Popular", icon: Flame },
  { href: "/games?sort=top", label: "Top rated", icon: Trophy },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]!);

  const Row = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        title={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-11 items-center gap-3 rounded-lg px-3 transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span
          className={cn(
            "whitespace-nowrap text-sm font-medium transition-opacity duration-150",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
      }}
      aria-label="Sections"
      className={cn(
        "fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] flex-col border-r border-border bg-card/95 py-3 backdrop-blur-xl transition-[width] duration-200 lg:flex",
        expanded ? "w-56" : "w-16",
      )}
    >
      <nav className="flex flex-col gap-1 px-2">
        {ITEMS.map((item) => (
          <Row key={item.href} {...item} />
        ))}
      </nav>

      <div className="my-3 mx-3 border-t border-border" />

      <nav className="flex flex-col gap-1 px-2">
        <p
          className={cn(
            "px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-opacity",
            expanded ? "opacity-100" : "opacity-0",
          )}
        >
          Discover
        </p>
        {DISCOVER.map((item) => (
          <Row key={item.href} {...item} />
        ))}
      </nav>

      <div className="mt-auto px-2">
        <Row href="/settings" label="Settings" icon={Settings} />
      </div>
    </aside>
  );
}
