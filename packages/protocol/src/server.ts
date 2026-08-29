import { z } from "zod";

export const ServerMessageTypeSchema = z.enum([
  "CONNECTED",
  "ROOM_STATE",
  "PLAYER_JOINED",
  "PLAYER_LEFT",
  "PLAYER_READY",
  "GAME_STARTED",
  "GAME_STATE",
  "GAME_EVENT",
  "CHAT_MESSAGE",
  "REACTION",
  "PLAYER_DISCONNECTED",
  "PLAYER_RECONNECTED",
  "GAME_FINISHED",
  "ERROR",
  "RESYNC_STATE",
]);

export type ServerMessageType = z.infer<typeof ServerMessageTypeSchema>;

export const PlayerRoleSchema = z.enum(["host", "player", "spectator"]);
export const PlayerConnectionStatusSchema = z.enum(["connected", "disconnected", "reconnecting"]);

export const ProtocolPlayerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: PlayerRoleSchema,
  isReady: z.boolean(),
  seatIndex: z.number(),
  status: PlayerConnectionStatusSchema,
  joinedAt: z.number(),
  lastPingAt: z.number(),
  isGuest: z.boolean(),
  /**
   * Bots are always identifiable (spec section 8: never pretend a bot is human).
   * Defaulted so existing payloads remain valid.
   */
  isBot: z.boolean().default(false),
  /** AI difficulty 1-7. Present only for bots. */
  botLevel: z.number().int().min(1).max(7).optional(),
});

export type ProtocolPlayer = z.infer<typeof ProtocolPlayerSchema>;

export const ProtocolRoomSettingsSchema = z.object({
  maxPlayers: z.number(),
  isPrivate: z.boolean(),
  gameMode: z.enum(["casual", "ranked", "custom"]),
  allowSpectators: z.boolean(),
  turnTimeSeconds: z.number().optional(),
  customRules: z.record(z.unknown()).default({}),
});

export type ProtocolRoomSettings = z.infer<typeof ProtocolRoomSettingsSchema>;

export const ProtocolRoomStatePayloadSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  hostId: z.string(),
  gameId: z.string(),
  status: z.enum(["waiting", "starting", "in_game", "finished", "abandoned"]),
  settings: ProtocolRoomSettingsSchema,
  players: z.record(ProtocolPlayerSchema),
  spectators: z.record(ProtocolPlayerSchema),
  currentSessionId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type ProtocolRoomStatePayload = z.infer<typeof ProtocolRoomStatePayloadSchema>;

export const ConnectedMessageSchema = z.object({
  type: z.literal("CONNECTED"),
  connectionId: z.string(),
  userId: z.string(),
  serverTimestamp: z.number(),
});

export const RoomStateMessageSchema = z.object({
  type: z.literal("ROOM_STATE"),
  room: ProtocolRoomStatePayloadSchema,
});

export const PlayerJoinedMessageSchema = z.object({
  type: z.literal("PLAYER_JOINED"),
  roomId: z.string(),
  player: ProtocolPlayerSchema,
});

export const PlayerLeftMessageSchema = z.object({
  type: z.literal("PLAYER_LEFT"),
  roomId: z.string(),
  playerId: z.string(),
  reason: z.enum(["voluntary", "kicked", "timeout", "disconnected"]),
});

export const PlayerReadyMessageSchema = z.object({
  type: z.literal("PLAYER_READY"),
  roomId: z.string(),
  playerId: z.string(),
  isReady: z.boolean(),
});

export const GameStartedMessageSchema = z.object({
  type: z.literal("GAME_STARTED"),
  roomId: z.string(),
  sessionId: z.string(),
  gameId: z.string(),
  players: z.array(ProtocolPlayerSchema),
  initialState: z.unknown(),
  startedAt: z.number(),
});

export const GameStateMessageSchema = z.object({
  type: z.literal("GAME_STATE"),
  roomId: z.string(),
  sessionId: z.string(),
  sequenceNumber: z.number().int().nonnegative(),
  state: z.unknown(),
  lastAction: z
    .object({
      type: z.string(),
      playerId: z.string(),
      payload: z.unknown(),
      clientActionId: z.string().optional(),
    })
    .optional(),
});

export const GameEventMessageSchema = z.object({
  type: z.literal("GAME_EVENT"),
  roomId: z.string(),
  sessionId: z.string(),
  eventType: z.string(),
  payload: z.unknown(),
});

export const ChatMessagePayloadSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  senderAvatarUrl: z.string().nullable(),
  message: z.string(),
  timestamp: z.number(),
  isSystem: z.boolean().optional(),
});

export const ChatMessageSchema = z.object({
  type: z.literal("CHAT_MESSAGE"),
  chat: ChatMessagePayloadSchema,
});

export const ReactionMessageSchema = z.object({
  type: z.literal("REACTION"),
  roomId: z.string(),
  senderId: z.string(),
  emoji: z.string(),
  timestamp: z.number(),
});

export const PlayerDisconnectedMessageSchema = z.object({
  type: z.literal("PLAYER_DISCONNECTED"),
  roomId: z.string(),
  playerId: z.string(),
  gracePeriodSeconds: z.number(),
});

export const PlayerReconnectedMessageSchema = z.object({
  type: z.literal("PLAYER_RECONNECTED"),
  roomId: z.string(),
  playerId: z.string(),
});

export const GameFinishedMessageSchema = z.object({
  type: z.literal("GAME_FINISHED"),
  roomId: z.string(),
  sessionId: z.string(),
  result: z.object({
    winnerId: z.string().nullable(),
    scores: z.array(
      z.object({
        playerId: z.string(),
        userId: z.string(),
        rank: z.number(),
        score: z.number(),
        isWinner: z.boolean(),
      })
    ),
    durationSeconds: z.number(),
    reason: z.enum(["normal", "resignation", "timeout", "disconnect", "draw"]),
  }),
});

export const ErrorMessageSchema = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const ResyncStateMessageSchema = z.object({
  type: z.literal("RESYNC_STATE"),
  roomId: z.string(),
  room: ProtocolRoomStatePayloadSchema,
  gameState: z.unknown().optional(),
  sequenceNumber: z.number().int().nonnegative().optional(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
  ConnectedMessageSchema,
  RoomStateMessageSchema,
  PlayerJoinedMessageSchema,
  PlayerLeftMessageSchema,
  PlayerReadyMessageSchema,
  GameStartedMessageSchema,
  GameStateMessageSchema,
  GameEventMessageSchema,
  ChatMessageSchema,
  ReactionMessageSchema,
  PlayerDisconnectedMessageSchema,
  PlayerReconnectedMessageSchema,
  GameFinishedMessageSchema,
  ErrorMessageSchema,
  ResyncStateMessageSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ConnectedMessage = z.infer<typeof ConnectedMessageSchema>;
export type RoomStateMessage = z.infer<typeof RoomStateMessageSchema>;
export type PlayerJoinedMessage = z.infer<typeof PlayerJoinedMessageSchema>;
export type PlayerLeftMessage = z.infer<typeof PlayerLeftMessageSchema>;
export type PlayerReadyMessage = z.infer<typeof PlayerReadyMessageSchema>;
export type GameStartedMessage = z.infer<typeof GameStartedMessageSchema>;
export type GameStateMessage = z.infer<typeof GameStateMessageSchema>;
export type GameEventMessage = z.infer<typeof GameEventMessageSchema>;
export type ChatMessageNotification = z.infer<typeof ChatMessageSchema>;
export type ReactionNotification = z.infer<typeof ReactionMessageSchema>;
export type PlayerDisconnectedMessage = z.infer<typeof PlayerDisconnectedMessageSchema>;
export type PlayerReconnectedMessage = z.infer<typeof PlayerReconnectedMessageSchema>;
export type GameFinishedMessage = z.infer<typeof GameFinishedMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type ResyncStateMessage = z.infer<typeof ResyncStateMessageSchema>;
