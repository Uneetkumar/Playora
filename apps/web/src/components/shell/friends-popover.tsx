"use client";

import * as React from "react";
import Link from "next/link";
import { Check, LogIn, Plus, UserPlus, Users, X } from "lucide-react";
import {
  Avatar,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { useFriends } from "../../hooks/use-friends";
import { CountDot } from "./count-dot";

/**
 * Friends at a glance from the header: the list, requests waiting on you,
 * and add-by-username, without leaving the page.
 *
 * It used to pad an empty list with three invented players marked "Online in
 * lobby", each with a Challenge button that opened the chess page. There is
 * no presence data behind any of that, so the list now shows only real
 * friends, and the action is the one that works: make a room and send them
 * the code.
 */
export function FriendsPopover() {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("friends");
  const [username, setUsername] = React.useState("");
  const [status, setStatus] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = React.useState(false);

  const user = useAuthStore((s) => s.user);
  const { friends, incoming, respond, sendRequest } = useFriends(user?.id);
  const close = () => setOpen(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSending(true);
    setStatus(null);
    const err = await sendRequest(username.trim());
    setSending(false);
    if (err) {
      setStatus({ ok: false, text: err });
    } else {
      setStatus({ ok: true, text: "Request sent." });
      setUsername("");
    }
  };

  const label =
    incoming.length > 0
      ? `Friends, ${incoming.length} ${incoming.length === 1 ? "request" : "requests"} waiting`
      : "Friends";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0" aria-label={label}>
              <Users className="h-5 w-5" aria-hidden />
              <CountDot count={incoming.length} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Friends</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="font-display text-base font-bold text-foreground">Friends</h2>
          <Button asChild variant="link" size="sm" className="h-auto px-0">
            <Link href="/friends" onClick={close}>
              See all
            </Link>
          </Button>
        </div>

        {!user ? (
          <div className="px-4 pb-5 pt-2 text-center">
            <p className="text-sm text-muted-foreground">Sign in to add friends and see their requests.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/login" onClick={close}>
                <LogIn className="h-4 w-4" aria-hidden />
                Sign in
              </Link>
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="px-4 pb-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="requests">
                Requests
                {incoming.length > 0 && (
                  <span className="numeric rounded-full bg-primary px-1.5 text-[11px] font-bold leading-4 text-primary-foreground">
                    {incoming.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="add">Add</TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="mt-3">
              {friends.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-5 w-5" aria-hidden />}
                  title="No friends yet"
                  text="Add someone by their username to see them here."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setTab("add")}>
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Add a friend
                    </Button>
                  }
                />
              ) : (
                <ScrollArea className="-mx-1" viewportClassName="max-h-72 [&>div]:!block">
                  <ul className="space-y-1 px-1">
                    {friends.map((f) => (
                      <li key={f.userId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-foreground/[0.04]">
                        <Avatar src={f.avatarUrl} alt="" fallbackText={f.displayName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{f.displayName}</span>
                          <span className="numeric block text-xs text-muted-foreground">Level {f.level}</span>
                        </span>
                        <Button asChild size="sm" variant="secondary" className="shrink-0">
                          <Link
                            href="/rooms?create=1"
                            onClick={close}
                            aria-label={`Create a room to play with ${f.displayName}`}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            Invite
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="requests" className="mt-3">
              {incoming.length === 0 ? (
                <EmptyState
                  icon={<UserPlus className="h-5 w-5" aria-hidden />}
                  title="No requests"
                  text="When someone adds you, it waits here for your answer."
                />
              ) : (
                <ul className="space-y-1">
                  {incoming.map((r) => (
                    <li key={r.friendshipId} className="flex items-center gap-3 rounded-lg p-2">
                      <Avatar src={r.avatarUrl} alt="" fallbackText={r.displayName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{r.displayName}</span>
                        <span className="numeric block text-xs text-muted-foreground">Level {r.level}</span>
                      </span>
                      <Button
                        size="icon-sm"
                        onClick={() => void respond(r.friendshipId, true)}
                        aria-label={`Accept ${r.displayName}`}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => void respond(r.friendshipId, false)}
                        aria-label={`Decline ${r.displayName}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="add" className="mt-3">
              <form onSubmit={send} className="space-y-3">
                <label htmlFor="friends-add-username" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <Input
                  id="friends-add-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (status) setStatus(null);
                  }}
                  placeholder="e.g. sophia_chess"
                  autoComplete="off"
                  spellCheck={false}
                />
                {status && (
                  <p
                    role="status"
                    className={status.ok ? "text-sm text-success-ink" : "text-sm text-destructive-ink"}
                  >
                    {status.text}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={!username.trim() || sending}>
                  <UserPlus className="h-4 w-4" aria-hidden />
                  {sending ? "Sending…" : "Send request"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
