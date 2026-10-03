"use client";

import * as React from "react";
import type { ChatMessage } from "@playora/game-types";
import { Button, Input, Card, CardHeader, CardTitle } from "@playora/ui";
import { Send, MessageSquare, Sparkles } from "lucide-react";
import { ReactionPicker } from "../reactions/reaction-overlay";

interface RoomChatProps {
  messages: ChatMessage[];
  currentUserId?: string;
  onSendMessage: (message: string) => void;
  onSendReaction: (emoji: string) => void;
  className?: string;
}

export function RoomChat({
  messages,
  currentUserId,
  onSendMessage,
  onSendReaction,
  className = "",
}: RoomChatProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [showReactions, setShowReactions] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  return (
    <Card className={`flex flex-col bg-card/60 border-border backdrop-blur-md ${className}`}>
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4 text-primary-accent" />
          <CardTitle className="text-sm font-semibold text-foreground">Room Chat</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => setShowReactions(!showReactions)}
          className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
            showReactions ? "bg-primary text-white" : "bg-border text-foreground hover:bg-border"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          <span>Reactions</span>
        </button>
      </CardHeader>

      {/* Floating Reaction Bar when toggled */}
      {showReactions && (
        <div className="px-3 pt-2 pb-1 border-b border-border bg-background/40 flex justify-center">
          <ReactionPicker
            onSelectReaction={(emoji) => {
              onSendReaction(emoji);
            }}
          />
        </div>
      )}

      {/* Messages Scroll Container */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[220px] max-h-[360px] text-xs"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-1 py-8">
            <MessageSquare className="h-6 w-6 opacity-30" />
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.isSystem || msg.senderId === "system";

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="bg-border/80 text-muted-foreground text-[10px] px-2.5 py-0.5 rounded-full border border-border/50">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center space-x-1.5 mb-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {isMe ? "You" : msg.senderName}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words ${
                    isMe
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-border text-foreground rounded-tl-sm border border-border/60"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-2 border-t border-border bg-background/30 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Send a message..."
          className="h-9 text-xs bg-card border-border focus-visible:ring-primary"
          maxLength={500}
        />
        <Button type="submit" size="sm" className="h-9 px-3 shrink-0">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </Card>
  );
}

function useRef<T>(arg0: null) {
  return React.useRef<T>(arg0);
}
