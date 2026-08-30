"use client";

import * as React from "react";
import { analytics, type AnalyticsSink } from "@playora/analytics";
import { useAuthStore } from "../store/auth-store";

/**
 * Connects the typed analytics client to PostHog, if PostHog is configured.
 *
 * PostHog is imported dynamically so it is not in the bundle every visitor
 * downloads — a platform whose landing page ships an analytics SDK before the
 * player has agreed to anything is both slower and ruder than it needs to be.
 * With no key set, nothing is loaded and every `track` call is a no-op.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuthStore();

  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    let cancelled = false;

    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;

      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        // Pages are recorded by the router below, which knows about the app's
        // own navigation; PostHog's own listener would double-count it.
        capture_pageview: false,
        // Never record what people type or say to each other.
        autocapture: false,
        disable_session_recording: true,
        persistence: "localStorage",
      });

      const sink: AnalyticsSink = {
        capture: (name, properties) => posthog.capture(name, properties),
        identify: (userId, traits) => posthog.identify(userId, traits),
        reset: () => posthog.reset(),
      };

      analytics.attach(sink);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Identity is set separately from the sink, because a guest can be minted
  // long before PostHog finishes loading.
  React.useEffect(() => {
    analytics.setContext({
      userId: user?.id ?? null,
      isGuest: Boolean(isGuest),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    });
  }, [user?.id, isGuest]);

  return <>{children}</>;
}
