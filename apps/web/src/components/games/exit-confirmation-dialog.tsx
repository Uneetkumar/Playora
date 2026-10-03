"use client";

import * as React from "react";
import { ConfirmDialog } from "@playora/ui";
import { LogOut } from "lucide-react";

interface ExitConfirmationDialogProps {
  open: boolean;
  gameName?: string;
  onConfirmExit: () => void;
  onResume: () => void;
}

/**
 * "Leave the match?", asked before a game in progress is abandoned.
 *
 * A thin wrapper over the shared ConfirmDialog, kept so the views that call
 * it need no changes. The hand-built version it replaces had no dialog role,
 * no focus trap and no Escape, and painted fixed dark colours that ignored
 * the light theme. ConfirmDialog brings alert-dialog semantics, starts focus
 * on Resume so a stray Enter keeps the player in the game, and treats
 * Escape as Resume. A tap outside does nothing, because an accidental tap
 * must not count as an answer.
 *
 * Games adopting GameShell get this question from the shell instead, asked
 * only while `matchInProgress` is true.
 */
export function ExitConfirmationDialog({
  open,
  gameName = "Game",
  onConfirmExit,
  onResume,
}: ExitConfirmationDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      variant="destructive"
      icon={<LogOut />}
      title={`Leave ${gameName}?`}
      description="Your match is still in progress. Leaving now forfeits or resets it."
      confirmLabel="Leave match"
      cancelLabel="Resume game"
      onConfirm={onConfirmExit}
      onCancel={onResume}
    />
  );
}
