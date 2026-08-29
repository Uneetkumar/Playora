"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Users, Trophy, LogIn, Swords } from "lucide-react";
import { useAuthStore } from "../lib/store/auth-store";
import { Avatar, Button, Badge } from "@playden/ui";

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  const navLinks = [
    { href: "/", label: "Home", icon: Swords },
    { href: "/games", label: "Games", icon: Gamepad2 },
    { href: "/rooms", label: "Rooms", icon: Trophy },
    { href: "/friends", label: "Friends", icon: Users },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <Gamepad2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-wider text-white">
                GAME<span className="text-indigo-400">PLATFORM</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 -mt-1">
                Multiplayer
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
                      ? "bg-slate-800/90 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
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
              className="flex items-center space-x-3 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5 pr-3 hover:bg-slate-800/80 transition-colors"
            >
              <Avatar src={user.avatarUrl} fallbackText={user.displayName} size="sm" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white leading-tight">
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
              <Button size="sm" className="gap-2 shadow-indigo-500/20">
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
