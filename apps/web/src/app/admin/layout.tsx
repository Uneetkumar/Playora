"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, Button, Skeleton, cn } from "@playora/ui";
import { Flag, LayoutDashboard, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";

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
      <PageContainer className="space-y-8" role="status" aria-live="polite">
        <span className="sr-only">Checking access</span>
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (!isStaff) {
    return (
      <PageContainer className="max-w-2xl">
        <EmptyState
          className="mt-8"
          icon={<ShieldAlert />}
          title="Staff only"
          body="This area is for moderators and administrators. If you should have access, ask an administrator to add your account."
          action={
            <Button asChild>
              <Link href="/">Back to Playora</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<ShieldCheck />}
        title="Staff"
        description="Moderation and the numbers behind the platform."
        action={
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role === "admin" ? "Administrator" : "Moderator"}
          </Badge>
        }
      />

      {/* Route links, not tabs: each section is its own page with its own URL. */}
      <nav aria-label="Staff sections" className="flex gap-6 border-b border-border">
        {SECTIONS.map((section) => {
          const active =
            section.href === "/admin" ? pathname === "/admin" : pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 pt-1 text-sm font-semibold transition-colors duration-hover ease-out-expo",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <section.icon className="h-4 w-4" aria-hidden />
              {section.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </PageContainer>
  );
}
