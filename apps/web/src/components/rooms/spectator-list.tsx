"use client";

import * as React from "react";
import type { Player } from "@playora/game-types";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@playora/ui";
import { Eye, MoreHorizontal, UserX } from "lucide-react";

/**
 * Who is watching. People who arrive once a match is under way, or once the
 * seats are full, are seated here by the server; the host can remove any of
 * them at any time, since a spectator holds no place in the match.
 */
export function SpectatorList({
  spectators,
  currentUserId,
  onKick,
  className,
}: {
  spectators: readonly Player[];
  currentUserId: string;
  /** Host only. */
  onKick?: (player: Player) => void;
  className?: string;
}) {
  if (spectators.length === 0) return null;

  return (
    <section aria-labelledby="spectators-title" className={cn("rounded-xl border border-border bg-card p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary-accent" aria-hidden />
        <h2 id="spectators-title" className="font-display text-base font-bold text-foreground">
          Watching
        </h2>
        <span className="numeric rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {spectators.length}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {spectators.map((s) => {
          const name = s.displayName || s.username || "Spectator";
          const isMe = s.userId === currentUserId;
          return (
            <li
              key={s.userId}
              className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3"
            >
              <Avatar size="xs" src={s.avatarUrl} fallbackText={name} alt="" />
              <span className="truncate text-sm font-medium text-foreground">
                {name}
                {isMe && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {onKick && !isMe && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* Drawn at 28px to sit inside the pill; the invisible
                        `after` box makes the target the 40px touch minimum. */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Manage ${name}`}
                      className="-mr-2 h-7 w-7 after:absolute after:-inset-1.5"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => onKick(s)}>
                      <UserX className="h-4 w-4" aria-hidden />
                      Remove from room
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
