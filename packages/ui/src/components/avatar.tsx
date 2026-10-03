"use client";

import * as React from "react";
import { cn } from "../lib/utils.js";

export type AvatarStatus = "online" | "in-game" | "away" | "offline";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  /** A name or handle; the avatar shows its initials when there is no image. */
  fallbackText?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Presence dot in the bottom-right corner. Omit for no dot. */
  status?: AvatarStatus;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
} as const;

const statusClasses: Record<AvatarStatus, string> = {
  online: "bg-success",
  "in-game": "bg-primary",
  away: "bg-warning",
  offline: "bg-subtle-foreground",
};

const statusLabels: Record<AvatarStatus, string> = {
  online: "Online",
  "in-game": "In a game",
  away: "Away",
  offline: "Offline",
};

/** "Ada Lovelace" → "AL", "ada" → "AD", "" → "?". */
export function getInitials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt = "Avatar", fallbackText = "U", size = "md", status, className, ...props }, ref) => {
    // Keyed to the URL rather than a plain flag: a flag that latched on one
    // broken image would keep hiding every later, working one.
    const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
    const showImage = Boolean(src) && failedSrc !== src;

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-foreground ring-2 ring-border",
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        <span className="absolute inset-0 overflow-hidden rounded-full">
          {showImage && src ? (
            <img
              src={src}
              alt={alt}
              onError={() => setFailedSrc(src)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center" aria-label={alt} role="img">
              <span aria-hidden>{getInitials(fallbackText)}</span>
            </span>
          )}
        </span>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block h-[30%] min-h-2 w-[30%] min-w-2 rounded-full ring-2 ring-background",
              statusClasses[status],
            )}
            role="img"
            aria-label={statusLabels[status]}
          />
        )}
      </div>
    );
  },
);
Avatar.displayName = "Avatar";

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatars beyond this many collapse into a "+N" chip. */
  max?: number;
  size?: AvatarProps["size"];
}

/**
 * Overlapping row of avatars, e.g. the players in a room. Children should be
 * Avatars; each is ringed in the page colour so the overlap reads as a stack.
 */
export function AvatarGroup({ children, max = 4, size = "sm", className, ...props }: AvatarGroupProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;

  return (
    <div className={cn("flex items-center -space-x-2", className)} {...props}>
      {shown.map((child) =>
        React.cloneElement(child as React.ReactElement<AvatarProps>, {
          size,
          className: cn("ring-background", (child.props as AvatarProps).className),
        }),
      )}
      {extra > 0 && (
        <span
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-muted-foreground ring-2 ring-background",
            sizeClasses[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
