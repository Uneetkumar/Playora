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

/**
 * The start procedure, in ticks (F1 style).
 *
 * A short settle so everyone sees the grid, then five red lights one every
 * 0.8 s, then a hold of 0.2-1.0 s before they all go out. The hold is drawn
 * from a hash of the race's secret seed rather than the public track seed, so
 * a client that rebuilds the circuit still cannot know when the lights will go
 * out — which is the entire point of a randomised hold.
 */
export const START_SETTLE_TICKS = 60;
export const START_LIGHT_INTERVAL_TICKS = 48;
export const START_LIGHT_COUNT = 5;
export const START_HOLD_MIN_TICKS = 12;
export const START_HOLD_MAX_TICKS = 60;
/** The tick the fifth light comes on. */
export const LIGHTS_FULL_TICK = START_SETTLE_TICKS + START_LIGHT_COUNT * START_LIGHT_INTERVAL_TICKS;

/**
 * The latest tick the lights can go out on.
 *
 * Kept under its old name because callers use it as "by this tick the race
 * has started". The actual lights-out tick is `state.start.lightsOutTick`.
 */
export const COUNTDOWN_TICKS = LIGHTS_FULL_TICK + START_HOLD_MAX_TICKS;

/** Reaction after lights out that still earns a perfect launch (0.3 s). */
export const PERFECT_LAUNCH_TICKS = 18;
/** Reaction that still earns a good launch (0.6 s). */
export const GOOD_LAUNCH_TICKS = 36;

/** Sectors per lap, for split times. */
export const SECTOR_COUNT = 3;

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
 * A player's control intent, as a client sends it.
 *
 * Intent, not position: the client says "I am steering left", never "I am at
 * x = 4.2". Position is derived by the server, which is what stops a client
 * teleporting itself to the finish line.
 *
 * Pedals are analog 0..1. Booleans are still accepted — `true` reads as a
 * fully pressed pedal — so keyboards, older clients and bots keep working.
 */
export interface VehicleInput {
  /** -1 full left, +1 full right. */
  steer: number;
  throttle: number | boolean;
  brake: number | boolean;
  /** Held nitro: the gauge burns while this is true. */
  nitro: boolean;
  /**
   * Rear brake. At speed with steering, it starts a drift. A held control like
   * the pedals: an input that does not mention it leaves it as it was, so a
   * client sends `false` to let go.
   */
  handbrake?: boolean;
  /**
   * Monotonic count of nitro presses. Each increment is latched until a tick
   * consumes it, so a tap that starts and ends between two server steps still
   * fires — a held boolean alone loses those.
   */
  nitroSeq?: number;
}

/** The controls as the engine holds them: normalised, never a boolean pedal. */
export interface VehicleControls {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  /** Held nitro. */
  nitro: boolean;
  /** Highest press count received; compared with `VehicleState.nitroSeqUsed`. */
  nitroSeq: number;
}

export const NEUTRAL_INPUT: VehicleControls = {
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
  nitro: false,
  nitroSeq: 0,
};

/**
 * One vehicle, in track space.
 *
 * Angles are radians and **right-positive** relative to the track tangent, the
 * same sign as `lateral` and `steer`. The renderer's world yaw is therefore
 * `trackHeading - heading` (see `vehicleWorldYaw`): track headings grow when
 * the road turns left.
 */
export interface VehicleState {
  playerId: string;
  /** Which vehicle from the garage this seat is driving. */
  vehicleId: string;
  /** The body model to draw (a CarModelId for cars). */
  modelId: string;
  /** Body colour, '#rrggbb'. Cosmetic. */
  paint: string;
  /** Metres travelled along the centreline (total, across laps; negative on the grid). */
  distance: number;
  /** Offset across the road, -1..1 at the painted edges; the barrier is further out. */
  lateral: number;
  /** Ground speed, metres per second. */
  speed: number;
  /** Body yaw relative to the track tangent. Right-positive. */
  heading: number;
  /**
   * Slip angle: body heading minus direction of travel. Positive when the car
   * points to the right of where it is going (the tail is out to the left).
   */
  slip: number;
  /** Front-wheel angle, radians, right-positive (counter-steer shows as opposite to slip). */
  steerAngle: number;
  /** Steering after the rack's rate limit, -1..1. */
  steerApplied: number;
  /** Throttle actually applied after stun, limiter and shift cuts, 0..1. */
  throttle: number;
  /** Brake actually applied, 0..1. */
  brake: number;
  /** Longitudinal acceleration last tick, m/s^2. For suspension pitch. */
  accel: number;
  /** Lateral acceleration last tick, m/s^2, right-positive. For roll and lean. */
  latAccel: number;
  /** Visual lean/roll, -1..1.2. Bikes lean into a turn; cars roll by far less. */
  lean: number;
  /** 0..1: how hard the tyres are sliding (understeer, drift, wheelspin, lock-up). */
  tyreSlip: number;
  /** True while the car is in a power slide / handbrake drift. */
  drifting: boolean;
  /** +1 for a right-hand drift, -1 left, 0 when gripping. */
  driftDir: number;
  /** Seconds-equivalent of drift charge built for the mini-turbo. */
  driftCharge: number;
  /** Mini-turbo tier being charged: 0 none, 1 blue, 2 orange, 3 purple. */
  miniTurbo: number;
  /** Ticks of boost left (mini-turbo, boost pad or launch). */
  boostTicks: number;
  /** Extra engine power fraction while `boostTicks` runs. */
  boostPower: number;
  gear: number;
  rpm: number;
  rpmMax: number;
  /** Ticks left of a gear change, during which drive is cut. */
  shiftTicks: number;
  /** Nitro gauge, 0..1. */
  nitro: number;
  nitroActive: boolean;
  /** Last nitro press count consumed. */
  nitroSeqUsed: number;
  /** Ticks of the minimum burn a press guarantees. */
  nitroMinTicks: number;
  /**
   * Nitro bottles, for HUDs built around charges: the gauge in thirds, rounded
   * up so the button only greys out when the gauge is truly empty.
   */
  nitroCharges: number;
  /** Tick the current boost appears to end; `> tick` while any boost runs. Legacy. */
  nitroUntilTick: number;
  /** 0..1 slipstream strength from the car ahead. */
  drafting: number;
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
  /** Beyond the painted edge. */
  offRoad: boolean;
  /**
   * Consecutive ticks spent off the racing surface.
   *
   * Drives a staged penalty rather than an instant one: clipping a kerb on the
   * exit of a hairpin is part of racing, and punishing it identically to
   * driving across a field makes tight corners miserable.
   */
  offTrackTicks: number;
  /** Touching the barrier now; a scrape fires one CRASHED, not one per tick. */
  wallContact: boolean;
  /** Pointing or travelling backwards for long enough to warn. */
  wrongWay: boolean;
  wrongWayTicks: number;
  /** Live race position, 1-based. */
  position: number;
  /** Laps completed. The lap being driven is this plus one. */
  lapsDone: number;
  /** Tick the current lap started on. */
  lapStartTick: number;
  /** Completed lap times, in ticks. */
  lapTicks: number[];
  /** Quickest completed lap, in ticks. Null until one is finished. */
  bestLapTicks: number | null;
  /** Sectors completed over the whole race (lap * 3 + sector). */
  sectorsDone: number;
  sectorStartTick: number;
  /** Splits of the lap being driven, in ticks. */
  sectorTicks: number[];
  /** Splits of the last completed lap. */
  lastSectorTicks: number[];
  /** Best split per sector across the race. */
  bestSectorTicks: Array<number | null>;
  /** Checkpoints passed this lap, used for progress. */
  checkpoint: number;
  /** Moved before lights out. */
  jumpStart: boolean;
  /** Ticks left of the jump-start speed limiter. */
  penaltyTicks: number;
  /** Reaction time at the start, in ticks after lights out; null until launched. */
  launchTicks: number | null;
  finishedAtTick: number | null;
  /** Final placing, assigned as each vehicle crosses the line. */
  place: number | null;
  input: VehicleControls;
  /** Last input sequence number accepted, so a client can reconcile. */
  lastInputSeq: number;
}

/** One piece of the road: a constant curvature and gradient over its length. */
export interface TrackSegment {
  /** Metres. */
  length: number;
  /** Radians of heading change per metre. Positive curves right. */
  curvature: number;
  /** Metres of rise per metre travelled. Uphill slows a car (g sin theta). */
  gradient: number;
}

export interface TrackObject {
  /** Metres along the centreline, within one lap. */
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
  /** Refills a third of the nitro gauge once per crossing. */
  | "nitro";

export interface TrackZone extends TrackObject {
  kind: ZoneKind;
  /** Half-width across the road, in lateral units. */
  halfWidth: number;
  /** How far along the track the zone extends, in metres. May cross the line. */
  length: number;
}

/**
 * Collectables that grant an advantage when driven over.
 *
 * Separate from coins, which are score. A pickup changes what the vehicle can
 * do; a coin changes a number at the end.
 */
export type PickupKind =
  /** A third of the nitro gauge. */
  | "nitro"
  /** Fills the nitro gauge. */
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
  /** Direction of travel at this point, in radians. Grows when the road turns left. */
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
  /** Power-ups and mystery boxes. They come back every lap. */
  pickups: TrackPickup[];
  /** Distances at which progress is recorded. */
  checkpoints: number[];
}

/** The start lights as everyone may see them. */
export interface StartLights {
  /** Red lights lit, 0..5. */
  lights: number;
  /** Tick the lights went out on; null until they have (it is a secret before). */
  lightsOutTick: number | null;
}

export interface RacingGameState extends BaseGameState {
  /** Ticks elapsed since the state was created, including the countdown. */
  tick: number;
  racingPhase: RacingPhase;
  /** Laps that must be completed to finish. */
  laps: number;
  track: TrackSpec;
  /** Cosmetic theme key chosen by the host, passed through to clients. */
  theme: string | null;
  vehicles: Record<string, VehicleState>;
  /** Seat order: the order vehicles are added to a scene, so colours stay put. */
  playerOrder: string[];
  /** Grid order, pole first. */
  gridOrder: string[];
  /** Live running order, leader first. */
  raceOrder: string[];
  /** Players whose finishing ends the race (the humans, unless configured). */
  decisive: string[];
  start: {
    /** Lights-out tick. Hidden from views until it happens. */
    lightsOutTick: number;
    lightsOut: boolean;
  };
  /** Vehicle pairs in contact last tick, as "a|b" with a < b. */
  contacts: string[];
  /** Coin ids already taken, as `${distance}:${lateral}` keys. */
  collectedCoins: string[];
  /**
   * Power-ups already taken, as `${lap}:${distance}:${lateral}`.
   *
   * Kept apart from `collectedCoins`: the coin tally must reconcile with the
   * record of coins gone. Keyed by lap because boxes come back every lap.
   */
  collectedPickups: string[];
  winnerId: string | null;
  /** Tick after which the race ends regardless, so one stuck car cannot hang it. */
  hardStopTick: number;
  /**
   * Set when the first car finishes: the tick the race closes for everyone
   * still running, who are then placed by running order. Null until then.
   */
  closingTick: number | null;
}

export type RacingActionType = "SET_INPUT" | "TICK";

/** SET_INPUT: any subset of the controls, plus the client's sequence number. */
export interface SetInputPayload extends Partial<VehicleInput> {
  /** Client-side sequence number, echoed back as `lastInputSeq` for reconciliation. */
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
  /** Chosen vehicle per player id. Legacy ids are mapped; unknown ids get the default. */
  vehicles?: Record<string, string>;
  /** Chosen paint per player id, '#rrggbb'. Anything else gets the car's default paint. */
  paints?: Record<string, string>;
  /** Cosmetic theme key, passed through to every client. */
  theme?: string;
  /** Starting nitro gauge, 0..1. Wins over `nitroCharges`. */
  nitroStart?: number;
  /**
   * Legacy: nitro "charges" a career level grants. Each is a third of the
   * gauge, so 3 starts the race full. Kept because career levels are tuned in
   * charges; the gauge is the only thing the physics knows.
   */
  nitroCharges?: number;
  /** Seconds before the race is stopped regardless of who has finished. */
  timeLimitSeconds?: number;
  /** Grid order, pole first. Ids not listed follow in seeded order. */
  grid?: string[];
  /** Players whose finishing ends the race. Defaults to every non-bot player. */
  decisive?: string[];
}

/** One row of the live standings. */
export interface RacingStanding {
  playerId: string;
  place: number;
  distance: number;
  finished: boolean;
  lapsDone: number;
  bestLapTicks: number | null;
}

/**
 * What one player sees.
 *
 * Everything, in this case. A race has no hidden information — every car is on
 * the same road in plain sight — so unlike UNO there is nothing to redact,
 * except the lights-out tick before it happens. The view still exists so the
 * client is handed a shape it can render directly.
 */
export interface RacingPlayerView {
  phase: string;
  racingPhase: RacingPhase;
  isFinished: boolean;
  tick: number;
  /**
   * During the start: red lights still to come on, counting down to 1 (held at
   * 1 through the final hold); 0 once racing. For HUDs that show a number.
   */
  countdown: number;
  start: StartLights;
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
  theme: string | null;
  /** Laps required to finish. */
  laps: number;
  /** Ticks since the lights went out; 0 during the start. */
  raceTicks: number;
  /** Distances at which progress is recorded; small, and needed for the HUD. */
  checkpoints: number[];
  me: VehicleState | null;
  vehicles: VehicleState[];
  /** Current standings, best first. */
  standings: RacingStanding[];
  collectedCoins: string[];
  winnerId: string | null;
  /** When the race closes for the cars still running (first finisher + 45 s); null until someone finishes. */
  closingTick: number | null;
  sequenceNumber: number;
  updatedAt: number;
}

export type RacingEventType =
  /** Legacy alias of START_LIGHT; value = lights still to come. */
  | "COUNTDOWN"
  /** A red light came on; value = 1..5. */
  | "START_LIGHT"
  /** All lights out: go. Also emitted as RACE_STARTED for older listeners. */
  | "LIGHTS_OUT"
  | "RACE_STARTED"
  /** Moved before lights out; a speed-limiter penalty follows. */
  | "JUMP_START"
  /** Launched within the reaction window; value = reaction ticks, strength = quality. */
  | "LAUNCH"
  | "PERFECT_LAUNCH"
  | "COIN_COLLECTED"
  /**
   * Wall, obstacle or spin; strength 0..1. Also fired once per new car-to-car
   * contact alongside COLLISION, with `otherId` set, for older listeners.
   */
  | "CRASHED"
  /** Car-to-car contact, once per new contact; otherId, strength 0..1, value = impact m/s. */
  | "COLLISION"
  | "SPIN"
  /** A nitro burn started; value = gauge. */
  | "NITRO_USED"
  | "NITRO_START"
  | "NITRO_END"
  /** Gauge refilled by a strip or pickup; value = gauge. */
  | "NITRO_GAINED"
  | "DRIFT_START"
  | "DRIFT_END"
  /** Drift released with charge; value = tier 1..3. */
  | "MINI_TURBO"
  | "BOOST_PAD"
  | "NEAR_MISS"
  /** value = new gear. */
  | "GEAR_UP"
  | "GEAR_DOWN"
  | "PICKUP_COLLECTED"
  | "SHIELD_BROKEN"
  | "CHECKPOINT"
  /** value = sector index 0..2, ticks = split. */
  | "SECTOR"
  | "LAP_COMPLETED"
  /** The lap that is about to be driven is the last. */
  | "FINAL_LAP"
  /** value = new position, from = old position. */
  | "POSITION_CHANGED"
  /** value = 1 when the warning starts, 0 when it clears. */
  | "WRONG_WAY"
  | "VEHICLE_FINISHED"
  | "RACE_FINISHED";

export interface RacingEvent {
  type: RacingEventType;
  playerId?: string;
  /** Event-specific number: a count, light, gear, tier, position, gauge. */
  value?: number;
  /** 0..1 intensity, for audio and effects. */
  strength?: number;
  /** The other vehicle, for contact and near misses. */
  otherId?: string;
  /** The previous value, for changes. */
  from?: number;
  /** A duration in ticks (sector splits, lap times). */
  ticks?: number;
}

export interface RacingResult extends GameResult {
  /** Metres covered by each player, for an unfinished race. */
  distances: Record<string, number>;
  coins: Record<string, number>;
}
