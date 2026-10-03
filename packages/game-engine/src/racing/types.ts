import type { GameResult } from "@playora/game-types";
import type { BaseGameAction, BaseGameConfig, BaseGameState } from "../types.js";

/**
 * The simulation runs at a fixed 60 ticks per second.
 *
 * Fixed, not variable, because the whole race is deterministic: the same
 * starting state plus the same inputs must produce the same result on the
 * server and on every client. A variable timestep makes that impossible, and
 * with it goes replay, server authority and any hope of catching a cheat.
 */
export const TICK_RATE = 60;
export const TICK_SECONDS = 1 / TICK_RATE;

/** Ticks of countdown before the lights go green. */
export const COUNTDOWN_TICKS = TICK_RATE * 3;

/**
 * Only the server may advance time.
 *
 * A TICK action carries this as its player id, and no client action is ever
 * constructed with it — the realtime layer builds actions from the verified
 * session, so a client asking to tick is rejected as "not your action" rather
 * than being trusted to drive the clock.
 */
export const SERVER_PLAYER_ID = "__server__";

/** Half the drivable width of the road, in metres. */
export const ROAD_HALF_WIDTH = 8;

export type RacingPhase = "countdown" | "racing" | "finished";

/**
 * A player's control state.
 *
 * Intent, not position: the client says "I am steering left", never "I am at
 * x = 4.2". Position is derived by the server, which is what stops a client
 * teleporting itself to the finish line.
 */
export interface VehicleInput {
  /** -1 fully left, +1 fully right. */
  steer: number;
  throttle: boolean;
  brake: boolean;
  /** Rising edge only; holding it does not drain a second charge. */
  nitro: boolean;
}

export const NEUTRAL_INPUT: VehicleInput = {
  steer: 0,
  throttle: false,
  brake: false,
  nitro: false,
};

export interface VehicleState {
  playerId: string;
  /** Which vehicle from the garage this seat is driving. */
  vehicleId: string;
  /** Metres travelled along the centreline. */
  distance: number;
  /** Offset across the road, -1..1 at the edges of the drivable surface. */
  lateral: number;
  /** Metres per second. */
  speed: number;
  /** Visual lean/tilt, -1..1. Bikes use it far more than cars. */
  lean: number;
  nitroCharges: number;
  /** Tick at which the current boost ends; 0 when not boosting. */
  nitroUntilTick: number;
  coins: number;
  /** Ticks left of the crash stun, during which input is ignored. */
  crashTicks: number;
  /**
   * The zone the vehicle is currently inside, or null.
   *
   * Server-derived and sent to clients for display only. A client claiming to
   * be in a nitro zone must never be believed (spec v2 section 58), so this is
   * recomputed from position every tick rather than being remembered.
   */
  zone: ZoneKind | null;
  /** Absorbs the next obstacle hit. Server-granted only. */
  shielded: boolean;
  /** Tick at which coin magnetism ends; 0 when inactive. */
  magnetUntilTick: number;
  /**
   * Consecutive ticks spent off the racing surface.
   *
   * Drives a staged penalty rather than an instant one: clipping a kerb on the
   * exit of a hairpin is part of racing, and punishing it identically to
   * driving across a field makes tight corners miserable.
   */
  offTrackTicks: number;
  /** Laps completed. The lap being driven is this plus one. */
  lapsDone: number;
  /** Tick the current lap started on. */
  lapStartTick: number;
  /** Completed lap times, in ticks. */
  lapTicks: number[];
  /** Quickest completed lap, in ticks. Null until one is finished. */
  bestLapTicks: number | null;
  /** Checkpoints passed, used for progress and for anti-shortcut ordering. */
  checkpoint: number;
  finishedAtTick: number | null;
  /** Final placing, assigned as each vehicle crosses the line. */
  place: number | null;
  input: VehicleInput;
  /** Last input sequence number accepted, so a client can reconcile. */
  lastInputSeq: number;
}

/** One piece of the road: a constant curvature and gradient over its length. */
export interface TrackSegment {
  /** Metres. */
  length: number;
  /** Radians of heading change per metre. Positive curves right. */
  curvature: number;
  /** Metres of rise per metre travelled. Cosmetic; it does not affect speed. */
  gradient: number;
}

export interface TrackObject {
  /** Metres along the centreline. */
  distance: number;
  /** -1..1 across the road. */
  lateral: number;
}

export type ObstacleKind = "cone" | "barrier" | "block" | "barrel" | "spikes" | "laser";

export interface TrackObstacle extends TrackObject {
  kind: ObstacleKind;
  /** Half-width in lateral units. */
  halfWidth: number;
}

export interface BoostPad extends TrackObject {
  /** Width across the road. */
  halfWidth: number;
}

/**
 * Painted areas of track that change how a vehicle behaves while it is on them.
 *
 * Distinct from an obstacle: an obstacle is an event that happens once, at the
 * instant of contact, and costs you speed and control. A zone is a condition
 * that holds for as long as you are inside it, and leaving it restores you.
 * Modelling the two the same way is how you end up with an oil slick that
 * "hits" you once and is then harmless for the rest of the puddle.
 */
export type ZoneKind =
  /** Increases speed while driving on it. */
  | "boost"
  /** Reduces speed — mud, gravel, standing water. */
  | "slow"
  /** More grip: the vehicle holds a tighter line. */
  | "grip"
  /** Less grip. Oil and ice: easy to skid, no stun. */
  | "slick"
  /** Refills the nitro bar while you stay on it. */
  | "nitro";

export interface TrackZone extends TrackObject {
  kind: ZoneKind;
  /** Half-width across the road, in lateral units. */
  halfWidth: number;
  /** How far along the track the zone extends, in metres. */
  length: number;
}

/**
 * Collectables that grant an advantage when driven over.
 *
 * Separate from coins, which are score. A pickup changes what the vehicle can
 * do; a coin changes a number at the end.
 */
export type PickupKind =
  /** One nitro charge. */
  | "nitro"
  /** Fills the nitro bar to the vehicle's capacity. */
  | "perfectNitro"
  /** Absorbs the next obstacle hit entirely. */
  | "shield"
  /** Widens coin collection for a while. */
  | "magnet"
  /** Clears crash stun and recovers some speed. */
  | "repair";

export interface TrackPickup extends TrackObject {
  /**
   * `null` means a mystery box: the kind is decided by the server when it is
   * driven over. Deciding at generation time would let anyone who can read the
   * track seed — which every client can, because it rebuilds the track from it
   * — know the contents of every box on the circuit.
   */
  kind: PickupKind | null;
}

/** One sample of the centreline, in world space. */
export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  /** Direction of travel at this point, in radians. */
  heading: number;
  /** Metres from the start line. */
  distance: number;
}

export interface TrackSpec {
  seed: number;
  /** Length of one lap, in metres. */
  length: number;
  /**
   * The centreline, sampled at even distances and closed into a loop.
   *
   * Stored rather than integrated from curvature: integration accumulates
   * error, and on a circuit that error is a visible step where the road meets
   * itself. Never sent over the wire — the client rebuilds it from the seed.
   */
  points: TrackPoint[];
  segments: TrackSegment[];
  obstacles: TrackObstacle[];
  coins: TrackObject[];
  boostPads: BoostPad[];
  /** Painted surface zones: mud, oil, grip, nitro strips. */
  zones: TrackZone[];
  /** Power-ups and mystery boxes. */
  pickups: TrackPickup[];
  /** Distances at which progress is recorded. */
  checkpoints: number[];
}

export interface RacingGameState extends BaseGameState {
  /** Ticks elapsed since the state was created, including the countdown. */
  tick: number;
  racingPhase: RacingPhase;
  /** Laps that must be completed to finish. */
  laps: number;
  track: TrackSpec;
  vehicles: Record<string, VehicleState>;
  /** Seat order, which is also grid order. */
  playerOrder: string[];
  /** Coin ids already taken, as `${distance}:${lateral}` keys. */
  collectedCoins: string[];
  /**
   * Power-ups already taken.
   *
   * Kept apart from `collectedCoins` rather than sharing it. They were sharing
   * one set, which quietly broke the invariant that the coin tally reconciles
   * with the record of coins gone — and would have let a pickup lying on the
   * same spot as a coin swallow the coin.
   */
  collectedPickups: string[];
  winnerId: string | null;
  /** Tick after which the race ends regardless, so one stuck car cannot hang it. */
  hardStopTick: number;
}

export type RacingActionType = "SET_INPUT" | "TICK";

export interface SetInputPayload extends Partial<VehicleInput> {
  /** Client-side sequence number, echoed back for reconciliation. */
  seq?: number;
}

export interface TickPayload {
  /** How many ticks to advance. Clamped by the engine. */
  ticks?: number;
}

export interface RacingAction extends BaseGameAction {
  type: RacingActionType;
  payload: SetInputPayload | TickPayload;
}

export interface RacingConfig extends BaseGameConfig {
  /** Length of one lap, in metres. */
  trackLength?: number;
  /** Laps to complete. */
  laps?: number;
  /** Chosen vehicle per player id. Anything missing gets the class default. */
  vehicles?: Record<string, string>;
  /** Nitro charges each vehicle starts with. */
  nitroCharges?: number;
  /** Seconds before the race is stopped regardless of who has finished. */
  timeLimitSeconds?: number;
}

/**
 * What one player sees.
 *
 * Everything, in this case. A race has no hidden information — every car is on
 * the same road in plain sight — so unlike UNO there is nothing to redact. The
 * view still exists so the client is handed a shape it can render directly.
 */
export interface RacingPlayerView {
  phase: string;
  racingPhase: RacingPhase;
  isFinished: boolean;
  tick: number;
  /** Seconds until the lights go green; 0 once racing. */
  countdown: number;
  /**
   * The track, as the two numbers it is generated from.
   *
   * Not the geometry. A 3 km track serialises to about 17 KB, which is 96 per
   * cent of a snapshot and 87 KB/s per player for data that never changes.
   * Track generation is deterministic, so the client rebuilds an identical road
   * from the seed with `buildTrack(trackSeed, trackLength)`.
   */
  trackSeed: number;
  trackLength: number;
  /** Laps required to finish. */
  laps: number;
  /** Ticks since the lights went green; 0 during the countdown. */
  raceTicks: number;
  /** Distances at which progress is recorded; small, and needed for the HUD. */
  checkpoints: number[];
  me: VehicleState | null;
  vehicles: VehicleState[];
  /** Current standings, best first. */
  standings: Array<{
    playerId: string;
    place: number;
    distance: number;
    finished: boolean;
    lapsDone: number;
    bestLapTicks: number | null;
  }>;
  collectedCoins: string[];
  winnerId: string | null;
  sequenceNumber: number;
  updatedAt: number;
}

export type RacingEventType =
  | "COUNTDOWN"
  | "RACE_STARTED"
  | "COIN_COLLECTED"
  | "CRASHED"
  | "NITRO_USED"
  | "PICKUP_COLLECTED"
  | "SHIELD_BROKEN"
  | "CHECKPOINT"
  | "LAP_COMPLETED"
  | "VEHICLE_FINISHED"
  | "RACE_FINISHED";

export interface RacingEvent {
  type: RacingEventType;
  playerId?: string;
  value?: number;
}

export interface RacingResult extends GameResult {
  /** Metres covered by each player, for an unfinished race. */
  distances: Record<string, number>;
  coins: Record<string, number>;
}
