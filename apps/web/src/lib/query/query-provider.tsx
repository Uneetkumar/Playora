"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * One query client for the app.
 *
 * Created inside a ref rather than at module scope: a module-level client is
 * shared across every request on the server, which on a multi-user render
 * leaks one visitor's cached data into another's page.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Thirty seconds before a refetch is considered.
             *
             * The data this platform reads — ratings, history, leaderboards —
             * changes when a match ends, not continuously. Refetching on every
             * mount made the profile page fire the same four queries each time
             * a player navigated back to it.
             */
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            // Coming back to the tab should show current standings; remounting
            // a component the player already looked at should not.
            refetchOnWindowFocus: true,
            refetchOnMount: false,
            /**
             * One retry, quickly.
             *
             * The default of three with exponential backoff means a genuinely
             * broken request spends the better part of a minute pretending to
             * load, which reads as a hang rather than an error.
             */
            retry: 1,
            retryDelay: 800,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
