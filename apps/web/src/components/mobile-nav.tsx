"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Swords, Trophy, User, Camera, type LucideIcon } from "lucide-react";
import { cn } from "@playora/ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isCenter?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lan?scan=true", label: "Scan QR", icon: Camera, isCenter: true },
  { href: "/rooms", label: "Rooms", icon: Swords },
  { href: "/leaderboard", label: "Rankings", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  // Hide mobile nav during active gameplay to give games 100% full screen space
  if (pathname?.startsWith("/play") || (pathname?.startsWith("/rooms/") && pathname !== "/rooms")) return null;

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-white/10 bg-[#0B0D19]/95 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-center justify-around py-1 px-2">
        {ITEMS.map(({ href, label, icon: Icon, isCenter }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]!);
          return (
            <li key={href} className="flex-1 flex justify-center">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  isCenter
                    ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-400 bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.6)] text-white active:scale-95"
                    : isActive
                    ? "px-2 py-1 text-[#A855F7]"
                    : "px-2 py-1 text-white/50 hover:text-white"
                )}
              >
                <Icon className={cn("shrink-0", isCenter ? "h-6 w-6" : "h-5 w-5")} aria-hidden />
                {!isCenter && <span className="text-[10px] font-semibold">{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
