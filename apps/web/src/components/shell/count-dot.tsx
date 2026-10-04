import { cn } from "@playora/ui";

/**
 * The unread/waiting count on a header icon button. Decorative: the button's
 * aria-label carries the number, so this is hidden from screen readers.
 * Nothing renders at zero.
 */
export function CountDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "numeric absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1",
        "text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
