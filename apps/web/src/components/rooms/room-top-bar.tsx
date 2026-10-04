"use client";

import * as React from "react";
import { Button, cn } from "@playora/ui";
import { ArrowLeft, Loader2, Wifi, WifiOff } from "lucide-react";

export type RoomConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

/**
 * The bar across the top of a room, lobby and match alike: the way out on
 * the left, what this room is in the middle, connection and chat on the
 * right. Rooms are immersive routes, so this is the only chrome they have.
 */
export function RoomTopBar({
  onLeave,
  leaveLabel = "Leave",
  title,
  connection,
  children,
  className,
}: {
  onLeave: () => void;
  leaveLabel?: string;
  /** What this room is: the game, the code, the state of the match. */
  title?: React.ReactNode;
  connection: RoomConnectionStatus;
  /** Right-hand actions after the connection pill (chat, spectators). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative z-sticky flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-2 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4",
        className,
      )}
    >
      {/* 40px tall on a phone, the touch minimum; the bar has room for it. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onLeave}
        className="h-10 gap-1.5 text-muted-foreground hover:text-foreground sm:h-8"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span>{leaveLabel}</span>
      </Button>
      <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1 truncate">{title}</div>
      <ConnectionPill status={connection} />
      {children}
    </div>
  );
}

const CONNECTION_COPY: Record<RoomConnectionStatus, string> = {
  connected: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

/** Connection state in words and an icon, never colour alone. A live region, so a drop is announced. */
export function ConnectionPill({ status, className }: { status: RoomConnectionStatus; className?: string }) {
  const label = CONNECTION_COPY[status];
  return (
    <span
      role="status"
      aria-label={`Connection: ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "connected" && "bg-success/15 text-success-ink",
        (status === "connecting" || status === "reconnecting") && "bg-warning/15 text-warning-ink",
        status === "disconnected" && "bg-destructive/15 text-destructive-ink",
        className,
      )}
    >
      {status === "connected" ? (
        <Wifi className="h-3.5 w-3.5" aria-hidden />
      ) : status === "disconnected" ? (
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
