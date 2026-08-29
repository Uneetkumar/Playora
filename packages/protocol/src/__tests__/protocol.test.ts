import { describe, it, expect } from "vitest";
import {
  parseClientMessage,
  parseServerMessage,
  serializeProtocolMessage,
  type ClientMessage,
  type ServerMessage,
} from "../index.js";

describe("Protocol Message Validation", () => {
  it("parses valid client JOIN_ROOM message", () => {
    const raw: ClientMessage = {
      type: "JOIN_ROOM",
      roomId: "123e4567-e89b-12d3-a456-426614174000",
      asSpectator: false,
    };
    const serialized = serializeProtocolMessage(raw);
    const parsed = parseClientMessage(serialized);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("JOIN_ROOM");
      expect(parsed.data).toEqual(raw);
    }
  });

  it("rejects invalid client message", () => {
    const raw = {
      type: "JOIN_ROOM",
      // missing roomId
      asSpectator: "invalid_boolean",
    };
    const parsed = parseClientMessage(JSON.stringify(raw));
    expect(parsed.success).toBe(false);
  });

  it("parses valid server CONNECTED and ROOM_STATE messages", () => {
    const connected: ServerMessage = {
      type: "CONNECTED",
      connectionId: "conn-123",
      userId: "user-456",
      serverTimestamp: 1700000000000,
    };
    const parsedConnected = parseServerMessage(connected);
    expect(parsedConnected.success).toBe(true);

    const roomState: ServerMessage = {
      type: "ROOM_STATE",
      room: {
        id: "room-1",
        code: "ABCD",
        name: "Game Room",
        hostId: "user-456",
        gameId: "chess",
        status: "waiting",
        settings: {
          maxPlayers: 2,
          isPrivate: false,
          gameMode: "casual",
          allowSpectators: true,
          customRules: {},
        },
        players: {},
        spectators: {},
        currentSessionId: null,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    };
    const parsedRoom = parseServerMessage(roomState);
    expect(parsedRoom.success).toBe(true);
  });
});
