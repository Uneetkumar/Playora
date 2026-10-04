import Link from "next/link";
import { cn } from "@playora/ui";

/**
 * The Playora mark: a cut gem, drawn in `currentColor` so the tile's text
 * colour decides it and both themes come from tokens. It was a white gem on a
 * hard-coded violet gradient with a hard-coded glow, which the light theme
 * could not touch; the 404 page and the footer meanwhile used a gamepad, so
 * the product had two logos.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-accent ring-1 ring-inset ring-primary/30",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-5 w-5">
        <path d="M16 4L28 13L16 28L4 13L16 4Z" fill="currentColor" fillOpacity="0.25" />
        <path d="M16 4L28 13L16 19L4 13L16 4Z" fill="currentColor" fillOpacity="0.9" />
        <path d="M16 19L28 13L16 28Z" fill="currentColor" fillOpacity="0.55" />
        <path d="M16 19L4 13L16 28Z" fill="currentColor" fillOpacity="0.4" />
      </svg>
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-lg font-extrabold tracking-tight text-foreground", className)}>
      Playora
    </span>
  );
}

/** Mark and wordmark, linking home. The header's, the menu sheet's and the footer's. */
export function BrandLink({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Playora home"
      className={cn("flex shrink-0 items-center gap-2 rounded-lg", className)}
    >
      <BrandMark />
      <BrandWordmark />
    </Link>
  );
}
