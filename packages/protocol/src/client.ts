import { z } from "zod";

export const ClientMessageTypeSchema = z.enum([
  "AUTH",
  "JOIN_ROOM",
  "LEAVE_ROOM",
  "READY",
  "UNREADY",
  "START_GAME",
  "GAME_ACTION",
  "CHAT_SEND",
  "REACTION_SEND",
  "PING",
  "RESYNC",
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

export const StartGameMessageSchema = z.object({
  type: z.literal("START_GAME"),
  roomId: z.string(),
  customRules: z.record(z.unknown()).optional(),
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
  StartGameMessageSchema,
  GameActionMessageSchema,
  ChatSendMessageSchema,
  ReactionSendMessageSchema,
  PingMessageSchema,
  ResyncMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type JoinRoomMessage = z.infer<typeof JoinRoomMessageSchema>;
export type LeaveRoomMessage = z.infer<typeof LeaveRoomMessageSchema>;
export type ReadyMessage = z.infer<typeof ReadyMessageSchema>;
export type UnreadyMessage = z.infer<typeof UnreadyMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
export type GameActionMessage = z.infer<typeof GameActionMessageSchema>;
export type ChatSendMessage = z.infer<typeof ChatSendMessageSchema>;
export type ReactionSendMessage = z.infer<typeof ReactionSendMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type ResyncMessage = z.infer<typeof ResyncMessageSchema>;
