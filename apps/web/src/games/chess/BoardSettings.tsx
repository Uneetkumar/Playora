"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Palette, RefreshCw, X, Sparkles, Check } from "lucide-react";
import { BOARD_THEMES } from "./board-themes";
import { PIECE_SETS, ChessPiece, type PieceSetId } from "./pieces";

/**
 * Board appearance & piece customization modal/dropdown.
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
        className="gap-2 border-white/10 bg-[#161926]/90 hover:bg-white/10 text-white font-semibold shadow-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Palette className="h-4 w-4 text-[#A855F7]" aria-hidden />
        Board & Pieces
      </Button>

      {open && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            className={cn(
              "z-50 w-84 sm:w-96 rounded-2xl border border-white/15 bg-[#121524] p-5 shadow-2xl backdrop-blur-xl",
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
              "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:translate-x-0 sm:translate-y-0"
            )}
            role="dialog"
            aria-label="Board and piece appearance"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#A855F7]" />
                <h3 className="font-display text-base font-bold text-white">Board & Piece Styles</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* Board Themes */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  Board Theme
                </span>
                <span className="text-xs font-semibold text-[#A855F7]">
                  {BOARD_THEMES.find((t) => t.id === themeId)?.label}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChooseTheme(t.id)}
                    aria-pressed={themeId === t.id}
                    title={t.label}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 p-1 transition-all flex flex-col items-center gap-1",
                      themeId === t.id
                        ? "border-[#7C3AED] bg-[#7C3AED]/20 shadow-md scale-105"
                        : "border-white/5 bg-white/5 hover:border-white/20 hover:scale-102"
                    )}
                  >
                    <span className="grid h-7 w-full grid-cols-2 rounded-lg overflow-hidden border border-black/20" aria-hidden>
                      <span style={{ background: t.light }} />
                      <span style={{ background: t.dark }} />
                    </span>
                    <span className="text-[10px] font-bold text-white/80 truncate w-full text-center">
                      {t.label}
                    </span>
                    {themeId === t.id && (
                      <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Piece Sets */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  Piece Style
                </span>
                <span className="text-xs font-semibold text-[#A855F7]">
                  {PIECE_SETS.find((s) => s.id === pieceSet)?.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {PIECE_SETS.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => onChoosePieceSet(set.id)}
                    aria-pressed={pieceSet === set.id}
                    title={set.hint}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all",
                      pieceSet === set.id
                        ? "border-[#7C3AED] bg-[#7C3AED]/20 shadow-md scale-105"
                        : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center">
                      <ChessPiece type="n" color="w" set={set.id} />
                    </span>
                    <span className="text-xs font-bold text-white leading-none">{set.label}</span>
                    <span className="text-[9px] text-white/50 leading-tight text-center truncate w-full">
                      {set.hint}
                    </span>
                    {pieceSet === set.id && (
                      <span className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Flip Board Action */}
            <div className="mt-5 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-white/10 bg-white/5 text-white hover:bg-white/15 font-semibold"
                onClick={onFlip}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Flip Board Perspective
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
