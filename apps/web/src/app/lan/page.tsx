"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@playora/ui";
import {
  Wifi,
  QrCode,
  Camera,
  Play,
  ArrowLeft,
  Users,
  Zap,
  CheckCircle2,
  Crown,
  Loader2,
} from "lucide-react";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import type { GameId } from "@playora/game-types";
import { useAuthStore } from "../../lib/store/auth-store";
import { QrDisplay } from "../../components/lan/qr-display";
import { QrScanner } from "../../components/lan/qr-scanner";
import { useLanSocket } from "../../hooks/use-lan-socket";
import { ChessGameView } from "../../games/chess/ChessGameView";
import { UnoGameView } from "../../games/uno/UnoGameView";
import { ArcadeGameView } from "../../games/arcade/ArcadeGameView";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import dynamic from "next/dynamic";

const ARCADE_GAMES = new Set<GameId>([
  "rope-rescue",
  "ant-attack",
  "bomb-pass",
  "color-rush",
  "falling-floor",
  "pin-puzzle",
  "target-rush",
  "hot-potato",
  "bridge-builder",
  "ice-breaker",
]);

const OnlineRaceView = dynamic(
  () => import("../../games/racing/OnlineRaceView").then((m) => m.OnlineRaceView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#090A14] text-cyan-400">
        <span className="animate-pulse font-mono text-sm">Loading 3D Track Engine…</span>
      </div>
    ),
  }
);

function generateLanCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function LanPlayPage() {
  return (
    <React.Suspense fallback={null}>
      <LanPlayContent />
    </React.Suspense>
  );
}

function LanPlayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [mounted, setMounted] = React.useState(false);

  const gameParam = searchParams?.get("game") as GameId | null;
  const roleParam = (searchParams?.get("role") as "host" | "guest") || "host";
  const codeParam = searchParams?.get("code") || "";
  const scanParam = searchParams?.get("scan") === "true";

  const [selectedGame, setSelectedGame] = React.useState<GameId>(
    gameParam && GAME_CATALOG.some((g) => g.id === gameParam) ? gameParam : "chess"
  );
  const [lanCode, setLanCode] = React.useState<string>(codeParam);
  const [activeTab, setActiveTab] = React.useState<"host" | "join">(
    scanParam || roleParam === "guest" ? "join" : "host"
  );
  const [showScanner, setShowScanner] = React.useState(scanParam);
  const [isChangingGame, setIsChangingGame] = React.useState(!gameParam);
  const [guestId, setGuestId] = React.useState<string>("");
  const [guestName, setGuestName] = React.useState<string>("");

  React.useEffect(() => {
    setMounted(true);
    if (!codeParam) {
      setLanCode(generateLanCode());
    }
    const id =
      localStorage.getItem("playora-guest-id") ||
      `guest-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("playora-guest-id", id);
    setGuestId(id);

    const name =
      localStorage.getItem("playora-guest-name") ||
      (roleParam === "guest"
        ? `Guest ${Math.floor(Math.random() * 900 + 100)}`
        : "Host Player");
    localStorage.setItem("playora-guest-name", name);
    setGuestName(name);
  }, [codeParam, roleParam]);

  const userId = user?.id || guestId || "player";
  const displayName = user?.displayName || guestName || "Player";

  const lan = useLanSocket({
    roomCode: lanCode || "LAN1",
    gameId: selectedGame,
    role: activeTab === "host" ? "host" : "guest",
    userId,
    displayName,
  });

  const [lanHost, setLanHost] = React.useState<string>("");
  const [customIp, setCustomIp] = React.useState<string>("");
  const [isEditingIp, setIsEditingIp] = React.useState(false);

  React.useEffect(() => {
    async function detectLanIp() {
      try {
        const res = await fetch("/api/network-ip");
        if (res.ok) {
          const data = await res.json();
          if (data.lanOrigin && data.ip !== "127.0.0.1") {
            setLanHost(data.lanOrigin);
          }
        }
      } catch (err) {
        console.warn("Could not detect LAN IP", err);
      }
    }
    detectLanIp();
  }, []);

  const effectiveOrigin = React.useMemo(() => {
    if (customIp.trim()) {
      return customIp.trim().startsWith("http")
        ? customIp.trim()
        : `http://${customIp.trim()}:8000`;
    }
    if (lanHost) return lanHost;
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:8000";
  }, [customIp, lanHost]);

  const joinUrl = `${effectiveOrigin}/lan?code=${lanCode}&game=${selectedGame}&role=guest`;

  const handleScanSuccess = (scannedData: string) => {
    try {
      if (scannedData.includes("/lan")) {
        const url = new URL(scannedData);
        const code = url.searchParams.get("code") || "";
        const g = url.searchParams.get("game") as GameId;
        if (code) setLanCode(code);
        if (g) setSelectedGame(g);
        setShowScanner(false);
        setActiveTab("join");
      } else {
        // Raw LAN code
        setLanCode(scannedData.toUpperCase());
        setShowScanner(false);
        setActiveTab("join");
      }
    } catch {
      setLanCode(scannedData.toUpperCase());
      setShowScanner(false);
      setActiveTab("join");
    }
  };

  const playersList = Object.values(lan.players);
  const currentGame = GAME_CATALOG.find((g) => g.id === selectedGame) || GAME_CATALOG[0]!;
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-xs font-semibold text-white/50">Initializing Wi-Fi lobby...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // IN-GAME ACTIVE MATCH SURFACE (EDGE-TO-EDGE FULL SCREEN)
  // ─────────────────────────────────────────────────────────────────
  if (lan.isStarted) {
    return (
      <div className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0A0B14]">
        {/* Exit Confirmation Dialog */}
        <ExitConfirmationDialog
          open={showExitConfirm}
          gameName={`${currentGame.name} (LAN)`}
          onConfirmExit={() => {
            setShowExitConfirm(false);
            router.push(`/games/${selectedGame}`);
          }}
          onResume={() => setShowExitConfirm(false)}
        />

        {/* Top Control Bar */}
        <div className="relative z-20 flex shrink-0 items-center justify-between px-4 sm:px-6 py-2.5 border-b border-white/5 bg-[#090A14]/90 backdrop-blur-md">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 text-white hover:bg-white/10"
            onClick={() => {
              if (lan.lastResult) {
                router.push(`/games/${selectedGame}`);
              } else {
                setShowExitConfirm(true);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Exit LAN Match
          </Button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge variant="success" className="hidden md:inline-flex gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px]">
              <Zap className="h-3 w-3 fill-current" />
              Direct Wi-Fi (0ms Ping)
            </Badge>
            <Badge variant="secondary" className="bg-white/10 text-white border border-white/10 text-[11px]">
              {lanCode}
            </Badge>
            <Badge variant="secondary" className="hidden sm:inline-flex bg-white/10 text-white border border-white/10 text-[11px]">
              {currentGame.name}
            </Badge>
          </div>
        </div>

        {/* Dynamic Game Surface */}
        <div className="relative flex flex-1 w-full h-full overflow-hidden">
          {selectedGame === "chess" && (
            <ChessGameView
              gameState={lan.gameState as any}
              players={lan.players as any}
              currentUserId={userId}
              lastResult={lan.lastResult}
              onMakeMove={(from, to, promo) => lan.sendAction("MOVE", { from, to, promotion: promo })}
              onResign={() => lan.sendAction("RESIGN")}
              onOfferDraw={() => lan.sendAction("OFFER_DRAW")}
              onAcceptDraw={() => lan.sendAction("ACCEPT_DRAW")}
              onDeclineDraw={() => lan.sendAction("DECLINE_DRAW")}
              onRematch={lan.startMatch}
            />
          )}

          {(selectedGame === "uno" || selectedGame === "uno-no-mercy") && (
            <UnoGameView
              gameState={lan.gameState as any}
              players={lan.players as any}
              currentUserId={userId}
              isOpponentThinking={false}
              noMercy={selectedGame === "uno-no-mercy"}
              lastResult={lan.lastResult}
              onPlayCard={(cId, color) => lan.sendAction("PLAY_CARD", { cardId: cId, color })}
              onDrawCard={() => lan.sendAction("DRAW_CARD")}
              onPass={() => lan.sendAction("PASS")}
              onRematch={lan.startMatch}
              onExit={() => {
                if (lan.lastResult) {
                  router.push(`/games/${selectedGame}`);
                } else {
                  setShowExitConfirm(true);
                }
              }}
            />
          )}

          {(selectedGame === "car-race" || selectedGame === "bike-race") && (
            <OnlineRaceView
              gameId={selectedGame}
              gameState={lan.gameState as any}
              players={lan.players as any}
              currentUserId={userId}
              onLeave={() => {
                if (lan.lastResult) {
                  router.push(`/games/${selectedGame}`);
                } else {
                  setShowExitConfirm(true);
                }
              }}
              sendGameAction={(type, payload) => lan.sendAction(type, payload)}
            />
          )}

          {ARCADE_GAMES.has(selectedGame) && (
            <ArcadeGameView
              gameId={selectedGame}
              onExit={() => {
                if (lan.lastResult) {
                  router.push(`/games/${selectedGame}`);
                } else {
                  setShowExitConfirm(true);
                }
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // LAN MATCH LOBBY & PAIRING SCREEN
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 space-y-6">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-[#0C1B33] via-[#0E1528] to-[#0A0B14] p-6 sm:p-8 shadow-2xl">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 px-3 py-1 text-xs font-bold text-cyan-300">
                <Wifi className="h-3.5 w-3.5" />
                Same Wi-Fi Local Multiplayer
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400">
                ⚡ 0ms Latency · Zero Cloud Delay
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight">
              Play with Friends on Same Wi-Fi
            </h1>
            <p className="mt-1 text-sm sm:text-base text-white/60 max-w-xl leading-relaxed">
              Connect phone to laptop or friends on the same local network instantly. Scan QR code to jump straight into the action with 0 lag.
            </p>
          </div>

          <Link href="/games">
            <Button variant="outline" size="sm" className="gap-2 border-white/10 text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> All Games
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: QR Code Display / Scanner */}
        <div className="lg:col-span-7 space-y-5">
          {/* Mode Switch Tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => {
                setActiveTab("host");
                setShowScanner(false);
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "host"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <QrCode className="h-4 w-4" />
              <span>Host LAN Room (Show QR)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("join");
                setShowScanner(true);
              }}
              className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                activeTab === "join"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] scale-105"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Join with Camera / Code</span>
            </button>
          </div>

          {/* Tab 1: Host Display (QR Code & Game Picker) */}
          {activeTab === "host" && (
            <div className="flex flex-col md:flex-row gap-4">
              {/* Left: Game Selector */}
              <div className="md:w-56 shrink-0">
                {!isChangingGame && gameParam ? (
                  <div className="flex items-center justify-between p-3 px-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 shadow-inner">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">
                        {currentGame.category === "Strategy" ? "♟️" : currentGame.category === "Card" ? "🃏" : "🏎️"}
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Hosting</p>
                        <p className="text-sm font-black text-white">{currentGame.name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingGame(true)}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 hover:no-underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50">
                        Select Game
                      </label>
                      {gameParam && (
                        <button
                          type="button"
                          onClick={() => setIsChangingGame(false)}
                          className="text-[10px] text-white/50 hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2 max-h-[340px] md:max-h-[440px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-white/10">
                      {GAME_CATALOG.filter(isPlayable).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGame(g.id);
                            setIsChangingGame(false);
                          }}
                          className={`flex items-center gap-2.5 rounded-xl p-2.5 border text-left transition-all ${
                            selectedGame === g.id
                              ? "border-cyan-400 bg-cyan-950/40 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40"
                              : "border-white/5 bg-[#0F111E]/80 text-white/70 hover:bg-white/5"
                          }`}
                        >
                          <span className="text-base shrink-0">
                            {g.category === "Strategy" ? "♟️" : g.category === "Card" ? "🃏" : g.category === "Racing" ? "🏎️" : "👾"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate">{g.name}</p>
                            <p className="text-[10px] text-white/40 truncate">{g.category}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: QR Code & Wi-Fi IP Status */}
              <div className="flex-1 rounded-3xl border border-white/10 bg-[#0F111E]/90 p-6 shadow-xl backdrop-blur-md space-y-4">
                {/* Same-Wi-Fi Network Address Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-bold text-white/80 text-[11px] uppercase tracking-wider">Wi-Fi IP:</span>
                    <code className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 font-mono text-xs text-cyan-300 font-bold">
                      {effectiveOrigin}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingIp(!isEditingIp)}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline text-left sm:text-right"
                  >
                    {isEditingIp ? "Close" : "Change IP / Port"}
                  </button>
                </div>

                {isEditingIp && (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 text-xs">
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.34 or mytunnel.ngrok.io"
                      value={customIp}
                      onChange={(e) => setCustomIp(e.target.value)}
                      className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-white font-mono placeholder:text-white/30"
                    />
                    <Button size="sm" onClick={() => setIsEditingIp(false)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                      Save
                    </Button>
                  </div>
                )}

                <QrDisplay
                  joinUrl={joinUrl}
                  roomCode={lanCode}
                  gameName={currentGame.name}
                />
              </div>
            </div>
          )}


          {/* Tab 2: Join with Scanner */}
          {activeTab === "join" && (
            <div className="rounded-3xl border border-white/10 bg-[#0F111E]/90 p-6 shadow-xl">
              {showScanner ? (
                <QrScanner
                  onScan={handleScanSuccess}
                  onCancel={() => setShowScanner(false)}
                />
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 mx-auto shadow-inner">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">
                      Connected to LAN Code: <span className="text-cyan-400 font-mono">{lanCode}</span>
                    </h3>
                    <p className="text-xs text-white/60 mt-1">
                      Waiting for the host to start the {currentGame.name} match.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowScanner(true)}
                    className="gap-2 border-white/10 text-white hover:bg-white/10"
                  >
                    <Camera className="h-4 w-4" /> Scan Another QR Code
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Connected Players & Start Game */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="border-white/10 bg-[#0F111E]/90 backdrop-blur-md p-5 shadow-xl">
            <CardHeader className="p-0 pb-4 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <span>Wi-Fi Room Lobby</span>
                </CardTitle>
                <p className="text-xs text-white/50 mt-0.5">
                  {playersList.length} player(s) on same network
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                ● Live Local Sync
              </Badge>
            </CardHeader>

            <CardContent className="p-0 pt-4 space-y-3">
              {playersList.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-xs font-black text-cyan-300">
                        {p.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      {p.role === "host" && (
                        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black p-0.5 rounded-full">
                          <Crown className="h-3 w-3" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{p.displayName}</span>
                        {p.userId === userId && (
                          <Badge variant="outline" className="text-[9px] border-white/20 text-white/70">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Zap className="h-3 w-3 fill-current" />
                        <span>Ping: {p.pingMs}ms</span>
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary" className="text-[10px] bg-white/5 text-white/80">
                    {p.role === "host" ? "Host" : "Connected"}
                  </Badge>
                </div>
              ))}

              {/* Start Match CTA */}
              <div className="pt-4 border-t border-white/5">
                {activeTab === "host" ? (
                  <Button
                    size="lg"
                    onClick={lan.startMatch}
                    className="w-full gap-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-6 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all hover:scale-105"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>Start LAN Match ({currentGame.name})</span>
                  </Button>
                ) : (
                  <div className="rounded-2xl border border-white/5 bg-white/2 p-4 text-center">
                    <p className="text-xs text-white/60 font-medium">
                      Connected to host. Waiting for match to start…
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
