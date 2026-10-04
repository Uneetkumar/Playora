"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { GameId } from "@playora/game-types";
import { Button, cn } from "@playora/ui";
import { Eye, Lock, Users, X } from "lucide-react";
import { getCatalogGame } from "../../lib/games/catalog";
import { gameAccentStyle, gameMeta } from "../../lib/games/meta";
import type { LiveRoomStatus } from "./use-live-room-status";

/** "just now", "12m ago", "3h ago", "2d ago". */
export function timeAgo(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * One room in a list: the game's cover, the room's name and code, how full it
 * is right now, and the way in.
 *
 * The count is the room server's (`live`), never the directory's, which does
 * not know who is seated. With no live status the count is left out.
 */
export function RoomRow({
  code,
  gameId,
  name,
  isPrivate = false,
  since,
  maxPlayers,
  live,
  onForget,
  className,
}: {
  code: string;
  gameId: GameId;
  name?: string;
  isPrivate?: boolean;
  /** Created, or last visited, in epoch ms. */
  since?: number;
  maxPlayers?: number;
  live?: LiveRoomStatus;
  /** Offered for a remembered room the server says has ended. */
  onForget?: () => void;
  className?: string;
}) {
  const gameName = getCatalogGame(gameId)?.name ?? gameId;
  const ended = live !== undefined && (!live.exists || live.status === "abandoned");
  const inGame = live?.status === "in_game";
  const capacity = live?.maxPlayers ?? maxPlayers;
  const full = live !== undefined && capacity !== undefined && capacity !== null && live.playerCount >= capacity;

  return (
    <li
      style={gameAccentStyle(gameId)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-2.5 pr-3 shadow-card transition-[box-shadow] duration-hover ease-out-expo hover:shadow-card-hover",
        ended && "opacity-70",
        className,
      )}
    >
      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image src={gameMeta(gameId).covers.landscape} alt="" fill sizes="80px" className="object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-foreground">{name ?? `${gameName} room`}</span>
          {isPrivate && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Private" />}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-meta text-muted-foreground">
          <span className="truncate">{gameName}</span>
          <span aria-hidden className="text-subtle">
            ·
          </span>
          <span className="font-mono-num shrink-0 tracking-wider">{code}</span>
          {since !== undefined && (
            <>
              <span aria-hidden className="hidden text-subtle sm:inline">
                ·
              </span>
              <span className="hidden shrink-0 sm:inline">{timeAgo(Date.now() - since)}</span>
            </>
          )}
          {/* A phone has no room for the count column; the count still matters most. */}
          {live && !ended && (
            <>
              <span aria-hidden className="text-subtle sm:hidden">
                ·
              </span>
              <span
                className={cn(
                  "numeric inline-flex shrink-0 items-center gap-1 font-semibold sm:hidden",
                  inGame ? "text-warning-ink" : "text-foreground",
                )}
              >
                <Users className="h-3 w-3" aria-hidden />
                <span>
                  {live.playerCount}
                  {capacity ? `/${capacity}` : null}
                  <span className="sr-only"> players{inGame ? ", in a match" : ""}</span>
                </span>
              </span>
            </>
          )}
        </p>
      </div>

      {live && !ended && (
        <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
          <span className="numeric inline-flex items-center gap-1 text-sm font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {/* One span, so the row's gap does not open up "2 /6". */}
            <span>
              {live.playerCount}
              {capacity ? <span className="text-muted-foreground">/{capacity}</span> : null}
              <span className="sr-only"> players</span>
            </span>
          </span>
          {inGame ? (
            <span className="text-xs font-semibold text-warning-ink">In a match</span>
          ) : full ? (
            <span className="text-xs font-semibold text-muted-foreground">Full</span>
          ) : live.spectatorCount > 0 ? (
            <span className="numeric inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" aria-hidden />
              {live.spectatorCount}
              <span className="sr-only"> watching</span>
            </span>
          ) : (
            <span className="text-xs text-success-ink">Waiting</span>
          )}
        </span>
      )}

      {ended ? (
        <>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">Ended</span>
          {onForget && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onForget}
              aria-label={`Forget room ${code}`}
              className="h-10 w-10 sm:h-8 sm:w-8"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </>
      ) : (
        // 40px on a phone, the touch minimum; compact beside the row's text from `sm` up.
        <Button asChild size="sm" variant={inGame || full ? "secondary" : "default"} className="h-10 shrink-0 sm:h-8">
          <Link href={`/rooms/${code}`} aria-label={`${inGame || full ? "Watch" : "Join"} ${name ?? gameName} (${code})`}>
            {inGame || full ? "Watch" : "Join"}
          </Link>
        </Button>
      )}
    </li>
  );
}
