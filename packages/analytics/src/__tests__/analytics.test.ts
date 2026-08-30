import { describe, it, expect, vi } from "vitest";
import { Analytics, type AnalyticsSink } from "../client.js";

function fakeSink() {
  const captured: Array<{ name: string; properties: Record<string, unknown> }> = [];
  const sink: AnalyticsSink = {
    capture: (name, properties) => void captured.push({ name, properties }),
    identify: vi.fn(),
    reset: vi.fn(),
  };
  return { sink, captured };
}

describe("Analytics", () => {
  it("does nothing, safely, when nothing is configured", () => {
    // The path a fresh clone and every CI run takes.
    const analytics = new Analytics();
    expect(analytics.enabled).toBe(false);
    expect(() => analytics.track({ name: "guest_started" })).not.toThrow();
    expect(() => analytics.reset()).not.toThrow();
  });

  it("delivers events buffered before the sink arrived", () => {
    // PostHog loads asynchronously, so the first events of a session happen
    // before it is ready.
    const analytics = new Analytics();
    analytics.track({ name: "game_viewed", properties: { gameId: "chess" } });

    const { sink, captured } = fakeSink();
    analytics.attach(sink);

    expect(captured).toHaveLength(1);
    expect(captured[0]!.name).toBe("game_viewed");
  });

  it("bounds the buffer, so an unconfigured session cannot grow forever", () => {
    const analytics = new Analytics();
    for (let i = 0; i < 500; i++) {
      analytics.track({ name: "game_viewed", properties: { gameId: "chess" } });
    }

    const { sink, captured } = fakeSink();
    analytics.attach(sink);
    expect(captured.length).toBeLessThanOrEqual(50);
  });

  it("attaches the release to every event", () => {
    const analytics = new Analytics();
    const { sink, captured } = fakeSink();
    analytics.attach(sink);
    analytics.setContext({ appVersion: "1.2.3", isGuest: true });

    analytics.track({ name: "quick_play_started", properties: { gameId: "uno" } });
    expect(captured[0]!.properties).toMatchObject({ appVersion: "1.2.3", isGuest: true });
  });

  it("identifies by the platform's own id and nothing else", () => {
    // Spec v2 section 80: do not collect unnecessary sensitive data.
    const analytics = new Analytics();
    const { sink } = fakeSink();
    analytics.attach(sink);
    analytics.setContext({ userId: "u-123", isGuest: false });

    expect(sink.identify).toHaveBeenCalledWith("u-123", { isGuest: false });
  });

  it("never lets a failing sink break the caller", () => {
    // Telemetry must not be able to break the thing it measures.
    const analytics = new Analytics();
    analytics.attach({
      capture: () => {
        throw new Error("network down");
      },
      identify: () => {
        throw new Error("network down");
      },
      reset: () => {
        throw new Error("network down");
      },
    });

    expect(() => analytics.track({ name: "guest_started" })).not.toThrow();
    expect(() => analytics.setContext({ userId: "u-1" })).not.toThrow();
    expect(() => analytics.reset()).not.toThrow();
  });

  it("forgets the user on reset", () => {
    // The next person on a shared device must not inherit the last one.
    const analytics = new Analytics();
    const { sink, captured } = fakeSink();
    analytics.attach(sink);
    analytics.setContext({ userId: "u-1", isGuest: false, appVersion: "1.0.0" });

    analytics.reset();
    analytics.track({ name: "guest_started" });

    expect(sink.reset).toHaveBeenCalled();
    expect(captured.at(-1)!.properties.isGuest).toBe(false);
    // The release survives a reset; the person does not.
    expect(captured.at(-1)!.properties.appVersion).toBe("1.0.0");
  });

  it("carries no display name, email or message text on any event", () => {
    const analytics = new Analytics();
    const { sink, captured } = fakeSink();
    analytics.attach(sink);

    analytics.setContext({ userId: "u-1", isGuest: false });
    analytics.track({
      name: "game_finished",
      properties: {
        gameId: "chess",
        mode: "vs-ai",
        durationSeconds: 300,
        won: true,
        rated: false,
      },
    });

    const keys = Object.keys(captured[0]!.properties).join(",").toLowerCase();
    for (const forbidden of ["name", "email", "message", "ip", "avatar"]) {
      expect(keys, `event carries a ${forbidden}`).not.toContain(forbidden);
    }
  });
});
