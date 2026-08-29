import { Chess, type Move } from "chess.js";
import type { ChessAction, ChessGameState } from "@playora/game-engine";
import type { GameId } from "@playora/game-types";
import { AI_LEVELS, type AiLevel, type BotEngine } from "../types.js";
import { MATE_SCORE, evaluate, pieceValue } from "./evaluation.js";

interface LevelProfile {
  /** Search depth in plies. Depth 0 means "do not search, pick heuristically". */
  depth: number;
  /**
   * Wall-clock search budget in milliseconds.
   *
   * chess.js costs roughly 100us per node, and that cost varies hugely with
   * position complexity, so a node cap cannot bound latency: the same budget
   * that returns in 300ms in the opening takes seconds in a busy midgame.
   * A deadline bounds it directly, and the search returns its best line so far.
   */
  budgetMs: number;
  /**
   * Chance of playing a deliberately non-optimal move, so lower levels feel
   * beatable rather than merely shallow.
   */
  blunderChance: number;
  thinkMs: number;
}

const PROFILES: Record<AiLevel, LevelProfile> = {
  1: { depth: 0, budgetMs: 0, blunderChance: 1.0, thinkMs: 300 },
  2: { depth: 0, budgetMs: 0, blunderChance: 0.5, thinkMs: 400 },
  3: { depth: 1, budgetMs: 60, blunderChance: 0.25, thinkMs: 500 },
  4: { depth: 2, budgetMs: 180, blunderChance: 0.1, thinkMs: 650 },
  5: { depth: 3, budgetMs: 400, blunderChance: 0.03, thinkMs: 800 },
  6: { depth: 4, budgetMs: 800, blunderChance: 0, thinkMs: 1000 },
  7: { depth: 5, budgetMs: 1500, blunderChance: 0, thinkMs: 1200 },
};

export type RandomSource = () => number;

/**
 * Deterministic chess AI: alpha-beta search over a material and piece-square
 * evaluation. No LLM involved (spec section 10).
 *
 * The bot returns a ChessAction, which the caller feeds through ChessEngine
 * exactly like a human move — it never mutates state directly.
 */
export class ChessBot implements BotEngine<ChessGameState, ChessAction> {
  readonly gameId: GameId = "chess";

  private nodes = 0;
  private deadline = 0;

  constructor(private random: RandomSource = Math.random) {}

  thinkingTimeMs(level: AiLevel): number {
    return PROFILES[level].thinkMs;
  }

  chooseAction(state: ChessGameState, playerId: string, level: AiLevel): ChessAction | null {
    if (state.isFinished) return null;

    const chess = new Chess(state.fen);
    const myColor = state.whitePlayerId === playerId ? "w" : "b";
    if (chess.turn() !== myColor) return null;

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Accept a draw when clearly worse; never when winning.
    if (state.drawOfferFromPlayerId && state.drawOfferFromPlayerId !== playerId) {
      const standing = evaluate(chess, myColor);
      return {
        type: standing < -150 ? "ACCEPT_DRAW" : "DECLINE_DRAW",
        playerId,
        payload: {},
        timestamp: Date.now(),
      };
    }

    const chosen = this.pickMove(chess, moves, PROFILES[level]);

    return {
      type: "MOVE",
      playerId,
      payload: {
        from: chosen.from,
        to: chosen.to,
        ...(chosen.promotion ? { promotion: chosen.promotion as "q" | "r" | "b" | "n" } : {}),
      },
      timestamp: Date.now(),
    };
  }

  private pickMove(chess: Chess, moves: Move[], profile: LevelProfile): Move {
    // Always take a mate in one, at every level: missing it looks broken.
    const mateInOne = moves.find((move) => {
      chess.move(move);
      const isMate = chess.isCheckmate();
      chess.undo();
      return isMate;
    });
    if (mateInOne) return mateInOne;

    if (profile.blunderChance > 0 && this.random() < profile.blunderChance) {
      return this.weakMove(moves);
    }

    if (profile.depth === 0) return this.greedyMove(moves);

    return this.searchBestMove(chess, moves, profile);
  }

  /** Level 1-2 texture: a legal move, preferring quiet ones over good ones. */
  private weakMove(moves: Move[]): Move {
    const quiet = moves.filter((m) => !m.captured);
    const pool = quiet.length > 0 ? quiet : moves;
    return pool[Math.floor(this.random() * pool.length)] ?? moves[0]!;
  }

  /** One-ply material grab: takes the most valuable safe-looking capture. */
  private greedyMove(moves: Move[]): Move {
    let best = moves[0]!;
    let bestScore = -Infinity;

    for (const move of moves) {
      const gain = move.captured ? pieceValue(move.captured) : 0;
      // Tiny jitter breaks ties without changing ranking.
      const score = gain + this.random();
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
      if (Date.now() > this.deadline) break;
    }
    return best;
  }

  private searchBestMove(chess: Chess, moves: Move[], profile: LevelProfile): Move {
    const perspective = chess.turn();
    this.nodes = 0;
    this.deadline = Date.now() + profile.budgetMs;
    let best = moves[0]!;
    let bestScore = -Infinity;

    for (const move of this.ordered(moves)) {
      chess.move(move);
      const score = -this.negamax(
        chess,
        profile.depth - 1,
        -Infinity,
        Infinity,
        opposite(perspective),
      );
      chess.undo();

      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  private negamax(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    perspective: "w" | "b",
  ): number {
    this.nodes++;
    // Past the deadline: stop descending and score the position as it stands.
    // Checked on every node -- Date.now() costs ~50ns against ~100us of
    // chess.js work per node, and sampling less often lets the search run on
    // long past its budget.
    if (depth === 0 || Date.now() > this.deadline || chess.isGameOver()) {
      return evaluate(chess, perspective);
    }

    let value = -Infinity;
    for (const move of this.ordered(chess.moves({ verbose: true }))) {
      chess.move(move);
      value = Math.max(
        value,
        -this.negamax(chess, depth - 1, -beta, -alpha, opposite(perspective)),
      );
      chess.undo();

      alpha = Math.max(alpha, value);
      if (alpha >= beta) break; // opponent would avoid this line
    }

    return value === -Infinity ? -MATE_SCORE : value;
  }

  /** Captures first: better move ordering makes alpha-beta prune far more. */
  private ordered(moves: Move[]): Move[] {
    return [...moves].sort((a, b) => {
      const av = a.captured ? pieceValue(a.captured) : 0;
      const bv = b.captured ? pieceValue(b.captured) : 0;
      return bv - av;
    });
  }
}

function opposite(color: "w" | "b"): "w" | "b" {
  return color === "w" ? "b" : "w";
}

export { AI_LEVELS };
