"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { GameId } from "@playora/game-types";
import { gameView } from "../../../lib/games/view";
import { similarGames } from "../../../lib/games/browse";
import { getPlayModes, isMultiplayer, isSoloGame } from "../../../lib/play/modes";
import { isSupabaseConfigured } from "../../../lib/env";
import { useAuthStore } from "../../../lib/store/auth-store";
import { usePlayerProgression } from "../../../hooks/use-progression";
import { useFavorites } from "../../../hooks/use-favorites";
import { useRecentlyPlayed } from "../../../hooks/use-recently-played";
import { useMatchHistory } from "../../../hooks/use-match-history";
import { useLocalHistory } from "../../../hooks/use-local-history";
import { gameAccentStyle } from "../../../lib/games/meta";
import { GameCard } from "../../../components/games/game-card";
import { Rail } from "../../../components/games/rail";
import { fromLocalMatch, fromOnlineMatch } from "../../../components/games/match-history-row";
import { genreHref } from "../../../components/shell/nav";
import { DetailHeader, HeroArt } from "./detail-hero";
import { PlayBox } from "./play-box";
import { HowToPlay, LeaderboardPreview, RecentMatches, YourStats } from "./detail-sections";
import { bestScore, detailStats, ratedStanding } from "./detail-stats";

/**
 * A game's page: the hero, the play box, the rules, the player's own record
 * in this game, and where to go next.
 *
 * Desktop is two columns over a full-bleed hero. The play box sits in the
 * right column from the top of the hero, with the art between it and the
 * title, and stays in view (sticky) while the left column scrolls. On a
 * phone everything stacks with the play
 * box straight after the hero, and a Play bar follows the thumb once the box
 * has scrolled away.
 *
 * Every colour is a token, so the page is the same design in both themes;
 * the game's own colour arrives through `--game-accent` on the root.
 */

/** Matches the list on a game page shows; the full history is a link away. */
const RECENT_LIMIT = 3;
/** Enough of this device's history for the stats; the store keeps at most 200. */
const LOCAL_LIMIT = 200;

/** `now` is the server page's `catalogDay()`: the one clock the badges are judged by. */
export function GameDetailClient({ gameId, now }: { gameId: GameId; now: number }) {
  const user = useAuthStore((s) => s.user);

  const game = React.useMemo(() => gameView(gameId, { now }), [gameId, now]);
  const modes = React.useMemo(() => getPlayModes(gameId), [gameId]);
  const similar = React.useMemo(
    () => similarGames(gameId, 8).map((g) => gameView(g.id, { now })),
    [gameId, now],
  );
  const solo = isSoloGame(gameId);

  const favorites = useFavorites();
  const { record: recordPlay } = useRecentlyPlayed();
  const { data: progression } = usePlayerProgression(user?.id);
  const { matches } = useMatchHistory(user?.id, { gameSlug: gameId, limit: RECENT_LIMIT });
  const local = useLocalHistory({ gameId, limit: LOCAL_LIMIT });

  const rating = progression?.ratings.find((r) => r.gameSlug === gameId) ?? null;
  const stats = detailStats({ rating, local, solo });
  const recent = React.useMemo(
    () =>
      [...matches.map(fromOnlineMatch), ...local.map(fromLocalMatch)]
        .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
        .slice(0, RECENT_LIMIT),
    [matches, local],
  );

  const onPlay = React.useCallback(() => recordPlay(gameId), [recordPlay, gameId]);

  return (
    <article
      style={gameAccentStyle(gameId)}
      // `--hero-h` is the header row's height on a desktop; the art behind it
      // runs a little further down, fading out above the rules.
      className="relative isolate pb-28 [--hero-h:26rem] lg:pb-16 xl:[--hero-h:30rem]"
    >
      <HeroArt game={game} />

      <div className="relative mx-auto grid max-w-[1400px] gap-x-8 gap-y-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-x-12">
        <div className="lg:col-start-1 lg:row-start-1">
          <DetailHeader game={game} rated={ratedStanding(rating)} best={bestScore(local, solo)} favorites={favorites} />
        </div>

        {/* From the top of the hero, level with the breadcrumb, so its Play
            button is above the fold on a laptop: rising only into the hero's
            lower corner left it under the fold at 1440x900 for most games.
            The sticky offset is that same top, so the box does not jump. */}
        <aside aria-label="Play" className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-6">
          <div className="lg:sticky lg:top-[calc(var(--shell-header-h)+1.5rem)]">
            <PlayBox gameId={gameId} gameName={game.name} modes={modes} onPlay={onPlay} />
          </div>
        </aside>

        <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2 lg:space-y-12">
          <HowToPlay game={game} modes={modes} />
          <YourStats stats={stats} />
          <RecentMatches items={recent} />
          {isSupabaseConfigured && isMultiplayer(gameId) && (
            <LeaderboardPreview gameId={gameId} gameName={game.name} userId={user?.id} />
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mx-auto mt-12 max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Rail title="Similar games" icon={<Sparkles />} seeAllHref={genreHref(game.genre)} bleed>
            {similar.map((g) => (
              <GameCard key={g.id} game={g} layout="rail" />
            ))}
          </Rail>
        </div>
      )}
    </article>
  );
}
