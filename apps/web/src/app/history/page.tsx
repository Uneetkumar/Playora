"use client";

import * as React from "react";
import Link from "next/link";
import type { GameId } from "@playora/game-types";
import {
  Button,
  ConfirmDialog,
  SectionHeader,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@playora/ui";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Info,
  Layers,
  LogIn,
  MonitorSmartphone,
  Trash2,
  Wifi,
} from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useMatchHistory } from "../../hooks/use-match-history";
import { useLocalHistory, clearLocalHistory } from "../../hooks/use-local-history";
import {
  MatchHistoryRow,
  MatchHistorySkeleton,
  fromLocalMatch,
  fromOnlineMatch,
} from "../../components/games/match-history-row";
import { GAME_CATALOG } from "../../lib/games/catalog";
import { isGameImplemented } from "../../lib/play/modes";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";
import { ALL_GAMES, GameSelect } from "../../components/page/game-select";

const PAGE_SIZE = 20;

const GAMES: GameId[] = GAME_CATALOG.filter((g) => isGameImplemented(g.id)).map((g) => g.id);

type Source = "all" | "online" | "local";

export default function MatchHistoryPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const [game, setGame] = React.useState<GameId | typeof ALL_GAMES>(ALL_GAMES);
  const [page, setPage] = React.useState(0);
  const [source, setSource] = React.useState<Source>("all");
  const [confirmClear, setConfirmClear] = React.useState(false);

  const gameSlug = game === ALL_GAMES ? null : game;

  // Online matches, from the server's results.
  const {
    matches: onlineMatches,
    isLoading,
    hasMore,
    error,
  } = useMatchHistory(user?.id, { gameSlug, limit: PAGE_SIZE, page });

  // Offline matches, from this device.
  const localMatches = useLocalHistory({ gameId: gameSlug, limit: 100 });

  const showOnline = source !== "local";
  const showLocal = source !== "online";
  const online = showOnline ? onlineMatches.map(fromOnlineMatch) : [];
  const local = showLocal ? localMatches.map(fromLocalMatch) : [];
  const loading = authLoading || (showOnline && isLoading);

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<History />}
        title="Match history"
        description="Every game you finish, online and on this device, in one place."
        action={
          <Button asChild>
            <Link href="/games">Find a game</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ToggleGroup
            type="single"
            value={source}
            onValueChange={(v) => v && setSource(v as Source)}
            aria-label="Where the matches were played"
            className="w-full sm:w-auto"
          >
            <ToggleGroupItem value="all" className="flex-1 sm:flex-none">
              <Layers aria-hidden />
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="online" className="flex-1 sm:flex-none">
              <Wifi aria-hidden />
              Online
            </ToggleGroupItem>
            <ToggleGroupItem value="local" className="flex-1 sm:flex-none">
              <MonitorSmartphone aria-hidden />
              This device
            </ToggleGroupItem>
          </ToggleGroup>
          <GameSelect
            games={GAMES}
            value={game}
            onValueChange={(v) => {
              setGame(v);
              setPage(0);
            }}
            allLabel="All games"
            label="Game"
            className="sm:w-60"
          />
        </div>

        {localMatches.length > 0 && showLocal && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground md:self-auto"
              onClick={() => setConfirmClear(true)}
              aria-haspopup="dialog"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear this device&apos;s history
            </Button>
            <ConfirmDialog
              open={confirmClear}
              onOpenChange={setConfirmClear}
              variant="destructive"
              icon={<Trash2 />}
              title="Clear this device's history?"
              description="Removes every offline match stored in this browser. Online matches are kept on your account and are not affected."
              confirmLabel="Clear history"
              onConfirm={() => clearLocalHistory()}
            />
          </>
        )}
      </div>

      {loading ? (
        <MatchHistorySkeleton rows={5} />
      ) : source === "all" && page === 0 && !error && online.length === 0 && local.length === 0 ? (
        // Nothing anywhere: one empty state, not one per section.
        <EmptyState
          icon={<History />}
          title="No matches yet"
          body={
            user ? (
              "Finish a game, online or against the AI, and it lands here."
            ) : (
              <>
                Games you finish on this device are saved here, no account needed.{" "}
                <Link
                  href="/login?next=/history"
                  className="font-medium text-primary-accent underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to keep online matches too.
              </>
            )
          }
          action={
            <Button asChild>
              <Link href="/games">Find a game</Link>
            </Button>
          }
        />
      ) : (
        // Signed out, the device's own games come first: they are the ones there are.
        <div className="flex flex-col gap-10">
          {showOnline && error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-ink"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {showOnline && (
            <section
              aria-labelledby="online-heading"
              className={cn("space-y-4", !user && "order-last")}
            >
              <SectionHeader
                headingId="online-heading"
                icon={<Wifi />}
                title="Online"
                description={
                  user ? "Rated and casual matches, as the server recorded them." : undefined
                }
              />
              {!user ? (
                <EmptyState
                  size="compact"
                  icon={<LogIn />}
                  title="Sign in to see online matches"
                  body="Online results are kept on your account. Games on this device are listed either way."
                  action={
                    <Button asChild>
                      <Link href="/login?next=/history">Sign in or play as guest</Link>
                    </Button>
                  }
                />
              ) : online.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={<Wifi />}
                  title={page > 0 ? "No older matches" : "No online matches yet"}
                  body={
                    page > 0
                      ? "That is everything."
                      : "Play someone in a room or through Quick Match and it lands here."
                  }
                  action={
                    page > 0 ? (
                      <Button variant="secondary" onClick={() => setPage(0)}>
                        Back to the newest
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link href="/rooms">Play with friends</Link>
                      </Button>
                    )
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {online.map((item) => (
                    <li key={item.id}>
                      <MatchHistoryRow item={item} />
                    </li>
                  ))}
                </ul>
              )}

              {user && (page > 0 || hasMore) && (
                <nav aria-label="Online match pages" className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                    Newer
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page <span className="font-mono-num font-bold text-foreground">{page + 1}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Older
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Button>
                </nav>
              )}
            </section>
          )}

          {showLocal && (
            <section aria-labelledby="local-heading" className="space-y-4">
              <SectionHeader
                headingId="local-heading"
                icon={<MonitorSmartphone />}
                title="On this device"
                description="Games against the AI, pass and play, and same Wi-Fi. Kept in this browser only."
              />
              {local.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={<History />}
                  title="No offline matches yet"
                  body="Play any game against the AI or on one device and the result is saved here, no sign-in needed."
                  action={
                    <Button asChild>
                      <Link href="/games">Find a game</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {local.map((item) => (
                    <li key={item.id}>
                      <MatchHistoryRow item={item} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
