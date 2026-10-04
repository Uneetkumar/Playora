import { z } from "zod";

/**
 * The lobby's shared rules: what a host may change about a room, and who still
 * has to ready up before a match can start.
 *
 * Both sides read this module. The server enforces it; the client uses the
 * same functions to decide which controls to draw and why Start is disabled,
 * so the tooltip a player sees is the reason the server would give.
 */

/** AI difficulty ladder, as ADD_BOT and the bot engine understand it. */
export const BOT_LEVEL_MIN = 1;
export const BOT_LEVEL_MAX = 7;
/** The level a room's bots play at until the host picks another. */
export const DEFAULT_BOT_LEVEL = 3;

/** Laps a host can set for an online race. */
export const RACE_LAPS_MIN = 1;
export const RACE_LAPS_MAX = 10;

/**
 * UNO house rules a host can toggle.
 *
 * Stored only: the engines do not read them yet. They are typed now so the
 * lobby, the protocol and the stored room agree on their names before the
 * rules themselves land, and a room created today keeps its choices then.
 */
export const UnoHouseRulesSchema = z
  .object({
    /** Play a +2 on a +2 (and a +4 on a +4) to pass the penalty on. */
    stacking: z.boolean(),
    /** A 7 swaps hands with a chosen player; a 0 rotates every hand. */
    sevenZero: z.boolean(),
    /** Play an identical card out of turn. */
    jumpIn: z.boolean(),
    /** Keep drawing until a playable card turns up. */
    drawToMatch: z.boolean(),
  })
  .partial()
  .strict();

export type UnoHouseRules = z.infer<typeof UnoHouseRulesSchema>;
export type UnoHouseRule = keyof UnoHouseRules;

export const UNO_HOUSE_RULES: readonly UnoHouseRule[] = [
  "stacking",
  "sevenZero",
  "jumpIn",
  "drawToMatch",
];

/**
 * Everything a host can set about a room before a match.
 *
 * Strict: an unknown key is a malformed message, not something to ignore. A
 * key that exists but does not apply to this room's game (laps on a chess
 * room) is refused one level up, by `validateRoomOptions`.
 */
export const RoomOptionsSchema = z
  .object({
    /** The level every bot in the room plays at, and new bots are seated at. */
    botLevel: z.number().int().min(BOT_LEVEL_MIN).max(BOT_LEVEL_MAX),
    /** Racing only. */
    laps: z.number().int().min(RACE_LAPS_MIN).max(RACE_LAPS_MAX),
    /** UNO only. */
    houseRules: UnoHouseRulesSchema,
  })
  .partial()
  .strict();

export type RoomOptions = z.infer<typeof RoomOptionsSchema>;
export type RoomOptionKey = keyof RoomOptions;

const TURN_BASED_OPTIONS: readonly RoomOptionKey[] = ["botLevel"];
const UNO_OPTIONS: readonly RoomOptionKey[] = ["botLevel", "houseRules"];
const RACING_OPTIONS: readonly RoomOptionKey[] = ["botLevel", "laps"];

/**
 * Which options a game's room offers. A game with no server engine offers
 * none: there is no match for them to change.
 */
export function roomOptionKeysFor(gameId: string): readonly RoomOptionKey[] {
  switch (gameId) {
    case "chess":
      return TURN_BASED_OPTIONS;
    case "uno":
    case "uno-no-mercy":
      return UNO_OPTIONS;
    case "car-race":
    case "bike-race":
      return RACING_OPTIONS;
    default:
      return [];
  }
}

export type RoomOptionsValidation =
  | { ok: true; options: RoomOptions }
  | { ok: false; reason: string; rejected: string[] };

/**
 * Checks a host's change against what this room's game offers.
 *
 * The values have already passed `RoomOptionsSchema` by the time a message
 * reaches a handler, so this is only about which keys apply here.
 */
export function validateRoomOptions(gameId: string, patch: RoomOptions): RoomOptionsValidation {
  const allowed = roomOptionKeysFor(gameId);
  const rejected = (Object.keys(patch) as RoomOptionKey[]).filter(
    (key) => patch[key] !== undefined && !allowed.includes(key),
  );
  if (rejected.length > 0) {
    return {
      ok: false,
      rejected,
      reason: `This room cannot change ${rejected.join(", ")}.`,
    };
  }
  return { ok: true, options: patch };
}

/**
 * Applies a change on top of the current options. House rules merge rule by
 * rule, so toggling one does not reset the others.
 */
export function mergeRoomOptions(current: RoomOptions, patch: RoomOptions): RoomOptions {
  const next: RoomOptions = { ...current };
  if (patch.botLevel !== undefined) next.botLevel = patch.botLevel;
  if (patch.laps !== undefined) next.laps = patch.laps;
  if (patch.houseRules !== undefined) {
    next.houseRules = { ...(current.houseRules ?? {}), ...patch.houseRules };
  }
  return next;
}

/**
 * Reads a room's stored options back out of its settings, keeping only what
 * validates and applies to the game.
 *
 * Lenient on purpose: the stored value is whatever an older build or a
 * hand-edited room left there, and one bad key must not discard the rest.
 */
export function readRoomOptions(gameId: string, stored: unknown): RoomOptions {
  if (!stored || typeof stored !== "object") return {};
  const source = stored as Record<string, unknown>;
  const options: RoomOptions = {};
  for (const key of roomOptionKeysFor(gameId)) {
    const field = RoomOptionsSchema.shape[key].safeParse(source[key]);
    if (field.success && field.data !== undefined) {
      (options as Record<string, unknown>)[key] = field.data;
    }
  }
  return options;
}

/** The fields of a seat the ready check looks at. */
export interface ReadinessSeat {
  userId: string;
  isReady: boolean;
  isBot?: boolean;
}

/**
 * Seated humans who still have to ready up, in seat order as given.
 *
 * Bots are always ready. The host is never waited on: pressing Start is the
 * host saying they are ready, so asking them to press Ready first as well
 * would be a second button for the same decision.
 */
export function playersNotReady(seats: Iterable<ReadinessSeat>, hostId: string): string[] {
  const waiting: string[] = [];
  for (const seat of seats) {
    if (seat.isBot || seat.userId === hostId || seat.isReady) continue;
    waiting.push(seat.userId);
  }
  return waiting;
}

export type StartBlocker =
  | { kind: "players"; /** More players needed to reach the minimum. */ missing: number }
  | { kind: "ready"; /** Seated humans who have not readied up. */ waitingOn: string[] };

/**
 * Why the host cannot start yet, or null when they can.
 *
 * The player count comes first: there is no point asking people to ready up
 * for a match that could not start with them anyway.
 */
export function startBlocker(params: {
  seats: readonly ReadinessSeat[];
  hostId: string;
  minPlayers: number;
}): StartBlocker | null {
  const missing = params.minPlayers - params.seats.length;
  if (missing > 0) return { kind: "players", missing };
  const waitingOn = playersNotReady(params.seats, params.hostId);
  if (waitingOn.length > 0) return { kind: "ready", waitingOn };
  return null;
}

/** The blocker as one short sentence, for a disabled Start button's tooltip. */
export function describeStartBlocker(blocker: StartBlocker): string {
  if (blocker.kind === "players") {
    return blocker.missing === 1
      ? "Waiting for 1 more player to join"
      : `Waiting for ${blocker.missing} more players to join`;
  }
  const n = blocker.waitingOn.length;
  return n === 1 ? "Waiting for 1 player to ready up" : `Waiting for ${n} players to ready up`;
}
