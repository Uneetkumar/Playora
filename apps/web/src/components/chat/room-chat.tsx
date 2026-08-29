"use client";

import * as React from "react";
import type { ChatMessage } from "@playden/game-types";
import { Button, Input, Card, CardHeader, CardTitle } from "@playden/ui";
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
    <Card className={`flex flex-col bg-slate-900/60 border-slate-800 backdrop-blur-md ${className}`}>
      <CardHeader className="py-3 px-4 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          <CardTitle className="text-sm font-semibold text-slate-200">Room Chat</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => setShowReactions(!showReactions)}
          className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 transition-colors ${
            showReactions ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          <span>Reactions</span>
        </button>
      </CardHeader>

      {/* Floating Reaction Bar when toggled */}
      {showReactions && (
        <div className="px-3 pt-2 pb-1 border-b border-slate-800 bg-slate-950/40 flex justify-center">
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
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1 py-8">
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
                  <span className="bg-slate-800/80 text-slate-400 text-[10px] px-2.5 py-0.5 rounded-full border border-slate-700/50">
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
                  <span className="text-[10px] font-medium text-slate-400">
                    {isMe ? "You" : msg.senderName}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-2xl max-w-[85%] break-words ${
                    isMe
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/60"
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
      <form onSubmit={handleSend} className="p-2 border-t border-slate-800 bg-slate-950/30 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Send a message..."
          className="h-9 text-xs bg-slate-900 border-slate-700 focus-visible:ring-indigo-500"
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
