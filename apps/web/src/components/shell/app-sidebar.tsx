"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { cn } from "@playora/ui";
import {
  History,
  Award,
  ShieldAlert,
  Home,
  Clock,
  Sparkles,
  Flame,
  Swords,
  Users,
  Trophy,
  User,
  Settings,
  Wifi,
} from "lucide-react";

/**
 * Clean, non-redundant sidebar icon rail.
 */
const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lan", label: "Local Wi-Fi", icon: Wifi },
  { href: "/rooms", label: "Rooms", icon: Swords },
  { href: "/history", label: "History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
] as const;

const DISCOVER = [
  { href: "/?sort=recent", label: "Recently played", icon: Clock },
  { href: "/?sort=new", label: "New games", icon: Sparkles },
  { href: "/?sort=popular", label: "Popular", icon: Flame },
  { href: "/?sort=top", label: "Top rated", icon: Trophy },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [expanded, setExpanded] = React.useState(false);
  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const { user } = useAuthStore();
  const { isStaff } = useStaffRole(user?.id);

  // Auto-collapse on route changes
  React.useEffect(() => {
    setExpanded(false);
  }, [pathname, search]);

  const isActive = (href: string) => {
    const [path, query] = href.split("?");

    if (path === "/") {
      if (pathname !== "/") return false;
      if (!query) return !search?.get("sort");
      const expected = new URLSearchParams(query);
      for (const [key, value] of expected) {
        if (search?.get(key) !== value) return false;
      }
      return true;
    }

    if (!pathname.startsWith(path!)) return false;
    if (!query) return !search?.get("sort");

    const expected = new URLSearchParams(query);
    for (const [key, value] of expected) {
      if (search?.get(key) !== value) return false;
    }
    return true;
  };

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
          "group flex h-11 items-center gap-3 rounded-xl px-3 transition-colors",
          active
            ? "bg-primary/20 text-primary-accent font-bold shadow-sm"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span
          className={cn(
            "whitespace-nowrap text-sm font-medium transition-opacity duration-150 overflow-hidden",
            expanded ? "opacity-100" : "opacity-0 w-0",
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Sections"
      className={cn(
        "fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] flex-col border-r border-foreground/10 bg-surface/95 py-3 backdrop-blur-xl transition-[width] duration-200 lg:flex",
        expanded ? "w-56" : "w-16",
      )}
    >
      <nav className="flex flex-col gap-1 px-2">
        {ITEMS.map((item) => (
          <Row key={item.href} {...item} />
        ))}
        {isStaff && <Row href="/admin" label="Staff" icon={ShieldAlert} />}
      </nav>

      <div className="my-3 mx-3 border-t border-foreground/10" />

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
