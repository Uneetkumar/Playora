"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, Button, Badge, Avatar } from "@playora/ui";
import { Trophy, Swords, Flame, LogOut, TrendingUp, Gamepad2, Award } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { usePlayerProgression, type GameRating } from "../../hooks/use-progression";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="numeric mt-2 text-3xl text-foreground">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function RatingCard({ rating }: { rating: GameRating }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-foreground">{rating.gameName}</h3>
          {/* Rank is stated in words, never by colour alone (spec section 32). */}
          <Badge variant="secondary" className="mt-1.5">
            {rating.rank.label}
          </Badge>
        </div>
        <div className="text-right">
          <div className="numeric text-2xl text-foreground">{rating.rating}</div>
          <div className="text-[11px] text-muted-foreground">Peak {rating.peakRating}</div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Played", rating.gamesPlayed],
          ["Won", rating.wins],
          ["Lost", rating.losses],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-muted/40 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="numeric text-base text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      {rating.toNextRank && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="numeric text-foreground">{rating.toNextRank.needed}</span> rating to{" "}
          {rating.toNextRank.tier.label}
        </p>
      )}
    </Card>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, initialize, signOut } = useAuthStore();
  const { data, isLoading, error } = usePlayerProgression(user?.id);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!authLoading && !user) {
    return (
      <div className="container mx-auto max-w-md px-4 py-20 text-center sm:px-6">
        <Gamepad2 className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Sign in to see your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Play as a guest and your progress is kept — you can link Google later.
        </p>
        <Link href="/login">
          <Button className="mt-6 w-full">Sign in or play as guest</Button>
        </Link>
      </div>
    );
  }

  const displayName = user?.displayName ?? "Player";
  const level = data?.level;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Card className="border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:text-left">
          <Avatar fallbackText={displayName} size="xl" className="ring-4 ring-primary/20" />

          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <h1 className="font-display text-2xl font-extrabold text-foreground">{displayName}</h1>
              {user?.isGuest ? (
                <Badge variant="warning">Guest</Badge>
              ) : (
                <Badge variant="success">Google account</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">@{user?.username ?? "player"}</p>

            {/* Platform level: participation, deliberately separate from rating. */}
            {level && (
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm font-bold text-foreground">
                    Level <span className="numeric text-primary-accent">{level.level}</span>
                  </span>
                  <span className="numeric text-xs text-muted-foreground">
                    {level.xpIntoLevel} / {level.xpForNextLevel} XP
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(level.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Level ${level.level} progress`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500"
                    style={{ width: `${level.progress * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </Card>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card/50" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Gamepad2} label="Games" value={data.gamesPlayed} />
            <StatTile icon={Trophy} label="Wins" value={data.wins} hint={`${data.losses} losses`} />
            <StatTile
              icon={TrendingUp}
              label="Win rate"
              value={data.gamesPlayed > 0 ? formatPercent(data.winRate) : "—"}
            />
            <StatTile
              icon={Flame}
              label="Streak"
              value={data.currentStreak}
              hint={`Best ${data.bestStreak}`}
            />
          </div>

          <section className="mt-10">
            <h2 className="font-display text-lg font-bold text-foreground">Game ratings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each game is rated separately — being strong at one says nothing about another.
            </p>

            {data.ratings.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.ratings.map((r) => (
                  <RatingCard key={r.gameSlug} rating={r} />
                ))}
              </div>
            ) : (
              <Card className="mt-4 border-border bg-card p-10 text-center">
                <Award className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="mt-3 font-semibold text-foreground">No rated games yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Play someone online to get a rating. Offline and AI games earn XP but stay unrated.
                </p>
                <Link href="/play">
                  <Button className="mt-5 gap-2">
                    <Swords className="h-4 w-4" aria-hidden />
                    Find a game
                  </Button>
                </Link>
              </Card>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
