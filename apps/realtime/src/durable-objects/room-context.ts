import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import type { ServerMessage } from "@playden/protocol";
import type { ConnectionAttachment, PersistedRoom } from "./room-state.js";
import type { MatchResult } from "../handlers/game-handler.js";

/**
 * The capabilities a handler needs from the Durable Object.
 *
 * Handlers mutate `room` in place and then call `persist()`. Keeping this seam
 * narrow is what lets the room, auth and game logic live in separate modules
 * without any of them owning socket or storage lifecycle.
 */
export interface RoomContext {
  readonly room: PersistedRoom;
  /** Every live socket, authenticated or not. */
  sockets(): CFWebSocket[];
  attachmentOf(ws: CFWebSocket): ConnectionAttachment | null;
  send(ws: CFWebSocket, msg: ServerMessage): void;
  /** Delivers to authenticated sockets only. */
  broadcast(msg: ServerMessage): void;
  closeSocket(ws: CFWebSocket, code: number, reason: string): void;
  persist(): Promise<void>;
  /**
   * Records a finished match to the persistent store. Never throws: the players
   * already have their result, and a database problem must not break the game
   * (spec section 67).
   */
  recordResult(record: {
    sessionId: string;
    startedAt: number;
    endedAt: number;
    result: MatchResult;
  }): Promise<void>;
}
