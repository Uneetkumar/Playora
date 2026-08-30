import type { AnalyticsContext, AnalyticsEvent } from "./events.js";

/**
 * Where events go. Implemented by PostHog in the browser, and by nothing at all
 * when analytics is not configured.
 */
export interface AnalyticsSink {
  capture(name: string, properties: Record<string, unknown>): void;
  identify(userId: string, traits: Record<string, unknown>): void;
  reset(): void;
}

/**
 * Records what happens, or does nothing at all.
 *
 * The no-op path is the important one. Analytics is configured with keys that
 * do not exist in a fresh clone, in CI, or in most local development, and a
 * platform that breaks — or worse, throws mid-game — because a telemetry key is
 * missing is a platform nobody can run. Every method here is safe to call with
 * no sink attached.
 */
export class Analytics {
  private sink: AnalyticsSink | null = null;
  private context: AnalyticsContext = { userId: null, isGuest: false, appVersion: "0.0.0" };
  /** Events recorded before a sink attached, so startup is not silently lost. */
  private buffer: Array<{ name: string; properties: Record<string, unknown> }> = [];

  get enabled(): boolean {
    return this.sink !== null;
  }

  attach(sink: AnalyticsSink): void {
    this.sink = sink;
    // PostHog loads asynchronously, so the first page view usually happens
    // before it is ready. Buffering means those events are not simply lost.
    for (const event of this.buffer.splice(0, this.buffer.length)) {
      try {
        sink.capture(event.name, event.properties);
      } catch {
        /* a failing sink drops its backlog rather than taking the page down */
      }
    }
  }

  setContext(context: Partial<AnalyticsContext>): void {
    this.context = { ...this.context, ...context };

    if (this.sink && this.context.userId) {
      try {
        // Only ever the platform's own id and whether the account is a guest.
        // Nothing here can identify a person outside Playora.
        this.sink.identify(this.context.userId, { isGuest: this.context.isGuest });
      } catch {
        // Same rule as track(): telemetry must never break the caller. Signing
        // in must not fail because an analytics endpoint is unreachable.
      }
    }
  }

  track(event: AnalyticsEvent): void {
    const properties = {
      ...(event.properties ?? {}),
      isGuest: this.context.isGuest,
      appVersion: this.context.appVersion,
    } as Record<string, unknown>;

    if (!this.sink) {
      // Bounded: an unconfigured session must not accumulate a session's worth
      // of events in memory waiting for a sink that will never arrive.
      if (this.buffer.length < 50) this.buffer.push({ name: event.name, properties });
      return;
    }

    try {
      this.sink.capture(event.name, properties);
    } catch {
      // Telemetry must never be able to break the thing it is measuring.
    }
  }

  /** On sign-out, so the next person on this device is not the previous one. */
  reset(): void {
    this.context = { userId: null, isGuest: false, appVersion: this.context.appVersion };
    try {
      this.sink?.reset();
    } catch {
      /* nothing to do about it */
    }
  }
}

export const analytics = new Analytics();
