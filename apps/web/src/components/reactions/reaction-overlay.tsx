"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger, cn, focusRingClass } from "@playora/ui";
import { useReducedMotionPref } from "../../lib/motion";

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName?: string;
  leftPercent: number; // 10% to 90%
}

interface ReactionOverlayProps {
  reactions: FloatingReaction[];
  onSendReaction?: (emoji: string) => void;
}

/**
 * The reactions a room can send, with the name a screen reader and the
 * tooltip use. These are content people send each other, not interface
 * icons, which is why they are emoji.
 */
export const AVAILABLE_REACTIONS: readonly { emoji: string; label: string }[] = [
  { emoji: "❤️", label: "Love" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😱", label: "Shock" },
  { emoji: "👏", label: "Applause" },
  { emoji: "🎉", label: "Party" },
  { emoji: "👑", label: "Crown" },
  { emoji: "GG", label: "Good game" },
];

/** "GG" and the like: a word, drawn as a pill rather than at emoji size. */
function isWordReaction(emoji: string): boolean {
  return /^[A-Za-z]+$/.test(emoji);
}

/**
 * Reactions floating up over the room.
 *
 * Under reduced motion they appear in place and leave when their time is up
 * (the parent removes them), rather than rising: the float would otherwise be
 * collapsed by the global rules to its final, invisible frame.
 */
export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  const reduced = useReducedMotionPref();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-toast overflow-hidden">
      {reactions.map((item) => (
        <div
          key={item.id}
          className={cn(
            "absolute flex select-none flex-col items-center",
            reduced ? "bottom-24" : "bottom-16 animate-float-fade",
          )}
          style={{ left: `${item.leftPercent}%` }}
        >
          <div
            className={cn(
              "drop-shadow-lg",
              isWordReaction(item.emoji)
                ? "rounded-full bg-primary px-3 py-1 font-display text-2xl font-extrabold text-primary-foreground"
                : "text-4xl sm:text-5xl",
            )}
          >
            {item.emoji}
          </div>
          {item.senderName && (
            <span className="mt-1 rounded-full border border-border bg-popover px-2 py-0.5 text-xs font-semibold text-popover-foreground shadow-raised">
              {item.senderName}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function ReactionPicker({
  onSelectReaction,
  className,
}: {
  onSelectReaction: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Send a reaction" className={cn("flex items-center justify-between gap-1", className)}>
      {AVAILABLE_REACTIONS.map(({ emoji, label }) => (
        <Tooltip key={emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onSelectReaction(emoji)}
              aria-label={`React: ${label}`}
              className={cn(
                "grid h-9 min-w-9 place-items-center rounded-full px-1 text-lg leading-none",
                "transition-[background-color,transform] duration-hover ease-out-expo hover:bg-foreground/[0.08] active:scale-[0.92] active:duration-press",
                "motion-reduce:active:scale-100 [.reduce-motion_&]:active:scale-100",
                isWordReaction(emoji) && "font-display text-xs font-extrabold text-primary-accent",
                focusRingClass,
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
