"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@playora/ui";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";

/**
 * Route error boundary.
 *
 * Players get a plain explanation and a way forward; the technical detail is
 * logged and tucked behind a disclosure rather than shown as the headline
 * (spec section 50: never surface a raw error). It renders inside the shell,
 * so navigation keeps working around the broken page.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-6"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive-ink ring-1 ring-inset ring-destructive/30">
        <TriangleAlert className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-balance font-display text-h1 text-foreground">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        That didn&apos;t load properly. Trying again usually sorts it, and your progress is safe.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            Back home
          </Link>
        </Button>
      </div>

      {error.digest && (
        <details className="mt-10 w-full max-w-md rounded-xl border border-border bg-card text-left">
          <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <p className="break-all border-t border-border px-4 py-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        </details>
      )}
    </div>
  );
}
