import type { BaseGameAction, BaseGameState } from "@playden/game-engine";
import type { GameId } from "@playden/game-types";

/**
 * AI difficulty. Deliberately separate from platform level and from game rating
 * (spec sections 10, 104.7) — a strong player may still practise against level 1.
 */
export const AI_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const AI_LEVEL_LABELS: Record<AiLevel, string> = {
  1: "Beginner",
  2: "Easy",
  3: "Normal",
  4: "Advanced",
  5: "Hard",
  6: "Expert",
  7: "Master",
};

export const RECOMMENDED_AI_LEVEL: AiLevel = 3;

/**
 * Produces an action for a bot-controlled seat.
 *
 * A bot returns an *action*, exactly like a human client does. It is then run
 * through the same GameEngine validation, so a bot can never reach a state a
 * human could not (spec section 104.5).
 */
export interface BotEngine<
  TState extends BaseGameState = BaseGameState,
  TAction extends BaseGameAction = BaseGameAction,
> {
  readonly gameId: GameId;
  /** How long the bot should appear to "think", for pacing the UI. */
  thinkingTimeMs(level: AiLevel): number;
  chooseAction(state: TState, playerId: string, level: AiLevel): TAction | null;
}
