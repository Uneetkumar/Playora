"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import type { VehicleSpec } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";
import {
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Gauge,
  Lock,
  Plus,
  Shield,
  ShoppingBag,
  X,
  Zap,
} from "lucide-react";
import { VehicleShowroom3D } from "./VehicleShowroom3D";
import { useRouter } from "next/navigation";

export type GarageTab = "performance" | "customize" | "upgrades" | "paint" | "wheels" | "nitro";
export type FilterTab = "all" | "owned" | "locked";

const COLOR_SWATCHES = [
  { id: "red", hex: 0xdc2626, label: "Crimson Red" },
  { id: "blue", hex: 0x2563eb, label: "Cobalt Blue" },
  { id: "charcoal", hex: 0x1e293b, label: "Stealth Gray" },
  { id: "silver", hex: 0xe2e8f0, label: "Glacier Silver" },
  { id: "yellow", hex: 0xf59e0b, label: "Solar Gold" },
  { id: "green", hex: 0x10b981, label: "Viper Green" },
  { id: "purple", hex: 0xa855f7, label: "Phantom Violet" },
];

const CAR_ROSTER_DATA = [
  {
    id: "eclipse-gt",
    name: "ECLIPSE GT",
    classType: "SPORTS",
    pr: 1287,
    owned: true,
    engine: "3.2L V8",
    power: "620 HP",
    weight: "1,450 KG",
    drive: "RWD",
    blurb: "Balanced performance for speed, handling and control.",
    specs: { topSpeed: 8.4, acceleration: 7.6, handling: 8.1, nitro: 7.3 },
    colour: 0xdc2626,
  },
  {
    id: "thunder-v10",
    name: "THUNDER V10",
    classType: "SUPER",
    pr: 1520,
    owned: false,
    engine: "5.2L V10",
    power: "740 HP",
    weight: "1,380 KG",
    drive: "AWD",
    blurb: "High-revving V10 engineered for explosive straight-line speed.",
    specs: { topSpeed: 9.1, acceleration: 8.4, handling: 7.8, nitro: 7.9 },
    colour: 0x94a3b8,
  },
  {
    id: "phantom-rs",
    name: "PHANTOM RS",
    classType: "HYPER",
    pr: 1785,
    owned: false,
    engine: "4.0L V8 Twin-Turbo",
    power: "820 HP",
    weight: "1,290 KG",
    drive: "AWD",
    blurb: "Ultra-lightweight carbon chassis with extreme downforce.",
    specs: { topSpeed: 9.4, acceleration: 9.0, handling: 8.8, nitro: 8.5 },
    colour: 0xf97316,
  },
  {
    id: "velocity-x",
    name: "VELOCITY X",
    classType: "HYPER",
    pr: 1995,
    owned: false,
    engine: "Quad-Turbo Hybrid",
    power: "980 HP",
    weight: "1,240 KG",
    drive: "AWD",
    blurb: "Experimental hybrid hypercar built for record-shattering lap times.",
    specs: { topSpeed: 9.8, acceleration: 9.6, handling: 9.2, nitro: 9.4 },
    colour: 0xef4444,
  },
  {
    id: "inferno-zx",
    name: "INFERNO ZX",
    classType: "EXTREME",
    pr: 2200,
    owned: false,
    engine: "6.0L Twin-Turbo W12",
    power: "1,150 HP",
    weight: "1,180 KG",
    drive: "AWD",
    blurb: "Pinnacle track weapon with unmatched top speed and titanium exhausts.",
    specs: { topSpeed: 10.0, acceleration: 9.9, handling: 9.7, nitro: 9.9 },
    colour: 0x18181b,
  },
];

const BIKE_ROSTER_DATA = [
  {
    id: "raptor-900",
    name: "RAPTOR 900",
    classType: "SPORT",
    pr: 1225,
    owned: true,
    engine: "900cc 4-CYL",
    power: "145 HP",
    weight: "199 KG",
    drive: "RWD",
    blurb: "Agile and balanced bike built for speed and control.",
    specs: { topSpeed: 8.6, acceleration: 8.2, handling: 8.7, nitro: 7.8 },
    colour: 0x10b981,
  },
  {
    id: "nighthawk-1000",
    name: "NIGHTHAWK 1000",
    classType: "SUPER",
    pr: 1460,
    owned: false,
    engine: "1000cc Inline-4",
    power: "185 HP",
    weight: "190 KG",
    drive: "RWD",
    blurb: "Aerodynamic supersport tuned for razor-sharp cornering.",
    specs: { topSpeed: 9.0, acceleration: 8.7, handling: 8.9, nitro: 8.1 },
    colour: 0x06b6d4,
  },
  {
    id: "phoenix-zx",
    name: "PHOENIX ZX",
    classType: "HYPER",
    pr: 1720,
    owned: false,
    engine: "1100cc V4",
    power: "215 HP",
    weight: "175 KG",
    drive: "RWD",
    blurb: "MotoGP-derived technology with active winglets and gold forks.",
    specs: { topSpeed: 9.4, acceleration: 9.2, handling: 9.1, nitro: 8.7 },
    colour: 0xf59e0b,
  },
  {
    id: "shadow-rr",
    name: "SHADOW RR",
    classType: "HYPER",
    pr: 1930,
    owned: false,
    engine: "1200cc Supercharged",
    power: "250 HP",
    weight: "168 KG",
    drive: "RWD",
    blurb: "Supercharged hyperbike delivering explosive acceleration.",
    specs: { topSpeed: 9.7, acceleration: 9.6, handling: 9.3, nitro: 9.2 },
    colour: 0xdc2626,
  },
  {
    id: "blaze-x",
    name: "BLAZE X",
    classType: "EXTREME",
    pr: 2150,
    owned: false,
    engine: "1300cc Twin-Turbo",
    power: "290 HP",
    weight: "160 KG",
    drive: "RWD",
    blurb: "The ultimate two-wheel rocket designed for track supremacy.",
    specs: { topSpeed: 10.0, acceleration: 9.9, handling: 9.6, nitro: 9.8 },
    colour: 0xb91c1c,
  },
];

/**
 * AAA-Grade Vehicle Selection & Garage matching the exact reference board.
 */
export function VehicleSelect({
  gameId,
  selectedId,
  onSelect,
  onConfirm,
  onClose,
  confirmLabel,
}: {
  gameId: GameId;
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const isBike = gameId === "bike-race";
  const rosterData = isBike ? BIKE_ROSTER_DATA : CAR_ROSTER_DATA;

  const [activeFilter, setActiveFilter] = React.useState<FilterTab>("all");
  const [activeTab, setActiveTab] = React.useState<GarageTab>("performance");
  const [customPaint, setCustomPaint] = React.useState<number | null>(null);

  // Find currently selected vehicle index
  const activeIndex = Math.max(0, rosterData.findIndex((v) => v.id === selectedId));
  const currentItem = rosterData[activeIndex] ?? rosterData[0]!;

  const handleStep = (delta: number) => {
    const nextIdx = (activeIndex + delta + rosterData.length) % rosterData.length;
    onSelect(rosterData[nextIdx]!.id);
    setCustomPaint(null);
  };

  // Convert currentItem to VehicleSpec for 3D showroom
  const activeVehicleSpec: VehicleSpec = React.useMemo(() => {
    return {
      id: currentItem.id,
      name: currentItem.name,
      blurb: currentItem.blurb,
      kind: isBike ? "bike" : "car",
      colour: customPaint !== null ? customPaint : currentItem.colour,
      modifiers: {
        maxSpeed: currentItem.specs.topSpeed / 8.5,
        acceleration: currentItem.specs.acceleration / 8.0,
        steerRate: currentItem.specs.handling / 8.0,
        centrifugal: 1.0,
        nitroMultiplier: currentItem.specs.nitro / 8.0,
        crashPenalty: 1.0,
      },
    };
  }, [currentItem, customPaint, isBike]);

  const filteredItems = React.useMemo(() => {
    if (activeFilter === "owned") return rosterData.filter((v) => v.owned);
    if (activeFilter === "locked") return rosterData.filter((v) => !v.owned);
    return rosterData;
  }, [rosterData, activeFilter]);

  const handleTestDrive = () => {
    router.push(`/play?game=${gameId}&mode=vs-ai&level=1`);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/20 bg-[#0e111a]/95 shadow-[0_0_80px_rgba(124,58,237,0.25)] backdrop-blur-2xl text-white">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        {/* Left: Icon, Title & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7c3aed] text-white shadow-lg shadow-purple-900/50">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-white">
              {isBike ? "BIKE SELECTION" : "CAR SELECTION"}
            </h1>
            <p className="text-xs text-white/60">
              {isBike
                ? "Pick your machine and feel the adrenaline!"
                : "Choose your ride and dominate the track!"}
            </p>
          </div>
        </div>

        {/* Right: Currency Badges & Close Button */}
        <div className="flex items-center gap-3">
          {/* Gold Coins Badge */}
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-[#1c1917]/90 px-3.5 py-1.5 text-xs font-bold text-amber-300 shadow-inner">
            <span className="text-sm">🪙</span>
            <span>25,430</span>
          </div>

          {/* Gems Badge */}
          <div className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-[#2e1065]/90 px-3 py-1.5 text-xs font-bold text-purple-200 shadow-inner">
            <span className="text-sm">💎</span>
            <span>1,250</span>
            <button
              type="button"
              className="ml-1 flex h-4 w-4 items-center justify-center rounded bg-purple-500/40 text-[10px] text-white hover:bg-purple-500"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SUB-HEADER FILTER TABS: ALL | OWNED | LOCKED */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-2">
          {(["all", "owned", "locked"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={cn(
                "rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all",
                activeFilter === tab
                  ? "bg-[#7c3aed] text-white shadow-[0_0_15px_rgba(124,58,237,0.5)]"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              {tab === "all"
                ? isBike ? "ALL BIKES" : "ALL CARS"
                : tab === "owned"
                ? "OWNED"
                : "LOCKED"}
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MAIN 3-COLUMN CONTENT AREA */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-6 p-6 lg:grid-cols-12 items-stretch">
        {/* ── LEFT COLUMN: Vehicle Cards List (Col Span 3) ── */}
        <div className="lg:col-span-3 flex flex-col min-w-0 max-h-[520px] overflow-hidden">
          <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1.5 pb-2 custom-scrollbar">
            {filteredItems.map((item) => {
              const isSelected = item.id === currentItem.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    setCustomPaint(null);
                  }}
                  className={cn(
                    "relative flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all duration-200",
                    isSelected
                      ? "border-[#7c3aed] bg-gradient-to-r from-[#1a1436] to-[#121624] shadow-[0_0_20px_rgba(124,58,237,0.4)] ring-1 ring-[#7c3aed]/50"
                      : "border-white/10 bg-[#121624]/80 hover:border-white/20 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Vehicle Preview Color Swatch Dot */}
                    <div
                      className="h-10 w-12 rounded-xl border border-white/20 shadow-inner flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `#${item.colour.toString(16).padStart(6, "0")}` }}
                    >
                      <Car className="h-4 w-4 text-white/90" />
                    </div>

                    <div className="min-w-0 truncate">
                      <div className="font-display text-sm font-black text-white truncate">
                        {item.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider">
                          {item.classType}
                        </span>
                        <span className="text-[10px] text-white/50 flex items-center gap-0.5">
                          🪙 {item.pr}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0 ml-2">
                    {item.owned ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/10">
                        <Lock className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Get More Cars CTA */}
          <button
            type="button"
            className="mt-2 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-purple-500/30 bg-[#2e1065]/60 hover:bg-[#2e1065] text-purple-200 py-3 text-xs font-black uppercase tracking-wider transition-all shadow-md"
          >
            <ShoppingBag className="h-4 w-4" />
            {isBike ? "GET MORE BIKES" : "GET MORE CARS"}
          </button>
        </div>

        {/* ── CENTER COLUMN: 3D Turntable Showroom (Col Span 6) ── */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {/* Vehicle Name, Class, Choose Vehicle CTA & Paint Swatches */}
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl sm:text-3xl font-black text-white">
                  {currentItem.name}
                </h2>
                {currentItem.owned && (
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> OWNED
                  </span>
                )}
              </div>

              {/* Dedicated Option to Choose Vehicle */}
              <button
                type="button"
                onClick={() => {
                  onSelect(currentItem.id);
                  if (onConfirm) onConfirm();
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all shadow-lg",
                  currentItem.id === selectedId
                    ? "border border-emerald-500/50 bg-emerald-950/80 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    : "border border-cyan-500/40 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-105"
                )}
              >
                {currentItem.id === selectedId ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3] text-emerald-400" />
                    EQUIPPED AS ACTIVE
                  </>
                ) : (
                  <>
                    <Car className="h-3.5 w-3.5 text-cyan-400" />
                    {isBike ? "CHOOSE THIS BIKE" : "CHOOSE THIS CAR"}
                  </>
                )}
              </button>
            </div>

            <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mt-0.5">
              {currentItem.classType} CLASS
            </div>
            <p className="text-xs text-white/60 mt-1">{currentItem.blurb}</p>

            {/* Color Swatch Circles */}
            <div className="flex items-center gap-2.5 mt-3">
              {COLOR_SWATCHES.map((swatch) => {
                const isCurrent =
                  customPaint === swatch.hex ||
                  (customPaint === null && currentItem.colour === swatch.hex);
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    onClick={() => setCustomPaint(swatch.hex)}
                    title={swatch.label}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform shadow-md",
                      isCurrent
                        ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                        : "border-black/50 hover:scale-105 opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: `#${swatch.hex.toString(16).padStart(6, "0")}` }}
                  >
                    {isCurrent && <Check className="h-3.5 w-3.5 stroke-[3] text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3D WebGL Showroom with Stepper Controls */}
          <div className="relative w-full flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleStep(-1)}
              aria-label="Previous vehicle"
              className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/90 transition-transform active:scale-95 shadow-xl backdrop-blur-md"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>

            <div className="w-full">
              <VehicleShowroom3D vehicle={activeVehicleSpec} isBike={isBike} />
            </div>

            <button
              type="button"
              onClick={() => handleStep(1)}
              aria-label="Next vehicle"
              className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/90 transition-transform active:scale-95 shadow-xl backdrop-blur-md"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* 4 Technical Specs Pills */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-2xl border border-white/10 bg-[#121624] p-2.5">
              <div className="text-[9px] font-extrabold text-white/50 uppercase">ENGINE</div>
              <div className="text-xs font-black text-white mt-0.5">{currentItem.engine}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#121624] p-2.5">
              <div className="text-[9px] font-extrabold text-white/50 uppercase">POWER</div>
              <div className="text-xs font-black text-amber-400 mt-0.5">{currentItem.power}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#121624] p-2.5">
              <div className="text-[9px] font-extrabold text-white/50 uppercase">WEIGHT</div>
              <div className="text-xs font-black text-white mt-0.5">{currentItem.weight}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#121624] p-2.5">
              <div className="text-[9px] font-extrabold text-white/50 uppercase">DRIVE</div>
              <div className="text-xs font-black text-cyan-400 mt-0.5">{currentItem.drive}</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Stats & Performance Rating (Col Span 3) ── */}
        <div className="lg:col-span-3 flex flex-col justify-between space-y-6 rounded-2xl border border-white/10 bg-[#121624]/90 p-5 shadow-xl">
          {/* Performance Spec Sliders */}
          <div className="space-y-4">
            <SpecSlider
              label="TOP SPEED"
              value={currentItem.specs.topSpeed}
              icon={Gauge}
              colorClass="from-[#7c3aed] to-[#38bdf8]"
            />
            <SpecSlider
              label="ACCELERATION"
              value={currentItem.specs.acceleration}
              icon={Zap}
              colorClass="from-[#a855f7] to-[#ec4899]"
            />
            <SpecSlider
              label="HANDLING"
              value={currentItem.specs.handling}
              icon={Shield}
              colorClass="from-[#06b6d4] to-[#10b981]"
            />
            <SpecSlider
              label="NITRO"
              value={currentItem.specs.nitro}
              icon={Flame}
              colorClass="from-[#f59e0b] to-[#ef4444]"
            />
          </div>

          {/* Total Rating Block */}
          <div className="border-t border-white/10 pt-4 text-left">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">
              TOTAL RATING
            </div>
            <div className="font-display text-4xl sm:text-5xl font-black text-[#a855f7] leading-none mt-1">
              {currentItem.pr}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. BOTTOM TOOLBAR & ACTION BUTTONS */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 bg-[#0a0d16] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left Sub-Tabs: PERFORMANCE | CUSTOMIZE | UPGRADES | PAINT | WHEELS | NITRO */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-1">
          {[
            { id: "performance", label: "PERFORMANCE" },
            { id: "customize", label: "CUSTOMIZE" },
            { id: "upgrades", label: "UPGRADES" },
            { id: "paint", label: "PAINT" },
            { id: "wheels", label: isBike ? "EXHAUST" : "WHEELS" },
            { id: "nitro", label: "NITRO" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as GarageTab)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === tab.id
                  ? "bg-[#7c3aed] text-white shadow-md"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Actions: TEST DRIVE & SELECT CAR */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onConfirm ?? handleTestDrive}
            className="gap-2 bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] text-white font-black rounded-2xl px-8 py-3 text-xs shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-transform active:scale-95"
          >
            {confirmLabel ?? (isBike ? "SELECT BIKE" : "SELECT CAR")}
          </Button>

          <Button
            variant="outline"
            onClick={handleTestDrive}
            className="gap-2 border-white/20 bg-white/5 hover:bg-white/15 text-white font-bold rounded-2xl px-5 py-3 text-xs shadow-md"
          >
            <Compass className="h-4 w-4 text-cyan-400" />
            {isBike ? "TEST RIDE" : "TEST DRIVE"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SpecSlider({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-white/90 mb-1.5">
        <span className="flex items-center gap-1.5 text-white/80">
          <Icon className="h-3.5 w-3.5 text-[#c084fc]" />
          {label}
        </span>
        <span className="numeric text-white font-extrabold">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500 shadow-sm", colorClass)}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function useChosenVehicle(gameId: GameId) {
  const isBike = gameId === "bike-race";
  const rosterData = isBike ? BIKE_ROSTER_DATA : CAR_ROSTER_DATA;
  const [id, setId] = React.useState(rosterData[0]!.id);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`playora:vehicle:${gameId}`);
      if (stored && rosterData.some((v) => v.id === stored)) setId(stored);
      else setId(rosterData[0]!.id);
    } catch {
      setId(rosterData[0]!.id);
    }
  }, [gameId, rosterData]);

  const choose = React.useCallback(
    (next: string) => {
      setId(next);
      try {
        localStorage.setItem(`playora:vehicle:${gameId}`, next);
      } catch {
        /* storage fallback */
      }
    },
    [gameId],
  );

  return { vehicleId: id, chooseVehicle: choose };
}
