"use client";

import * as React from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger, cn, focusRingClass } from "@playora/ui";
import { Check, Eye, Loader2, Play } from "lucide-react";
import type { LobbyReadiness, ViewerRole } from "./lobby-logic";
import { actionHint } from "./lobby-logic";

/**
 * The bar pinned to the bottom of the lobby: how many are ready, what the
 * room is waiting for, and the one button that matters to whoever is looking.
 *
 * The host gets Start, in the Play colour, because it is the screen's one
 * Play action. Everyone else seated gets a big Ready toggle. A disabled Start
 * says why twice: in the hint beside it, and in a tooltip on the button for
 * anyone who goes looking there (a tooltip is never the only place a reason
 * is given).
 */
export function LobbyActionBar({
  role,
  readiness,
  meReady,
  connected,
  onToggleReady,
  onStart,
  className,
}: {
  role: ViewerRole;
  readiness: LobbyReadiness;
  meReady: boolean;
  /** No socket, no actions: the buttons stay visible but disabled. */
  connected: boolean;
  onToggleReady: (ready: boolean) => void;
  onStart: () => void;
  className?: string;
}) {
  const [starting, setStarting] = React.useState(false);
  // A Start that the server refuses (someone unreadied in the same instant)
  // comes back as an error toast; the button frees itself after a moment
  // rather than waiting on a reply that may not come.
  React.useEffect(() => {
    if (!starting) return;
    const t = setTimeout(() => setStarting(false), 2500);
    return () => clearTimeout(t);
  }, [starting]);

  const hint = connected ? actionHint(role, readiness, meReady) : "Connecting to the room…";
  const canStart = connected && readiness.blocker === null && !starting;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-sticky border-t border-border bg-surface/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className="numeric shrink-0 text-sm font-bold text-foreground">
              {readiness.readyCount}/{readiness.seatedCount} ready
            </p>
            <ReadyMeter ready={readiness.readyCount} total={readiness.seatedCount} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate" aria-live="polite">
            {hint}
          </p>
        </div>

        {role === "host" && (
          <StartButton
            disabled={!canStart}
            busy={starting}
            reason={connected ? readiness.reason : "Connecting to the room…"}
            onStart={() => {
              setStarting(true);
              onStart();
            }}
          />
        )}

        {role === "player" && (
          <Button
            size="xl"
            aria-pressed={meReady}
            disabled={!connected}
            onClick={() => onToggleReady(!meReady)}
            className={cn(
              "min-w-[9.5rem] sm:min-w-[11rem]",
              meReady &&
                "bg-success text-success-foreground hover:bg-success/90 active:bg-success/80",
            )}
          >
            {meReady ? <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> : null}
            {meReady ? "Ready" : "Ready up"}
          </Button>
        )}

        {role === "spectator" && (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" aria-hidden />
            Watching
          </span>
        )}
      </div>
    </div>
  );
}

function StartButton({
  disabled,
  busy,
  reason,
  onStart,
}: {
  disabled: boolean;
  busy: boolean;
  reason: string | null;
  onStart: () => void;
}) {
  const button = (
    <Button
      variant="play"
      size="xl"
      disabled={disabled}
      onClick={onStart}
      className="min-w-[9.5rem] sm:min-w-[11rem]"
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Play className="h-5 w-5 fill-current" aria-hidden />
      )}
      Start
    </Button>
  );

  if (!disabled || !reason) return button;

  // A disabled button fires no pointer or focus events, so the tooltip hangs
  // off a focusable wrapper that keyboard users can reach too.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`Start, unavailable: ${reason}`}
          className={cn("inline-flex rounded-xl", focusRingClass)}
        >
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{reason}</TooltipContent>
    </Tooltip>
  );
}

/** One segment per seated player, filled when they count as ready. */
function ReadyMeter({ ready, total }: { ready: number; total: number }) {
  if (total <= 0) return null;
  return (
    <span aria-hidden className="flex min-w-0 max-w-40 flex-1 gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-hover ease-out-expo",
            i < ready ? "bg-success" : "bg-muted",
          )}
        />
      ))}
    </span>
  );
}
