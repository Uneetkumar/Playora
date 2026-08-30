"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadingState, cn } from "@playora/ui";
import { ShieldAlert, LayoutDashboard, Flag } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";

const SECTIONS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/reports", label: "Reports", icon: Flag },
];

/**
 * The staff area.
 *
 * The check below decides what to *draw*, not what a person may do. Every table
 * behind these pages enforces access in Postgres through `is_staff()`
 * (migration 00008), so someone who defeats this check reaches a page whose
 * every query returns nothing. Client-side guards are a courtesy; the database
 * is the boundary.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading: authLoading } = useAuthStore();
  const { isStaff, role, isLoading } = useStaffRole(user?.id);

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16">
        <LoadingState title="Checking access" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="container mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">Staff only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is for moderators and administrators.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
          Back to Playora
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-foreground">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {role === "admin" ? "an administrator" : "a moderator"}.
          </p>
        </div>
      </header>

      <nav className="mb-6 flex gap-2" aria-label="Staff sections">
        {SECTIONS.map((section) => {
          const active =
            section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <section.icon className="h-3.5 w-3.5" aria-hidden />
              {section.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
