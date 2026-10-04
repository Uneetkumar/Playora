"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  focusRingClass,
  cn,
} from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { NAV } from "./nav";

const MENU_ITEMS = [NAV.profile, NAV.history, NAV.achievements, NAV.settings] as const;

/**
 * The account control: your avatar (the Google photo when there is one —
 * the header used to pass only initials) opening a menu of your own pages,
 * or Sign in when nobody is.
 */
export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);

  if (!user) {
    // Holding the space while the session loads keeps "Sign in" from
    // flashing up for someone who is signed in.
    if (isLoading) return <span className="h-9 w-9 shrink-0 rounded-full bg-muted" aria-hidden />;
    return (
      <Button asChild size="sm" className="h-9 shrink-0">
        <Link href="/login">
          <LogIn className="h-4 w-4" aria-hidden />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user.displayName}`}
        className={cn("shrink-0 rounded-full", focusRingClass)}
      >
        <Avatar src={user.avatarUrl} alt="" fallbackText={user.displayName} size="sm" className="h-9 w-9" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3 py-2 normal-case tracking-normal">
          <Avatar src={user.avatarUrl} alt="" fallbackText={user.displayName} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{user.displayName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.isGuest ? "Guest account" : (user.email ?? "Signed in")}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MENU_ITEMS.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link href={item.href}>
              <item.icon aria-hidden />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void signOut().then(() => router.push("/"));
          }}
        >
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
