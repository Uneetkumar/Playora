"use client";

import * as React from "react";

/**
 * High-performance ambient animated background.
 *
 * Renders smooth floating color orbs, a cybernetic perspective grid,
 * and particle dust across all pages without affecting CPU/render cycles.
 *
 * This layer used to paint an opaque `#07080E` across the whole viewport,
 * which is why choosing Light changed nothing visible: the light page
 * background was behind a fixed sheet of near-black. Base, grid and sheen now
 * come from tokens, and the glow orbs are damped in light, where the same
 * opacities read as muddy rather than atmospheric.
 */
export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none" aria-hidden>
      {/* 1. Deep Space Base Gradient */}
      <div className="absolute inset-0 bg-background" />

      {/* 2. Floating Ambient Glow Orbs */}
      <div className="absolute inset-0 opacity-40 dark:opacity-100">
      <div
        className="absolute -top-[20%] -left-[10%] h-[50vw] w-[50vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-br from-[#7C3AED]/25 via-[#6D28D9]/15 to-transparent blur-[120px] animate-[pulse_8s_ease-in-out_infinite]"
      />
      <div
        className="absolute top-[35%] -right-[15%] h-[55vw] w-[55vw] max-w-[750px] max-h-[750px] rounded-full bg-gradient-to-bl from-[#06B6D4]/20 via-[#3B82F6]/15 to-transparent blur-[130px] animate-[pulse_10s_ease-in-out_infinite_2s]"
      />
      <div
        className="absolute -bottom-[20%] left-[20%] h-[45vw] w-[45vw] max-w-[650px] max-h-[650px] rounded-full bg-gradient-to-tr from-[#EC4899]/15 via-[#8B5CF6]/10 to-transparent blur-[140px] animate-[pulse_12s_ease-in-out_infinite_4s]"
      />
      </div>

      {/* 3. Subtle Cybernetic Perspective Grid Lines */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
        }}
      />

      {/* 4. Top Horizon Light Sheen */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </div>
  );
}
