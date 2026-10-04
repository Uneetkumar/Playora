"use client";

import * as React from "react";
import Image from "next/image";
import type { GameId } from "@playora/game-types";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@playora/ui";
import { Copy, Globe2, Lock, QrCode, Share2, Users } from "lucide-react";
import { gameAccentStyle, gameMeta } from "../../lib/games/meta";
import { playerRange } from "../../lib/games/view";
import { getCatalogGame } from "../../lib/games/catalog";
import { QrDisplay } from "../lan/qr-display";
import { copyRoomCode, roomInviteUrl, shareRoomInvite } from "./invite";

/**
 * The top of a lobby: the game's cover as a strip, what the game is, and the
 * room code big enough to read across a sofa, with the three ways to pass it
 * on (copy, share sheet, QR).
 */
export function RoomHeader({
  gameId,
  code,
  isPrivate,
  className,
}: {
  gameId: GameId;
  code: string;
  isPrivate: boolean;
  className?: string;
}) {
  const meta = gameMeta(gameId);
  const game = getCatalogGame(gameId);
  const name = game?.name ?? gameId;
  const range = playerRange(gameId);
  const players =
    range.min === range.max
      ? `${range.min} ${range.min === 1 ? "player" : "players"}`
      : `${range.min}–${range.max} players`;

  return (
    <header
      style={gameAccentStyle(gameId)}
      className={cn("relative isolate overflow-hidden rounded-2xl border border-border bg-card shadow-card", className)}
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* High priority without `priority`, inside <picture>: as on the home
            hero, React would otherwise preload it in a Link header whose
            srcset the browser cannot read, and it fetched the 3840w file. */}
        <picture className="absolute inset-0">
          <Image
            src={meta.covers.landscape}
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1024px) calc(100vw - 22rem), 100vw"
            className="object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 scrim-bottom sm:scrim-left" />
        {/* On a phone the text sits on the art rather than beside it, so the
            page colour comes up to the badges and only the strip above them
            shows the cover. Light theme's tagline was unreadable without it. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 from-30% via-background/75 via-70% to-transparent sm:hidden" />
      </div>

      <div className="flex flex-col gap-5 p-4 pt-24 sm:flex-row sm:items-end sm:justify-between sm:p-6 sm:pt-16 lg:pt-20">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="border-transparent bg-background/70 backdrop-blur-sm">
              {meta.genre}
            </Badge>
            <Badge variant="secondary" className="numeric border-transparent bg-background/70 backdrop-blur-sm">
              <Users aria-hidden />
              {players}
            </Badge>
            <Badge variant="secondary" className="border-transparent bg-background/70 backdrop-blur-sm">
              {isPrivate ? <Lock aria-hidden /> : <Globe2 aria-hidden />}
              {isPrivate ? "Private" : "Public"}
            </Badge>
          </div>
          <h1 className="mt-3 truncate font-display text-h1 text-foreground">{name}</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{meta.heroTagline}</p>
        </div>

        <RoomCodePanel code={code} gameName={name} />
      </div>
    </header>
  );
}

/** The code, spaced and in mono so it can be read aloud, with copy, share and QR. */
export function RoomCodePanel({ code, gameName, className }: { code: string; gameName: string; className?: string }) {
  const [inviteUrl, setInviteUrl] = React.useState("");
  // The origin is only known in the browser; reading it in an effect keeps
  // the server render and hydration identical.
  React.useEffect(() => setInviteUrl(roomInviteUrl(code)), [code]);

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border border-border bg-background/75 p-3 shadow-raised backdrop-blur-md sm:p-4",
        className,
      )}
    >
      <p id="room-code-label" className="text-tag uppercase text-muted-foreground">
        Room code
      </p>
      <p
        aria-labelledby="room-code-label"
        className="font-mono-num select-all text-4xl font-bold leading-tight tracking-[0.18em] text-foreground sm:text-5xl"
      >
        {code}
      </p>
      {/* 40px tall, the touch minimum: on a phone these are the buttons the
          room is shared with. */}
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" onClick={() => void copyRoomCode(code)} className="flex-1 sm:flex-none">
          <Copy className="h-4 w-4" aria-hidden />
          Copy
        </Button>
        <Button
          variant="secondary"
          onClick={() => void shareRoomInvite(code, gameName)}
          className="flex-1 sm:flex-none"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Share
        </Button>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button size="icon" variant="secondary" aria-label="Show QR code">
                  <QrCode className="h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>QR code</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-auto max-w-[min(24rem,calc(100vw-1rem))] p-5">
            {inviteUrl && <QrDisplay joinUrl={inviteUrl} roomCode={code} gameName={gameName} />}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
