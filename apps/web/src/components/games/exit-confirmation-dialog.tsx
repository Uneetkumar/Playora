"use client";

import * as React from "react";
import { Button } from "@playora/ui";
import { AlertTriangle, Play, LogOut, X } from "lucide-react";

interface ExitConfirmationDialogProps {
  open: boolean;
  gameName?: string;
  onConfirmExit: () => void;
  onResume: () => void;
}

export function ExitConfirmationDialog({
  open,
  gameName = "Game",
  onConfirmExit,
  onResume,
}: ExitConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#0F111E] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Top glowing specular flare */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C084FC] to-transparent" />

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-black text-white leading-tight">
              Match Paused · Leave {gameName}?
            </h3>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Your match is currently in progress. Leaving now will forfeit or reset this game session.
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onConfirmExit}
            className="gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 text-xs font-bold h-11 rounded-xl order-2 sm:order-1"
          >
            <LogOut className="h-4 w-4" />
            <span>Leave Match</span>
          </Button>

          <Button
            onClick={onResume}
            className="gap-2 bg-gradient-to-r from-[#7C3AED] to-[#9333EA] hover:opacity-90 text-white text-xs font-black h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] order-1 sm:order-2"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Resume Game</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
