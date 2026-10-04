import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import { gameEngineRegistry } from "@playora/game-engine";
import type { RoomContext } from "../durable-objects/room-context.js";
import { log } from "../lib/logger.js";
import { beginSession } from "./game-handler.js";

/**
 * Seats that have to agree before a rematch starts.
 *
 * Bots always agree — there is nobody to ask. A player who has dropped is not
 * counted either, or one person leaving would strand the other on a screen
 * waiting for a vote that can never arrive.
 */
function votersFor(ctx: RoomContext): string[] {
  return Object.values(ctx.room.players)
    .filter((p) => !p.isBot && p.status !== "disconnected")
    .map((p) => p.userId);
}

function announce(ctx: RoomContext): void {
  const { room } = ctx;
  ctx.broadcast({
    type: "REMATCH_STATE",
    roomId: room.roomId,
    votes: room.rematchVotes ?? [],
    needed: votersFor(ctx),
  });
}

/**
 * Records one player's rematch vote, and starts a new game once everyone agrees.
 *
 * A rematch is a mutual decision, so this is a vote rather than a host action:
 * the previous session's host has no special claim on the next one.
 */
export async function voteRematch(
  ctx: RoomContext,
  ws: CFWebSocket,
  userId: string,
  accept: boolean,
): Promise<{ started: boolean }> {
  const { room } = ctx;

  if (room.status !== "finished") {
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_STATE",
      message: "There is no finished game to rematch.",
    });
    return { started: false };
  }

  if (!room.players[userId]) {
    ctx.send(ws, {
      type: "ERROR",
      code: "FORBIDDEN",
      message: "Only players in this match can ask for a rematch.",
    });
    return { started: false };
  }

  const votes = new Set(room.rematchVotes ?? []);
  if (accept) votes.add(userId);
  else votes.delete(userId);
  room.rematchVotes = [...votes];

  const needed = votersFor(ctx);
  const everyoneAgreed = needed.length > 0 && needed.every((id) => votes.has(id));

  if (!everyoneAgreed) {
    await ctx.persist();
    announce(ctx);
    return { started: false };
  }

  // The engine can have gone away between matches only if the deployment
  // changed underneath the room; say so rather than hanging on a vote.
  if (!gameEngineRegistry.has(room.gameId)) {
    ctx.send(ws, {
      type: "ERROR",
      code: "NOT_IMPLEMENTED",
      message: `Game '${room.gameId}' is not available any more.`,
    });
    return { started: false };
  }

  // Everyone left agreeing is not the same as there being enough of them: an
  // opponent who leaves or is removed after the match takes their seat with
  // them. Refused here, with the votes cleared so the result screen does not
  // sit on "waiting", rather than left for the engine to throw on.
  const count = gameEngineRegistry.get(room.gameId).validatePlayerCount(Object.values(room.players));
  if (!count.valid) {
    room.rematchVotes = [];
    await ctx.persist();
    announce(ctx);
    ctx.send(ws, {
      type: "ERROR",
      code: "INVALID_PLAYER_COUNT",
      message: count.reason ?? "Not enough players for a rematch.",
    });
    return { started: false };
  }

  room.rematchVotes = [];
  announce(ctx);
  if (!(await beginSession(ctx))) {
    await ctx.persist();
    ctx.send(ws, {
      type: "ERROR",
      code: "EXECUTION_ERROR",
      message: "The rematch could not be dealt. Vote again to retry.",
    });
    return { started: false };
  }

  log.info("rematch.started", { roomId: room.roomId, players: needed.length });
  return { started: true };
}

/** Clears votes when a match ends or a player leaves, so none carry over. */
export function clearRematchVotes(ctx: RoomContext): void {
  if ((ctx.room.rematchVotes ?? []).length === 0) return;
  ctx.room.rematchVotes = [];
  announce(ctx);
}
