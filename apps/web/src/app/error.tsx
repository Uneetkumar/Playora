"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@playora/ui";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

/**
 * Route error boundary.
 *
 * Players get a plain explanation and a way forward; the technical detail is
 * logged and tucked behind a disclosure rather than shown as the headline
 * (spec section 50: never surface a raw error).
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/15">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden />
      </span>

      <h1 className="mt-5 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        That didn&apos;t load properly. Trying again usually sorts it — your
        progress is safe.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button className="gap-2" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <Home className="h-4 w-4" aria-hidden />
            Back to games
          </Button>
        </Link>
      </div>

      {error.digest && (
        <details className="mt-8 max-w-md text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Technical details
          </summary>
          <p className="mt-2 break-all rounded-lg bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground">
            {error.digest}
          </p>
        </details>
      )}
    </div>
  );
}
