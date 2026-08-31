"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Dialog } from "@playora/ui";
import {
  Plus,
  Search,
  Users,
  Lock,
  Globe2,
  Play,
  Hash,
  Gamepad2,
  CheckCircle2,
  RefreshCw,
  Clock,
  Swords,
} from "lucide-react";
import { useRooms } from "../../hooks/use-rooms";
import { cn } from "@playora/ui";

const GAME_NAMES: Record<string, string> = {
  chess: "Chess",
  uno: "UNO Classic",
  "uno-no-mercy": "UNO No Mercy",
  "car-race": "Car Race",
  "bike-race": "Bike Race",
};

const GAME_EMOJI: Record<string, string> = {
  chess: "♟️",
  uno: "🃏",
  "uno-no-mercy": "🔥",
  "car-race": "🏎️",
  "bike-race": "🏍️",
};

function timeAgo(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function RoomsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameParam = searchParams?.get("game") || null;

  const [activeTab, setActiveTab] = React.useState<"all" | "public" | "private">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [joinCodeInput, setJoinCodeInput] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [roomName, setRoomName] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);

  const { rooms, isLoading, isCreating, error, setError, refresh, createRoom, resolveCode } =
    useRooms(gameParam);

  const liveRooms = React.useMemo(() => {
    return rooms.filter((r) => r.status === "waiting" && Date.now() - r.createdAt < 60 * 60 * 1000);
  }, [rooms]);

  const filteredRooms = liveRooms.filter((room) => {
    if (gameParam && room.gameId !== gameParam) return false;
    if (activeTab === "public" && room.isPrivate) return false;
    if (activeTab === "private" && !room.isPrivate) return false;
    return (
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.gameId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleCreateRoom = async () => {
    const code = await createRoom({
      gameSlug: gameParam || "chess",
      ...(roomName.trim() ? { name: roomName.trim() } : {}),
      isPrivate,
    });
    if (!code) return;
    setIsCreateOpen(false);
    router.push(`/rooms/${code}`);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = await resolveCode(joinCodeInput);
    if (code) router.push(`/rooms/${code}`);
  };

  const tabs = [
    { id: "all", label: "All Live", count: liveRooms.length },
    { id: "public", label: "Public", count: liveRooms.filter((r) => !r.isPrivate).length },
    { id: "private", label: "Private", count: liveRooms.filter((r) => r.isPrivate).length },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">

      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-[0_0_20px_rgba(124,58,237,0.4)]">
              <Swords className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {gameParam ? `${GAME_NAMES[gameParam] ?? gameParam} Rooms` : "Game Rooms"}
              </h1>
              <p className="text-xs text-white/50 mt-0.5">
                {liveRooms.length} live {liveRooms.length === 1 ? "room" : "rooms"} right now
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refresh()}
            title="Refresh rooms"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button
            onClick={() => { setIsPrivate(false); setIsCreateOpen(true); }}
            className="gap-2 bg-[#7C3AED] hover:bg-[#9333EA] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.35)] h-9 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Create Room
          </Button>
        </div>
      </div>

      {/* ─── Controls Row: Tabs + Search + Code Join ─── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Filter tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Tab pills */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/8 p-1 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all",
                  activeTab === tab.id
                    ? "bg-[#7C3AED] text-white shadow-md"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-white/10 text-white/40"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rooms..."
              className="h-9 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#7C3AED]/60 focus:ring-1 focus:ring-[#7C3AED]/30 transition-all"
            />
          </div>
        </div>

        {/* Row 2: Join by code */}
        <form onSubmit={handleJoinByCode} className="flex items-center gap-2 max-w-sm">
          <div className="relative flex-1">
            <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="ENTER PRIVATE ROOM CODE..."
              maxLength={8}
              className="h-9 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 font-mono text-xs uppercase tracking-widest text-white placeholder:text-white/25 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!joinCodeInput.trim()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 text-xs font-bold text-amber-300 hover:bg-amber-950/60 hover:border-amber-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Lock className="h-3.5 w-3.5" />
            Join
          </button>
        </form>
      </div>

      {/* ─── Error Banner ─── */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-950/30 px-4 py-3 text-sm text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); void refresh(); }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Rooms Grid / Loading / Empty ─── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-white/5 bg-white/3"
            />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          isPrivateTab={activeTab === "private"}
          onCreatePublic={() => { setIsPrivate(false); setIsCreateOpen(true); }}
          onCreatePrivate={() => { setIsPrivate(true); setIsCreateOpen(true); }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={() => router.push(`/rooms/${room.code}`)}
            />
          ))}
        </div>
      )}

      {/* ─── Create Room Dialog ─── */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Room"
        description="Configure match privacy and room settings."
      >
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-white/70">Room Name (optional)</label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Saturday Night Showdown"
              className="mt-1.5 bg-white/5 border-white/10 text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-white/70 mb-2 block">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: false,
                  icon: Globe2,
                  label: "Public",
                  desc: "Visible in room directory. Anyone can join.",
                  activeClass: "border-emerald-500/70 bg-emerald-950/40 ring-1 ring-emerald-500/40",
                  iconClass: "bg-emerald-500/20 text-emerald-400",
                  checkClass: "text-emerald-400",
                },
                {
                  value: true,
                  icon: Lock,
                  label: "Private",
                  desc: "Hidden. Only people with your code can join.",
                  activeClass: "border-amber-500/70 bg-amber-950/40 ring-1 ring-amber-500/40",
                  iconClass: "bg-amber-500/20 text-amber-400",
                  checkClass: "text-amber-400",
                },
              ].map((opt) => {
                const active = isPrivate === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setIsPrivate(opt.value)}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition-all",
                      active ? opt.activeClass : "border-white/10 bg-white/5 hover:bg-white/8"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn("p-1.5 rounded-lg", active ? opt.iconClass : "bg-white/10 text-white/40")}>
                        <opt.icon className="h-4 w-4" />
                      </div>
                      {active && <CheckCircle2 className={cn("h-4 w-4", opt.checkClass)} />}
                    </div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="text-white/60">
              Cancel
            </Button>
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="bg-[#7C3AED] hover:bg-[#9333EA] text-white font-bold shadow-[0_0_16px_rgba(124,58,237,0.35)]"
            >
              {isCreating ? "Creating…" : `Create ${isPrivate ? "Private" : "Public"} Room`}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function RoomCard({
  room,
  onJoin,
}: {
  room: {
    id: string;
    name: string;
    gameId: string;
    code: string;
    isPrivate: boolean;
    playerCount: number;
    maxPlayers: number;
    hostUsername: string;
    createdAt: number;
  };
  onJoin: () => void;
}) {
  const isFull = room.playerCount >= room.maxPlayers;
  const emoji = GAME_EMOJI[room.gameId] ?? "🎮";
  const gameName = GAME_NAMES[room.gameId] ?? room.gameId;
  const age = timeAgo(Date.now() - room.createdAt);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5",
        room.isPrivate
          ? "border-amber-500/20 bg-gradient-to-b from-amber-950/30 to-[#0B0D17]/90 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
          : "border-white/10 bg-gradient-to-b from-[#1A1B2E]/80 to-[#0B0D17]/90 hover:border-[#7C3AED]/40 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)]"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{room.name}</p>
            <p className="text-[11px] text-white/50">{gameName}</p>
          </div>
        </div>
        {room.isPrivate ? (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
            <Lock className="h-2.5 w-2.5" /> Private
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
            <Globe2 className="h-2.5 w-2.5" /> Public
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {room.playerCount} / {room.maxPlayers} players
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {age}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/50">
          <span>Host: <span className="text-white/70 font-semibold">{room.hostUsername}</span></span>
          <span className="font-mono text-[10px] text-white/30">{room.code}</span>
        </div>

        {/* Player fill bar */}
        <div className="mt-1.5 h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isFull ? "bg-red-500" : room.isPrivate ? "bg-amber-500" : "bg-[#7C3AED]"
            )}
            style={{ width: `${(room.playerCount / room.maxPlayers) * 100}%` }}
          />
        </div>
      </div>

      {/* Join button */}
      <button
        type="button"
        disabled={isFull}
        onClick={onJoin}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all",
          isFull
            ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
            : room.isPrivate
            ? "bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
            : "bg-[#7C3AED]/80 border border-[#7C3AED]/50 text-white hover:bg-[#9333EA] shadow-[0_0_12px_rgba(124,58,237,0.3)]"
        )}
      >
        <Play className="h-3.5 w-3.5 fill-current" />
        {isFull ? "Room Full" : room.isPrivate ? "Enter Private Room" : "Join Room"}
      </button>
    </div>
  );
}

function EmptyState({
  isPrivateTab,
  onCreatePublic,
  onCreatePrivate,
}: {
  isPrivateTab: boolean;
  onCreatePublic: () => void;
  onCreatePrivate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-white/10 bg-[#0F111E]/40 py-20 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#7C3AED]/20 to-[#4F46E5]/20 border border-[#7C3AED]/20">
        {isPrivateTab ? (
          <Lock className="h-9 w-9 text-amber-400/70" />
        ) : (
          <Gamepad2 className="h-9 w-9 text-[#9333EA]/70" />
        )}
      </div>

      <div className="max-w-sm space-y-1.5">
        <h3 className="font-display text-xl font-black text-white">
          {isPrivateTab ? "Private Rooms are Hidden" : "No Active Rooms"}
        </h3>
        <p className="text-sm text-white/40 leading-relaxed">
          {isPrivateTab
            ? "Private matches don't appear in the directory. Enter the room code given by your host using the form above."
            : "No public rooms are waiting right now. Be the first — create a room and invite friends!"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!isPrivateTab && (
          <button
            type="button"
            onClick={onCreatePublic}
            className="flex items-center gap-2 rounded-xl bg-[#7C3AED] hover:bg-[#9333EA] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition-all hover:scale-105"
          >
            <Globe2 className="h-4 w-4" />
            Create Public Room
          </button>
        )}
        <button
          type="button"
          onClick={onCreatePrivate}
          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 hover:bg-amber-950/50 px-5 py-2.5 text-sm font-bold text-amber-300 transition-all hover:scale-105"
        >
          <Lock className="h-4 w-4" />
          Create Private Room
        </button>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <React.Suspense fallback={
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="h-10 w-48 rounded-xl bg-white/5 animate-pulse mb-6" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded-2xl border border-white/5 bg-white/3 animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <RoomsContent />
    </React.Suspense>
  );
}
