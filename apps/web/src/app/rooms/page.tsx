"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Dialog,
  Tabs,
} from "@playden/ui";
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
} from "lucide-react";
import { useRooms } from "../../hooks/use-rooms";

const GAME_NAMES: Record<string, string> = {
  chess: "Chess (2 Players) - Live",
  uno: "UNO Classic (2-4 Players)",
  "uno-no-mercy": "UNO No Mercy (2-6 Players)",
  "car-race": "Car Race (2-8 Players)",
  "bike-race": "Bike Race (2-8 Players)",
};

function RoomsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameParam = searchParams?.get("game") || null;

  const [activeFilterTab, setActiveFilterTab] = React.useState<"all" | "public" | "private">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [joinCodeInput, setJoinCodeInput] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [roomName, setRoomName] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);

  const { rooms, isLoading, isCreating, error, setError, refresh, createRoom, resolveCode } =
    useRooms(gameParam);

  const filteredRooms = rooms.filter((room) => {
    if (gameParam && room.gameId !== gameParam) return false;
    if (activeFilterTab === "public" && room.isPrivate) return false;
    if (activeFilterTab === "private" && !room.isPrivate) return false;

    return (
      room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.gameId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleCreateRoom = async () => {
    // The server owns the code and persists the room, so it exists before
    // anyone connects and capacity/privacy are enforced server-side.
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
    // Resolve first so a bad or full code gives a clear message instead of a
    // socket that connects and is immediately closed.
    const code = await resolveCode(joinCodeInput);
    if (code) {
      router.push(`/rooms/${code}`);
    }
  };

  const currentGameTitle = gameParam ? GAME_NAMES[gameParam] || gameParam.toUpperCase() : null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-8 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {currentGameTitle ? `${currentGameTitle.split(" (")[0]} Rooms` : "Game Rooms"}
            </h1>
            {gameParam && (
              <Badge variant="default" className="uppercase text-xs">
                {gameParam}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-slate-400">
            {currentGameTitle
              ? `Join a public match or create a private room for ${currentGameTitle.split(" (")[0]}.`
              : "Discover public multiplayer matches or enter a private room code."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-lg shadow-indigo-600/25">
            <Plus className="h-5 w-5" />
            <span>Create Room</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="my-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <Tabs
            tabs={[
              { id: "all", label: "All Rooms", count: rooms.length },
              { id: "public", label: "Public Lobbies", count: rooms.filter((r) => !r.isPrivate).length },
              { id: "private", label: "Private Match (Code)", count: rooms.filter((r) => r.isPrivate).length },
            ]}
            activeTab={activeFilterTab}
            onTabChange={(tabId) => setActiveFilterTab(tabId as "all" | "public" | "private")}
          />

          {/* Join with Room Code Form */}
          <form onSubmit={handleJoinByCode} className="flex gap-2 w-full lg:w-96">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Enter Private Room Code..."
                className="pl-9 font-mono uppercase bg-slate-900/80 border-slate-700 text-xs"
              />
            </div>
            <Button type="submit" variant="secondary" className="gap-1.5 px-4 text-xs font-semibold shrink-0">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>Join</span>
            </Button>
          </form>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search rooms..."
            className="pl-9 bg-slate-900/50 border-slate-800"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              void refresh();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Rooms Grid or Distinct Empty State */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-900/40"
            />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        activeFilterTab === "private" ? (
          <Card className="bg-slate-900/40 border-slate-800/80 p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-xl font-bold text-slate-100">Private Rooms are Hidden</h3>
              <p className="text-sm text-slate-400">
                Private matches do not appear in the public list. Enter the 6-character room code provided by your host above to enter.
              </p>
            </div>
            <Button onClick={() => { setIsPrivate(true); setIsCreateOpen(true); }} className="gap-2 shadow-amber-600/20 bg-amber-600 hover:bg-amber-500 text-white">
              <Plus className="h-4 w-4" />
              <span>Create Private Room</span>
            </Button>
          </Card>
        ) : (
          <Card className="bg-slate-900/40 border-slate-800/80 p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Gamepad2 className="h-8 w-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-xl font-bold text-slate-100">No Active Rooms Available</h3>
              <p className="text-sm text-slate-400">
                There are currently no public rooms waiting for players. Create your match to start playing!
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setIsPrivate(false); setIsCreateOpen(true); }} className="gap-2 shadow-indigo-600/30">
                <Globe2 className="h-4 w-4" />
                <span>Create Public Room</span>
              </Button>
              <Button variant="outline" onClick={() => { setIsPrivate(true); setIsCreateOpen(true); }} className="gap-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
                <Lock className="h-4 w-4" />
                <span>Create Private Room</span>
              </Button>
            </div>
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <Card
              key={room.id}
              className={`flex flex-col justify-between transition-all bg-slate-900/50 backdrop-blur-md ${
                room.isPrivate
                  ? "border-amber-500/30 hover:border-amber-500/60"
                  : "border-slate-800 hover:border-indigo-500/50"
              }`}
            >
              <div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="uppercase">{room.gameId}</Badge>
                    <div className="flex items-center space-x-1.5 text-xs">
                      {room.isPrivate ? (
                        <span className="flex items-center text-amber-400 font-semibold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/40">
                          <Lock className="h-3 w-3 mr-1" /> Private
                        </span>
                      ) : (
                        <span className="flex items-center text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
                          <Globe2 className="h-3 w-3 mr-1" /> Public
                        </span>
                      )}
                    </div>
                  </div>
                  <CardTitle className="mt-3 text-lg">{room.name}</CardTitle>
                  <CardDescription className="font-mono text-xs text-indigo-400">
                    Code: {room.code}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2 text-xs text-slate-400">
                  <div className="flex justify-between items-center py-1 border-t border-slate-800/60">
                    <span>Host:</span>
                    <span className="font-semibold text-slate-200">{room.hostUsername}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-800/60">
                    <span>Players:</span>
                    <span className="flex items-center text-indigo-400 font-semibold">
                      <Users className="h-3.5 w-3.5 mr-1" />
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                  </div>
                </CardContent>
              </div>

              <div className="p-6 pt-0">
                <Button
                  variant={room.isPrivate ? "outline" : "default"}
                  onClick={() => router.push(`/rooms/${room.code}`)}
                  className={`w-full gap-2 ${room.isPrivate ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10" : "shadow-indigo-600/20"}`}
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{room.isPrivate ? "Enter Private Room" : "Join Room"}</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Improved Create Room Modal with Interactive Public / Private Cards */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Room"
        description="Configure match privacy and room settings."
      >
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-300">Room Name</label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Saturday Night Showdown"
              className="mt-1.5 bg-slate-900 border-slate-700"
            />
          </div>

          {/* Privacy Selector Cards */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">Room Visibility</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Public Option Card */}
              <div
                onClick={() => setIsPrivate(false)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  !isPrivate
                    ? "bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${!isPrivate ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-white">Public Room</span>
                  </div>
                  {!isPrivate && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Visible in room directory. Anyone can discover and join.
                </p>
              </div>

              {/* Private Option Card */}
              <div
                onClick={() => setIsPrivate(true)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isPrivate
                    ? "bg-amber-950/40 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${isPrivate ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                      <Lock className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-white">Private Room</span>
                  </div>
                  {isPrivate && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Hidden from directory. Only friends with your room code can join.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="shadow-indigo-600/30"
            >
              Create {isPrivate ? "Private" : "Public"} Room
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function RoomsPage() {
  return (
    <React.Suspense fallback={<div className="container mx-auto p-10 text-slate-400">Loading rooms...</div>}>
      <RoomsContent />
    </React.Suspense>
  );
}
