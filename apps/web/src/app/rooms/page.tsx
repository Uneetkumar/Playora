"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameId } from "@playora/game-types";
import {
  Button,
  SectionHeader,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@playora/ui";
import { DoorOpen, Globe2, Hash, History, Loader2, Lock, Plus, RefreshCw, Sparkles, Swords } from "lucide-react";
import { useRooms } from "../../hooks/use-rooms";
import { isGameId, getCatalogGame } from "../../lib/games/catalog";
import { GamePicker, ROOM_GAME_IDS } from "../../components/rooms/game-picker";
import { JoinByCode } from "../../components/rooms/join-by-code";
import { RoomRow } from "../../components/rooms/room-row";
import { forgetRoom, useRecentRooms } from "../../components/rooms/recent-rooms";
import { useLiveRoomStatus } from "../../components/rooms/use-live-room-status";
import { useReducedMotionPref } from "../../lib/motion";
import { PageContainer, PageHeader } from "../../components/page/page-header";

/** A directory room older than this is presumed played out (the API agrees). */
const LIVE_WINDOW_MS = 60 * 60 * 1000;

/** The game filter's chips: 40px on a phone, the touch minimum; compact from `sm` up. */
const FILTER_CHIP = "h-10 sm:h-8";

/**
 * Play with friends: start a room, join one with a code, get back into one
 * you were in, or pick an open one.
 *
 * Creating is inline rather than in a dialog: picking the game is the whole
 * decision, so it sits on the page as a grid of the games a room can host.
 * `?create=1` (the palette, quick play, friends' Invite and the home tile)
 * opens that flow: scrolled to, with the game choice focused.
 */
function RoomsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotionPref();
  const gameParam = searchParams?.get("game") ?? null;
  const initialGame: GameId = isGameId(gameParam) && ROOM_GAME_IDS.includes(gameParam) ? gameParam : "uno";
  const wantsCreate = searchParams?.get("create") === "1";

  const createRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!wantsCreate) return;
    const section = createRef.current;
    section?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    section?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus({ preventScroll: true });
    // Drop the flag once acted on, so a refresh or Back doesn't jump again.
    const rest = new URLSearchParams(searchParams?.toString());
    rest.delete("create");
    const query = rest.toString();
    router.replace(query ? `/rooms?${query}` : "/rooms", { scroll: false });
    // Only the flag arriving should fire this, not the reduced-motion read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsCreate]);

  const [game, setGame] = React.useState<GameId>(initialGame);
  const [visibility, setVisibility] = React.useState<"public" | "private">("private");
  const [filter, setFilter] = React.useState<string>(isGameId(gameParam) ? gameParam : "all");

  // Two instances so a failed create and a failed listing keep their own
  // messages: the hook holds one error for both.
  const list = useRooms(filter === "all" ? null : filter);
  const creator = useRooms(null, { autoFetch: false });
  const recent = useRecentRooms();

  const openRooms = React.useMemo(
    () => list.rooms.filter((r) => r.status === "waiting" && Date.now() - r.createdAt < LIVE_WINDOW_MS),
    [list.rooms],
  );
  const live = useLiveRoomStatus([...openRooms.map((r) => r.code), ...recent.map((r) => r.code)]);

  const handleCreate = async () => {
    const isPrivate = visibility === "private";
    const code = await creator.createRoom({ gameSlug: game, isPrivate });
    if (code) router.push(`/rooms/${code}${isPrivate ? "?private=true" : ""}`);
  };

  // The hook reports a failed create through its state; say it where the
  // person is looking.
  const { error: createError, setError: setCreateError } = creator;
  React.useEffect(() => {
    if (!createError) return;
    toast.error("Couldn't create the room", { description: createError, id: "create-room" });
    setCreateError(null);
  }, [createError, setCreateError]);

  const gameName = getCatalogGame(game)?.name ?? game;

  return (
    <PageContainer className="space-y-10 lg:space-y-12">
      {/* The shared header, so the title sits where every other page's does.
          The code card is its action; it is too wide to share a row with the
          title until `lg`, so the header stays stacked until then, and it is
          taller than the title, so the row aligns to the top: aligned to the
          bottom, the title dropped 44px below every other page's. */}
      <PageHeader
        icon={<Swords />}
        title="Play with friends"
        description="Start a room and share the code, or join a friend’s with theirs. Empty seats can take bots."
        className="sm:flex-col sm:items-stretch lg:flex-row lg:items-start"
        action={
          <section
            aria-labelledby="join-title"
            className="w-full rounded-2xl border border-border bg-card p-4 shadow-card lg:w-[24rem]"
          >
            <h2 id="join-title" className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <Hash className="h-4 w-4 text-primary-accent" aria-hidden />
              Have a code?
            </h2>
            <JoinByCode className="mt-3" />
          </section>
        }
      />

      <section
        ref={createRef}
        aria-labelledby="create-title"
        className="scroll-mt-[calc(var(--shell-header-h,4rem)+1rem)] rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6"
      >
        <SectionHeader
          headingId="create-title"
          title="Start a room"
          icon={<Plus />}
          description="Pick a game. You'll get a code to share, and empty seats can take bots."
        />

        <GamePicker value={game} onChange={setGame} className="mt-5" />

        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p id="visibility-label" className="text-sm font-semibold text-foreground">
              Who can find it
            </p>
            <ToggleGroup
              type="single"
              aria-labelledby="visibility-label"
              value={visibility}
              onValueChange={(v) => v && setVisibility(v as "public" | "private")}
              className="mt-2"
            >
              <ToggleGroupItem value="private" className="h-10 gap-1.5 px-4 sm:h-9">
                <Lock className="h-4 w-4" aria-hidden />
                Code only
              </ToggleGroupItem>
              <ToggleGroupItem value="public" className="h-10 gap-1.5 px-4 sm:h-9">
                <Globe2 className="h-4 w-4" aria-hidden />
                Listed
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="mt-2 text-xs text-muted-foreground">
              {visibility === "private"
                ? "Only people with the code or link can join."
                : "Shows under Open rooms for anyone to join."}
            </p>
          </div>
          <Button size="lg" onClick={() => void handleCreate()} disabled={creator.isCreating} className="sm:min-w-[14rem]">
            {creator.isCreating ? (
              <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden />
            )}
            {creator.isCreating ? "Creating…" : `Create ${gameName} room`}
          </Button>
        </div>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="space-y-4">
          <SectionHeader
            headingId="recent-title"
            title="Your recent rooms"
            icon={<History />}
            description="Rooms you were in on this device. Rejoin while they're still open."
          />
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recent.map((r) => (
              <RoomRow
                key={r.code}
                code={r.code}
                gameId={r.gameId}
                since={r.at}
                {...(live[r.code] ? { live: live[r.code] } : {})}
                onForget={() => forgetRoom(r.code)}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="open-title" className="space-y-4">
        <SectionHeader
          headingId="open-title"
          title="Open rooms"
          icon={<DoorOpen />}
          description="Listed rooms waiting for players. Counts come live from the room."
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => void list.refresh()} aria-label="Refresh open rooms">
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          }
        />

        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="Filter by game"
            value={filter}
            onValueChange={(v) => v && setFilter(v)}
            className="w-max"
          >
            <ToggleGroupItem value="all" className={FILTER_CHIP}>
              All games
            </ToggleGroupItem>
            {ROOM_GAME_IDS.map((id) => (
              <ToggleGroupItem key={id} value={id} className={FILTER_CHIP}>
                {getCatalogGame(id)?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {list.isLoading ? (
          <ul aria-busy="true" aria-label="Loading open rooms" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[4.75rem] rounded-xl" />
            ))}
          </ul>
        ) : list.error ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Couldn&rsquo;t load open rooms</p>
              <p className="text-sm text-muted-foreground">{list.error}</p>
            </div>
            <Button variant="outline" onClick={() => void list.refresh()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          </div>
        ) : openRooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <DoorOpen className="h-5 w-5" aria-hidden />
            </span>
            <p className="font-display text-base font-bold text-foreground">No open rooms right now</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start one above and set it to Listed, or share a code-only room with friends.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {openRooms.map((room) => (
              <RoomRow
                key={room.id}
                code={room.code}
                gameId={room.gameId}
                name={room.name}
                isPrivate={room.isPrivate}
                since={room.createdAt}
                maxPlayers={room.maxPlayers}
                {...(live[room.code] ? { live: live[room.code] } : {})}
              />
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

export default function RoomsPage() {
  return (
    <React.Suspense
      fallback={
        <PageContainer className="space-y-6">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-72 rounded-2xl" />
        </PageContainer>
      }
    >
      <RoomsContent />
    </React.Suspense>
  );
}
