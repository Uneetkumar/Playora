"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Badge } from "@playora/ui";
import { Loader2, Search, Swords, X, Bot, RotateCcw, AlertTriangle } from "lucide-react";
import { useMatchmaking } from "../../hooks/use-matchmaking";

const START_COUNTDOWN_SECONDS = 3;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

/**
 * Quick Match panel.
 *
 * Covers the states the brief names — searching, match found, cancelled,
 * timeout — with human-readable copy rather than protocol codes, and always an
 * escape route so a player is never stuck in a queue.
 */
export function QuickMatch({
  gameId,
  gameName,
  onPlayAi,
  onClose,
}: {
  gameId: string;
  gameName: string;
  onPlayAi: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const mm = useMatchmaking(gameId);
  const [countdown, setCountdown] = React.useState(START_COUNTDOWN_SECONDS);

  const mmSearchRef = React.useRef(mm.search);
  mmSearchRef.current = mm.search;
  const mmSetStartingRef = React.useRef(mm.setStarting);
  mmSetStartingRef.current = mm.setStarting;

  // Start searching once when the panel opens. Guarded by a ref rather than an
  // empty dependency array, so re-running the effect can never restart a queue
  // the player is already in.
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void mmSearchRef.current("casual");
  }, []);

  // Once matched, count down then hand off to the room.
  const matchRoomCode = mm.match?.roomCode ?? null;
  React.useEffect(() => {
    if (mm.state !== "match_found" || !matchRoomCode) return;
    setCountdown(START_COUNTDOWN_SECONDS);

    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    const go = setTimeout(() => {
      mmSetStartingRef.current();
      router.push(`/rooms/${matchRoomCode}`);
    }, START_COUNTDOWN_SECONDS * 1000);

    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [mm.state, matchRoomCode, router]);

  const opponent = mm.match?.opponents[0];

  return (
    <div
      role="dialog"
      aria-label="Quick Match"
      aria-live="polite"
      className="rounded-xl border border-border bg-card p-8 text-center shadow-raised"
    >
      {(mm.state === "connecting" || mm.state === "searching") && (
        <>
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-2 ring-inset ring-primary/40">
            <Loader2 className="h-8 w-8 animate-spin text-primary-accent" aria-hidden />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">Finding an opponent…</h2>
          <p className="mt-2 text-sm text-muted-foreground">{mm.message}</p>

          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <div>
              <div className="font-mono-num text-xl font-bold text-foreground">
                {formatElapsed(mm.waitingSeconds)}
              </div>
              <div className="text-xs text-muted-foreground">Waiting</div>
            </div>
            <div className="h-8 w-px bg-border" aria-hidden />
            <div>
              <div className="font-mono-num text-xl font-bold text-foreground">{mm.poolSize}</div>
              <div className="text-xs text-muted-foreground">In queue</div>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-8 w-full gap-2"
            onClick={() => {
              mm.cancel();
              onClose();
            }}
          >
            <X className="h-4 w-4" aria-hidden />
            Cancel
          </Button>

          {mm.waitingSeconds > 20 && (
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => {
                mm.cancel();
                onPlayAi();
              }}
            >
              Tired of waiting? Play the AI instead
            </Button>
          )}
        </>
      )}

      {mm.state === "match_found" && mm.match && (
        <>
          <Badge variant="success" className="mb-4">
            Match found!
          </Badge>
          <h2 className="font-display text-2xl font-bold text-foreground">{gameName} · Casual</h2>

          <div className="mt-6 flex items-center justify-center gap-6">
            <div className="text-center">
              <Avatar
                alt=""
                aria-hidden
                fallbackText="You"
                size="xl"
                className="mx-auto bg-primary/15 text-primary-accent ring-primary/40"
              />
              <div className="mt-2 text-sm font-semibold text-foreground">You</div>
            </div>

            <Swords className="h-6 w-6 text-muted-foreground" aria-hidden />

            <div className="text-center">
              <Avatar
                alt=""
                aria-hidden
                fallbackText={opponent?.displayName ?? "Opponent"}
                size="xl"
                className="mx-auto bg-secondary/15 text-secondary ring-secondary/40"
              />
              <div className="mt-2 text-sm font-semibold text-foreground">
                {opponent?.displayName ?? "Opponent"}
              </div>
              <div className="font-mono-num text-xs font-bold text-muted-foreground">
                {opponent?.rating ?? "–"}
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Starting in{" "}
            <span className="font-mono-num font-bold text-foreground">
              {Math.max(0, countdown)}
            </span>
            …
          </p>
        </>
      )}

      {(mm.state === "timeout" || mm.state === "cancelled" || mm.state === "error") && (
        <>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {mm.state === "error" ? (
              <AlertTriangle className="h-7 w-7 text-warning-ink" aria-hidden />
            ) : (
              <Search className="h-7 w-7 text-muted-foreground" aria-hidden />
            )}
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {mm.state === "error" ? "Matchmaking problem" : "No opponent yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{mm.error ?? mm.message}</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2 sm:flex-1" onClick={() => void mm.search("casual")}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Search again
            </Button>
            <Button variant="outline" className="gap-2 sm:flex-1" onClick={onPlayAi}>
              <Bot className="h-4 w-4" aria-hidden />
              Play the AI
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-muted-foreground"
            onClick={() => {
              mm.reset();
              onClose();
            }}
          >
            Back to all modes
          </Button>
        </>
      )}
    </div>
  );
}
