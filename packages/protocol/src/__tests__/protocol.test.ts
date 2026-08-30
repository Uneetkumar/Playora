import { describe, it, expect } from "vitest";
import {
  UnityCommandSchema,
  UnitySessionConfigSchema,
  parseUnityEvent,
} from "../unity-bridge.js";
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

describe("Unity bridge protocol", () => {
  const session = {
    sessionId: "s1",
    gameId: "car-race" as const,
    trackSeed: 12345,
    trackLength: 1200,
    laps: 3,
    vehicleId: "car-balanced",
    localPlayerId: "p1",
    players: [
      { playerId: "p1", displayName: "You", vehicleId: "car-balanced", isBot: false },
      { playerId: "b1", displayName: "AI 1", vehicleId: "car-speed", isBot: true, aiLevel: 5 },
    ],
    quality: "medium" as const,
    controls: "keyboard" as const,
  };

  it("accepts a well-formed init command", () => {
    const result = UnityCommandSchema.safeParse({ type: "INIT", session });
    expect(result.success).toBe(true);
  });

  it("treats a race without a Photon room as single-player", () => {
    const parsed = UnitySessionConfigSchema.parse(session);
    expect(parsed.photon).toBeUndefined();
  });

  it("rejects an AI level outside the ladder", () => {
    const bad = {
      ...session,
      players: [{ ...session.players[1]!, aiLevel: 12 }],
    };
    expect(UnitySessionConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown command type", () => {
    expect(UnityCommandSchema.safeParse({ type: "TELEPORT" }).success).toBe(false);
  });

  it("parses a race report and records where it came from", () => {
    const event = parseUnityEvent(
      JSON.stringify({
        type: "RACE_FINISHED",
        report: {
          sessionId: "s1",
          reportedPlacings: [
            {
              playerId: "p1",
              place: 1,
              raceTimeMs: 91240,
              bestLapMs: 29110,
              lapsCompleted: 3,
              finished: true,
            },
          ],
          authority: "local",
        },
      }),
    );

    expect(event?.type).toBe("RACE_FINISHED");
    if (event?.type === "RACE_FINISHED") {
      // The field exists so the platform can refuse to rate a client-decided
      // result (spec v2 section 58).
      expect(event.report.authority).toBe("local");
    }
  });

  it("returns null for malformed input rather than throwing", () => {
    // Unity is a separate build artefact and can be older than the page hosting
    // it, so its messages are untrusted input.
    expect(parseUnityEvent("not json")).toBeNull();
    expect(parseUnityEvent('{"type":"NONSENSE"}')).toBeNull();
    expect(parseUnityEvent('{"type":"COUNTDOWN","value":99}')).toBeNull();
  });

  it("keeps a Photon token out of anything the browser can forge", () => {
    // The token is minted by the platform and passed through; the schema does
    // not accept a raw app secret in its place because there is no field for one.
    const networked = UnitySessionConfigSchema.parse({
      ...session,
      photon: { appId: "app", region: "eu", roomName: "r1", token: "short-lived" },
    });
    expect(networked.photon?.token).toBe("short-lived");
    expect(Object.keys(networked.photon ?? {})).not.toContain("secret");
  });
});
