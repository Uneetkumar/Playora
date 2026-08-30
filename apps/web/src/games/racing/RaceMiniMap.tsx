"use client";

import * as React from "react";
import { trackCenterline, type TrackSpec } from "@playora/game-engine";
import { cn } from "@playora/ui";

export interface MapVehicle {
  playerId: string;
  distance: number;
  isMe: boolean;
  colour: string;
  finished: boolean;
}

/**
 * Colours matching the order vehicles are added to the 3D scene.
 *
 * The same list, in the same order, as `CAR_COLOURS` in RaceScene — a car that
 * is red on the track and blue on the map is worse than no map at all.
 */
export const MAP_COLOURS = [
  "#ff2b3d",
  "#3ba7ff",
  "#4ade80",
  "#fbbf24",
  "#a855f7",
  "#f472b6",
  "#22d3ee",
  "#f97316",
];

const SIZE = 118;
const PADDING = 10;

/**
 * The track, seen from above, with everyone on it.
 *
 * Built from the same centreline the physics and the renderer use, so the
 * shape on the map is the shape being driven. The path is computed once per
 * track — it never changes — and only the dots move.
 */
export function RaceMiniMap({
  track,
  vehicles,
}: {
  track: TrackSpec;
  vehicles: MapVehicle[];
}) {
  // Projected once per track. Recomputing a few hundred points twelve times a
  // second for a shape that cannot change would be pure waste.
  const projection = React.useMemo(() => project(track), [track]);

  return (
    <div className="rounded-xl border border-white/15 bg-black/50 p-1.5 backdrop-blur-sm">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[104px] w-[104px]"
        role="img"
        aria-label="Track map"
      >
        {/* The road, drawn twice: a wide dark casing under a thin bright line,
            so it reads as a route rather than a scribble. */}
        <polyline
          points={projection.points}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={projection.points}
          fill="none"
          stroke="rgba(216,180,255,0.55)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start and finish. */}
        <circle cx={projection.start.x} cy={projection.start.y} r={3} fill="#4ade80" />
        <g transform={`translate(${projection.finish.x} ${projection.finish.y})`}>
          <circle r={4.2} fill="#ffffff" />
          <circle r={2.2} fill="#1a1030" />
        </g>

        {/* Everyone on the track. The player is drawn last and larger, so they
            are never hidden underneath a rival. */}
        {vehicles
          .filter((v) => !v.isMe)
          .map((vehicle) => {
            const at = projection.at(vehicle.distance);
            return (
              <circle
                key={vehicle.playerId}
                cx={at.x}
                cy={at.y}
                r={2.6}
                fill={vehicle.colour}
                opacity={vehicle.finished ? 0.45 : 1}
              />
            );
          })}

        {vehicles
          .filter((v) => v.isMe)
          .map((vehicle) => {
            const at = projection.at(vehicle.distance);
            return (
              <g key={vehicle.playerId}>
                <circle cx={at.x} cy={at.y} r={5.2} fill={vehicle.colour} opacity={0.35} />
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={3.2}
                  fill={vehicle.colour}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/**
 * Fits the whole track into the map box.
 *
 * Scaled by the longer axis and centred, so a track that runs mostly north to
 * south is not stretched sideways to fill the square.
 */
function project(track: TrackSpec) {
  const line = trackCenterline(track, 20);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of line) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = (SIZE - PADDING * 2) / Math.max(spanX, spanZ);
  const offsetX = (SIZE - spanX * scale) / 2;
  const offsetY = (SIZE - spanZ * scale) / 2;

  // The world's x is mirrored on screen (see trackToWorld), and z grows away
  // from the camera, so the map is flipped to match what the driver sees.
  const toMap = (x: number, z: number) => ({
    x: SIZE - (offsetX + (x - minX) * scale),
    y: SIZE - (offsetY + (z - minZ) * scale),
  });

  const mapped = line.map((point) => toMap(point.x, point.z));

  return {
    points: mapped.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    start: mapped[0] ?? { x: SIZE / 2, y: SIZE / 2 },
    finish: mapped[mapped.length - 1] ?? { x: SIZE / 2, y: SIZE / 2 },
    /** Where a vehicle at this distance sits on the map. */
    at(distance: number) {
      const raw = Math.max(0, Math.min(track.length, distance)) / 20;
      const index = Math.min(mapped.length - 1, Math.max(0, Math.floor(raw)));
      const next = Math.min(mapped.length - 1, index + 1);
      const t = raw - index;
      const a = mapped[index]!;
      const b = mapped[next]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    },
  };
}

export interface StandingRow {
  playerId: string;
  place: number;
  name: string;
  colour: string;
  isMe: boolean;
  finished: boolean;
  /** Metres ahead of, or behind, the player. */
  gap: number;
}

/** The order everyone is in, by name, updated as the race runs. */
export function RaceStandings({ rows }: { rows: StandingRow[] }) {
  if (rows.length < 2) return null;

  return (
    <ol className="w-[104px] space-y-1 rounded-xl border border-white/15 bg-black/50 p-1.5 backdrop-blur-sm">
      {rows.map((row) => (
        <li
          key={row.playerId}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[10px] leading-tight",
            row.isMe ? "bg-white/15 font-bold text-white" : "text-white/75",
          )}
        >
          <span className="numeric w-3 shrink-0 text-right tabular-nums">{row.place}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: row.colour }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          {!row.isMe && (
            <span className="numeric shrink-0 tabular-nums text-white/50">
              {row.finished ? "fin" : formatGap(row.gap)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Metres ahead (+) or behind (-), rounded to something readable at a glance. */
function formatGap(gap: number): string {
  if (Math.abs(gap) < 1) return "0";
  const rounded = Math.round(Math.abs(gap));
  const value = rounded >= 1000 ? `${(rounded / 1000).toFixed(1)}k` : `${rounded}`;
  return `${gap > 0 ? "+" : "−"}${value}`;
}
