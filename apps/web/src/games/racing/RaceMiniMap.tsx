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

export const MAP_COLOURS = [
  "#38bdf8", // You (Cyan)
  "#ef4444", // AI 1 (Red)
  "#f59e0b", // AI 2 (Amber)
  "#a855f7", // AI 3 (Purple)
  "#10b981", // AI 4 (Green)
  "#ec4899", // AI 5 (Pink)
  "#3b82f6", // AI 6 (Blue)
  "#f97316", // AI 7 (Orange)
];

const SIZE = 128;
const PADDING = 12;

/**
 * High-Contrast Tactical Radar Minimap.
 */
export function RaceMiniMap({
  track,
  vehicles,
}: {
  track: TrackSpec;
  vehicles: MapVehicle[];
}) {
  const projection = React.useMemo(() => project(track), [track]);

  return (
    <div className="relative rounded-2xl border border-white/20 bg-[#090b14]/85 p-2 shadow-2xl backdrop-blur-md">
      {/* Top ambient corner glow */}
      <div className="pointer-events-none absolute -top-4 -right-4 h-16 w-16 rounded-full bg-[#06b6d4]/20 blur-xl" />

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[116px] w-[116px]"
        role="img"
        aria-label="Tactical Track Radar"
      >
        {/* Track Outer Glow Outline */}
        <polyline
          points={projection.points}
          fill="none"
          stroke="rgba(6, 182, 212, 0.25)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Road Base Surface */}
        <polyline
          points={projection.points}
          fill="none"
          stroke="#1e293b"
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Neon Center Route Line */}
        <polyline
          points={projection.points}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start / Finish Checkered Gate */}
        <g transform={`translate(${projection.finish.x} ${projection.finish.y})`}>
          <circle r={5} fill="#06b6d4" opacity={0.4} />
          <circle r={3.2} fill="#ffffff" stroke="#0f172a" strokeWidth={1} />
        </g>

        {/* Opponents Blips (Drawn first) */}
        {vehicles
          .filter((v) => !v.isMe)
          .map((vehicle, idx) => {
            const at = projection.at(vehicle.distance);
            return (
              <g key={vehicle.playerId}>
                <circle cx={at.x} cy={at.y} r={3.8} fill={vehicle.colour} stroke="#0f172a" strokeWidth={1.2} />
                <text
                  x={at.x}
                  y={at.y + 2.5}
                  fontSize="6"
                  fontWeight="bold"
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}

        {/* Local Player (YOU) - High-Contrast Glowing Pulsing Beacon */}
        {vehicles
          .filter((v) => v.isMe)
          .map((vehicle) => {
            const at = projection.at(vehicle.distance);
            return (
              <g key={vehicle.playerId}>
                {/* Radar Halo Rings */}
                <circle cx={at.x} cy={at.y} r={8.5} fill="#4ade80" opacity={0.3} className="animate-ping" />
                <circle cx={at.x} cy={at.y} r={5.8} fill="#22c55e" opacity={0.5} />
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={3.8}
                  fill="#4ade80"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
      </svg>
    </div>
  );
}

/**
 * Fits the whole track into the map box with correct aspect ratio.
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

  const toMap = (x: number, z: number) => ({
    x: SIZE - (offsetX + (x - minX) * scale),
    y: SIZE - (offsetY + (z - minZ) * scale),
  });

  const mapped = line.map((point) => toMap(point.x, point.z));

  return {
    points: mapped.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    start: mapped[0] ?? { x: SIZE / 2, y: SIZE / 2 },
    finish: mapped[mapped.length - 1] ?? { x: SIZE / 2, y: SIZE / 2 },
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
  gap: number;
}

export function RaceStandings({ rows }: { rows: StandingRow[] }) {
  if (rows.length < 2) return null;

  return (
    <ol className="w-[116px] space-y-1 rounded-2xl border border-white/15 bg-[#090b14]/85 p-2 shadow-xl backdrop-blur-md">
      {rows.map((row) => (
        <li
          key={row.playerId}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] leading-tight",
            row.isMe
              ? "bg-[#7c3aed]/30 border border-[#7c3aed]/50 font-bold text-white shadow-sm"
              : "text-white/75",
          )}
        >
          <span className="numeric w-3.5 shrink-0 text-right font-black tabular-nums">{row.place}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: row.colour }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
          {!row.isMe && (
            <span className="numeric font-bold shrink-0 text-[10px] tabular-nums text-white/50">
              {row.finished ? "FIN" : formatGap(row.gap)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatGap(gap: number): string {
  if (Math.abs(gap) < 1) return "0";
  const rounded = Math.round(Math.abs(gap));
  const value = rounded >= 1000 ? `${(rounded / 1000).toFixed(1)}k` : `${rounded}`;
  return `${gap > 0 ? "+" : "−"}${value}`;
}
