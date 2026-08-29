import { z } from "zod";

/**
 * Matchmaking protocol.
 *
 * Deliberately a separate message union from the room protocol: matchmaking
 * decides *who* plays together, rooms manage a match in progress, and mixing
 * them is what makes queueing logic leak into room state (spec sections 5, 104.8).
 */
export const QueueModeSchema = z.enum(["casual", "ranked"]);
export type QueueMode = z.infer<typeof QueueModeSchema>;

export const QueueJoinMessageSchema = z.object({
  type: z.literal("QUEUE_JOIN"),
  token: z.string().min(1),
  gameId: z.string().min(1),
  mode: QueueModeSchema.default("casual"),
});

export const QueueLeaveMessageSchema = z.object({
  type: z.literal("QUEUE_LEAVE"),
});

export const QueuePingMessageSchema = z.object({
  type: z.literal("QUEUE_PING"),
  clientTimestamp: z.number().int(),
});

export const MatchmakingClientMessageSchema = z.discriminatedUnion("type", [
  QueueJoinMessageSchema,
  QueueLeaveMessageSchema,
  QueuePingMessageSchema,
]);
export type MatchmakingClientMessage = z.infer<typeof MatchmakingClientMessageSchema>;

export const QueuedMessageSchema = z.object({
  type: z.literal("QUEUED"),
  gameId: z.string(),
  mode: QueueModeSchema,
  /** How many players are waiting in this pool, including you. */
  poolSize: z.number().int().nonnegative(),
});

export const QueueStatusMessageSchema = z.object({
  type: z.literal("QUEUE_STATUS"),
  waitingSeconds: z.number().int().nonnegative(),
  poolSize: z.number().int().nonnegative(),
  /** Current rating tolerance, which widens the longer you wait. */
  ratingWindow: z.number().int().nonnegative(),
});

export const MatchFoundMessageSchema = z.object({
  type: z.literal("MATCH_FOUND"),
  roomCode: z.string(),
  gameId: z.string(),
  opponents: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      rating: z.number().int(),
    }),
  ),
});

export const QueueLeftMessageSchema = z.object({
  type: z.literal("QUEUE_LEFT"),
  reason: z.enum(["cancelled", "timeout", "error"]),
});

export const MatchmakingErrorSchema = z.object({
  type: z.literal("MM_ERROR"),
  code: z.string(),
  message: z.string(),
});

export const MatchmakingServerMessageSchema = z.discriminatedUnion("type", [
  QueuedMessageSchema,
  QueueStatusMessageSchema,
  MatchFoundMessageSchema,
  QueueLeftMessageSchema,
  MatchmakingErrorSchema,
]);
export type MatchmakingServerMessage = z.infer<typeof MatchmakingServerMessageSchema>;

export type MatchFoundMessage = z.infer<typeof MatchFoundMessageSchema>;
export type QueueStatusMessage = z.infer<typeof QueueStatusMessageSchema>;

export function parseMatchmakingClientMessage(
  raw: unknown,
): { success: true; data: MatchmakingClientMessage } | { success: false; error: string } {
  try {
    const json = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result = MatchmakingClientMessageSchema.safeParse(json);
    if (!result.success) {
      return {
        success: false,
        error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      };
    }
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export function parseMatchmakingServerMessage(
  raw: unknown,
): { success: true; data: MatchmakingServerMessage } | { success: false; error: string } {
  try {
    const json = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result = MatchmakingServerMessageSchema.safeParse(json);
    if (!result.success) {
      return {
        success: false,
        error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      };
    }
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}
