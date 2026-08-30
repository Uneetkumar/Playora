import type { Env } from "../types.js";
import type { MatchJob } from "../lib/match-queue.js";
import { log, errorFields } from "../lib/logger.js";
import { createResultStore, recordMatchSafely } from "../lib/result-store.js";
import { applyProgressionSafely, createProgressionStore } from "../lib/progression-store.js";

/**
 * Runs the post-match chain off the hot path.
 *
 * The room enqueues a job the moment a game ends and gets straight back to
 * serving the players; this does the several sequential Supabase round trips
 * that follow (spec v2 section 70).
 *
 * One difference from the inline path is worth knowing about: the consumer runs
 * in a plain Worker, not inside the Durable Object, so it cannot broadcast the
 * MATCH_PROGRESSION message to the room's sockets. The result screen therefore
 * fills in its rating and XP from the player's own profile on next read rather
 * than being pushed them. That is the trade for not blocking the room, and it
 * is why the screen was built to render without progression in the first place.
 */
export async function handleMatchJob(job: MatchJob, env: Env): Promise<void> {
  if (job.type !== "match.finished") {
    log.warn("queue.unknown_job", { type: (job as { type: string }).type });
    return;
  }

  const waited = Date.now() - job.enqueuedAt;
  if (waited > 30_000) {
    // Visible rather than silent: a queue running half a minute behind means
    // players are seeing stale ratings, and nothing else would show that.
    log.warn("queue.lagging", { sessionId: job.sessionId, waitedMs: waited });
  }

  const resultStore = createResultStore(env);
  const outcome = await recordMatchSafely(resultStore, {
    roomCode: job.roomCode,
    sessionId: job.sessionId,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    result: job.result,
  });

  // Rating and XP only apply once the match itself is on record.
  if (!outcome.ok || !outcome.gameId) {
    log.warn("queue.result_not_persisted", {
      sessionId: job.sessionId,
      reason: outcome.ok ? "no game id" : outcome.reason,
    });
    return;
  }

  const progression = await applyProgressionSafely(createProgressionStore(env), {
    gameId: outcome.gameId,
    gameSlug: job.gameId,
    sessionId: job.sessionId,
    result: job.result,
    botIds: job.botIds,
  });

  log.info("queue.match_processed", {
    sessionId: job.sessionId,
    players: progression.length,
    waitedMs: waited,
  });
}

/** Cloudflare's queue message, narrowed to what this consumer uses. */
interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(): void;
}

export interface QueueBatch<T> {
  messages: QueueMessage<T>[];
}

/**
 * Processes a batch.
 *
 * Each message is acked or retried on its own, so one poisonous job does not
 * take a whole batch of otherwise-fine matches down with it.
 */
export async function consumeMatchBatch(batch: QueueBatch<MatchJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await handleMatchJob(message.body, env);
      message.ack();
    } catch (err) {
      log.error("queue.job_failed", {
        sessionId: message.body?.sessionId,
        ...errorFields(err),
      });
      // Retried up to max_retries, then sent to the dead letter queue — so a
      // match that cannot be processed is inspectable rather than lost.
      message.retry();
    }
  }
}
