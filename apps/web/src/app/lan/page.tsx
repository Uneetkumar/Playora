"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@playora/ui";
import {
  ArrowLeft,
  Camera,
  Crown,
  Pencil,
  Play,
  QrCode,
  ScanLine,
  Users,
  Wifi,
} from "lucide-react";
import { GAME_CATALOG } from "../../lib/games/catalog";
import type { GameId, Player } from "@playora/game-types";
import type { ChessPlayerView } from "@playora/game-engine";
import type { UnoPlayerView, RacingPlayerView } from "@playora/game-engine";
import { useAuthStore } from "../../lib/store/auth-store";
import { QrDisplay } from "../../components/lan/qr-display";
import { QrScanner } from "../../components/lan/qr-scanner";
import { useLanSocket } from "../../hooks/use-lan-socket";
import { ChessGameView } from "../../games/chess/ChessGameView";
import { UnoGameView } from "../../games/uno/UnoGameView";
import { ArcadeGameView } from "../../games/arcade/ArcadeGameView";
import { ExitConfirmationDialog } from "../../components/games/exit-confirmation-dialog";
import { isMultiplayer, isSoloGame } from "../../lib/play/modes";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { GameSelect } from "../../components/page/game-select";

const OnlineRaceView = dynamic(
  () => import("../../games/racing/OnlineRaceView").then((m) => m.OnlineRaceView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Spinner size="lg" label="Loading the track" />
      </div>
    ),
  }
);

/**
 * The games a LAN room can run: the ones with an engine for the host to
 * drive. The picker used to list all thirty-one, and choosing a solo arcade
 * title hosted a "match" no guest could join.
 */
const LAN_GAMES: GameId[] = GAME_CATALOG.filter((g) => isMultiplayer(g.id)).map((g) => g.id);

const STEPS = [
  { icon: Wifi, title: "Same network", body: "Put every device on the same Wi-Fi." },
  { icon: QrCode, title: "Host a game", body: "One device picks a game and shows its code." },
  { icon: ScanLine, title: "Everyone joins", body: "Scan the QR code, or type the four letters." },
] as const;

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
    <React.Suspense fallback={<LanSkeleton />}>
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
  const [guestId, setGuestId] = React.useState<string>("");
  const [guestName, setGuestName] = React.useState<string>("");

  React.useEffect(() => {
    setMounted(true);
    if (!codeParam) {
      setLanCode(generateLanCode());
    }
    const id =
      localStorage.getItem("playora-guest-id") || `guest-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("playora-guest-id", id);
    setGuestId(id);

    const name =
      localStorage.getItem("playora-guest-name") ||
      (roleParam === "guest" ? `Guest ${Math.floor(Math.random() * 900 + 100)}` : "Host Player");
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

  // Stable: QrScanner restarts the camera whenever its onScan changes.
  const handleScanSuccess = React.useCallback((scannedData: string) => {
    try {
      if (scannedData.includes("/lan")) {
        const url = new URL(scannedData);
        const code = url.searchParams.get("code") || "";
        const g = url.searchParams.get("game") as GameId;
        if (code) setLanCode(code);
        if (g) setSelectedGame(g);
      } else {
        // Raw LAN code
        setLanCode(scannedData.toUpperCase());
      }
    } catch {
      setLanCode(scannedData.toUpperCase());
    }
    setShowScanner(false);
    setActiveTab("join");
  }, []);
  const closeScanner = React.useCallback(() => setShowScanner(false), []);

  const playersList = Object.values(lan.players);
  const currentGame = GAME_CATALOG.find((g) => g.id === selectedGame) || GAME_CATALOG[0]!;
  const hostPresent = playersList.some((p) => p.role === "host");
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const leave = () => {
    if (lan.lastResult) {
      router.push(`/games/${selectedGame}`);
    } else {
      setShowExitConfirm(true);
    }
  };

  if (!mounted) return <LanSkeleton />;

  // ─────────────────────────────────────────────────────────────────
  // In a match: the game takes the whole screen.
  // ─────────────────────────────────────────────────────────────────
  if (lan.isStarted) {
    return (
      <div className="fixed inset-0 z-modal flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
        <ExitConfirmationDialog
          open={showExitConfirm}
          gameName={`${currentGame.name} (Wi-Fi)`}
          onConfirmExit={() => {
            setShowExitConfirm(false);
            router.push(`/games/${selectedGame}`);
          }}
          onResume={() => setShowExitConfirm(false)}
        />

        <div className="relative z-sticky flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Leave
          </Button>

          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              <Wifi aria-hidden />
              Same Wi-Fi
            </Badge>
            <span className="truncate text-sm font-semibold text-foreground">
              {currentGame.name}
            </span>
            <span className="font-mono-num rounded-md bg-muted px-2 py-0.5 text-xs font-bold tracking-widest text-foreground">
              {lanCode}
            </span>
          </div>
        </div>

        <div className="relative flex h-full w-full flex-1 overflow-hidden">
          {selectedGame === "chess" && (
            <ChessGameView
              gameState={lan.gameState as ChessPlayerView}
              players={lan.players as unknown as Record<string, Player>}
              currentUserId={userId}
              lastResult={lan.lastResult}
              onMakeMove={(from, to, promo) =>
                lan.sendAction("MOVE", { from, to, promotion: promo })
              }
              onResign={() => lan.sendAction("RESIGN")}
              onOfferDraw={() => lan.sendAction("OFFER_DRAW")}
              onAcceptDraw={() => lan.sendAction("ACCEPT_DRAW")}
              onDeclineDraw={() => lan.sendAction("DECLINE_DRAW")}
              onRematch={lan.startMatch}
            />
          )}

          {(selectedGame === "uno" || selectedGame === "uno-no-mercy") && (
            <UnoGameView
              gameState={lan.gameState as UnoPlayerView}
              players={lan.players as unknown as Record<string, Player>}
              currentUserId={userId}
              isOpponentThinking={false}
              noMercy={selectedGame === "uno-no-mercy"}
              lastResult={lan.lastResult}
              onPlayCard={(cId, color) => lan.sendAction("PLAY_CARD", { cardId: cId, color })}
              onDrawCard={() => lan.sendAction("DRAW_CARD")}
              onPass={() => lan.sendAction("PASS")}
              onRematch={lan.startMatch}
              onExit={leave}
            />
          )}

          {(selectedGame === "car-race" || selectedGame === "bike-race") && (
            <OnlineRaceView
              gameId={selectedGame}
              gameState={lan.gameState as RacingPlayerView}
              players={lan.players as unknown as Record<string, Player>}
              currentUserId={userId}
              onLeave={leave}
              sendGameAction={(type, payload) => lan.sendAction(type, payload)}
            />
          )}

          {isSoloGame(selectedGame) && <ArcadeGameView gameId={selectedGame} onExit={leave} />}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // The lobby: how it works, host or join, and who is here.
  // ─────────────────────────────────────────────────────────────────
  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<Wifi />}
        title="Same Wi-Fi"
        description="Play with the people in the room over your own network. One device hosts, everyone else scans its code."
        action={
          activeTab === "host" ? (
            <Button
              variant="secondary"
              onClick={() => {
                setActiveTab("join");
                setShowScanner(true);
              }}
            >
              <Camera className="h-4 w-4" aria-hidden />
              Scan to join
            </Button>
          ) : undefined
        }
      />

      <ol aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title}>
            <Card className="flex h-full items-start gap-3 p-4">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-accent">
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-mono-num absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ring-2 ring-card">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const tab = v as "host" | "join";
          setActiveTab(tab);
          setShowScanner(tab === "join");
        }}
      >
        {/* 40px tabs on a phone, where the host is tapping them one-handed. */}
        <TabsList aria-label="Host or join" className="h-auto w-full sm:h-10 sm:w-auto">
          <TabsTrigger value="host" className="h-10 flex-1 sm:h-full sm:flex-none">
            <QrCode aria-hidden />
            Host a game
          </TabsTrigger>
          <TabsTrigger value="join" className="h-10 flex-1 sm:h-full sm:flex-none">
            <ScanLine aria-hidden />
            Join a game
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0">
            <TabsContent value="host" className="mt-0">
              {/* `grid-cols-1` is `minmax(0, 1fr)`: without it the implicit column
                  grows to the unbroken join URL and pushes a phone sideways. */}
              <Card className="grid grid-cols-1 gap-8 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="order-2 min-w-0 space-y-6 md:order-1">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Game</p>
                    <GameSelect
                      games={LAN_GAMES}
                      value={selectedGame}
                      onValueChange={(v) => v !== "all" && setSelectedGame(v)}
                      label="Game to host"
                      className="sm:w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Games that need a host to keep score: chess, UNO and the races.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      This device&apos;s address
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      <span
                        className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-success"
                        aria-hidden
                      />
                      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {effectiveOrigin}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        // 40px to tap on a phone; slim inside the field from `sm`.
                        className="h-10 shrink-0 px-3 sm:h-7 sm:px-2"
                        onClick={() => setIsEditingIp((v) => !v)}
                        aria-expanded={isEditingIp}
                        aria-controls="lan-address-editor"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        {isEditingIp ? "Done" : "Change"}
                      </Button>
                    </div>
                    {isEditingIp && (
                      <div id="lan-address-editor" className="space-y-1.5">
                        <label htmlFor="lan-address" className="sr-only">
                          Address other devices should open
                        </label>
                        <Input
                          id="lan-address"
                          placeholder="192.168.1.34 or a tunnel address"
                          value={customIp}
                          onChange={(e) => setCustomIp(e.target.value)}
                          className="font-mono text-sm"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      The QR code points here. If the others cannot open it, check they are on the
                      same network, or enter this computer&apos;s address.
                    </p>
                  </div>
                </div>

                <div className="order-1 min-w-0 md:order-2">
                  <QrDisplay joinUrl={joinUrl} roomCode={lanCode} gameName={currentGame.name} />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="join" className="mt-0">
              {showScanner ? (
                <QrScanner
                  onScan={handleScanSuccess}
                  onCancel={closeScanner}
                  className="mx-auto max-w-md shadow-card"
                />
              ) : (
                <Card className="flex flex-col items-center px-6 py-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary-accent">
                    {lan.connected && hostPresent ? (
                      <Users className="h-7 w-7" aria-hidden />
                    ) : (
                      <Spinner size="md" label="Looking for the host" />
                    )}
                  </span>
                  <p className="mt-4 text-tag uppercase text-muted-foreground">Room code</p>
                  <p className="font-mono-num text-4xl font-bold tracking-[0.2em] text-foreground">
                    {lanCode}
                  </p>
                  <p className="mt-3 max-w-sm text-sm text-muted-foreground" aria-live="polite">
                    {lan.connected && hostPresent
                      ? `You are in. Waiting for the host to start ${currentGame.name}.`
                      : "Looking for the host on this network…"}
                  </p>
                  <Button variant="secondary" className="mt-6" onClick={() => setShowScanner(true)}>
                    <Camera className="h-4 w-4" aria-hidden />
                    Scan a different code
                  </Button>
                </Card>
              )}
            </TabsContent>
          </div>

          <LobbyCard
            players={playersList}
            userId={userId}
            connected={lan.connected}
            isHost={activeTab === "host"}
            gameName={currentGame.name}
            onStart={lan.startMatch}
          />
        </div>
      </Tabs>
    </PageContainer>
  );
}

function LobbyCard({
  players,
  userId,
  connected,
  isHost,
  gameName,
  onStart,
}: {
  players: Array<{
    userId: string;
    displayName: string;
    role: string;
    pingMs: number;
    avatarUrl?: string | null;
  }>;
  userId: string;
  connected: boolean;
  isHost: boolean;
  gameName: string;
  onStart: () => void;
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Users className="h-4 w-4 text-primary-accent" aria-hidden />
            Players
          </h2>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono-num font-bold text-foreground">{players.length}</span> on
            this network
          </p>
        </div>
        <Badge variant={connected ? "success" : "warning"}>
          {connected ? "Connected" : "Connecting…"}
        </Badge>
      </div>

      <ul className="space-y-2 p-4" aria-live="polite">
        {players.map((p) => (
          <li
            key={p.userId}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              p.userId === userId ? "border-primary/40 bg-primary/[0.08]" : "border-border"
            )}
          >
            <span className="relative">
              <Avatar src={p.avatarUrl} alt="" aria-hidden fallbackText={p.displayName} size="sm" />
              {p.role === "host" && (
                <span className="absolute -right-1 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-reward/15 text-reward ring-2 ring-card">
                  <Crown className="h-2.5 w-2.5" aria-hidden />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="truncate">{p.displayName}</span>
                {p.userId === userId && (
                  <Badge variant="default" className="px-2 text-[10px]">
                    You
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.role === "host" ? "Host" : "Joined"} ·{" "}
                <span className="font-mono-num">{p.pingMs}</span> ms
              </p>
            </div>
          </li>
        ))}
        {players.length < 2 && (
          <li className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border"
              aria-hidden
            >
              <Users className="h-3.5 w-3.5" />
            </span>
            {isHost ? "Waiting for someone to scan the code" : "Waiting for the host"}
          </li>
        )}
      </ul>

      <div className="border-t border-border p-4">
        {isHost ? (
          <Button variant="play" size="lg" className="w-full" onClick={onStart}>
            <Play className="h-5 w-5 fill-current" aria-hidden />
            Start {gameName}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            The host starts the match when everyone is in.
          </p>
        )}
      </div>
    </Card>
  );
}

function LanSkeleton() {
  return (
    <PageContainer className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Loading the Wi-Fi lobby</span>
      <div className="flex items-start gap-4">
        <Skeleton className="hidden h-12 w-12 rounded-xl sm:block" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </PageContainer>
  );
}
