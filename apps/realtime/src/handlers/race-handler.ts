import {
  gameEngineRegistry,
  SERVER_PLAYER_ID,
  TICK_RATE,
  type RacingAction,
  type RacingEngine,
  type RacingGameState,
} from "@playora/game-engine";
import { botRegistry, type AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import type { RoomContext } from "../durable-objects/room-context.js";
import { log, errorFields } from "../lib/logger.js";
import { broadcastGameState, finishGame, type MatchResult } from "./game-handler.js";

/** Games whose clock runs on the server rather than on a player's turn. */
const REAL_TIME_GAMES: GameId[] = ["car-race", "bike-race"];

export function isRealTimeGame(gameId: GameId): boolean {
  return REAL_TIME_GAMES.includes(gameId);
}

/**
 * Wall-clock interval between server steps, in milliseconds.
 *
 * Fifty milliseconds, carrying three physics ticks each, gives the mandated
 * 60 Hz simulation from twenty timer wakeups a second. Running the timer at
 * the full tick rate would triple the scheduling overhead for a simulation
 * that is identical either way — the physics is a fixed timestep regardless of
 * how the ticks are delivered.
 */
const STEP_MS = 50;
const TICKS_PER_STEP = Math.round((STEP_MS / 1000) * TICK_RATE);

/**
 * How often a snapshot goes out: every second step, so ten a second.
 *
 * Far below the tick rate on purpose. Once the client interpolates between
 * snapshots, ten a second is indistinguishable from sixty, and sixty would be
 * fifty wasted messages per second per player. A snapshot is around a kilobyte
 * because the track is sent as a seed rather than as geometry.
 */
const BROADCAST_EVERY = 2;

/** Bots decide at the same cadence the client is told about the world. */
const BOT_EVERY = 4;

/**
 * A race's clock, run by the server.
 *
 * This is what makes real-time play authoritative rather than merely refereed.
 * Clients send SET_INPUT and nothing else; the engine refuses a TICK from
 * anyone but the server, so the only thing that can advance a race is this
 * loop. A client that stops sending input keeps driving in a straight line; a
 * client that lies about its position is not able to say anything about its
 * position at all.
 */
export class RaceLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private steps = 0;

  constructor(
    private readonly ctx: RoomContext,
    /** Runs the durable write and the result broadcast when the race ends. */
    private readonly onFinished: (result: MatchResult) => Promise<void>,
  ) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    const { room } = this.ctx;
    if (!isRealTimeGame(room.gameId)) return;

    this.steps = 0;
    this.timer = setInterval(() => {
      void this.step();
    }, STEP_MS);

    log.info("race.loop_started", { roomId: room.roomId, gameId: room.gameId });
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
    log.info("race.loop_stopped", { roomId: this.ctx.room.roomId });
  }

  private async step(): Promise<void> {
    const { room } = this.ctx;

    try {
      if (room.status !== "in_game" || !room.currentGameState) {
        this.stop();
        return;
      }
      if (!gameEngineRegistry.has(room.gameId)) {
        this.stop();
        return;
      }

      const engine = gameEngineRegistry.get(room.gameId) as unknown as RacingEngine;
      let state = room.currentGameState as RacingGameState;

      this.steps += 1;

      if (this.steps % BOT_EVERY === 0) {
        state = this.driveBots(engine, state);
      }

      state = engine.applyAction(state, {
        type: "TICK",
        playerId: SERVER_PLAYER_ID,
        payload: { ticks: TICKS_PER_STEP },
        timestamp: Date.now(),
      } as RacingAction).state;

      room.currentGameState = state;
      room.sequenceNumber += 1;

      if (state.isFinished) {
        this.stop();
        await this.ctx.persist();
        broadcastGameState(this.ctx, engine as never);
        await this.onFinished(engine.calculateResult(state, room.roomId) as MatchResult);
        return;
      }

      if (this.steps % BROADCAST_EVERY === 0) {
        broadcastGameState(this.ctx, engine as never);
      }

      // Persisted on a slower cadence than it is simulated. A race writes state
      // twenty times a second; storing all of it would dominate the Durable
      // Object's write budget for no benefit, because a race that is
      // interrupted is abandoned rather than resumed mid-corner.
      if (this.steps % 40 === 0) await this.ctx.persist();
    } catch (err) {
      log.error("race.step_failed", {
        roomId: this.ctx.room.roomId,
        ...errorFields(err),
      });
      // A throwing loop that keeps running floods the log twenty times a
      // second and never recovers. Stopping leaves the room in a state the
      // players can restart from.
      this.stop();
    }
  }

  /** Asks every bot in the race for its next input. */
  private driveBots(engine: RacingEngine, state: RacingGameState): RacingGameState {
    const { room } = this.ctx;
    if (!botRegistry.has(room.gameId)) return state;

    let next = state;
    for (const player of Object.values(room.players)) {
      if (!player.isBot) continue;
      const vehicle = next.vehicles[player.userId];
      if (!vehicle || vehicle.finishedAtTick !== null) continue;

      try {
        const bot = botRegistry.get(room.gameId);
        const action = bot.chooseAction(
          next as never,
          player.userId,
          (player.botLevel ?? 3) as AiLevel,
        ) as RacingAction | null;
        // executeAction, so a bot is validated exactly as a human is.
        if (action) next = engine.executeAction(next, action).state;
      } catch (err) {
        log.error("race.bot_failed", { roomId: room.roomId, userId: player.userId, ...errorFields(err) });
      }
    }
    return next;
  }
}

/**
 * Applies a driver's input.
 *
 * Separate from the normal action path because a race receives input far more
 * often than a turn-based game receives moves, and none of it should broadcast:
 * the loop's own snapshot is what tells everyone where the cars are. Echoing
 * every input would multiply traffic by the number of players for no
 * information at all.
 */
export function applyRaceInput(
  ctx: RoomContext,
  userId: string,
  payload: unknown,
): { ok: boolean; reason?: string } {
  const { room } = ctx;
  if (room.status !== "in_game" || !room.currentGameState) {
    return { ok: false, reason: "No race is in progress." };
  }
  if (!gameEngineRegistry.has(room.gameId)) {
    return { ok: false, reason: "This race is not available." };
  }

  const engine = gameEngineRegistry.get(room.gameId) as unknown as RacingEngine;
  const action = {
    type: "SET_INPUT",
    playerId: userId,
    payload: (payload ?? {}) as Record<string, unknown>,
    timestamp: Date.now(),
  } as RacingAction;

  const validation = engine.validateAction(room.currentGameState as RacingGameState, action);
  if (!validation.valid) return { ok: false, reason: validation.reason };

  room.currentGameState = engine.applyAction(
    room.currentGameState as RacingGameState,
    action,
  ).state;
  return { ok: true };
}

export { finishGame };
