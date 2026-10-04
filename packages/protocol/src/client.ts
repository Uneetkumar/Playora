import { z } from "zod";
import { RoomOptionsSchema } from "./lobby.js";

export const ClientMessageTypeSchema = z.enum([
  "AUTH",
  "JOIN_ROOM",
  "LEAVE_ROOM",
  "READY",
  "UNREADY",
  "SET_READY",
  "START_GAME",
  "ADD_BOT",
  "REMOVE_BOT",
  "GAME_ACTION",
  "CHAT_SEND",
  "REACTION_SEND",
  "PING",
  "RESYNC",
  "REMATCH",
  "KICK_PLAYER",
  "UPDATE_ROOM_SETTINGS",
]);

export type ClientMessageType = z.infer<typeof ClientMessageTypeSchema>;

export const AuthMessageSchema = z.object({
  type: z.literal("AUTH"),
  token: z.string().min(1),
  isGuest: z.boolean().default(false),
  guestUsername: z.string().optional(),
});

export const JoinRoomMessageSchema = z.object({
  type: z.literal("JOIN_ROOM"),
  roomId: z.string().uuid().or(z.string().min(4)),
  passcode: z.string().optional(),
  asSpectator: z.boolean().default(false),
});

export const RematchMessageSchema = z.object({
  type: z.literal("REMATCH"),
  roomId: z.string(),
  /** False withdraws a vote already cast. */
  accept: z.boolean().default(true),
});

export const LeaveRoomMessageSchema = z.object({
  type: z.literal("LEAVE_ROOM"),
  roomId: z.string(),
});

export const ReadyMessageSchema = z.object({
  type: z.literal("READY"),
  roomId: z.string(),
});

export const UnreadyMessageSchema = z.object({
  type: z.literal("UNREADY"),
  roomId: z.string(),
});

/**
 * Ready or not, as one message. READY and UNREADY remain for older clients and
 * do exactly the same thing.
 */
export const SetReadyMessageSchema = z.object({
  type: z.literal("SET_READY"),
  roomId: z.string(),
  ready: z.boolean(),
});

/**
 * Host-only: remove someone from the room. A seated player can only be removed
 * between matches; a spectator at any time. Someone removed cannot rejoin the
 * same room.
 */
export const KickPlayerMessageSchema = z.object({
  type: z.literal("KICK_PLAYER"),
  roomId: z.string(),
  playerId: z.string().min(1),
});

/**
 * Host-only: change the room's options before a match. Only the keys the
 * room's game offers are accepted (see `roomOptionKeysFor`).
 */
export const UpdateRoomSettingsMessageSchema = z.object({
  type: z.literal("UPDATE_ROOM_SETTINGS"),
  roomId: z.string(),
  settings: RoomOptionsSchema,
});

export const StartGameMessageSchema = z.object({
  type: z.literal("START_GAME"),
  roomId: z.string(),
  customRules: z.record(z.unknown()).optional(),
});

/** Host-only: seat an AI opponent at the requested difficulty. */
export const AddBotMessageSchema = z.object({
  type: z.literal("ADD_BOT"),
  roomId: z.string(),
  level: z.number().int().min(1).max(7).default(3),
});

export const RemoveBotMessageSchema = z.object({
  type: z.literal("REMOVE_BOT"),
  roomId: z.string(),
  botId: z.string(),
});

export const GameActionMessageSchema = z.object({
  type: z.literal("GAME_ACTION"),
  roomId: z.string(),
  sessionId: z.string(),
  actionType: z.string(),
  payload: z.unknown(),
  clientActionId: z.string().optional(),
});

export const ChatSendMessageSchema = z.object({
  type: z.literal("CHAT_SEND"),
  roomId: z.string(),
  message: z.string().min(1).max(500),
});

export const ReactionSendMessageSchema = z.object({
  type: z.literal("REACTION_SEND"),
  roomId: z.string(),
  emoji: z.string().min(1).max(8),
});

export const PingMessageSchema = z.object({
  type: z.literal("PING"),
  clientTimestamp: z.number().int(),
});

export const ResyncMessageSchema = z.object({
  type: z.literal("RESYNC"),
  roomId: z.string(),
  lastSequenceNumber: z.number().int().nonnegative().optional(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  AuthMessageSchema,
  JoinRoomMessageSchema,
  LeaveRoomMessageSchema,
  ReadyMessageSchema,
  UnreadyMessageSchema,
  SetReadyMessageSchema,
  StartGameMessageSchema,
  AddBotMessageSchema,
  RemoveBotMessageSchema,
  GameActionMessageSchema,
  ChatSendMessageSchema,
  ReactionSendMessageSchema,
  PingMessageSchema,
  ResyncMessageSchema,
  RematchMessageSchema,
  KickPlayerMessageSchema,
  UpdateRoomSettingsMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type JoinRoomMessage = z.infer<typeof JoinRoomMessageSchema>;
export type LeaveRoomMessage = z.infer<typeof LeaveRoomMessageSchema>;
export type RematchMessage = z.infer<typeof RematchMessageSchema>;
export type ReadyMessage = z.infer<typeof ReadyMessageSchema>;
export type UnreadyMessage = z.infer<typeof UnreadyMessageSchema>;
export type SetReadyMessage = z.infer<typeof SetReadyMessageSchema>;
export type KickPlayerMessage = z.infer<typeof KickPlayerMessageSchema>;
export type UpdateRoomSettingsMessage = z.infer<typeof UpdateRoomSettingsMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
export type AddBotMessage = z.infer<typeof AddBotMessageSchema>;
export type RemoveBotMessage = z.infer<typeof RemoveBotMessageSchema>;
export type GameActionMessage = z.infer<typeof GameActionMessageSchema>;
export type ChatSendMessage = z.infer<typeof ChatSendMessageSchema>;
export type ReactionSendMessage = z.infer<typeof ReactionSendMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type ResyncMessage = z.infer<typeof ResyncMessageSchema>;
