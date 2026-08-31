"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Users, Trophy, RotateCcw, ArrowRight, Play, Sparkles } from "lucide-react";

export function RopeRescueView({ onExit }: { onExit?: () => void }) {
  const [level, setLevel] = React.useState(1);
  const [survivors, setSurvivors] = React.useState(10);
  const [rescued, setRescued] = React.useState(0);
  const [lost, setLost] = React.useState(0);
  const [isZipping, setIsZipping] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [stars, setStars] = React.useState(0);

  // Rope anchor points
  const [anchorY, setAnchorY] = React.useState(180);

  const startRescue = () => {
    if (survivors <= 0 || isZipping || gameOver) return;
    setIsZipping(true);
  };

  const stopRescue = () => {
    setIsZipping(false);
  };

  React.useEffect(() => {
    if (!isZipping || survivors <= 0 || gameOver) return;

    const timer = setInterval(() => {
      setSurvivors((s) => {
        if (s <= 1) {
          setIsZipping(false);
          setGameOver(true);
        }
        return Math.max(0, s - 1);
      });

      // Saw collision check based on anchor position
      const hitHazard = Math.random() < 0.15;
      if (hitHazard) {
        setLost((l) => l + 1);
      } else {
        setRescued((r) => r + 1);
      }
    }, 380);

    return () => clearInterval(timer);
  }, [isZipping, survivors, gameOver]);

  React.useEffect(() => {
    if (gameOver) {
      const rescuedPct = rescued / 10;
      if (rescuedPct >= 0.8) setStars(3);
      else if (rescuedPct >= 0.5) setStars(2);
      else if (rescuedPct > 0) setStars(1);
      else setStars(0);
    }
  }, [gameOver, rescued]);

  const restart = () => {
    setSurvivors(10);
    setRescued(0);
    setLost(0);
    setIsZipping(false);
    setGameOver(false);
    setStars(0);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#1e1b4b] via-[#0f172a] to-[#020617] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase tracking-widest">
            PHYSICS PUZZLE
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">ROPE RESCUE</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-400">
            L{level}
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-emerald-400">
            SAVED: {rescued}/10
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-rose-400">
            LOST: {lost}
          </div>
        </div>
      </div>

      {/* Main Physics Canvas Simulation */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(5,10,25,0.7), rgba(2,6,23,0.85)), url('/games/rope-rescue-thumb.jpg')`,
        }}
      >
        {/* Left Cliff: Survivors Waiting */}
        <div className="absolute left-6 top-12 flex flex-col items-center rounded-2xl border border-amber-400/40 bg-black/60 backdrop-blur-md p-3.5 shadow-2xl">
          <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">DANGER CLIFF</span>
          <div className="mt-1 flex items-center gap-2 font-display text-xl font-black text-white">
            <Users className="h-5 w-5 text-amber-400 animate-pulse" />
            {survivors}
          </div>
        </div>

        {/* Right Cliff: Safe Ambulance Zone */}
        <div className="absolute right-6 bottom-12 flex flex-col items-center rounded-2xl border border-emerald-400/40 bg-black/60 backdrop-blur-md p-3.5 shadow-2xl">
          <span className="text-[10px] font-black tracking-widest text-emerald-300 uppercase">SAFE HELIPAD</span>
          <div className="mt-1 flex items-center gap-2 font-display text-xl font-black text-emerald-400">
            <Trophy className="h-5 w-5" />
            {rescued}
          </div>
        </div>

        {/* SVG Tension Rope & Hazards */}
        <svg viewBox="0 0 500 300" className="h-full w-full drop-shadow-2xl">
          <defs>
            <linearGradient id="steel-cable" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFF7D6" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <radialGradient id="saw-metal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="60%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#1E293B" />
            </radialGradient>
            <filter id="glow-saw" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Left Cliff Structure */}
          <polygon points="0,40 85,40 50,300 0,300" fill="#1e293b" stroke="#334155" strokeWidth="2" opacity="0.9" />
          <line x1="85" y1="40" x2="50" y2="300" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />

          {/* Right Helipad Structure */}
          <polygon points="415,220 500,220 500,300 380,300" fill="#0f172a" stroke="#10b981" strokeWidth="2" opacity="0.9" />
          {/* Helipad Glow Ring */}
          <ellipse cx="445" cy="235" rx="35" ry="12" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4 2" />

          {/* Tension Rope Line */}
          <path
            d={`M 80 65 Q 250 ${anchorY} 420 230`}
            fill="none"
            stroke="url(#steel-cable)"
            strokeWidth="6"
            strokeLinecap="round"
            className={isZipping ? "animate-pulse" : ""}
          />

          {/* Anchor Pivot Wheel */}
          <circle cx="250" cy={anchorY} r="12" fill="#0284c7" stroke="#38bdf8" strokeWidth="3" className="drop-shadow-lg" />
          <circle cx="250" cy={anchorY} r="4" fill="#ffffff" />

          {/* Spinning Hazard Saw Blade with Teeth & Sparks */}
          <g transform="translate(240, 95)" className="animate-spin origin-center" filter="url(#glow-saw)">
            <circle cx="0" cy="0" r="26" fill="#dc2626" opacity="0.35" />
            <circle cx="0" cy="0" r="20" fill="url(#saw-metal)" stroke="#fca5a5" strokeWidth="2" />
            {/* Saw Teeth */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <path
                key={deg}
                d="M 0 -22 L 4 -16 L -4 -16 Z"
                fill="#ffffff"
                transform={`rotate(${deg})`}
              />
            ))}
            <circle cx="0" cy="0" r="6" fill="#0f172a" stroke="#dc2626" strokeWidth="2" />
          </g>

          {/* Zipline Survivor Gondola */}
          {isZipping && (
            <g transform="translate(225, 155)" className="animate-bounce">
              {/* Pulley wheels on rope */}
              <circle cx="0" cy="-6" r="4" fill="#38bdf8" stroke="#fff" strokeWidth="1" />
              <line x1="0" y1="-6" x2="0" y2="4" stroke="#e2e8f0" strokeWidth="2" />
              {/* Gondola Pod */}
              <rect x="-10" y="4" width="20" height="14" rx="4" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
              <circle cx="0" cy="11" r="3" fill="#fef08a" />
            </g>
          )}
        </svg>

        {/* Anchor Adjustment Slider Control */}
        <div className="absolute top-4 right-6 flex items-center gap-3 rounded-2xl border border-white/20 bg-black/60 px-4 py-2 backdrop-blur-md shadow-2xl">
          <span className="text-xs font-black tracking-wider text-cyan-300">ROPE TENSION:</span>
          <input
            type="range"
            min="100"
            max="220"
            value={anchorY}
            onChange={(e) => setAnchorY(Number(e.target.value))}
            className="h-2 w-28 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <Button variant="ghost" onClick={restart} className="gap-2 text-white/70 hover:text-white">
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>

        {/* Hold to Zip-line Button */}
        {!gameOver ? (
          <button
            type="button"
            onPointerDown={startRescue}
            onPointerUp={stopRescue}
            onPointerLeave={stopRescue}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-10 py-4 font-display text-sm font-black uppercase tracking-wider text-white shadow-2xl transition-all active:scale-95",
              isZipping
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_30px_rgba(16,185,129,0.7)] scale-105"
                : "bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce]"
            )}
          >
            <Play className="h-4 w-4 fill-white" />
            {isZipping ? "RESCUING..." : "HOLD TO RESCUE"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Sparkles
                  key={i}
                  className={cn(
                    "h-6 w-6",
                    i < stars ? "text-amber-400 fill-amber-400" : "text-white/20"
                  )}
                />
              ))}
            </div>
            <Button
              onClick={() => {
                setLevel((l) => l + 1);
                restart();
              }}
              className="gap-2 bg-emerald-500 hover:bg-emerald-600 font-bold px-6"
            >
              NEXT LEVEL <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {onExit && (
          <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
