"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, CheckCheck, Flame, Sparkles, Swords, Trash2, Trophy, UserPlus, X } from "lucide-react";
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  focusRingClass,
} from "@playora/ui";
import { useNotifications, type NotificationItem } from "../../hooks/use-notifications";
import { CountDot } from "./count-dot";

/** One icon and tint per kind, from tokens, so both themes read. */
const KIND: Record<NotificationItem["type"], { icon: LucideIcon; className: string }> = {
  invite: { icon: Swords, className: "bg-primary/15 text-primary-accent" },
  achievement: { icon: Trophy, className: "bg-reward/15 text-reward" },
  friend: { icon: UserPlus, className: "bg-accent/15 text-accent" },
  match: { icon: Flame, className: "bg-streak/15 text-streak" },
  system: { icon: Sparkles, className: "bg-muted text-muted-foreground" },
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * "just now", "5 minutes ago", "yesterday", from `createdAt`, worked out each
 * time the list renders rather than stored, so it never freezes at "Just
 * now". Nothing for an item without a usable time.
 */
function timeAgo(createdAt: number): string | null {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
  const seconds = Math.round((createdAt - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}

/**
 * Notifications from the header. Restyled onto Popover (portalled, Escape
 * and outside-click handled, focus returned) and tokens; the rows used to be
 * clickable <div>s, which a keyboard could not reach, with a dismiss button
 * that only appeared on mouse hover.
 */
export function NotificationPopover() {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } =
    useNotifications();

  const shown = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0" aria-label={label}>
              <Bell className="h-5 w-5" aria-hidden />
              <CountDot count={unreadCount} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 className="font-display text-base font-bold text-foreground">Notifications</h2>
          <div className="ml-auto flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4" aria-hidden />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={clearAll} aria-label="Clear all notifications">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="px-4 pb-3">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as "all" | "unread")}
            className="w-full"
            aria-label="Show"
          >
            <ToggleGroupItem value="all" size="sm">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="unread" size="sm">
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {filter === "unread" ? "You are all caught up" : "No notifications yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Match results, achievements and invites show up here.
            </p>
          </div>
        ) : (
          <ScrollArea className="border-t border-border" viewportClassName="max-h-80 [&>div]:!block">
            <ul className="divide-y divide-border">
              {shown.map((item) => {
                const kind = KIND[item.type] ?? KIND.system;
                const Icon = kind.icon;
                const when = timeAgo(item.createdAt);
                const body = (
                  <>
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", kind.className)}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
                        {!item.read && (
                          <span className="h-2 w-2 shrink-0 self-center rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {when}
                        {item.actionUrl && (
                          <span className="font-semibold text-primary-accent">
                            {when && "· "}
                            {item.actionLabel || "View"}
                          </span>
                        )}
                      </span>
                    </span>
                  </>
                );
                const rowClass = cn(
                  "flex w-full items-start gap-3 py-3 pl-4 pr-12 text-left transition-colors duration-hover ease-out-expo",
                  "hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  !item.read && "bg-primary/[0.06]",
                );
                return (
                  <li key={item.id} className="relative">
                    {item.actionUrl ? (
                      <Link
                        href={item.actionUrl}
                        className={rowClass}
                        onClick={() => {
                          markAsRead(item.id);
                          setOpen(false);
                        }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" className={rowClass} onClick={() => markAsRead(item.id)}>
                        {body}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(item.id)}
                      aria-label={`Dismiss "${item.title}"`}
                      className={cn(
                        "absolute right-2 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
                        "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.08] hover:text-foreground",
                        focusRingClass,
                      )}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
