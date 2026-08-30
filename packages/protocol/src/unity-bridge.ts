import { z } from "zod";

/**
 * The boundary between the Playora web platform and a Unity WebGL game.
 *
 * Spec v2 section 44 splits ownership: Unity owns the 3D world, its physics,
 * camera, effects and in-race HUD; the platform owns navigation, the lobby,
 * social, settings, results and progression. This file is the only place the
 * two are allowed to talk, and both sides are generated from it — the C# in
 * `unity/car-race/Assets/Scripts/Core/PlayoraBridge.cs` mirrors these shapes.
 *
 * Everything crosses as a JSON string, because that is all
 * `unityInstance.SendMessage` and a `.jslib` `extern` can carry.
 */

// ---------------------------------------------------------------- platform → Unity

export const UnityQualityTierSchema = z.enum(["low", "medium", "high"]);
export type UnityQualityTier = z.infer<typeof UnityQualityTierSchema>;

export const UnityControlSchemeSchema = z.enum(["keyboard", "touch", "tilt", "wheel"]);
export type UnityControlScheme = z.infer<typeof UnityControlSchemeSchema>;

/**
 * Everything Unity needs to build the race.
 *
 * The track is a seed, not geometry — the same decision the Three.js build
 * arrived at, and for the same reason: a circuit serialises to tens of
 * kilobytes and never changes, so both sides generate it from one number.
 */
export const UnitySessionConfigSchema = z.object({
  sessionId: z.string(),
  gameId: z.enum(["car-race", "bike-race"]),
  /** Deterministic track generation. */
  trackSeed: z.number().int(),
  trackLength: z.number().positive(),
  laps: z.number().int().positive(),
  /** Which vehicle from the garage this player picked. */
  vehicleId: z.string(),
  /** The local player, so Unity knows which car is theirs. */
  localPlayerId: z.string(),
  players: z.array(
    z.object({
      playerId: z.string(),
      displayName: z.string(),
      vehicleId: z.string(),
      isBot: z.boolean(),
      /** 1-7, for bots only. */
      aiLevel: z.number().int().min(1).max(7).optional(),
    }),
  ),
  /**
   * Photon room to join. Absent for a single-player race, which runs entirely
   * inside Unity with no network session at all.
   */
  photon: z
    .object({
      appId: z.string(),
      region: z.string(),
      roomName: z.string(),
      /** Short-lived token minted by the platform, never a raw secret. */
      token: z.string(),
    })
    .optional(),
  quality: UnityQualityTierSchema,
  controls: UnityControlSchemeSchema,
});
export type UnitySessionConfig = z.infer<typeof UnitySessionConfigSchema>;

export const UnityCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("INIT"), session: UnitySessionConfigSchema }),
  z.object({ type: z.literal("SET_PAUSED"), paused: z.boolean() }),
  z.object({ type: z.literal("SET_QUALITY"), tier: UnityQualityTierSchema }),
  z.object({
    type: z.literal("SET_CONTROLS"),
    scheme: UnityControlSchemeSchema,
    sensitivity: z.number().min(0).max(2),
  }),
  z.object({
    type: z.literal("SET_AUDIO"),
    master: z.number().min(0).max(1),
    sfx: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
  }),
  z.object({ type: z.literal("LEAVE") }),
]);
export type UnityCommand = z.infer<typeof UnityCommandSchema>;

// ---------------------------------------------------------------- Unity → platform

/**
 * What Unity says happened at the end of a race.
 *
 * **This is a client report, not a result.** Spec v2 section 58 is explicit
 * that position, lap, finish and winner must never be trusted from the browser.
 * A single-player race may take this at face value, because there is nobody to
 * cheat; a multiplayer race must take the authoritative outcome from the Photon
 * session or have the platform validate it before any rating or XP is written.
 * The field name says `reported` for that reason.
 */
export const UnityRaceReportSchema = z.object({
  sessionId: z.string(),
  reportedPlacings: z.array(
    z.object({
      playerId: z.string(),
      place: z.number().int().positive(),
      /** Milliseconds from lights-out to the line. */
      raceTimeMs: z.number().nonnegative(),
      bestLapMs: z.number().nonnegative().nullable(),
      lapsCompleted: z.number().int().nonnegative(),
      finished: z.boolean(),
    }),
  ),
  /** Whether a networked session arbitrated this, or Unity decided it alone. */
  authority: z.enum(["local", "photon"]),
});
export type UnityRaceReport = z.infer<typeof UnityRaceReportSchema>;

/** Low-rate telemetry, for platform surfaces outside the Unity canvas. */
export const UnityTelemetrySchema = z.object({
  place: z.number().int().positive(),
  totalPlayers: z.number().int().positive(),
  lap: z.number().int().nonnegative(),
  laps: z.number().int().positive(),
  speedKph: z.number().nonnegative(),
  fps: z.number().nonnegative(),
});
export type UnityTelemetry = z.infer<typeof UnityTelemetrySchema>;

export const UnityEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("READY"), buildVersion: z.string() }),
  z.object({
    type: z.literal("LOAD_PROGRESS"),
    progress: z.number().min(0).max(1),
    label: z.string(),
  }),
  z.object({ type: z.literal("LOADED") }),
  /** 3, 2, 1, then 0 for GO. */
  z.object({ type: z.literal("COUNTDOWN"), value: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal("RACE_STARTED") }),
  z.object({ type: z.literal("TELEMETRY"), telemetry: UnityTelemetrySchema }),
  z.object({ type: z.literal("RACE_FINISHED"), report: UnityRaceReportSchema }),
  z.object({ type: z.literal("PAUSED"), paused: z.boolean() }),
  z.object({ type: z.literal("LEFT") }),
  z.object({
    type: z.literal("ERROR"),
    code: z.string(),
    // Shown to the player, so it must read as English rather than as a code.
    message: z.string(),
  }),
]);
export type UnityEvent = z.infer<typeof UnityEventSchema>;

/**
 * The global the `.jslib` plugin calls into.
 *
 * Unity's WebGL plugins can only reach globals, so the page installs one
 * dispatcher and the React shell subscribes to it. Named distinctly enough not
 * to collide with anything else on `window`.
 */
export const UNITY_BRIDGE_GLOBAL = "__playoraUnityBridge";

/** The GameObject on the Unity side that receives SendMessage calls. */
export const UNITY_RECEIVER_OBJECT = "PlayoraBridge";
export const UNITY_RECEIVER_METHOD = "ReceiveCommand";

/** Parses an event from Unity, rejecting anything malformed. */
export function parseUnityEvent(raw: string): UnityEvent | null {
  try {
    return UnityEventSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
