import type { WebSocket as CFWebSocket } from "@cloudflare/workers-types";
import type { ServerMessage } from "@playden/protocol";
import type { ConnectionAttachment, PersistedRoom } from "./room-state.js";

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
}
