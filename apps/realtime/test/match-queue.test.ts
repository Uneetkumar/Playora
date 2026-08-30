import { describe, it, expect, vi } from "vitest";
import { enqueueMatchWork, type MatchJob } from "../src/lib/match-queue.js";

const job: MatchJob = {
  type: "match.finished",
  enqueuedAt: Date.now(),
  roomId: "room-1",
  roomCode: "ABCD",
  gameId: "chess",
  sessionId: "session-1",
  startedAt: Date.now() - 60_000,
  endedAt: Date.now(),
  result: {
    winnerId: "u1",
    scores: [],
    durationSeconds: 60,
    reason: "normal",
  } as MatchJob["result"],
  botIds: [],
};

describe("post-match work", () => {
  it("queues when a queue is bound", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const inline = vi.fn().mockResolvedValue(undefined);

    const how = await enqueueMatchWork({ send }, job, inline);

    expect(how).toBe("queued");
    expect(send).toHaveBeenCalledOnce();
    // The whole point: the room does not wait for Supabase.
    expect(inline).not.toHaveBeenCalled();
  });

  it("runs inline when there is no queue", async () => {
    // Queues need a paid plan, so a fresh clone, local wrangler and CI all
    // take this path. A match must still be recorded.
    const inline = vi.fn().mockResolvedValue(undefined);

    const how = await enqueueMatchWork(undefined, job, inline);

    expect(how).toBe("inline");
    expect(inline).toHaveBeenCalledOnce();
  });

  it("falls back to inline when the queue rejects the message", async () => {
    // A queue outage must cost latency, never a player's rating.
    const send = vi.fn().mockRejectedValue(new Error("queue unavailable"));
    const inline = vi.fn().mockResolvedValue(undefined);

    const how = await enqueueMatchWork({ send }, job, inline);

    expect(how).toBe("inline");
    expect(inline).toHaveBeenCalledOnce();
  });

  it("does not throw when the inline fallback itself fails", async () => {
    const send = vi.fn().mockRejectedValue(new Error("down"));
    const inline = vi.fn().mockRejectedValue(new Error("supabase down"));

    // The caller is a Durable Object finishing a game; it must not be taken
    // down by bookkeeping.
    await expect(enqueueMatchWork({ send }, job, inline)).rejects.toThrow();
  });

  it("stamps the job so a lagging queue is visible", () => {
    expect(job.enqueuedAt).toBeGreaterThan(0);
  });
});
