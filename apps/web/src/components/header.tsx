"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Users, Trophy, LogIn, Swords, Zap } from "lucide-react";
import { useAuthStore } from "../lib/store/auth-store";
import { Avatar, Button, Badge } from "@playora/ui";

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  const navLinks = [
    { href: "/", label: "Home", icon: Swords },
    { href: "/games", label: "Games", icon: Gamepad2 },
    { href: "/play", label: "Play", icon: Zap },
    { href: "/rooms", label: "Rooms", icon: Trophy },
    { href: "/friends", label: "Friends", icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary via-primary to-secondary shadow-glow-primary transition-transform duration-200 group-hover:scale-105">
              <Gamepad2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-extrabold tracking-wide text-foreground">
                PLAY<span className="text-primary-accent">ORA</span>
              </span>
              {/* Wraps and crowds the header below ~400px; the wordmark carries
                  the brand on its own there. */}
              <span className="-mt-1 hidden whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                Play · Connect · Compete
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav aria-label="Main" className="hidden md:flex items-center space-x-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-border/90 text-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-border/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User / Auth */}
        <div className="flex items-center space-x-3">
          {isAuthenticated && user ? (
            <Link
              href="/profile"
              className="flex items-center space-x-3 rounded-xl border border-border bg-card/60 p-1.5 pr-3 hover:bg-border/80 transition-colors"
            >
              <Avatar src={user.avatarUrl} fallbackText={user.displayName} size="sm" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {user.displayName}
                </span>
                {user.isGuest && (
                  <Badge variant="warning" className="text-[9px] px-1 py-0 h-3.5">
                    Guest
                  </Badge>
                )}
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="gap-2 shadow-primary/20">
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
