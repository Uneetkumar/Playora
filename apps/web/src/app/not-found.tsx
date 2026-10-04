import Link from "next/link";
import { Button } from "@playora/ui";
import { Home, LayoutGrid, MapPinOff } from "lucide-react";
import { OpenSearchButton } from "../components/shell/open-search-button";

/**
 * Branded 404.
 *
 * Without this file Next falls back to its built-in error page, which renders
 * outside the app's stylesheet — so a missing route looked like the whole site
 * had broken rather than one link being wrong. It renders inside the shell,
 * so the sidebar and search are still there; the page offers the three ways
 * out people actually take: home, the catalogue, or a search.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary-accent ring-1 ring-inset ring-primary/30">
        <MapPinOff className="h-8 w-8" aria-hidden />
      </span>
      <p className="mt-6 font-mono-num text-meta uppercase tracking-[0.2em] text-muted-foreground">Error 404</p>
      <h1 className="mt-2 text-balance font-display text-h1 text-foreground">This page doesn&apos;t exist</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The link may be out of date, or the page may have moved. Nothing is broken; you just took a
        wrong turn.
      </p>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            Back home
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/games">
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Browse games
          </Link>
        </Button>
        <OpenSearchButton variant="ghost" />
      </div>
    </div>
  );
}
