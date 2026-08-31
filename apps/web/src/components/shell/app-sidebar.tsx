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

  // Bulletproof pointer tracking: auto-close whenever pointer exits the sidebar bounding box
  React.useEffect(() => {
    if (!expanded) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      if (
        e.clientX > rect.right + 8 ||
        e.clientX < rect.left - 8 ||
        e.clientY < rect.top - 8 ||
        e.clientY > rect.bottom + 8
      ) {
        setExpanded(false);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [expanded]);

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
        onClick={() => setExpanded(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-11 items-center gap-3 rounded-xl px-3 transition-all",
          active
            ? "bg-[#7C3AED]/20 text-[#A855F7] font-bold shadow-sm"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
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
      ref={sidebarRef}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Sections"
      className={cn(
        "fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] flex-col border-r border-white/10 bg-[#0B0D19]/95 py-3 backdrop-blur-xl transition-[width] duration-200 lg:flex",
        expanded ? "w-56" : "w-16",
      )}
    >
      <nav className="flex flex-col gap-1 px-2">
        {ITEMS.map((item) => (
          <Row key={item.href} {...item} />
        ))}
        {isStaff && <Row href="/admin" label="Staff" icon={ShieldAlert} />}
      </nav>

      <div className="my-3 mx-3 border-t border-white/10" />

      <nav className="flex flex-col gap-1 px-2">
        <p
          className={cn(
            "px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40 transition-opacity",
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
