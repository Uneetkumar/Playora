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
        return <Swords className="h-4 w-4 text-primary-accent" />;
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
            ? "bg-primary/20 text-primary-accent shadow-inner"
            : "text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
        )}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink px-1 text-[9px] font-black text-white shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-84 sm:w-96 rounded-2xl border border-foreground/15 bg-popover/95 p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-foreground/10">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-popover-foreground">Notifications</h3>
              {unreadCount > 0 ? (
                <Badge variant="default" className="text-[10px] bg-primary text-white">
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
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary-accent transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1 text-muted-foreground hover:text-rose-400 transition-colors"
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
                  ? "bg-foreground/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
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
                  ? "bg-primary/30 text-primary-accent border border-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
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
                      ? "border-foreground/5 bg-foreground/2 hover:bg-foreground/5 text-foreground/70"
                      : "border-primary/30 bg-primary/10 hover:bg-primary/15 text-foreground shadow-sm"
                  )}
                >
                  {/* Icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 border border-foreground/10">
                    {getIcon(item.type)}
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold truncate leading-tight text-popover-foreground">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{item.time}</span>
                    </div>
                    <p className="text-[11px] text-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {item.actionUrl && (
                      <Link
                        href={item.actionUrl}
                        onClick={() => {
                          markAsRead(item.id);
                          setOpen(false);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary-accent hover:text-primary-accent/80"
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
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
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
