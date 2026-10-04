import type { GameId, Player, Room } from "@playora/game-types";
import { gameEngineRegistry } from "@playora/game-engine";
import { describeStartBlocker, startBlocker, type StartBlocker } from "@playora/protocol";
import { getCatalogGame } from "../../lib/games/catalog";

/**
 * The lobby's decisions as plain functions: how many seats to draw, who sits
 * where, what the action bar says and when the host may start.
 *
 * Kept out of the components so each rule is tested without a DOM, and so the
 * room page and the dev preview cannot disagree about any of them. The ready
 * rule itself is `startBlocker` from @playora/protocol, which is the function
 * the server enforces START_GAME with.
 */

/** More seats than this and the grid stops reading as a party; racing is 8, the most any room hosts. */
export const MAX_VISIBLE_SEATS = 8;

/** The room's seats, capped for the grid. Never fewer than one. */
export function seatCountFor(maxPlayers: number): number {
  if (!Number.isFinite(maxPlayers)) return 2;
  return Math.min(MAX_VISIBLE_SEATS, Math.max(1, Math.floor(maxPlayers)));
}

/**
 * The fewest players a match can start with.
 *
 * The engine's number when the game has one, because that is what the server
 * checks; the catalogue's for anything else. Racing's engine says 1 (a time
 * trial against bots is a race), which the catalogue's "1-8" agrees with.
 */
export function minPlayersFor(gameId: GameId): number {
  if (gameEngineRegistry.has(gameId)) return gameEngineRegistry.get(gameId).minPlayers;
  return getCatalogGame(gameId)?.minPlayers ?? 2;
}

/** The most a room for this game can seat: the room's own setting, else the engine's, else the catalogue's. */
export function maxPlayersFor(gameId: GameId, roomMax?: number): number {
  if (roomMax && roomMax > 0) return roomMax;
  if (gameEngineRegistry.has(gameId)) return gameEngineRegistry.get(gameId).maxPlayers;
  return getCatalogGame(gameId)?.maxPlayers ?? 2;
}

/**
 * Seated players only.
 *
 * The server keeps spectators in their own map, but a PLAYER_JOINED for a
 * spectator used to be filed under players by the client, so the role is
 * checked as well rather than trusting which map a record arrived in.
 */
export function seatedPlayers(room: Pick<Room, "players"> | null): Player[] {
  if (!room) return [];
  return Object.values(room.players).filter((p) => p.role !== "spectator");
}

/**
 * Why the result screen's Rematch cannot be pressed, or null when it can.
 *
 * Someone who leaves (or is removed) after a match takes their seat with
 * them, and the server will not deal a game a player short. Saying so on the
 * button beats taking a vote the server can only refuse.
 */
export function rematchBlocker(room: Pick<Room, "players" | "status">, gameId: GameId): string | null {
  if (room.status !== "finished") return null;
  return seatedPlayers(room).length < minPlayersFor(gameId) ? "Not enough players" : null;
}

export function spectatorsOf(room: Pick<Room, "players" | "spectators"> | null): Player[] {
  if (!room) return [];
  const listed = Object.values(room.spectators ?? {});
  const misfiled = Object.values(room.players).filter((p) => p.role === "spectator");
  const seen = new Set<string>();
  return [...listed, ...misfiled].filter((p) => {
    if (seen.has(p.userId)) return false;
    seen.add(p.userId);
    return true;
  });
}

/**
 * Lays players into `count` seats by their server-assigned seat index, so a
 * player keeps their seat when someone before them leaves. A player whose
 * index is taken or out of range takes the first free seat; the grid grows
 * rather than drop anyone.
 */
export function arrangeSeats<T extends Pick<Player, "seatIndex" | "joinedAt" | "userId">>(
  players: readonly T[],
  count: number,
): (T | null)[] {
  const seats: (T | null)[] = Array.from({ length: Math.max(count, 0) }, () => null);
  const ordered = [...players].sort((a, b) => a.seatIndex - b.seatIndex || a.joinedAt - b.joinedAt);
  const homeless: T[] = [];

  for (const player of ordered) {
    const i = player.seatIndex;
    if (Number.isInteger(i) && i >= 0 && i < seats.length && seats[i] === null) seats[i] = player;
    else homeless.push(player);
  }
  for (const player of homeless) {
    const free = seats.indexOf(null);
    if (free >= 0) seats[free] = player;
    else seats.push(player);
  }
  return seats;
}

export type ViewerRole = "host" | "player" | "spectator";

export function viewerRole(room: Pick<Room, "hostId" | "players"> | null, userId: string): ViewerRole {
  if (room && userId && room.hostId === userId) return "host";
  const me = room?.players[userId];
  if (me && me.role !== "spectator") return "player";
  return "spectator";
}

export interface LobbyReadiness {
  blocker: StartBlocker | null;
  /** The blocker as a sentence, or null when the host can start. */
  reason: string | null;
  /** Seated players counted ready: bots, the host and everyone who pressed Ready. */
  readyCount: number;
  seatedCount: number;
}

/** The ready check exactly as the server applies it, plus the counts the action bar shows. */
export function lobbyReadiness(params: {
  seated: readonly Player[];
  hostId: string;
  minPlayers: number;
}): LobbyReadiness {
  const blocker = startBlocker({
    seats: params.seated.map((p) => ({ userId: p.userId, isReady: p.isReady, isBot: p.isBot })),
    hostId: params.hostId,
    minPlayers: params.minPlayers,
  });
  const readyCount = params.seated.filter(
    (p) => p.isBot || p.isReady || p.userId === params.hostId,
  ).length;
  return {
    blocker,
    reason: blocker ? describeStartBlocker(blocker) : null,
    readyCount,
    seatedCount: params.seated.length,
  };
}

/** One line under the action bar's button, for whoever is looking. */
export function actionHint(role: ViewerRole, readiness: LobbyReadiness, meReady: boolean): string {
  if (role === "spectator") return "You're watching. Seats open up between matches.";
  if (role === "host") return readiness.reason ?? "Everyone's ready. Start when you are.";
  if (meReady) return "You're ready. The host starts the match.";
  return "Ready up so the host can start.";
}

/**
 * Messages from other people since the reader last looked.
 *
 * Counted from the end, by id, so a capped message list (the store keeps the
 * last hundred) cannot make the count go negative or jump.
 */
export function countUnread(
  messages: readonly { id: string; senderId: string }[],
  lastSeenId: string | null,
  selfId: string,
): number {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (msg.id === lastSeenId) break;
    if (msg.senderId !== selfId) count++;
  }
  return count;
}

/** "9+" past nine, so the badge stays one small circle. */
export function formatUnread(count: number): string {
  return count > 9 ? "9+" : String(count);
}
