import * as React from "react";
import { rankForRating } from "@playora/progression";
import { Avatar, Badge, Card, Skeleton, cn } from "@playora/ui";
import { Crown, Medal } from "lucide-react";
import type { LeaderboardEntry } from "../../hooks/use-leaderboard";
import { RankBadge } from "../../components/progression/rank-badge";

/*
 * The board itself, as pure presentation: entries in, markup out. Kept apart
 * from the page so the data plumbing (game, scope, season) and the look can
 * change without touching each other.
 *
 * Names are plain text, not links. They used to link to `/profile?user=…`,
 * which ignores the parameter and shows the viewer's own profile: a link
 * that looked like "see this player" and opened "you".
 */

/** First, second and third, each in its podium metal. */
const PLACE = {
  1: {
    label: "1st",
    ring: "ring-reward",
    height: "h-24 sm:h-28",
    plinth: "border-reward/40 bg-reward/15 text-reward",
    icon: Crown,
    iconTone: "text-reward",
  },
  2: {
    label: "2nd",
    ring: "ring-foreground/40",
    height: "h-16 sm:h-20",
    plinth: "border-foreground/20 bg-foreground/[0.06] text-foreground",
    icon: Medal,
    iconTone: "text-muted-foreground",
  },
  3: {
    label: "3rd",
    ring: "ring-streak/70",
    height: "h-11 sm:h-14",
    plinth: "border-streak/30 bg-streak/10 text-streak",
    icon: Medal,
    iconTone: "text-streak",
  },
} as const;

type Place = keyof typeof PLACE;

/** The podium's card, shared with its skeleton so nothing moves when the board loads. */
const PODIUM_FRAME =
  "overflow-hidden rounded-xl border border-border bg-gradient-to-b from-primary/10 via-card/60 to-card px-3 pt-6 shadow-card sm:px-8 sm:pt-8";

/**
 * The top three, second-first-third left to right as on a real podium. The
 * DOM keeps 1, 2, 3 so a screen reader reads the ranking in order; only the
 * CSS `order` moves them.
 */
export function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const top = entries.filter((e) => e.rank <= 3).slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className={PODIUM_FRAME}>
      <ol
        aria-label="Top three"
        className="mx-auto grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-5"
      >
        {([1, 2, 3] as const).map((place) => {
          const entry = top.find((e) => e.rank === place);
          return (
            <li
              key={place}
              className={cn(
                place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3",
                "min-w-0"
              )}
            >
              {entry ? <PodiumSpot entry={entry} place={place} /> : <EmptySpot place={place} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PodiumSpot({ entry, place }: { entry: LeaderboardEntry; place: Place }) {
  const style = PLACE[place];
  const Icon = style.icon;
  const tier = rankForRating(entry.rating);

  return (
    <div className="flex flex-col items-center text-center">
      <Icon className={cn("mb-2 h-5 w-5 sm:h-6 sm:w-6", style.iconTone)} aria-hidden />
      <Avatar
        src={entry.avatarUrl}
        alt=""
        aria-hidden
        fallbackText={entry.displayName}
        size={place === 1 ? "xl" : "lg"}
        className={cn("ring-[3px]", style.ring)}
      />
      <p className="mt-2 w-full truncate px-1 text-sm font-semibold text-foreground sm:text-base">
        {entry.displayName}
        {entry.isMe && <span className="sr-only"> (you)</span>}
      </p>
      <p className="font-mono-num text-lg font-bold text-foreground sm:text-2xl">{entry.rating}</p>
      <RankBadge tier={tier} size="sm" className="mt-1 max-w-full" />
      <div
        className={cn(
          "mt-3 flex w-full items-start justify-center rounded-t-xl border border-b-0 pt-2 font-display text-2xl font-extrabold sm:text-3xl",
          style.height,
          style.plinth
        )}
      >
        <span aria-hidden>{place}</span>
        <span className="sr-only">{style.label} place</span>
      </div>
    </div>
  );
}

function EmptySpot({ place }: { place: Place }) {
  const style = PLACE[place];
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-2 h-5 sm:h-6" aria-hidden />
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground",
          place === 1 ? "h-16 w-16" : "h-12 w-12"
        )}
        aria-hidden
      >
        ?
      </span>
      <p className="mt-2 text-sm text-muted-foreground">Open spot</p>
      <div
        className={cn(
          "mt-3 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-dashed border-border pt-2 font-display text-2xl font-extrabold text-muted-foreground sm:text-3xl",
          style.height
        )}
      >
        <span aria-hidden>{place}</span>
        <span className="sr-only">{style.label} place is open</span>
      </div>
    </div>
  );
}

/** Columns from `sm` up: rank, player, tier, record, rating. */
const ROW_GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[3rem_minmax(0,1fr)_8.5rem_7.5rem_5rem] sm:gap-4";

/** Everyone below the podium, plus (optionally) a heading row. */
export function BoardTable({
  entries,
  caption,
}: {
  entries: LeaderboardEntry[];
  /** Read by screen readers as the list's name. */
  caption: string;
}) {
  if (entries.length === 0) return null;
  return (
    <Card className="overflow-hidden p-0">
      <div
        className={cn(
          ROW_GRID,
          "hidden border-b border-border bg-surface/60 px-4 py-2.5 text-tag uppercase text-muted-foreground sm:grid"
        )}
        aria-hidden
      >
        <span>Rank</span>
        <span>Player</span>
        <span>Tier</span>
        <span>W · L · D</span>
        <span className="text-right">Rating</span>
      </div>
      <ol aria-label={caption} className="divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.userId}>
            <BoardRow entry={entry} />
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function BoardRow({
  entry,
  standalone = false,
}: {
  entry: LeaderboardEntry;
  standalone?: boolean;
}) {
  const tier = rankForRating(entry.rating);
  return (
    <div
      className={cn(
        ROW_GRID,
        "px-4 py-3",
        entry.isMe && "bg-primary/[0.08]",
        standalone && "rounded-xl border border-primary/40 shadow-card"
      )}
    >
      <span className="font-mono-num text-sm font-bold text-muted-foreground">
        <span className="sr-only">Rank </span>
        {entry.rank}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          src={entry.avatarUrl}
          alt=""
          aria-hidden
          fallbackText={entry.displayName}
          size="sm"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="truncate">{entry.displayName}</span>
            {entry.isMe && (
              <Badge variant="default" className="px-2 text-[10px]">
                You
              </Badge>
            )}
          </p>
          {/* The record moves under the name on a phone, where it has no column. */}
          <p className="text-xs text-muted-foreground sm:hidden">
            <Record entry={entry} />
          </p>
        </div>
      </div>

      <span className="hidden sm:block">
        <RankBadge tier={tier} size="sm" />
      </span>

      <span className="hidden text-sm text-muted-foreground sm:block">
        <Record entry={entry} />
      </span>

      <div className="text-right">
        <span className="font-mono-num text-base font-bold text-foreground">{entry.rating}</span>
        <span className="block sm:hidden">
          <RankBadge tier={tier} size="sm" className="mt-0.5" />
        </span>
      </div>
    </div>
  );
}

function Record({ entry }: { entry: LeaderboardEntry }) {
  return (
    <span className="numeric">
      <span className="sr-only">
        {entry.wins} wins, {entry.losses} losses, {entry.draws} draws
      </span>
      <span aria-hidden>
        {entry.wins} · {entry.losses} · {entry.draws}
      </span>
    </span>
  );
}

/** The board's shape while it loads, so nothing jumps when it arrives. */
export function BoardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading the leaderboard</span>
      <div className={PODIUM_FRAME}>
        <div className="mx-auto grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-5">
          {[2, 1, 3].map((place) => (
            <div key={place} className="flex flex-col items-center gap-2">
              <Skeleton className={cn("rounded-full", place === 1 ? "h-16 w-16" : "h-12 w-12")} />
              <Skeleton className="h-4 w-20 max-w-full" />
              <Skeleton
                className={cn("w-full rounded-b-none rounded-t-xl", PLACE[place as Place].height)}
              />
            </div>
          ))}
        </div>
      </div>
      <Card className="space-y-4 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-40 max-w-[40%]" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
        ))}
      </Card>
    </div>
  );
}
