"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { Trophy, RotateCcw, Play, Check } from "lucide-react";

export function BridgeBuilderView({ onExit }: { onExit?: () => void }) {
  const budget = 1200;
  const cost = 650;
  const [material, setMaterial] = React.useState<"wood" | "steel" | "cable">("steel");
  const [trussHeight, setTrussHeight] = React.useState(50);
  const [simulating, setSimulating] = React.useState(false);
  const [truckX, setTruckX] = React.useState(20);
  const [bridgeSnapped, setBridgeSnapped] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const startTest = () => {
    if (simulating) return;
    setSimulating(true);
    setBridgeSnapped(false);
    setSuccess(false);
    setTruckX(20);
  };

  React.useEffect(() => {
    if (!simulating || bridgeSnapped || success) return;

    const interval = setInterval(() => {
      setTruckX((x) => {
        const nextX = x + 3;

        // Stress test in the middle
        if (nextX >= 180 && nextX <= 260) {
          if (trussHeight < 30) {
            // Weak structure!
            setBridgeSnapped(true);
            setSimulating(false);
            return nextX;
          }
        }

        if (nextX >= 380) {
          // Reached destination!
          setSuccess(true);
          setSimulating(false);
          return 380;
        }

        return nextX;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [simulating, trussHeight, bridgeSnapped, success]);

  const restart = () => {
    setSimulating(false);
    setTruckX(20);
    setBridgeSnapped(false);
    setSuccess(false);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-b from-[#0c4a6e] via-[#082f49] to-[#031524] p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
      {/* Top Bar */}
      <div className="flex w-full items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-cyan-400 uppercase tracking-widest">
            PHYSICS ENGINEERING
          </span>
          <h2 className="font-display text-xl sm:text-3xl font-black text-white">BRIDGE BUILDER</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-cyan-300">
            BUDGET: ${budget - cost}
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold text-emerald-300">
            {material.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Main Bridge Physics Viewport */}
      <div
        className="relative my-2 sm:my-4 flex flex-1 w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10,35,55,0.65), rgba(3,15,25,0.9)), url('/games/bridge-builder-thumb.jpg')`,
        }}
      >
        <svg viewBox="0 0 500 300" className="h-full w-full">
          {/* Cliffs on Left and Right */}
          <polygon points="0,120 100,120 70,300 0,300" fill="#334155" />
          <polygon points="400,120 500,120 500,300 430,300" fill="#334155" />
          {/* Water Gorge Below */}
          <rect x="0" y="240" width="500" height="60" fill="#0284c7" opacity="0.6" />

          {/* Bridge Road Deck */}
          {!bridgeSnapped ? (
            <line x1="90" y1="122" x2="410" y2="122" stroke="#64748b" strokeWidth="6" />
          ) : (
            <>
              <line x1="90" y1="122" x2="230" y2="180" stroke="#ef4444" strokeWidth="6" />
              <line x1="270" y1="190" x2="410" y2="122" stroke="#ef4444" strokeWidth="6" />
            </>
          )}

          {/* Structural Trusses with Dynamic Stress Coloring */}
          {!bridgeSnapped && (
            <g>
              <path
                d={`M 90 122 L 170 ${122 - trussHeight} L 250 122 L 330 ${122 - trussHeight} L 410 122`}
                fill="none"
                stroke={simulating ? (trussHeight < 30 ? "#ef4444" : "#10b981") : "#38bdf8"}
                strokeWidth="4"
              />
              <line x1={`170`} y1={`${122 - trussHeight}`} x2={`330`} y2={`${122 - trussHeight}`} stroke="#38bdf8" strokeWidth="3" />
              <line x1="170" y1={`${122 - trussHeight}`} x2="170" y2="122" stroke="#38bdf8" strokeWidth="3" />
              <line x1="330" y1={`${122 - trussHeight}`} x2="330" y2="122" stroke="#38bdf8" strokeWidth="3" />
            </g>
          )}

          {/* Heavy Cargo Truck */}
          <g transform={`translate(${truckX}, ${bridgeSnapped && truckX > 200 ? 200 : 100})`}>
            <rect x="0" y="0" width="34" height="18" rx="3" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
            <rect x="34" y="5" width="12" height="13" rx="2" fill="#ea580c" />
            <circle cx="8" cy="20" r="4" fill="#000" />
            <circle cx="26" cy="20" r="4" fill="#000" />
            <circle cx="40" cy="20" r="4" fill="#000" />
          </g>
        </svg>

        {/* Structure Height Slider Control */}
        {!simulating && (
          <div className="absolute top-3 right-3 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-1.5 backdrop-blur-md">
            <span className="text-[10px] font-bold text-white/70">TRUSS HEIGHT:</span>
            <input
              type="range"
              min="15"
              max="75"
              value={trussHeight}
              onChange={(e) => setTrussHeight(Number(e.target.value))}
              className="h-1.5 w-24 accent-cyan-400 cursor-pointer"
            />
          </div>
        )}

        {bridgeSnapped && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <h3 className="font-display text-3xl font-black text-rose-500">BRIDGE COLLAPSED!</h3>
            <p className="text-sm text-white/70">Increase truss height & steel reinforcement to withstand the truck weight.</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] px-6 font-bold">
              <RotateCcw className="h-4 w-4" /> Rebuild
            </Button>
          </div>
        )}

        {success && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md">
            <Trophy className="h-12 w-12 text-amber-400 animate-bounce" />
            <h3 className="font-display text-3xl font-black text-emerald-400 mt-2">BRIDGE CERTIFIED!</h3>
            <p className="text-sm text-white/70">Cargo delivered across safely under load!</p>
            <Button onClick={restart} className="mt-4 gap-2 bg-emerald-500 hover:bg-emerald-600 px-6 font-bold">
              <Check className="h-4 w-4" /> Next Test
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          {(["wood", "steel", "cable"] as const).map((mat) => (
            <button
              key={mat}
              type="button"
              onClick={() => setMaterial(mat)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold uppercase transition-all",
                material === mat
                  ? "bg-[#7c3aed] text-white shadow-md"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              {mat}
            </button>
          ))}
        </div>

        <Button
          onClick={startTest}
          disabled={simulating}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold px-8 py-3 text-xs shadow-xl"
        >
          <Play className="h-4 w-4 fill-white" /> TEST SIMULATION
        </Button>

        {onExit && (
          <Button variant="outline" onClick={onExit} className="border-white/20 text-white">
            Exit
          </Button>
        )}
      </div>
    </div>
  );
}
