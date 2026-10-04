"use client";

import * as React from "react";
import type { ChatMessage } from "@playora/game-types";
import { Avatar, Button, Input, cn } from "@playora/ui";
import { MessageSquare, SendHorizontal } from "lucide-react";
import { ReactionPicker } from "../reactions/reaction-overlay";

interface RoomChatProps {
  messages: ChatMessage[];
  currentUserId?: string;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  /**
   * `card` is a self-contained panel (its own border and background), for a
   * page column. `bare` has neither, for inside a drawer or a column that
   * already draws them.
   */
  variant?: "card" | "bare";
  /** Hides the title row, when the surrounding drawer or column already has one. */
  hideHeader?: boolean;
  className?: string;
}

const MAX_LENGTH = 500;

/**
 * The room's chat: reactions along the top, messages, and the composer.
 *
 * It fills whatever height its parent gives it and scrolls the message list
 * inside, so the same panel works as a desktop column and inside a drawer.
 * New messages are announced politely to screen readers through the log
 * role, and the list follows them down unless the reader has scrolled up to
 * read something older.
 */
export function RoomChat({
  messages,
  currentUserId,
  onSendMessage,
  onSendReaction,
  variant = "card",
  hideHeader = false,
  className,
}: RoomChatProps) {
  const [inputValue, setInputValue] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  /** Whether the reader is at (or near) the bottom, so new messages may scroll them. */
  const pinnedRef = React.useRef(true);

  React.useEffect(() => {
    const list = listRef.current;
    if (list && pinnedRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    pinnedRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    onSendMessage(text);
    setInputValue("");
    pinnedRef.current = true;
  };

  return (
    <section
      aria-label="Room chat"
      className={cn(
        "flex min-h-0 flex-col",
        variant === "card" && "overflow-hidden rounded-xl border border-border bg-card shadow-card",
        className,
      )}
    >
      {!hideHeader && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-4 w-4 text-primary-accent" aria-hidden />
          <h2 className="font-display text-sm font-bold text-foreground">Chat</h2>
        </div>
      )}

      <div className="border-b border-border px-3 py-2">
        <ReactionPicker onSelectReaction={onSendReaction} />
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        // Focusable so a keyboard user can scroll the history.
        tabIndex={0}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquare className="h-6 w-6 opacity-40" aria-hidden />
            <p className="text-sm">No messages yet. Say hello.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatLine key={msg.id} message={msg} isMe={msg.senderId === currentUserId} />
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-2">
        <label htmlFor="room-chat-input" className="sr-only">
          Message
        </label>
        <Input
          id="room-chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Send a message"
          autoComplete="off"
          maxLength={MAX_LENGTH}
          className="h-10"
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!inputValue.trim()}>
          <SendHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </section>
  );
}

function ChatLine({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (message.isSystem || message.senderId === "system") {
    return (
      <p className="text-center">
        <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {message.message}
        </span>
      </p>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", isMe && "flex-row-reverse")}>
      {!isMe && (
        <Avatar
          size="xs"
          src={message.senderAvatarUrl}
          fallbackText={message.senderName}
          alt=""
          aria-hidden
          className="mb-0.5"
        />
      )}
      <div className={cn("flex min-w-0 max-w-[85%] flex-col", isMe ? "items-end" : "items-start")}>
        <p className="mb-0.5 flex items-baseline gap-1.5 text-xs text-muted-foreground">
          <span className="truncate font-semibold">{isMe ? "You" : message.senderName}</span>
          <time className="numeric shrink-0" dateTime={new Date(message.timestamp).toISOString()}>
            {time}
          </time>
        </p>
        <p
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5",
            isMe
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
          )}
        >
          {message.message}
        </p>
      </div>
    </div>
  );
}
