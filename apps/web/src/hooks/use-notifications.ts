"use client";

import * as React from "react";
import { useAuthStore } from "../lib/store/auth-store";
import { usePlayerProgression } from "./use-progression";

export interface NotificationItem {
  id: string;
  type: "invite" | "achievement" | "friend" | "match" | "system";
  title: string;
  description: string;
  time: string;
  createdAt: number;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const STORAGE_KEY_PREFIX = "playora_real_notifications_";

export function useNotifications() {
  const { user } = useAuthStore();
  const { data: progression } = usePlayerProgression(user?.id);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${user?.id || "guest"}`;

  // Load real notifications from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationItem[];
        setNotifications(parsed);
      } else {
        // Generate real welcome notification for user
        const initial: NotificationItem[] = [
          {
            id: `sys-welcome-${Date.now()}`,
            type: "system",
            title: "Welcome to Playora!",
            description: "Explore 5 instant games, play vs AI bots or challenge friends on Wi-Fi.",
            time: "Just now",
            createdAt: Date.now(),
            read: false,
            actionUrl: "/games",
            actionLabel: "Explore Games",
          },
        ];
        setNotifications(initial);
        localStorage.setItem(storageKey, JSON.stringify(initial));
      }
    } catch {
      setNotifications([]);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // Sync with real player level / achievements
  React.useEffect(() => {
    if (!progression || !isLoaded) return;

    if (progression.gamesPlayed > 0) {
      setNotifications((prev) => {
        const hasMatchNotif = prev.some((n) => n.id.startsWith("prog-games-"));
        if (hasMatchNotif) return prev;

        const notif: NotificationItem = {
          id: `prog-games-${progression.gamesPlayed}`,
          type: "achievement",
          title: "Match Progress Recorded",
          description: `You have completed ${progression.gamesPlayed} match(es) with a ${Math.round(progression.winRate * 100)}% win rate.`,
          time: "Recent",
          createdAt: Date.now(),
          read: false,
          actionUrl: "/history",
          actionLabel: "View Match History",
        };
        const next = [notif, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    }
  }, [progression, isLoaded, storageKey]);

  const addNotification = React.useCallback(
    (notif: Omit<NotificationItem, "id" | "time" | "createdAt" | "read">) => {
      const item: NotificationItem = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: "Just now",
        createdAt: Date.now(),
        read: false,
      };

      setNotifications((prev) => {
        const next = [item, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const markAsRead = React.useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const markAllAsRead = React.useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const deleteNotification = React.useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const clearAll = React.useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}
