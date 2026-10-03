"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Button, Card, Input, LoadingState, buttonVariants, cn } from "@playora/ui";
import { UserPlus, Users, UserCheck, Clock, X, Check, Search, Swords } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useAudioStore } from "../../lib/store/audio-store";
import { useFriends, type FriendProfile, type FriendRequest } from "../../hooks/use-friends";

type TabId = "friends" | "incoming" | "outgoing";

export default function FriendsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const {
    friends, incoming, outgoing, isLoading, error, sendRequest, respond, remove,
  } = useFriends(user?.id);
  const play = useAudioStore((s) => s.play);

  const [tab, setTab] = React.useState<TabId>("friends");
  const [filter, setFilter] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSent(false);
    const message = await sendRequest(handle);
    setBusy(false);
    setFormError(message);
    if (!message) {
      setHandle("");
      setSent(true);
      play("ui.notify");
    } else {
      play("ui.error");
    }
  };

  const shown = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(filter.toLowerCase()) ||
      f.username.toLowerCase().includes(filter.toLowerCase()),
  );

  const TABS: Array<{ id: TabId; label: string; icon: typeof Users; count: number }> = [
    { id: "friends", label: "Friends", icon: Users, count: friends.length },
    { id: "incoming", label: "Requests", icon: UserCheck, count: incoming.length },
    { id: "outgoing", label: "Sent", icon: Clock, count: outgoing.length },
  ];

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Friends
        </h1>
        <p className="mt-1 text-muted-foreground">
          Add people by username, then play them directly from here.
        </p>
      </header>

      <Card className="border-border bg-card p-5">
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="add-friend" className="sr-only">
            Username to add
          </label>
          <Input
            id="add-friend"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setFormError(null);
              setSent(false);
            }}
            placeholder="Their username"
            autoComplete="off"
            className="flex-1"
          />
          <Button type="submit" className="gap-2" disabled={busy || !handle.trim() || !user}>
            <UserPlus className="h-4 w-4" aria-hidden />
            {busy ? "Sending…" : "Send request"}
          </Button>
        </form>

        <div aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs">
          {formError && <span className="text-destructive">{formError}</span>}
          {sent && <span className="text-success">Request sent.</span>}
          {!formError && !sent && !user && (
            <span className="text-muted-foreground">Sign in to add friends.</span>
          )}
        </div>
      </Card>

      <div role="tablist" aria-label="Friends" className="mt-6 inline-flex rounded-lg border border-border p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-primary/15 text-primary-accent"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden />
            {t.label}
            {t.count > 0 && <span className="numeric font-bold text-xs">({t.count})</span>}
          </button>
        ))}
      </div>

      {authLoading || isLoading ? (
        <div className="mt-6">
          <LoadingState title="Loading your friends" />
        </div>
      ) : error ? (
        <Empty title="Could not load your friends" body={error} />
      ) : tab === "friends" ? (
        <>
          {friends.length > 3 && (
            <div className="relative mt-4">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter friends"
                className="pl-9"
                aria-label="Filter friends"
              />
            </div>
          )}

          {shown.length === 0 ? (
            <Empty
              title={friends.length === 0 ? "No friends yet" : "Nobody matches that"}
              body={
                friends.length === 0
                  ? "Send a request above. You will need their exact username — Playora has no people search yet, on purpose."
                  : "Try a different name."
              }
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {shown.map((friend) => (
                <li key={friend.userId}>
                  <FriendRow friend={friend} onRemove={() => remove(friend.userId)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : tab === "incoming" ? (
        incoming.length === 0 ? (
          <Empty title="No requests" body="Nobody is waiting on you." />
        ) : (
          <ul className="mt-4 space-y-2">
            {incoming.map((request) => (
              <li key={request.friendshipId}>
                <RequestRow
                  request={request}
                  onAccept={async () => {
                    await respond(request.friendshipId, true);
                    play("ui.notify");
                  }}
                  onDecline={async () => {
                    await respond(request.friendshipId, false);
                    play("ui.back");
                  }}
                />
              </li>
            ))}
          </ul>
        )
      ) : outgoing.length === 0 ? (
        <Empty title="Nothing sent" body="Requests you send will wait here until they answer." />
      ) : (
        <ul className="mt-4 space-y-2">
          {outgoing.map((request) => (
            <li key={request.friendshipId}>
              <RequestRow
                request={request}
                pending
                onDecline={async () => {
                  await respond(request.friendshipId, false);
                  play("ui.back");
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Online presence and invite notifications are not built yet — a friend&rsquo;s status is not
        shown because nothing tracks it, rather than because they are offline.
      </p>
    </div>
  );
}

function Avatar({ profile }: { profile: FriendProfile }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary-accent"
      aria-hidden
    >
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function FriendRow({ friend, onRemove }: { friend: FriendProfile; onRemove: () => void }) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Avatar profile={friend} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile?user=${friend.username}`}
          className="block truncate text-sm font-semibold text-foreground hover:underline"
        >
          {friend.displayName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          @{friend.username} · Level <span className="numeric font-bold">{friend.level}</span>
        </p>
      </div>

      <Link
        href="/rooms"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Swords className="h-3.5 w-3.5" aria-hidden />
        Play
      </Link>

      {confirming ? (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="destructive" onClick={onRemove}>
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${friend.displayName}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

function RequestRow({
  request,
  onAccept,
  onDecline,
  pending = false,
}: {
  request: FriendRequest;
  onAccept?: () => void;
  onDecline: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Avatar profile={request} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{request.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">@{request.username}</p>
      </div>

      {pending ? (
        <>
          <Badge variant="outline" className="text-[10px]">
            Waiting
          </Badge>
          <Button size="sm" variant="ghost" onClick={onDecline}>
            Withdraw
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-1">
          <Button size="sm" className="gap-1.5" onClick={onAccept}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={onDecline} aria-label="Decline">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="font-display text-lg font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
