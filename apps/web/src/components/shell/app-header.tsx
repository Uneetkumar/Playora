"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Badge, Button, Input, cn } from "@playora/ui";
import {
  Hash, Search, LogIn, X, ArrowRight, Camera, Menu, Home,
  Wifi, Swords, History, Trophy, Award, Users, User, Settings,
  ShieldAlert, Clock, Sparkles, Flame,
} from "lucide-react";
import { NotificationPopover } from "./notification-popover";
import { FriendsPopover } from "./friends-popover";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { useRoomResolver } from "../../hooks/use-rooms";
import { GAME_CATALOG, isPlayable, searchGames, type CatalogGame } from "../../lib/games/catalog";
import { ROOM_CODE_LENGTH } from "@playora/game-types";
import { QrScanner } from "../lan/qr-scanner";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lan", label: "Local Wi-Fi", icon: Wifi },
  { href: "/rooms", label: "Rooms & Matches", icon: Swords },
  { href: "/history", label: "Match History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const DISCOVER_ITEMS = [
  { href: "/?sort=recent", label: "Recently played", icon: Clock },
  { href: "/?sort=new", label: "New games", icon: Sparkles },
  { href: "/?sort=popular", label: "Popular", icon: Flame },
  { href: "/?sort=top", label: "Top rated", icon: Trophy },
] as const;

/**
 * Fixed header: search in the middle, join-by-code beside it, account to the
 * right. Both primary ways *in* to a game are reachable from every page, which
 * is the point of pinning it.
 */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, initialize } = useAuthStore();
  const { isStaff } = useStaffRole(user?.id);
  const { resolveCode, error: roomError, setError } = useRoomResolver();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [openResults, setOpenResults] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const [code, setCode] = React.useState("");
  const [joining, setJoining] = React.useState(false);
  const [showScanModal, setShowScanModal] = React.useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  // Close mobile drawer whenever route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const results = React.useMemo<CatalogGame[]>(
    () => (query.trim() ? searchGames(query) : GAME_CATALOG.filter(isPlayable)),
    [query],
  );

  React.useEffect(() => setHighlight(0), [query]);

  React.useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setOpenResults(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const openGame = (game: CatalogGame) => {
    setOpenResults(false);
    router.push(isPlayable(game) ? `/play?game=${game.id}` : "/games");
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    const resolved = await resolveCode(code);
    setJoining(false);
    if (resolved) router.push(`/rooms/${resolved}`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-card/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-2 sm:gap-4 px-3 sm:px-4">
        {/* Mobile Hamburger Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-foreground/10 lg:hidden transition-colors"
          aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2.5 group">
          {/* Custom Playora logo mark */}
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-[0_0_16px_rgba(124,58,237,0.6)] transition-shadow duration-300 group-hover:shadow-[0_0_24px_rgba(124,58,237,0.8)]">
            {/* Gradient background */}
            <span className="absolute inset-0 bg-gradient-to-br from-[#9333EA] via-[#7C3AED] to-[#4F46E5]" />
            {/* Custom SVG mark: stylised controller / gem */}
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative h-5 w-5"
              aria-hidden
            >
              {/* Gem / crystal shape */}
              <path d="M16 4L28 13L16 28L4 13L16 4Z" fill="white" fillOpacity="0.15" />
              <path d="M16 4L28 13L16 19L4 13L16 4Z" fill="white" fillOpacity="0.55" />
              <path d="M16 19L28 13L16 28Z" fill="white" fillOpacity="0.30" />
              <path d="M16 19L4 13L16 28Z" fill="white" fillOpacity="0.20" />
              {/* Center dot highlight */}
              <circle cx="16" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
            </svg>
          </span>
          <span className="hidden font-display text-lg font-extrabold tracking-wide sm:block">
            <span className="text-foreground">PLAY</span>
            <span
              className="bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] dark:from-[#C084FC] dark:to-[#818CF8] bg-clip-text text-transparent"
            >
              ORA
            </span>
          </span>
        </Link>

        {/* Search */}
        <div ref={searchRef} className="relative min-w-0 flex-1 max-w-2xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="header-search" className="sr-only">
            Search games and categories
          </label>
          <Input
            id="header-search"
            role="combobox"
            aria-expanded={openResults}
            aria-controls="header-search-results"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenResults(true);
            }}
            onFocus={() => setOpenResults(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                const g = results[highlight];
                if (g) openGame(g);
              } else if (e.key === "Escape") {
                setOpenResults(false);
              }
            }}
            placeholder="Search games and categories"
            className="h-10 rounded-full pl-9 pr-9"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}

          {openResults && (
            <div
              id="header-search-results"
              role="listbox"
              className="absolute mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-raised"
            >
              {results.length === 0 ? (
                <p className="p-5 text-center text-sm text-muted-foreground">
                  No games match that. Try “chess”, “cards” or “racing”.
                </p>
              ) : (
                <ul>
                  {results.map((game, i) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => openGame(game)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left",
                          i === highlight ? "bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {game.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {game.category} · {game.minPlayers}-{game.maxPlayers} players
                          </span>
                        </span>
                        <Badge
                          variant={isPlayable(game) ? "success" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          {isPlayable(game) ? "Play" : game.phase}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Join by code & Scan QR — reachable on all screen sizes */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <form onSubmit={submitCode} className="hidden shrink-0 items-center gap-2 md:flex">
            <div className="relative">
              <Hash
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="header-code" className="sr-only">
                Room code
              </label>
              <Input
                id="header-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (roomError) setError(null);
                }}
                placeholder="ROOM CODE"
                maxLength={ROOM_CODE_LENGTH + 2}
                autoComplete="off"
                className="h-10 w-36 rounded-full pl-8 font-mono text-xs uppercase tracking-widest"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!code.trim() || joining}
              className="h-10 rounded-full"
              aria-label="Join room by code"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </form>

          {/* Camera QR Scan Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowScanModal(true)}
            className="h-10 gap-1.5 rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 hover:text-cyan-800 dark:bg-cyan-500/10 dark:bg-cyan-950/30 dark:text-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-500/20 dark:hover:bg-cyan-900/50 dark:hover:text-foreground px-3 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
            aria-label="Scan QR Code"
          >
            <Camera className="h-4 w-4 text-cyan-400" />
            <span className="hidden xl:inline text-xs font-bold">Scan QR</span>
          </Button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <FriendsPopover />
          <NotificationPopover />

          {user ? (
            <Link href="/profile" aria-label="Your profile">
              <Avatar fallbackText={user.displayName} size="sm" className="ring-2 ring-primary/40" />
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="h-10 gap-1.5 rounded-full">
                <LogIn className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign in</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Global Camera QR Code Scanner Modal */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-sm">
            <QrScanner
              onScan={(data) => {
                setShowScanModal(false);
                if (data.includes("/lan") || data.includes("/rooms")) {
                  try {
                    const url = new URL(data);
                    router.push(url.pathname + url.search);
                  } catch {
                    router.push(data);
                  }
                } else {
                  // Raw code
                  void (async () => {
                    setJoining(true);
                    const resolved = await resolveCode(data);
                    setJoining(false);
                    if (resolved) router.push(`/rooms/${resolved}`);
                    else router.push(`/lan?code=${encodeURIComponent(data)}&role=guest`);
                  })();
                }
              }}
              onCancel={() => setShowScanModal(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-50 flex lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 flex h-[calc(100dvh-4rem)] w-72 max-w-[85vw] flex-col border-r border-border bg-card/98 p-4 shadow-2xl backdrop-blur-2xl overflow-y-auto">
            {/* User profile / guest row */}
            {user ? (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3">
                <Avatar fallbackText={user.displayName} size="sm" className="ring-2 ring-primary/40" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-foreground">{user.displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{user.isGuest ? "Guest Player" : "Member"}</div>
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-white font-bold text-sm shadow-md"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In / Create Account
                </Link>
              </div>
            )}

            {/* Navigation Links */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Navigation
              </div>
              {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/20 text-primary-accent font-bold shadow-sm"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
              {isStaff && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-amber-400 hover:bg-amber-400/10"
                >
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <span>Staff Portal</span>
                </Link>
              )}
            </div>

            <div className="my-3 border-t border-border" />

            {/* Discover Section */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Discover
              </div>
              {DISCOVER_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-auto pt-4 text-center">
              <span className="text-[10px] text-muted-foreground font-mono">
                Playora v2.0 · Low Latency Web Gaming
              </span>
            </div>
          </div>
        </div>
      )}

      {roomError && (
        <p role="alert" className="bg-destructive/15 px-4 py-1 text-center text-xs text-destructive">
          {roomError}
        </p>
      )}
    </header>
  );
}
