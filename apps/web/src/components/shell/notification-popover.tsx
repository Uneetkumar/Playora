"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Trophy,
  Swords,
  UserPlus,
  Sparkles,
  X,
  ChevronRight,
  Flame,
  Trash2,
} from "lucide-react";
import { Badge, cn } from "@playora/ui";
import { useNotifications, type NotificationItem } from "../../hooks/use-notifications";

export function NotificationPopover() {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

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

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "invite":
        return <Swords className="h-4 w-4 text-[#A855F7]" />;
      case "achievement":
        return <Trophy className="h-4 w-4 text-yellow-400" />;
      case "friend":
        return <UserPlus className="h-4 w-4 text-blue-400" />;
      case "match":
        return <Flame className="h-4 w-4 text-orange-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-emerald-400" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full transition-all",
          open
            ? "bg-[#7C3AED]/20 text-[#A855F7] shadow-inner"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[9px] font-black text-white shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-84 sm:w-96 rounded-2xl border border-white/15 bg-[#0F111E]/95 p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 ? (
                <Badge variant="default" className="text-[10px] bg-[#7C3AED] text-white">
                  {unreadCount} new
                </Badge>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold">All caught up</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white/50 hover:text-[#A855F7] transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1 text-white/40 hover:text-rose-400 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 py-2.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                filter === "all"
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                filter === "unread"
                  ? "bg-[#7C3AED]/30 text-[#A855F7] border border-[#7C3AED]/40"
                  : "text-white/50 hover:text-white"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-white/40">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  Real match results, achievements & invites will appear here.
                </p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl p-3 border transition-all cursor-pointer",
                    item.read
                      ? "border-white/5 bg-white/2 hover:bg-white/5 text-white/70"
                      : "border-[#7C3AED]/30 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/15 text-white shadow-sm"
                  )}
                >
                  {/* Icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                    {getIcon(item.type)}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold truncate leading-tight text-white">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-white/40 shrink-0">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {item.actionUrl && (
                      <Link
                        href={item.actionUrl}
                        onClick={() => {
                          markAsRead(item.id);
                          setOpen(false);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#A855F7] hover:text-[#C084FC]"
                      >
                        <span>{item.actionLabel || "View"}</span>
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white transition-opacity"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
