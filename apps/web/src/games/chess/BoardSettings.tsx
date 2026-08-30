"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Palette, RefreshCw, X } from "lucide-react";
import { BOARD_THEMES } from "./board-themes";
import { PIECE_SETS, ChessPiece, type PieceSetId } from "./pieces";

/**
 * Board appearance controls.
 *
 * Both choices are previewed rather than named alone — nobody knows what
 * "Forest" or "Modern" looks like from the word, and picking blind then undoing
 * is a worse experience than a two-square swatch.
 */
export function BoardSettings({
  themeId,
  pieceSet,
  onChooseTheme,
  onChoosePieceSet,
  onFlip,
}: {
  themeId: string;
  pieceSet: PieceSetId;
  onChooseTheme: (id: string) => void;
  onChoosePieceSet: (id: PieceSetId) => void;
  onFlip: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Palette className="h-4 w-4" aria-hidden />
        Board
      </Button>

      {open && (
        <>
          {/* Below lg the panel is a centred sheet, because there is no room
              beside the board to put it. */}
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "z-50 w-72 rounded-xl border border-border bg-card p-4 shadow-raised",
              // Docked beside the trigger on a wide screen, so the board stays
              // visible while a theme is being previewed — the whole point of
              // previewing one. It used to drop straight down over the board.
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "lg:absolute lg:left-full lg:top-0 lg:ml-3 lg:translate-x-0 lg:translate-y-0",
            )}
            role="dialog"
            aria-label="Board appearance"
          >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">Appearance</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Board
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChooseTheme(t.id)}
                aria-pressed={themeId === t.id}
                title={t.label}
                className={cn(
                  "overflow-hidden rounded-lg border-2 transition-transform hover:scale-105",
                  themeId === t.id ? "border-primary" : "border-transparent",
                )}
              >
                {/* Two squares is enough to judge a board at a glance. */}
                <span className="grid h-9 w-full grid-cols-2" aria-hidden>
                  <span style={{ background: t.light }} />
                  <span style={{ background: t.dark }} />
                </span>
                <span className="sr-only">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {BOARD_THEMES.find((t) => t.id === themeId)?.label}
          </p>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pieces
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PIECE_SETS.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => onChoosePieceSet(set.id)}
                aria-pressed={pieceSet === set.id}
                title={set.hint}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
                  pieceSet === set.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center">
                  <ChessPiece type="n" color="w" set={set.id} />
                </span>
                <span className="text-[10px] font-medium text-foreground">{set.label}</span>
              </button>
            ))}
          </div>

            <Button variant="outline" size="sm" className="mt-4 w-full gap-2" onClick={onFlip}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Flip board
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
