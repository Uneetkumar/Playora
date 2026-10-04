"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Hash, Plus, ScanLine, Users, Wifi, Zap } from "lucide-react";
import type { GameId } from "@playora/game-types";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionHeader,
  cn,
  focusRingClass,
} from "@playora/ui";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { isSupabaseConfigured } from "../../lib/env";
import { readyModes } from "../../lib/play/modes";
import { formatPlayers, playerRange } from "../../lib/games/view";
import { useRooms } from "../../hooks/use-rooms";
import { GameThumb } from "../shell/game-thumb";
import { RoomCodeForm } from "../shell/room-code-form";
import { useShellActions } from "../shell/shell-actions";
import { NAV } from "../shell/nav";
import { RoomRow } from "../rooms/room-row";
import { useLiveRoomStatus } from "../rooms/use-live-room-status";

/**
 * Every way into a game with other people, on the home page: four tiles
 * (Quick match, Create a room, Join by code, Same Wi-Fi), and under them the
 * public rooms waiting for players, when there are any.
 *
 * The tiles always show. A list of open rooms is the better invitation when it
 * exists, but it is empty most of the time on a young site, and a section
 * that only sometimes appears teaches people not to look for it.
 */

/** Games Quick Match can pair, from the same table the detail page offers modes from. */
const QUICK_MATCH_GAMES: readonly GameId[] = GAME_CATALOG.filter((g) =>
  readyModes(g.id).some((m) => m.id === "online-random")
).map((g) => g.id);

const NAMES = new Map(GAME_CATALOG.map((g) => [g.id, g.name]));

/** A listed room older than this is presumed played out; the rooms page and API agree. */
const LIVE_WINDOW_MS = 60 * 60 * 1000;

/** How many open rooms the home page lists before "All rooms". */
const ROOM_LIMIT = 4;

const tileClassName = cn(
  "group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-card sm:flex-row sm:items-center sm:p-4",
  "transition-[background-color,border-color] duration-hover ease-out-expo hover:border-foreground/20 hover:bg-foreground/[0.03]",
  "data-[state=open]:border-primary/50",
  focusRingClass
);

function TileBody({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary-accent sm:h-11 sm:w-11"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 line-clamp-2 block text-meta text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-[color,transform] duration-hover ease-out-expo group-hover:translate-x-0.5 group-hover:text-foreground sm:block"
      />
    </>
  );
}

export function PlayWithFriends({ className }: { className?: string }) {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeader
        headingId={headingId}
        title="Play with friends"
        icon={<Users />}
        description="Start a room, join one with a code, or get matched in seconds."
        action={
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href={NAV.rooms.href}>
              All rooms
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <ul role="list" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <li>
          <QuickMatchTile />
        </li>
        <li>
          <Link href="/rooms?create=1" className={tileClassName}>
            <TileBody
              icon={Plus}
              title="Create a room"
              description="Pick a game and share the code"
            />
          </Link>
        </li>
        <li>
          <JoinByCodeTile />
        </li>
        <li>
          <Link href={NAV.lan.href} className={tileClassName}>
            <TileBody
              icon={Wifi}
              title="Same Wi-Fi"
              description="Play on one network, no internet needed"
            />
          </Link>
        </li>
      </ul>

      {isSupabaseConfigured && <OpenRooms />}
    </section>
  );
}

function QuickMatchTile() {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={tileClassName}>
          <TileBody
            icon={Zap}
            title="Quick match"
            description="Get paired with a player at your level"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 pb-1 pt-1.5 text-sm font-semibold text-foreground">Pick a game</p>
        <p className="px-2 pb-2 text-meta text-muted-foreground">We will find you an opponent.</p>
        <ul role="list" className="space-y-0.5">
          {QUICK_MATCH_GAMES.map((id) => (
            <li key={id}>
              <Link
                href={`/play?game=${id}&quick=1`}
                prefetch={false}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-1.5 pr-2 text-sm font-medium text-foreground",
                  "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.06]",
                  focusRingClass
                )}
              >
                <GameThumb id={id} sizes="56px" className="aspect-video w-14 rounded-md" />
                <span className="min-w-0 flex-1 truncate">{NAMES.get(id)}</span>
                <span className="numeric text-meta text-muted-foreground">
                  {formatPlayers(playerRange(id))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function JoinByCodeTile() {
  const [open, setOpen] = React.useState(false);
  const { openScanner } = useShellActions();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={tileClassName}>
          <TileBody
            icon={Hash}
            title="Join by code"
            description="Got a code from a friend? Jump in"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <p className="text-sm font-semibold text-foreground">Enter the room code</p>
        <RoomCodeForm idPrefix="home-join" autoFocus onJoined={() => setOpen(false)} />
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={() => {
            setOpen(false);
            openScanner();
          }}
        >
          <ScanLine aria-hidden className="h-4 w-4" />
          Scan a QR code instead
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Public rooms waiting for players. Renders nothing until there is at least
 * one, and nothing at all without a database, where the listing cannot work.
 */
function OpenRooms() {
  const headingId = React.useId();
  const { rooms } = useRooms(null);

  const open = React.useMemo(() => {
    const cutoff = Date.now() - LIVE_WINDOW_MS;
    return rooms.filter((r) => r.status === "waiting" && r.createdAt > cutoff).slice(0, ROOM_LIMIT);
  }, [rooms]);
  const live = useLiveRoomStatus(open.map((r) => r.code));

  if (open.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-success" aria-hidden />
        Open rooms
      </h3>
      <ul
        role="list"
        aria-labelledby={headingId}
        className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {open.map((room) => (
          <RoomRow
            key={room.id}
            code={room.code}
            gameId={room.gameId}
            name={room.name}
            isPrivate={room.isPrivate}
            since={room.createdAt}
            maxPlayers={room.maxPlayers}
            {...(live[room.code] ? { live: live[room.code] } : {})}
          />
        ))}
      </ul>
    </div>
  );
}
