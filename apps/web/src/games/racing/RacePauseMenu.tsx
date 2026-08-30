"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@playora/ui";
import { Play, RotateCcw, Settings, LogOut } from "lucide-react";

/**
 * The pause overlay.
 *
 * Offered only where pausing is meaningful. An online race runs on the server's
 * clock and does not stop because one player opened a menu, so there the same
 * button leaves the race instead of pretending to freeze it.
 */
export function RacePauseMenu({
  onResume,
  onRestart,
  onSettings,
  onLeave,
  canRestart,
}: {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onLeave: () => void;
  canRestart: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={reduced ? false : { scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="w-64 rounded-2xl border border-border bg-card p-5 shadow-2xl"
        role="dialog"
        aria-label="Race paused"
      >
        <h2 className="mb-4 text-center font-display text-xl font-black tracking-wide text-foreground">
          RACE PAUSED
        </h2>

        <div className="flex flex-col gap-2">
          <Button className="gap-2" onClick={onResume} autoFocus>
            <Play className="h-4 w-4" aria-hidden />
            Resume
          </Button>
          {canRestart && (
            <Button variant="outline" className="gap-2" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Restart
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={onSettings}>
            <Settings className="h-4 w-4" aria-hidden />
            Settings
          </Button>
          <Button variant="outline" className="gap-2" onClick={onLeave}>
            <LogOut className="h-4 w-4" aria-hidden />
            Leave race
          </Button>
        </div>

        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Esc closes this menu
        </p>
      </motion.div>
    </div>
  );
}
