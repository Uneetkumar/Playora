"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Hash,
  LayoutGrid,
  Moon,
  Plus,
  ScanLine,
  SearchX,
  Settings,
  Sun,
  Trophy,
} from "lucide-react";
import type { GameId } from "@playora/game-types";
import { ROOM_CODE_LENGTH, isValidRoomCode, normalizeRoomCode } from "@playora/game-types";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Kbd,
} from "@playora/ui";
import { GAME_CATALOG, searchGames } from "../../lib/games/catalog";
import { GAME_META } from "../../lib/games/meta";
import { playerRange } from "../../lib/games/view";
import { GENRE_NAV, NAV } from "./nav";
import { GameThumb } from "./game-thumb";
import { RoomCodeForm } from "./room-code-form";
import { readPaletteRecents, rememberPaletteGame } from "./palette-recents";
import { toggleTheme, useResolvedTheme } from "./use-shell-prefs";

/**
 * The Ctrl/Cmd+K palette: every game, and the handful of things people come
 * to the platform to do, behind one search box.
 *
 * It replaces the header's hand-rolled combobox, which listed all 31 games in
 * a dropdown with no height limit (the lower half was unreachable), had no
 * active-descendant wiring, and sent a chosen game straight to /play — past
 * the page that asks how you want to play it. Games here open their detail
 * page, where that choice lives.
 *
 * cmdk's own filter is off. Games are ranked by `searchGames`, the same
 * ranking the browse page uses, which knows about genres and tags; cmdk's
 * fuzzy scorer would rank "Chess" below anything containing c-h-e-s-s in
 * order. Actions are matched word by word against their label and keywords.
 */

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

/** "1 player", "2 players", "2–4 players": the real range, not the catalog's. */
function playersText(id: GameId): string {
  const { min, max } = playerRange(id);
  if (min === max) return min === 1 ? "1 player" : `${min} players`;
  return `${min}–${max} players`;
}

const GAME_ROWS = new Map(
  GAME_CATALOG.map((g) => [
    g.id,
    { id: g.id, name: g.name, meta: `${GAME_META[g.id].genre} · ${playersText(g.id)}` },
  ]),
);

/** Every word of the query appears somewhere in `text`. */
function matches(query: string, text: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * A query that is exactly a room code's length once separators go. Checked on
 * the raw length because `normalizeRoomCode` truncates, which would make
 * "checkers" look like the code CHECKE.
 */
function roomCodeIn(query: string): string | null {
  const stripped = query.replace(/[\s_-]/g, "");
  if (stripped.length !== ROOM_CODE_LENGTH || !isValidRoomCode(stripped)) return null;
  return normalizeRoomCode(stripped);
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenScanner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScanner: () => void;
}) {
  const router = useRouter();
  const theme = useResolvedTheme();
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState<"search" | "join">("search");
  /** Set by Back on the join page: see the search box. */
  const [backFromJoin, setBackFromJoin] = React.useState(false);
  const [joinCode, setJoinCode] = React.useState("");
  const [recents, setRecents] = React.useState<GameId[]>([]);

  /*
   * Every opening starts from a clean search with fresh recents. Reset while
   * rendering, not in an effect: an effect runs after the dialog has mounted,
   * so a palette closed on its join page reopened there for one commit, the
   * code field's autoFocus took focus, and the dialog never learned which
   * control opened it.
   */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setPage("search");
      setBackFromJoin(false);
      setJoinCode("");
      setRecents(readPaletteRecents());
    }
  }

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const openGame = (id: GameId) => {
    setRecents(rememberPaletteGame(id));
    go(`/games/${id}`);
  };

  const startJoin = (code: string) => {
    setJoinCode(code);
    setPage("join");
  };

  const q = query.trim();
  const games = React.useMemo(() => (q ? searchGames(q) : GAME_CATALOG), [q]);
  const code = q ? roomCodeIn(q) : null;

  const actions: PaletteAction[] = [
    {
      id: "create-room",
      label: "Create a room",
      icon: Plus,
      keywords: "new private host invite friends multiplayer online",
      run: () => go("/rooms?create=1"),
    },
    {
      id: "join-room",
      label: "Join a room by code",
      icon: Hash,
      keywords: "enter code friends invite",
      run: () => startJoin(""),
    },
    {
      id: "scan",
      label: "Scan a QR code",
      icon: ScanLine,
      keywords: "camera qr lan wifi join local",
      run: () => {
        close();
        onOpenScanner();
      },
    },
    {
      id: "browse",
      label: "Browse all games",
      icon: LayoutGrid,
      keywords: "catalogue catalog games library",
      run: () => go(NAV.browse.href),
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      keywords: "rankings rating top players",
      run: () => go(NAV.leaderboard.href),
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      keywords: "preferences sound audio motion account",
      run: () => go(NAV.settings.href),
    },
    {
      id: "theme",
      label: theme === "light" ? "Switch to dark theme" : "Switch to light theme",
      icon: theme === "light" ? Moon : Sun,
      keywords: "theme dark light mode appearance colour color",
      run: () => {
        toggleTheme();
        close();
      },
    },
  ];

  const shownActions: PaletteAction[] = [
    ...(code
      ? [{ id: `code-${code}`, label: `Join room ${code}`, icon: Hash, keywords: "", run: () => startJoin(code) }]
      : []),
    // A genre typed into search is most likely "show me those".
    ...(q
      ? GENRE_NAV.filter((g) => matches(q, `${g.label} genre`)).map((g) => ({
          id: g.id,
          label: `Browse ${g.label} games`,
          icon: g.icon,
          keywords: "",
          run: () => go(g.href),
        }))
      : []),
    ...actions.filter((a) => !q || matches(q, `${a.label} ${a.keywords}`)),
  ];

  const recentRows = q ? [] : recents.flatMap((id) => GAME_ROWS.get(id) ?? []);

  /*
   * The selection is controlled so that every new query starts on its best
   * match. Left to itself, cmdk keeps whatever was selected if it is still
   * in the list (shouldFilter is off, so it never re-ranks), and scrolls the
   * list to keep it in view: type "ra" and the highlight stayed on an action
   * at the far end of the list, with the best results scrolled out of sight.
   * Each opening starts there too, rather than on the row last arrowed to.
   */
  const firstAction = shownActions[0] ? `action:${shownActions[0].id}` : "";
  const firstGame = games[0] ? `game:${games[0].id}` : "";
  const firstValue = recentRows[0]
    ? `recent:${recentRows[0].id}`
    : q
      ? firstGame || firstAction
      : firstAction || firstGame;
  const [selected, setSelected] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    setSelected(firstValue);
    listRef.current?.scrollTo({ top: 0 });
  }, [firstValue, q, open]);

  const gameGroup = games.length > 0 && (
    <CommandGroup heading={q ? "Games" : "All games"}>
      {games.map((g) => {
        const row = GAME_ROWS.get(g.id);
        return row ? (
          <GameItem key={g.id} value={`game:${g.id}`} row={row} onSelect={() => openGame(g.id)} />
        ) : null;
      })}
    </CommandGroup>
  );

  const actionGroup = shownActions.length > 0 && (
    <CommandGroup heading="Actions">
      {shownActions.map((a) => (
        <CommandItem key={a.id} value={`action:${a.id}`} onSelect={a.run} className="group gap-3 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-data-[selected=true]:bg-primary/15 group-data-[selected=true]:text-primary-accent">
            <a.icon aria-hidden />
          </span>
          <span className="flex-1 truncate font-medium">{a.label}</span>
          <ArrowRight className="text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" aria-hidden />
        </CommandItem>
      ))}
    </CommandGroup>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="mx-auto mb-auto mt-[6vh] max-w-xl gap-0 overflow-hidden p-0 sm:mt-[12vh]"
      >
        <DialogTitle className="sr-only">Search Playora</DialogTitle>
        <DialogDescription className="sr-only">
          Find a game, or jump to an action such as creating or joining a room.
        </DialogDescription>

        {page === "search" ? (
          <Command
            shouldFilter={false}
            loop
            value={selected}
            onValueChange={setSelected}
            label="Search games and actions"
            className="bg-card [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-base"
          >
            {/* No autoFocus on opening: the dialog focuses this, its first
                field, itself. Focused any earlier, the dialog opens with focus
                already inside it, never records the control that opened it,
                and Escape drops focus on <body>. Back from the join page it
                does need it, as it replaces the focused Back button. */}
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search games, genres or actions"
              autoFocus={backFromJoin}
            />
            <CommandList ref={listRef} className="max-h-[min(440px,60dvh)] p-1">
              <CommandEmpty>
                <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="font-medium text-foreground">Nothing matches “{q}”</p>
                <p className="mt-1">Try a genre such as Racing or Cards, or a room code.</p>
              </CommandEmpty>

              {recentRows.length > 0 && (
                <>
                  <CommandGroup heading="Recent">
                    {recentRows.map((row) => (
                      <GameItem
                        key={row.id}
                        value={`recent:${row.id}`}
                        row={row}
                        recent
                        onSelect={() => openGame(row.id)}
                      />
                    ))}
                  </CommandGroup>
                  <CommandSeparator className="my-1" />
                </>
              )}

              {/* Searching, the games are the answer and come first. Before
                  anything is typed, the short list of actions comes before
                  all 31 games, which would otherwise bury it. */}
              {q ? (
                <>
                  {gameGroup}
                  {gameGroup && actionGroup && <CommandSeparator className="my-1" />}
                  {actionGroup}
                </>
              ) : (
                <>
                  {actionGroup}
                  <CommandSeparator className="my-1" />
                  {gameGroup}
                </>
              )}
            </CommandList>

            <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                to move
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                to open
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <Kbd>Esc</Kbd>
                to close
              </span>
            </div>
          </Command>
        ) : (
          /*
           * Outside <Command> on purpose: cmdk's root swallows Enter, Home
           * and End for list navigation, which would stop the code field
           * from submitting or moving its cursor.
           */
          <div className="bg-card">
            <div className="flex h-14 items-center gap-2 border-b border-border px-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setBackFromJoin(true);
                  setPage("search");
                }}
                aria-label="Back to search"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Button>
              <h2 className="font-sans text-sm font-semibold tracking-normal text-foreground">
                Join a room
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Enter the {ROOM_CODE_LENGTH}-character code from your host&apos;s screen.
              </p>
              {/* autoFocus is safe here, unlike on the search box: this page
                  only ever mounts inside an open palette, replacing the
                  focused search box, so focus has to be moved somewhere. */}
              <RoomCodeForm
                key={joinCode}
                idPrefix="palette-join"
                autoFocus
                initialCode={joinCode}
                autoSubmit={Boolean(joinCode)}
                onJoined={close}
              />
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground"
                onClick={() => {
                  close();
                  onOpenScanner();
                }}
              >
                <ScanLine className="h-4 w-4" aria-hidden />
                Scan a QR code instead
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GameItem({
  value,
  row,
  recent = false,
  onSelect,
}: {
  value: string;
  row: { id: GameId; name: string; meta: string };
  recent?: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect} className="group gap-3 py-2">
      <GameThumb id={row.id} sizes="64px" className="h-9 w-16 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{row.name}</span>
        <span className="block truncate text-meta text-muted-foreground">{row.meta}</span>
      </span>
      {recent && <Clock className="text-muted-foreground group-data-[selected=true]:hidden" aria-hidden />}
      <ArrowRight className="text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" aria-hidden />
    </CommandItem>
  );
}
