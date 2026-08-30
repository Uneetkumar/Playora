import type { MatchResult } from "../handlers/game-handler.js";
import { log, errorFields } from "./logger.js";

/**
 * The work that happens after a match, and does not belong on the hot path.
 *
 * Spec v2 section 70: result persistence, rating, XP, statistics, achievements,
 * leaderboards, notifications and analytics all follow a finished game, and
 * none of them should hold up realtime gameplay. Today that whole chain is
 * awaited inside the Durable Object — four or five sequential round trips to
 * Supabase while the room sits there unable to process anything else.
 */
export interface MatchFinishedJob {
  type: "match.finished";
  /** Set by the producer so a slow queue is visible in the consumer's logs. */
  enqueuedAt: number;
  roomId: string;
  roomCode: string;
  gameId: string;
  sessionId: string;
  startedAt: number;
  endedAt: number;
  result: MatchResult;
  /** User ids of bots in the match; they take no rating and earn no XP. */
  botIds: string[];
}

export type MatchJob = MatchFinishedJob;

/** Cloudflare's queue binding, narrowed to what this Worker uses. */
export interface MatchQueue {
  send(message: MatchJob): Promise<void>;
}

/**
 * Hands post-match work to the queue, or does it here if there is no queue.
 *
 * The fallback is not a nicety. Queues need a paid Cloudflare plan and a
 * deployed binding, so a fresh clone, a local `wrangler dev` and CI all run
 * without one — and a platform where finishing a game silently records nothing
 * unless billing is configured is worse than one that is briefly slower.
 *
 * Returns how the work was handled so the caller can log it honestly rather
 * than reporting success either way.
 */
export async function enqueueMatchWork(
  queue: MatchQueue | undefined,
  job: MatchJob,
  runInline: () => Promise<void>,
): Promise<"queued" | "inline"> {
  if (queue) {
    try {
      await queue.send(job);
      log.info("match.queued", { sessionId: job.sessionId, roomId: job.roomId });
      return "queued";
    } catch (err) {
      // A queue that rejects the message must not lose the match. Falling
      // through to inline costs latency and keeps the player's rating.
      log.error("match.enqueue_failed", { sessionId: job.sessionId, ...errorFields(err) });
    }
  }

  await runInline();
  return "inline";
}
