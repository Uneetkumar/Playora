import Link from "next/link";
import { Button } from "@playora/ui";
import { Gamepad2, Home, Search } from "lucide-react";

/**
 * Branded 404.
 *
 * Without this file Next falls back to its built-in error page, which renders
 * outside the app's stylesheet — so a missing route looked like the whole site
 * had broken rather than one link being wrong.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative">
        <span
          className="font-display text-[7rem] font-black leading-none text-primary/15 sm:text-[10rem]"
          aria-hidden
        >
          404
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <Gamepad2 className="h-16 w-16 text-primary" aria-hidden />
        </span>
      </div>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The link may be out of date, or the page may have moved. Nothing is
        broken — you just took a wrong turn.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" aria-hidden />
            Back to games
          </Button>
        </Link>
        <Link href="/games">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" aria-hidden />
            Browse the catalogue
          </Button>
        </Link>
      </div>
    </div>
  );
}
