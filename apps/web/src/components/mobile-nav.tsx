"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Gamepad2, Zap, Users, User } from "lucide-react";
import { cn } from "@playora/ui";

/**
 * Mobile bottom navigation.
 *
 * The desktop nav is `hidden md:flex`, which left phones with no navigation at
 * all beyond the home page. The brief is explicit that mobile is designed, not
 * a shrunken desktop, and that the Play action stays visually prominent —
 * hence the raised centre item.
 */
const ITEMS = [
  { href: "/", label: "Home", icon: Swords },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/play", label: "Play", icon: Zap, primary: true },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 md:hidden",
        "border-t border-border bg-card/95 backdrop-blur-xl",
        // Keeps the bar clear of the iOS home indicator.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
          const primary = "primary" in rest && rest.primary;
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          if (primary) {
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className="flex flex-col items-center gap-1 px-1 pb-2 pt-1"
                >
                  {/* Raised so Play reads as the primary action, not one tab of five. */}
                  <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-glow-primary">
                    <Icon className="h-6 w-6 text-white" aria-hidden />
                  </span>
                  <span className="text-[10px] font-semibold text-primary">{label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // 44px minimum touch target.
                  "flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="text-[10px] font-medium">{label}</span>
                {/* Active state is not conveyed by colour alone (spec section 32). */}
                {isActive && <span className="sr-only">(current page)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
