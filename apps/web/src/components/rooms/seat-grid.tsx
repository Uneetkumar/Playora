"use client";

import * as React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { popIn } from "@playora/animation";
import { AI_LEVELS, AI_LEVEL_LABELS, type AiLevel } from "@playora/bot-engine";
import type { GameId, Player } from "@playora/game-types";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  focusRingClass,
} from "@playora/ui";
import { Bot, Check, Crown, Hourglass, Link2, MoreHorizontal, UserPlus, UserX, WifiOff } from "lucide-react";
import { useReducedMotionPref } from "../../lib/motion";
import { useSeatStats, type SeatStats } from "./seat-stats";

/**
 * The lobby's seats: one card per seat the game has, filled or not.
 *
 * Filled seats show who is sitting there and whether they are ready. Empty
 * seats are dashed "Invite" slots that copy the room link, and for the host
 * the last empty seat is where a bot is added instead, with its level beside
 * the button. Seats keep the server's seat index, so nobody shuffles along
 * when someone before them leaves.
 */

export interface SeatGridProps {
  gameId: GameId;
  seats: readonly (Player | null)[];
  hostId: string;
  currentUserId: string;
  viewerIsHost: boolean;
  /** The game has a bot and the room is between matches. */
  canAddBots: boolean;
  botLevel: number;
  onBotLevelChange: (level: number) => void;
  onAddBot: () => void;
  /** Host menu on another player's card. Omit and no menu is drawn. */
  onKick?: (player: Player) => void;
  onInvite: () => void;
  /**
   * Level and rating per user id, instead of reading each player's
   * progression. For the dev preview, which has no database behind it.
   */
  statsOverride?: Record<string, SeatStats>;
}

export function SeatGrid({
  gameId,
  seats,
  hostId,
  currentUserId,
  viewerIsHost,
  canAddBots,
  botLevel,
  onBotLevelChange,
  onAddBot,
  onKick,
  onInvite,
  statsOverride,
}: SeatGridProps) {
  const emptyIndexes = seats.flatMap((s, i) => (s === null ? [i] : []));
  const botSlot = viewerIsHost && canAddBots ? emptyIndexes[emptyIndexes.length - 1] : undefined;
  const onlyEmptySeat = emptyIndexes.length === 1;

  return (
    <ul aria-label="Seats" className={cn("grid gap-3 lg:gap-4", gridColumns(seats.length))}>
      {seats.map((player, index) => (
        <li key={player?.userId ?? `empty-${index}`} className="min-w-0">
          {player ? (
            <SeatCard
              gameId={gameId}
              player={player}
              seatNumber={index + 1}
              isHost={player.userId === hostId}
              isMe={player.userId === currentUserId}
              {...(viewerIsHost && onKick && player.userId !== currentUserId
                ? { onKick: () => onKick(player) }
                : {})}
              {...(statsOverride ? { stats: statsOverride[player.userId] ?? null } : {})}
            />
          ) : index === botSlot ? (
            <AddBotSeat
              seatNumber={index + 1}
              level={botLevel}
              onLevelChange={onBotLevelChange}
              onAdd={onAddBot}
              {...(onlyEmptySeat ? { onInvite } : {})}
            />
          ) : (
            <InviteSeat seatNumber={index + 1} onInvite={onInvite} />
          )}
        </li>
      ))}
    </ul>
  );
}

function gridColumns(count: number): string {
  if (count <= 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-2 sm:grid-cols-3";
  if (count === 4) return "grid-cols-2 md:grid-cols-4";
  return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
}

const SEAT_BOX = "relative flex h-full min-h-[13rem] flex-col items-center rounded-xl p-4 pt-9 text-center";

function SeatLabel({ n }: { n: number }) {
  return (
    <span className="absolute left-3 top-3 text-tag uppercase text-muted-foreground">Seat {n}</span>
  );
}

interface SeatCardProps {
  gameId: GameId;
  player: Player;
  seatNumber: number;
  isHost: boolean;
  isMe: boolean;
  onKick?: () => void;
  /** Supplied by the preview; otherwise read live. */
  stats?: SeatStats | null;
}

function SeatCard(props: SeatCardProps) {
  // Only read progression when the caller has not handed stats in.
  return props.stats !== undefined ? (
    <SeatCardView {...props} stats={props.stats} />
  ) : (
    <LiveSeatCard {...props} />
  );
}

function LiveSeatCard(props: SeatCardProps) {
  const stats = useSeatStats(props.player, props.gameId);
  return <SeatCardView {...props} stats={stats} />;
}

function SeatCardView({
  player,
  seatNumber,
  isHost,
  isMe,
  onKick,
  stats,
}: SeatCardProps & { stats: SeatStats | null }) {
  const reduced = useReducedMotionPref();
  const name = player.displayName || player.username || `Player ${seatNumber}`;
  const disconnected = player.status !== "connected";
  const ready = player.isBot || player.isReady;
  const state: "host" | "ready" | "waiting" | "away" = disconnected
    ? "away"
    : isHost
      ? "host"
      : ready
        ? "ready"
        : "waiting";

  return (
    <div
      data-seat-state={state}
      className={cn(
        SEAT_BOX,
        "border bg-card shadow-card transition-[border-color,background-color,box-shadow] duration-hover ease-out-expo",
        state === "ready" ? "border-success/50 bg-success/5" : "border-border",
        isMe && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
      )}
    >
      <SeatLabel n={seatNumber} />

      {/* Your own card never has the host's menu, so its top-right corner is
          free for the marker. Beside the name it took the name's room: on a
          phone's two-column grid "Maya Okafor" was cut to "Maya Oka…". */}
      {isMe && (
        <span className="absolute right-3 top-2.5 rounded-full bg-primary/15 px-1.5 py-px text-tag uppercase text-primary-accent">
          You
        </span>
      )}

      {onKick && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Manage ${name}`}
              className="absolute right-1 top-1 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onKick}>
              {player.isBot ? <Bot className="h-4 w-4" aria-hidden /> : <UserX className="h-4 w-4" aria-hidden />}
              {player.isBot ? "Remove bot" : "Remove from room"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="relative">
        {player.isBot ? (
          <span
            className="grid h-16 w-16 place-items-center rounded-full bg-game-accent-soft text-game-accent ring-2 ring-border"
            aria-hidden
          >
            <Bot className="h-7 w-7" />
          </span>
        ) : (
          <Avatar
            size="xl"
            src={player.avatarUrl}
            fallbackText={name}
            alt=""
            // A dot on everyone who is simply here is noise; only a drop is news.
            {...(disconnected ? { status: "away" as const } : {})}
          />
        )}
        {isHost && (
          <span
            className="absolute -top-2 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-card text-reward shadow-raised ring-1 ring-border"
            aria-hidden
          >
            <Crown className="h-3.5 w-3.5 fill-current" />
          </span>
        )}
      </div>

      {/* Two lines before an ellipsis: a seat is narrow on a phone, and a
          name is how people find themselves and each other. */}
      <p className="mt-3 line-clamp-2 w-full break-words font-display text-base font-bold text-foreground">{name}</p>

      <p className="mt-0.5 flex min-h-5 flex-wrap items-center justify-center gap-x-1.5 text-meta text-muted-foreground">
        <SeatMeta player={player} stats={stats} />
      </p>

      <div className="mt-auto pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            // The builders are typed loosely so the package needs no Motion
            // dependency; the shape is Motion's.
            variants={popIn(reduced) as Variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              state === "ready" && "bg-success/15 text-success-ink",
              state === "host" && "bg-reward/15 text-reward-ink",
              state === "waiting" && "bg-muted text-muted-foreground",
              state === "away" && "bg-warning/15 text-warning-ink",
            )}
          >
            {state === "ready" && <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} />}
            {state === "host" && <Crown className="h-3.5 w-3.5" aria-hidden />}
            {state === "waiting" && <Hourglass className="h-3.5 w-3.5" aria-hidden />}
            {state === "away" && <WifiOff className="h-3.5 w-3.5" aria-hidden />}
            {state === "ready" ? "Ready" : state === "host" ? "Host" : state === "away" ? "Reconnecting" : "Not ready"}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SeatMeta({ player, stats }: { player: Player; stats: SeatStats | null }) {
  if (player.isBot) {
    const level = (player.botLevel ?? 3) as AiLevel;
    return (
      <span>
        Bot · {AI_LEVEL_LABELS[level] ?? `Level ${level}`}
      </span>
    );
  }
  const parts: React.ReactNode[] = [];
  if (stats?.rankLabel && stats.rating !== undefined) {
    parts.push(
      <span key="rating" className="numeric">
        {stats.rankLabel} {Math.round(stats.rating).toLocaleString()}
      </span>,
    );
  }
  if (stats?.level !== undefined) {
    parts.push(
      <span key="level" className="numeric">
        Lv {stats.level}
      </span>,
    );
  }
  if (player.isGuest) parts.push(<span key="guest">Guest</span>);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span aria-hidden className="text-subtle">
              ·
            </span>
          )}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}

function InviteSeat({ seatNumber, onInvite }: { seatNumber: number; onInvite: () => void }) {
  return (
    <button
      type="button"
      onClick={onInvite}
      className={cn(
        SEAT_BOX,
        "group w-full justify-center gap-2 border-2 border-dashed border-border text-muted-foreground",
        "transition-[border-color,background-color,color] duration-hover ease-out-expo hover:border-primary/50 hover:bg-primary/5 hover:text-foreground",
        focusRingClass,
      )}
    >
      <SeatLabel n={seatNumber} />
      <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-current transition-colors duration-hover group-hover:text-primary-accent">
        <UserPlus className="h-6 w-6" aria-hidden />
      </span>
      <span className="font-display text-base font-bold text-foreground">Invite</span>
      <span className="text-meta">Copy the room link</span>
    </button>
  );
}

function AddBotSeat({
  seatNumber,
  level,
  onLevelChange,
  onAdd,
  onInvite,
}: {
  seatNumber: number;
  level: number;
  onLevelChange: (level: number) => void;
  onAdd: () => void;
  /** Set when this is the only empty seat, so inviting a person is still one tap away. */
  onInvite?: () => void;
}) {
  const id = React.useId();
  return (
    <div className={cn(SEAT_BOX, "gap-2 border-2 border-dashed border-border")}>
      <SeatLabel n={seatNumber} />
      <span className="grid h-14 w-14 place-items-center rounded-full bg-game-accent-soft text-game-accent">
        <Bot className="h-6 w-6" aria-hidden />
      </span>
      <span id={`${id}-title`} className="font-display text-base font-bold text-foreground">
        Add a bot
      </span>
      {/* Compact from `sm` up; on a phone each control keeps the 40px touch minimum. */}
      <div className="mt-auto flex w-full flex-col gap-2">
        <label htmlFor={`${id}-level`} className="sr-only">
          Bot level
        </label>
        <Select value={String(level)} onValueChange={(v) => onLevelChange(Number(v))}>
          <SelectTrigger id={`${id}-level`} className="h-10 text-xs sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_LEVELS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Level {n} · {AI_LEVEL_LABELS[n]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onAdd} aria-describedby={`${id}-title`} className="h-10 w-full sm:h-8">
          <Bot className="h-4 w-4" aria-hidden />
          Add bot
        </Button>
        {onInvite && (
          <Button size="sm" variant="ghost" onClick={onInvite} className="h-10 w-full text-muted-foreground sm:h-8">
            <Link2 className="h-4 w-4" aria-hidden />
            Or copy invite link
          </Button>
        )}
      </div>
    </div>
  );
}
