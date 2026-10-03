"use client";

import * as React from "react";
import { Button, Badge } from "@playora/ui";
import { RotateCcw, ArrowLeft, Bot, Sparkles, Volume2, VolumeX, Shuffle, Target, Shield, Crosshair } from "lucide-react";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { saveLocalMatch } from "../../hooks/use-local-history";

const GRID_SIZE = 10;

interface ShipDef {
  id: string;
  name: string;
  size: number;
}

const SHIPS: ShipDef[] = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

export interface PlacedShip {
  id: string;
  name: string;
  size: number;
  cells: Array<[number, number]>;
}

export type ShotStatus = "hit" | "miss";

export function validateShipPlacement(
  gridSize: number,
  shipSize: number,
  row: number,
  col: number,
  orientation: "horizontal" | "vertical",
  existingShips: PlacedShip[]
): { valid: boolean; cells: Array<[number, number]> } {
  const isHoriz = orientation === "horizontal";
  if (isHoriz && col + shipSize > gridSize) return { valid: false, cells: [] };
  if (!isHoriz && row + shipSize > gridSize) return { valid: false, cells: [] };

  const cells: Array<[number, number]> = [];
  for (let i = 0; i < shipSize; i++) {
    const r = isHoriz ? row : row + i;
    const c = isHoriz ? col + i : col;
    if (existingShips.some((ps) => ps.cells.some(([pr, pc]) => pr === r && pc === c))) {
      return { valid: false, cells: [] };
    }
    cells.push([r, c]);
  }
  return { valid: true, cells };
}

export function checkBattleshipFleetSunk(
  fleet: PlacedShip[],
  shots: Map<string, ShotStatus>
): boolean {
  if (fleet.length === 0) return false;
  return fleet.every((ship) =>
    ship.cells.every(([r, c]) => shots.get(`${r},${c}`) === "hit")
  );
}

// Persistent Web Audio context
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function BattleshipView({
  onExit,
}: {
  onExit?: () => void;
}) {
  const [phase, setPhase] = React.useState<"placement" | "battle" | "over">("placement");
  const [orientation, setOrientation] = React.useState<"horizontal" | "vertical">("horizontal");
  const [selectedShipIndex, setSelectedShipIndex] = React.useState(0);
  const [hoveredCell, setHoveredCell] = React.useState<[number, number] | null>(null);
  const [activeTab, setActiveTab] = React.useState<"enemy" | "fleet">("enemy");

  // Player fleet & enemy incoming shots
  const [playerShips, setPlayerShips] = React.useState<PlacedShip[]>([]);
  const [aiShots, setAiShots] = React.useState<Map<string, ShotStatus>>(new Map());

  // AI fleet & shots fired by player
  const [aiShips, setAiShips] = React.useState<PlacedShip[]>([]);
  const [playerShots, setPlayerShots] = React.useState<Map<string, ShotStatus>>(new Map());

  const [isAiTurn, setIsAiTurn] = React.useState(false);
  const [winner, setWinner] = React.useState<"player" | "ai" | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const startTimeRef = React.useRef(Date.now());
  const matchRecordedRef = React.useRef(false);

  // Audio synthesis
  const playSound = React.useCallback(
    (type: "miss" | "hit" | "sunk" | "win" | "sonar" | "click") => {
      if (!soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === "sonar") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === "miss") {
          // Splash water sound
          osc.type = "sine";
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.linearRampToValueAtTime(120, now + 0.18);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === "hit") {
          // Torpedo explosion
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(190, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.25);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
        } else if (type === "sunk") {
          // Deep naval hull collapse
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.linearRampToValueAtTime(35, now + 0.45);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
          osc.start(now);
          osc.stop(now + 0.45);
        } else if (type === "win") {
          const notes = [440, 554.37, 659.25, 880];
          notes.forEach((freq, idx) => {
            const noteOsc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            noteOsc.type = "triangle";
            noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
            noteGain.gain.setValueAtTime(0.2, now + idx * 0.1);
            noteGain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
            noteOsc.connect(noteGain);
            noteGain.connect(ctx.destination);
            noteOsc.start(now + idx * 0.1);
            noteOsc.stop(now + idx * 0.1 + 0.3);
          });
        } else if (type === "click") {
          osc.type = "sine";
          osc.frequency.setValueAtTime(700, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
        }
      } catch {
        // audio fail
      }
    },
    [soundEnabled]
  );

  // Random ship fleet generator
  const generateRandomFleet = (): PlacedShip[] => {
    const fleet: PlacedShip[] = [];
    const occupied = new Set<string>();

    for (const ship of SHIPS) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 200) {
        attempts++;
        const isHoriz = Math.random() < 0.5;
        const maxR = isHoriz ? GRID_SIZE : GRID_SIZE - ship.size + 1;
        const maxC = isHoriz ? GRID_SIZE - ship.size + 1 : GRID_SIZE;
        const r = Math.floor(Math.random() * maxR);
        const c = Math.floor(Math.random() * maxC);

        const cells: Array<[number, number]> = [];
        let collision = false;
        for (let i = 0; i < ship.size; i++) {
          const cr = isHoriz ? r : r + i;
          const cc = isHoriz ? c + i : c;
          if (occupied.has(`${cr},${cc}`)) {
            collision = true;
            break;
          }
          cells.push([cr, cc]);
        }

        if (!collision) {
          cells.forEach(([cr, cc]) => occupied.add(`${cr},${cc}`));
          fleet.push({ id: ship.id, name: ship.name, size: ship.size, cells });
          placed = true;
        }
      }
    }
    return fleet;
  };

  // Preview placement cells for hovered coordinate
  const previewCells = React.useMemo(() => {
    if (phase !== "placement" || !hoveredCell || selectedShipIndex >= SHIPS.length) return null;
    const [row, col] = hoveredCell;
    const ship = SHIPS[selectedShipIndex]!;
    return validateShipPlacement(GRID_SIZE, ship.size, row, col, orientation, playerShips);
  }, [phase, hoveredCell, selectedShipIndex, orientation, playerShips]);

  // Place player ship on click
  const handlePlacementClick = (row: number, col: number) => {
    if (selectedShipIndex >= SHIPS.length) return;
    const ship = SHIPS[selectedShipIndex]!;
    const validation = validateShipPlacement(GRID_SIZE, ship.size, row, col, orientation, playerShips);
    if (!validation.valid) return;

    const nextShips = [...playerShips, { id: ship.id, name: ship.name, size: ship.size, cells: validation.cells }];
    setPlayerShips(nextShips);
    playSound("click");

    if (selectedShipIndex + 1 < SHIPS.length) {
      setSelectedShipIndex(selectedShipIndex + 1);
    } else {
      setAiShips(generateRandomFleet());
      setPhase("battle");
      playSound("sonar");
    }
  };

  const autoDeployPlayer = React.useCallback(() => {
    const fleet = generateRandomFleet();
    setPlayerShips(fleet);
    setAiShips(generateRandomFleet());
    setSelectedShipIndex(SHIPS.length);
    setPhase("battle");
    playSound("sonar");
  }, [playSound]);

  // Player fires torpedo at AI grid
  const handleFireShot = (r: number, c: number) => {
    if (phase !== "battle" || isAiTurn || winner) return;
    const key = `${r},${c}`;
    if (playerShots.has(key)) return;

    const hitShip = aiShips.find((s) => s.cells.some(([sr, sc]) => sr === r && sc === c));
    const nextShots = new Map(playerShots);

    if (hitShip) {
      nextShots.set(key, "hit");
      playSound("hit");
      const shipAllHit = hitShip.cells.every(
        ([sr, sc]) => nextShots.get(`${sr},${sc}`) === "hit"
      );
      if (shipAllHit) {
        playSound("sunk");
      }
    } else {
      nextShots.set(key, "miss");
      playSound("miss");
    }
    setPlayerShots(nextShots);

    // Win check
    if (checkBattleshipFleetSunk(aiShips, nextShots)) {
      setWinner("player");
      setPhase("over");
      playSound("win");
      if (!matchRecordedRef.current) {
        matchRecordedRef.current = true;
        const duration = Math.max(30, Math.round((Date.now() - startTimeRef.current) / 1000));
        saveLocalMatch({
          gameId: "battleship",
          gameName: "Battleship",
          mode: "vs-ai",
          outcome: "win",
          durationSeconds: duration,
          playedAt: Date.now(),
          score: 100,
        });
      }
      return;
    }

    setIsAiTurn(true);
  };

  // Smart AI Turn logic
  React.useEffect(() => {
    if (!(phase === "battle" && isAiTurn && !winner)) return;
    const timer = setTimeout(() => {
      // Find all cells that AI hasn't shot yet
      const unshot: Array<[number, number]> = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!aiShots.has(`${r},${c}`)) {
            unshot.push([r, c]);
          }
        }
      }

      if (unshot.length === 0) return;

      // Group active hits by ship so line hunting doesn't conflate two separate ships
      const unsunkHitsByShip: Array<Array<[number, number]>> = [];
      for (const ship of playerShips) {
        const isSunk = ship.cells.every(([sr, sc]) => aiShots.get(`${sr},${sc}`) === "hit");
        if (!isSunk) {
          const shipHits: Array<[number, number]> = [];
          for (const [sr, sc] of ship.cells) {
            if (aiShots.get(`${sr},${sc}`) === "hit") {
              shipHits.push([sr, sc]);
            }
          }
          if (shipHits.length > 0) {
            unsunkHitsByShip.push(shipHits);
          }
        }
      }

      let target = unshot[Math.floor(Math.random() * unshot.length)]!;

      const multiHitShip = unsunkHitsByShip.find((hits) => hits.length >= 2);
      const singleHitShip = unsunkHitsByShip.find((hits) => hits.length === 1);

      if (multiHitShip) {
        // Line hunting on this specific ship's hits
        const [h1, h2] = multiHitShip;
        const isHoriz = h1![0] === h2![0];
        const lineTargets: Array<[number, number]> = [];

        if (isHoriz) {
          const row = h1![0];
          const cols = multiHitShip.map(([, c]) => c).sort((a, b) => a - b);
          const minC = cols[0]! - 1;
          const maxC = cols[cols.length - 1]! + 1;
          if (minC >= 0 && !aiShots.has(`${row},${minC}`)) lineTargets.push([row, minC]);
          if (maxC < GRID_SIZE && !aiShots.has(`${row},${maxC}`)) lineTargets.push([row, maxC]);
        } else {
          const col = h1![1];
          const rows = multiHitShip.map(([r]) => r).sort((a, b) => a - b);
          const minR = rows[0]! - 1;
          const maxR = rows[rows.length - 1]! + 1;
          if (minR >= 0 && !aiShots.has(`${minR},${col}`)) lineTargets.push([minR, col]);
          if (maxR < GRID_SIZE && !aiShots.has(`${maxR},${col}`)) lineTargets.push([maxR, col]);
        }

        if (lineTargets.length > 0) {
          target = lineTargets[Math.floor(Math.random() * lineTargets.length)]!;
        } else {
          const allSurround: Array<[number, number]> = [];
          const deltas: Array<[number, number]> = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];
          for (const [hr, hc] of multiHitShip) {
            for (const [dr, dc] of deltas) {
              const nr = hr + dr;
              const nc = hc + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !aiShots.has(`${nr},${nc}`)) {
                allSurround.push([nr, nc]);
              }
            }
          }
          if (allSurround.length > 0) {
            target = allSurround[Math.floor(Math.random() * allSurround.length)]!;
          }
        }
      } else if (singleHitShip) {
        // Orthogonal hunt around the single hit
        const [hr, hc] = singleHitShip[0]!;
        const candidates: Array<[number, number]> = [
          [hr - 1, hc],
          [hr + 1, hc],
          [hr, hc - 1],
          [hr, hc + 1],
        ];
        const adjacents = candidates.filter(
          ([ar, ac]) =>
            ar >= 0 && ar < GRID_SIZE && ac >= 0 && ac < GRID_SIZE && !aiShots.has(`${ar},${ac}`)
        );

        if (adjacents.length > 0) {
          target = adjacents[Math.floor(Math.random() * adjacents.length)]!;
        }
      } else {
        // Checkerboard parity hunting for remaining ships
        const parityCells = unshot.filter(([r, c]) => (r + c) % 2 === 0);
        if (parityCells.length > 0) {
          target = parityCells[Math.floor(Math.random() * parityCells.length)]!;
        }
      }

      const [tr, tc] = target;
      const key = `${tr},${tc}`;
      const hitShip = playerShips.find((s) => s.cells.some(([sr, sc]) => sr === tr && sc === tc));

      const nextAiShots = new Map(aiShots);
      nextAiShots.set(key, hitShip ? "hit" : "miss");
      setAiShots(nextAiShots);

      if (hitShip) {
        playSound("hit");
        const shipSunk = hitShip.cells.every(
          ([sr, sc]) => nextAiShots.get(`${sr},${sc}`) === "hit"
        );
        if (shipSunk) playSound("sunk");
      } else {
        playSound("miss");
      }

      // Check if AI won
      if (checkBattleshipFleetSunk(playerShips, nextAiShots)) {
        setWinner("ai");
        setPhase("over");
        playSound("sunk");
        if (!matchRecordedRef.current) {
          matchRecordedRef.current = true;
          const duration = Math.max(30, Math.round((Date.now() - startTimeRef.current) / 1000));
          saveLocalMatch({
            gameId: "battleship",
            gameName: "Battleship",
            mode: "vs-ai",
            outcome: "loss",
            durationSeconds: duration,
            playedAt: Date.now(),
            score: 0,
          });
        }
      } else {
        setIsAiTurn(false);
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [phase, isAiTurn, winner, aiShots, playerShips, playSound]);

  const resetGame = React.useCallback(() => {
    setPhase("placement");
    setPlayerShips([]);
    setAiShips([]);
    setPlayerShots(new Map());
    setAiShots(new Map());
    setSelectedShipIndex(0);
    setIsAiTurn(false);
    setWinner(null);
    matchRecordedRef.current = false;
    startTimeRef.current = Date.now();
    playSound("click");
  }, [playSound]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (phase === "placement") {
        if (e.key === " " || e.key === "r" || e.key === "R") {
          e.preventDefault();
          setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"));
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          autoDeployPlayer();
        }
      } else if (e.key === "r" || e.key === "R") {
        resetGame();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, resetGame, autoDeployPlayer]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0B14] select-none text-foreground">
      <ExitConfirmationDialog
        open={showExitConfirm}
        gameName="Battleship"
        onConfirmExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
        onResume={() => setShowExitConfirm(false)}
      />

      {/* Control Header */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-3 sm:px-6 py-2.5 border-b border-white/10 bg-[#090A14]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (phase === "over" || playerShips.length === 0 ? onExit?.() : setShowExitConfirm(true))}
            className="gap-1.5 text-white/70 hover:text-white -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">Battleship</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90">
              Naval Radar
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {phase === "placement" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOrientation((o) => (o === "horizontal" ? "vertical" : "horizontal"))}
                className="gap-1 text-xs border-white/15 text-white/90 hover:border-white/30"
              >
                Rotate: <strong className="capitalize">{orientation}</strong>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={autoDeployPlayer}
                className="gap-1 text-xs bg-white/10 text-white hover:bg-white/20 border border-white/15"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Auto Deploy</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 w-8 p-0 text-white/60 hover:text-white"
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-white/40" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={resetGame}
            className="gap-1 text-xs border-white/15 hover:border-white/30 text-white/90"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </header>

      {/* Main Arena */}
      <main className="relative flex flex-1 flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Phase Header and Fleet Status */}
        <div className="mb-3 text-center w-full max-w-2xl">
          {phase === "placement" ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-bold text-white">
                Anchoring:{" "}
                <strong className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                  {SHIPS[selectedShipIndex]?.name}
                </strong>{" "}
                ({SHIPS[selectedShipIndex]?.size} cells)
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {SHIPS.map((ship, idx) => {
                  const isPlaced = idx < selectedShipIndex;
                  const isCurrent = idx === selectedShipIndex;
                  return (
                    <span
                      key={ship.id}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                        isCurrent
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 ring-2 ring-cyan-400/40"
                          : isPlaced
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 line-through opacity-70"
                          : "border-white/10 bg-white/5 text-white/50"
                      }`}
                    >
                      {ship.name} ({ship.size})
                    </span>
                  );
                })}
              </div>
            </div>
          ) : phase === "battle" ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                {isAiTurn ? (
                  <span className="text-rose-400 animate-pulse flex items-center gap-1.5">
                    <Bot className="h-4 w-4 animate-spin" /> Enemy radar scanning defense coordinates...
                  </span>
                ) : (
                  <span className="text-cyan-400 flex items-center gap-1.5">
                    <Crosshair className="h-4 w-4" /> Tap enemy radar cell to launch torpedo!
                  </span>
                )}
              </div>

              {/* Mobile Tab Switcher */}
              <div className="flex md:hidden rounded-lg bg-white/5 p-0.5 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("enemy")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === "enemy" ? "bg-rose-500 text-white" : "text-white/60"
                  }`}
                >
                  Enemy Radar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fleet")}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    activeTab === "fleet" ? "bg-cyan-500 text-white" : "text-white/60"
                  }`}
                >
                  Your Fleet
                </button>
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold">
              {winner === "player" ? (
                <span className="text-emerald-400 flex items-center justify-center gap-2 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                  <Sparkles className="h-5 w-5" /> Admiral Victory! Hostile Fleet Demolished!
                </span>
              ) : (
                <span className="text-rose-400 flex items-center justify-center gap-2 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]">
                  Fleet Destroyed! Mission Failed.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Dual Radar Grids */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-8 w-full max-w-4xl">
          {/* Enemy Waters (Target Radar) */}
          {phase !== "placement" && (
            <div className={`flex flex-col items-center gap-2 ${activeTab === "fleet" ? "hidden md:flex" : "flex"}`}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                <Target className="h-3.5 w-3.5" /> Enemy Radar Grid
              </div>
              <div className="relative aspect-square w-[min(90vw,320px)] sm:w-[360px] lg:w-[400px] bg-[#071322] border-2 border-rose-500/40 rounded-2xl p-2 grid grid-cols-10 grid-rows-10 gap-0.5 shadow-[0_15px_35px_rgba(244,63,94,0.15)]">
                {Array.from({ length: 100 }).map((_, idx) => {
                  const r = Math.floor(idx / 10);
                  const c = idx % 10;
                  const key = `${r},${c}`;
                  const shot = playerShots.get(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFireShot(r, c)}
                      disabled={Boolean(shot) || isAiTurn || Boolean(winner)}
                      aria-label={`Sector ${r + 1}, ${c + 1}`}
                      className={`relative flex items-center justify-center rounded-sm transition ${
                        shot === "hit"
                          ? "bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                          : shot === "miss"
                          ? "bg-cyan-500/30"
                          : "bg-[#0b1f36] hover:bg-[#123154] cursor-pointer"
                      }`}
                    >
                      {shot === "hit" && <div className="h-2 w-2 rounded-full bg-white animate-pulse" />}
                      {shot === "miss" && <div className="h-1.5 w-1.5 rounded-full bg-cyan-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Player Waters (Defense Command Grid) */}
          <div className={`flex flex-col items-center gap-2 ${phase !== "placement" && activeTab === "enemy" ? "hidden md:flex" : "flex"}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Shield className="h-3.5 w-3.5" /> Your Fleet Command
            </div>
            <div
              onMouseLeave={() => setHoveredCell(null)}
              className={`relative aspect-square ${
                phase === "placement" ? "w-full max-w-[min(90vw,65vh,440px)]" : "w-[min(90vw,320px)] sm:w-[360px] lg:w-[400px]"
              } bg-[#071322] border-2 border-cyan-500/40 rounded-2xl p-2 grid grid-cols-10 grid-rows-10 gap-0.5 shadow-[0_15px_35px_rgba(6,182,212,0.15)]`}
            >
              {Array.from({ length: 100 }).map((_, idx) => {
                const r = Math.floor(idx / 10);
                const c = idx % 10;
                const key = `${r},${c}`;
                const hasShip = playerShips.some((s) => s.cells.some(([sr, sc]) => sr === r && sc === c));
                const aiShot = aiShots.get(key);
                const isPreview = previewCells?.cells.some(([pr, pc]) => pr === r && pc === c);

                return (
                  <button
                    key={key}
                    type="button"
                    onMouseEnter={() => phase === "placement" && setHoveredCell([r, c])}
                    onClick={() => phase === "placement" && handlePlacementClick(r, c)}
                    disabled={phase !== "placement"}
                    aria-label={`Fleet cell ${r + 1}, ${c + 1}`}
                    className={`relative flex items-center justify-center rounded-sm transition ${
                      aiShot === "hit"
                        ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
                        : aiShot === "miss"
                        ? "bg-cyan-500/30"
                        : isPreview
                        ? previewCells?.valid
                          ? "bg-cyan-400/80 border border-cyan-300"
                          : "bg-rose-500/80 border border-rose-300"
                        : hasShip
                        ? "bg-cyan-600/90 border border-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.5)]"
                        : "bg-[#0b1f36] hover:bg-[#123154]"
                    }`}
                  >
                    {aiShot === "hit" && <div className="h-2 w-2 rounded-full bg-white animate-pulse" />}
                    {aiShot === "miss" && <div className="h-1.5 w-1.5 rounded-full bg-cyan-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button on Game Over */}
        {phase === "over" && (
          <div className="mt-5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
            <Button onClick={resetGame} className="gap-2 bg-gradient-to-r from-cyan-500 to-rose-500 text-white font-bold px-6 py-2 rounded-xl shadow-lg">
              <RotateCcw className="h-4 w-4" />
              Battle Again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
