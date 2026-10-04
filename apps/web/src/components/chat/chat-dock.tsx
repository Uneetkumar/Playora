"use client";

import * as React from "react";
import type { ChatMessage } from "@playora/game-types";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  cn,
} from "@playora/ui";
import { MessageSquare } from "lucide-react";
import { countUnread, formatUnread } from "../rooms/lobby-logic";
import { RoomChat } from "./room-chat";

/**
 * Where the room chat lives: a full-height column from `lg` up, a drawer the
 * thumb pulls down below it, opened from a button that counts what arrived
 * while it was shut.
 */

const DESKTOP_QUERY = "(min-width: 1024px)";

/** True from the `lg` breakpoint up. False on the server and the first client render. */
export function useIsDesktop(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Messages from other people since the chat was last on screen. Reading the
 * chat (`visible`) marks everything up to the newest message as seen.
 */
export function useChatUnread(messages: readonly ChatMessage[], visible: boolean, selfId: string): number {
  const [lastSeenId, setLastSeenId] = React.useState<string | null>(null);
  const newestId = messages[messages.length - 1]?.id ?? null;

  React.useEffect(() => {
    if (visible) setLastSeenId(newestId);
  }, [visible, newestId]);

  // Until the first look, everything already in the list counts as seen: a
  // reconnect that replays nothing should not light the badge up either.
  const [baseline] = React.useState(newestId);
  return visible ? 0 : countUnread(messages, lastSeenId ?? baseline, selfId);
}

export interface ChatDockProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
}

/** The desktop column. Hidden below `lg`, where ChatDrawerButton takes over. */
export function ChatColumn({ className, ...chat }: ChatDockProps & { className?: string }) {
  return (
    <aside
      aria-label="Chat"
      className={cn("hidden min-h-0 w-[22rem] shrink-0 flex-col border-l border-border bg-surface lg:flex", className)}
    >
      <RoomChat {...chat} variant="bare" className="flex-1" />
    </aside>
  );
}

/**
 * The phone's way into chat: a button with an unread count that opens the
 * chat in a drawer. Rendered only below `lg`.
 */
export function ChatDrawerButton({
  open,
  onOpenChange,
  unread,
  className,
  ...chat
}: ChatDockProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unread: number;
  className?: string;
}) {
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onOpenChange(true)}
        aria-label={unread > 0 ? `Chat, ${unread} unread` : "Chat"}
        // 40px on a phone, the touch minimum, like the bar's Leave.
        className={cn("relative h-10 sm:h-8 lg:hidden", className)}
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        <span>Chat</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="numeric absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-surface"
          >
            {formatUnread(unread)}
          </span>
        )}
      </Button>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[80dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-display">Chat</DrawerTitle>
            <DrawerDescription className="sr-only">Messages and reactions for this room.</DrawerDescription>
          </DrawerHeader>
          <RoomChat {...chat} variant="bare" hideHeader className="min-h-0 flex-1" />
        </DrawerContent>
      </Drawer>
    </>
  );
}
