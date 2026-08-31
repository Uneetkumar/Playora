"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Input, cn } from "@playora/ui";
import { Hash, Search, LogIn, X, ArrowRight, Camera } from "lucide-react";
import { NotificationPopover } from "./notification-popover";
import { FriendsPopover } from "./friends-popover";
import { useAuthStore } from "../../lib/store/auth-store";
import { useRooms } from "../../hooks/use-rooms";
import { GAME_CATALOG, isPlayable, searchGames, type CatalogGame } from "../../lib/games/catalog";
import { ROOM_CODE_LENGTH } from "@playora/game-types";
import { QrScanner } from "../lan/qr-scanner";

/**
 * Fixed header: search in the middle, join-by-code beside it, account to the
 * right. Both primary ways *in* to a game are reachable from every page, which
 * is the point of pinning it.
 */
export function AppHeader() {
  const router = useRouter();
  const { user, initialize } = useAuthStore();
  const { resolveCode, error: roomError, setError } = useRooms();

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
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-3 px-3 sm:gap-4 sm:px-4">
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
            <span className="text-white">PLAY</span>
            <span
              className="bg-gradient-to-r from-[#C084FC] to-[#818CF8] bg-clip-text text-transparent"
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
            className="h-10 gap-1.5 rounded-full border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50 hover:text-white px-3 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
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

      {roomError && (
        <p role="alert" className="bg-destructive/15 px-4 py-1 text-center text-xs text-destructive">
          {roomError}
        </p>
      )}
    </header>
  );
}
