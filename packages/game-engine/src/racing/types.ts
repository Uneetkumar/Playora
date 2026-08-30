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

export type ObstacleKind = "cone" | "barrier" | "block";

export interface TrackObstacle extends TrackObject {
  kind: ObstacleKind;
  /** Half-width in lateral units. */
  halfWidth: number;
}

export interface TrackSpec {
  seed: number;
  /** Total race distance in metres. */
  length: number;
  segments: TrackSegment[];
  obstacles: TrackObstacle[];
  coins: TrackObject[];
  /** Distances at which progress is recorded. */
  checkpoints: number[];
}

export interface RacingGameState extends BaseGameState {
  /** Ticks elapsed since the state was created, including the countdown. */
  tick: number;
  racingPhase: RacingPhase;
  track: TrackSpec;
  vehicles: Record<string, VehicleState>;
  /** Seat order, which is also grid order. */
  playerOrder: string[];
  /** Coin ids already taken, as `${distance}:${lateral}` keys. */
  collectedCoins: string[];
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
  /** Race distance in metres. */
  trackLength?: number;
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
  /** Distances at which progress is recorded; small, and needed for the HUD. */
  checkpoints: number[];
  me: VehicleState | null;
  vehicles: VehicleState[];
  /** Current standings, best first. */
  standings: Array<{ playerId: string; place: number; distance: number; finished: boolean }>;
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
  | "CHECKPOINT"
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
