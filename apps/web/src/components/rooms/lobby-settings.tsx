"use client";

import * as React from "react";
import { AI_LEVELS, AI_LEVEL_LABELS, type AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import {
  DEFAULT_BOT_LEVEL,
  RACE_LAPS_MAX,
  RACE_LAPS_MIN,
  roomOptionKeysFor,
  type RoomOptions,
} from "@playora/protocol";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@playora/ui";
import { Bot, Flag, SlidersHorizontal } from "lucide-react";

/**
 * The room's match settings: what the host can change, and what everyone
 * else sees of it.
 *
 * Only the options the game offers are drawn (`roomOptionKeysFor`, the same
 * whitelist the server enforces). UNO house rules exist in the protocol but
 * the engines do not apply them yet, so they are not offered here: a switch
 * that changes nothing is worse than no switch.
 */

const LAP_PRESETS = [1, 3, 5, 10] as const;

export function LobbySettings({
  gameId,
  options,
  editable,
  hasBots,
  onChange,
  className,
}: {
  gameId: GameId;
  options: RoomOptions;
  /** The viewer is the host and the room is between matches. */
  editable: boolean;
  /** A bot is seated, so its level is worth showing here as well as in the add-bot seat. */
  hasBots: boolean;
  onChange: (patch: RoomOptions) => void;
  className?: string;
}) {
  const keys = roomOptionKeysFor(gameId);
  const showLaps = keys.includes("laps");
  const showBots = keys.includes("botLevel") && hasBots;
  if (!showLaps && !showBots) return null;

  const laps = options.laps;
  const botLevel = (options.botLevel ?? DEFAULT_BOT_LEVEL) as AiLevel;

  return (
    <section aria-labelledby="lobby-settings-title" className={cn("rounded-xl border border-border bg-card p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary-accent" aria-hidden />
        <h2 id="lobby-settings-title" className="font-display text-base font-bold text-foreground">
          Match settings
        </h2>
        {!editable && <span className="ml-auto text-xs text-muted-foreground">Set by the host</span>}
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {showLaps && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm text-muted-foreground" id="laps-label">
              <Flag className="h-3.5 w-3.5" aria-hidden />
              Laps
            </Label>
            {editable ? (
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  aria-labelledby="laps-label"
                  value={laps !== undefined && (LAP_PRESETS as readonly number[]).includes(laps) ? String(laps) : ""}
                  onValueChange={(v) => v && onChange({ laps: Number(v) })}
                >
                  {LAP_PRESETS.map((n) => (
                    <ToggleGroupItem key={n} value={String(n)} className="numeric min-w-11">
                      {n}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Select value={laps !== undefined ? String(laps) : ""} onValueChange={(v) => onChange({ laps: Number(v) })}>
                  <SelectTrigger aria-label="Exact number of laps" className="h-10 w-28">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: RACE_LAPS_MAX - RACE_LAPS_MIN + 1 }, (_, i) => i + RACE_LAPS_MIN).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "lap" : "laps"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="numeric text-sm font-semibold text-foreground">
                {laps !== undefined ? `${laps} ${laps === 1 ? "lap" : "laps"}` : "Track default"}
              </p>
            )}
          </div>
        )}

        {showBots && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm text-muted-foreground" htmlFor="bot-level">
              <Bot className="h-3.5 w-3.5" aria-hidden />
              Bot level
            </Label>
            {editable ? (
              <Select value={String(botLevel)} onValueChange={(v) => onChange({ botLevel: Number(v) })}>
                <SelectTrigger id="bot-level" className="h-10">
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
            ) : (
              <p className="text-sm font-semibold text-foreground">
                Level {botLevel} · {AI_LEVEL_LABELS[botLevel]}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
