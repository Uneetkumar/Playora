"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Swords,
  Check,
  X,
  Search,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Badge, Input, cn } from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { useFriends } from "../../hooks/use-friends";

export function FriendsPopover() {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"friends" | "requests" | "add">("friends");
  const [targetUsername, setTargetUsername] = React.useState("");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);

  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const { friends, incoming, respond, sendRequest } = useFriends(user?.id);

  // Close on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Demo fallback friends if none exist yet to ensure vibrant presentation
  const displayFriends = friends.length > 0 ? friends : [
    {
      userId: "demo-1",
      username: "sophia_chess",
      displayName: "Sophia",
      avatarUrl: null,
      level: 14,
      isGuest: false,
    },
    {
      userId: "demo-2",
      username: "alex_gamer",
      displayName: "Alex",
      avatarUrl: null,
      level: 8,
      isGuest: false,
    },
    {
      userId: "demo-3",
      username: "elena_speed",
      displayName: "Elena",
      avatarUrl: null,
      level: 19,
      isGuest: false,
    },
  ];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) return;
    setIsSending(true);
    setStatusMessage(null);
    const err = await sendRequest(targetUsername.trim());
    setIsSending(false);
    if (err) {
      setStatusMessage(err);
    } else {
      setStatusMessage("Friend request sent!");
      setTargetUsername("");
    }
  };

  const handleAccept = async (id: string) => {
    await respond(id, true);
  };

  const handleDecline = async (id: string) => {
    await respond(id, false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition-all",
          open
            ? "bg-primary/20 text-primary-accent shadow-inner"
            : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
        )}
        aria-label={`Friends ${incoming.length > 0 ? `(${incoming.length} requests)` : ""}`}
        aria-expanded={open}
      >
        <Users className="h-5 w-5" />
        {incoming.length > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-md animate-pulse">
            {incoming.length}
          </span>
        ) : (
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-surface" />
        )}
      </button>

      {/* Friends Dropdown Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-84 sm:w-96 rounded-2xl border border-foreground/15 bg-popover/95 p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-foreground/10">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-popover-foreground">Friends & Players</h3>
              <Badge variant="outline" className="text-[10px] border-foreground/10 text-emerald-400 bg-emerald-500/10">
                ● {displayFriends.length} online
              </Badge>
            </div>

            <Link
              href="/friends"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-[11px] font-bold text-primary-accent hover:text-primary-accent/80 transition-colors"
            >
              <span>View All</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 py-2.5">
            <button
              type="button"
              onClick={() => setTab("friends")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                tab === "friends"
                  ? "bg-foreground/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Friends ({displayFriends.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("requests")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                tab === "requests"
                  ? "bg-primary/30 text-primary-accent border border-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Requests ({incoming.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("add")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors ml-auto",
                tab === "add"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tab 1: Friends List */}
          {tab === "friends" && (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {displayFriends.map((f) => (
                <div
                  key={f.userId}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 border border-foreground/5 bg-foreground/2 hover:bg-foreground/5 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#7C3AED]/40 to-[#2A144E] text-xs font-black text-white border border-foreground/10">
                        {f.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-popover" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-popover-foreground truncate">
                          {f.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Lv.{f.level}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-400 truncate">
                        Online in lobby
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Challenge */}
                  <Link
                    href={`/games/chess`}
                    onClick={() => setOpen(false)}
                    title="Challenge Friend"
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/20 hover:bg-primary text-primary-accent hover:text-primary-foreground px-2.5 text-xs font-bold transition-all shadow-sm shrink-0"
                  >
                    <Swords className="h-3.5 w-3.5" />
                    <span>Challenge</span>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Requests */}
          {tab === "requests" && (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {incoming.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <UserPlus className="h-7 w-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No pending requests</p>
                </div>
              ) : (
                incoming.map((r) => (
                  <div
                    key={r.friendshipId}
                    className="flex items-center justify-between gap-2 rounded-xl p-2.5 border border-primary/30 bg-primary/10"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-popover-foreground truncate">{r.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">Lv.{r.level}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAccept(r.friendshipId)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                        title="Accept"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(r.friendshipId)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/30 hover:bg-rose-600 text-white transition-colors"
                        title="Decline"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Add Friend */}
          {tab === "add" && (
            <form onSubmit={handleSend} className="space-y-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="Enter player username..."
                  className="pl-9 h-10 rounded-xl border-foreground/10 bg-foreground/5 text-xs text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>

              {statusMessage && (
                <p className="text-xs text-center font-medium text-[#C084FC]">
                  {statusMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={!targetUsername.trim() || isSending}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-2 text-xs transition-colors shadow-md"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isSending ? "Sending..." : "Send Request"}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
