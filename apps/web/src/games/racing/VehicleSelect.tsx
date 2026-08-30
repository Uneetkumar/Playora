"use client";

import * as React from "react";
import { Button, Card, cn } from "@playora/ui";
import { vehicleStats, vehiclesFor, type VehicleSpec } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

/**
 * The garage.
 *
 * The stat bars are computed from the same modifiers the physics uses, so a
 * vehicle that shows more speed genuinely has a higher top speed. Bars authored
 * separately from the tuning they describe drift apart within a patch or two,
 * and then the garage is quietly lying to the player.
 */
export function VehicleSelect({
  gameId,
  selectedId,
  onSelect,
  onConfirm,
  confirmLabel = "Select vehicle",
}: {
  gameId: GameId;
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const roster = React.useMemo(() => vehiclesFor(gameId), [gameId]);
  const index = Math.max(0, roster.findIndex((v) => v.id === selectedId));
  const vehicle = roster[index] ?? roster[0]!;
  const isBike = gameId === "bike-race";

  const step = (delta: number) => {
    const next = (index + delta + roster.length) % roster.length;
    onSelect(roster[next]!.id);
  };

  return (
    <Card className="border-border bg-card p-5">
      <h2 className="mb-4 font-display text-lg font-bold text-foreground">
        {isBike ? "Choose your bike" : "Choose your car"}
      </h2>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous vehicle"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <VehiclePreview vehicle={vehicle} isBike={isBike} />
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next vehicle"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 text-center">
        <p className="font-display text-lg font-bold text-foreground">{vehicle.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{vehicle.blurb}</p>
      </div>

      <dl className="mt-4 space-y-2">
        <StatBar label="Speed" value={vehicleStats(vehicle).speed} />
        <StatBar label="Acceleration" value={vehicleStats(vehicle).acceleration} />
        <StatBar label="Handling" value={vehicleStats(vehicle).handling} />
        <StatBar label="Nitro" value={vehicleStats(vehicle).nitro} />
      </dl>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {roster.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-label={option.name}
            aria-pressed={option.id === vehicle.id}
            className={cn(
              "h-10 w-14 rounded-lg border-2 transition-transform hover:scale-105",
              option.id === vehicle.id ? "border-primary" : "border-border/60",
            )}
            style={{ backgroundColor: `#${option.colour.toString(16).padStart(6, "0")}` }}
          >
            {option.id === vehicle.id && (
              <Check className="mx-auto h-4 w-4 text-white drop-shadow" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {onConfirm && (
        <Button className="mt-4 w-full" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      )}
    </Card>
  );
}

/**
 * A quick side-on sketch of the vehicle.
 *
 * SVG rather than a second 3D scene: a WebGL context per garage card is an
 * expensive way to show a shape that never moves, and browsers cap how many
 * contexts a page may hold.
 */
function VehiclePreview({ vehicle, isBike }: { vehicle: VehicleSpec; isBike: boolean }) {
  const colour = `#${vehicle.colour.toString(16).padStart(6, "0")}`;

  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-border/60 bg-gradient-to-b from-primary/10 to-transparent">
      <svg viewBox="0 0 120 50" className="h-24 w-full" role="img" aria-label={vehicle.name}>
        {isBike ? (
          <>
            <circle cx="30" cy="36" r="11" fill="none" stroke="#2a2140" strokeWidth="4" />
            <circle cx="90" cy="36" r="11" fill="none" stroke="#2a2140" strokeWidth="4" />
            <path d="M30 36 L58 22 L78 24 L90 36" fill="none" stroke={colour} strokeWidth="5" strokeLinecap="round" />
            <path d="M58 22 L52 12 L66 14 Z" fill={colour} />
            <path d="M78 24 L88 14" stroke="#4a4a6a" strokeWidth="3" strokeLinecap="round" />
            <circle cx="70" cy="14" r="5" fill="#1a1030" />
          </>
        ) : (
          <>
            <path
              d="M14 36 L22 26 L44 20 L76 20 L96 27 L106 36 Z"
              fill={colour}
              stroke="#1a1030"
              strokeWidth="1.5"
            />
            <path d="M46 20 L54 11 L74 11 L80 20 Z" fill="#0d0a1c" />
            <rect x="76" y="14" width="18" height="3" rx="1.5" fill="#2a2140" />
            <circle cx="34" cy="38" r="8" fill="#14101f" stroke="#d8d8e8" strokeWidth="2.5" />
            <circle cx="88" cy="38" r="8" fill="#14101f" stroke="#d8d8e8" strokeWidth="2.5" />
            <rect x="104" y="29" width="5" height="4" rx="1" fill="#fff3c4" />
          </>
        )}
      </svg>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-300"
            style={{ width: `${(value / 10) * 100}%` }}
          />
        </div>
        <span className="numeric w-7 text-right text-xs font-bold tabular-nums text-foreground">
          {value.toFixed(1)}
        </span>
      </dd>
    </div>
  );
}

/** Which vehicle the player last chose, per game, remembered on this device. */
export function useChosenVehicle(gameId: GameId) {
  const roster = React.useMemo(() => vehiclesFor(gameId), [gameId]);
  const [id, setId] = React.useState(roster[0]!.id);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`playora:vehicle:${gameId}`);
      // Only accept an id that still exists: the roster can change between
      // releases, and a stale id would silently seat the player in nothing.
      if (stored && roster.some((v) => v.id === stored)) setId(stored);
      else setId(roster[0]!.id);
    } catch {
      setId(roster[0]!.id);
    }
  }, [gameId, roster]);

  const choose = React.useCallback(
    (next: string) => {
      setId(next);
      try {
        localStorage.setItem(`playora:vehicle:${gameId}`, next);
      } catch {
        /* storage unavailable; the choice simply will not persist */
      }
    },
    [gameId],
  );

  return { vehicleId: id, chooseVehicle: choose };
}
