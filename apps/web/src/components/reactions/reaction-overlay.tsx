"use client";

import * as React from "react";

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

const AVAILABLE_REACTIONS = ["❤️", "🔥", "😂", "😱", "👏", "🎉", "👑", "GG"];

export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Animated Floating Badges */}
      {reactions.map((item) => (
        <div
          key={item.id}
          className="absolute bottom-16 animate-float-fade flex flex-col items-center select-none"
          style={{
            left: `${item.leftPercent}%`,
          }}
        >
          <div className="text-4xl sm:text-5xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transform hover:scale-125 transition-transform">
            {item.emoji}
          </div>
          {item.senderName && (
            <span className="text-[10px] bg-slate-900/80 text-slate-300 font-semibold px-2 py-0.5 rounded-full border border-slate-700/50 shadow mt-1">
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
}: {
  onSelectReaction: (emoji: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-full shadow-lg backdrop-blur-md">
      {AVAILABLE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelectReaction(emoji)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-base hover:scale-125 hover:bg-slate-800 active:scale-95 transition-all duration-150"
          title={`Send ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
