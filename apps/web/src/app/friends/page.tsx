"use client";

import * as React from "react";
import Link from "next/link";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from "@playora/ui";
import {
  Check,
  Clock,
  Info,
  LogIn,
  Search,
  Swords,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { useAudioStore } from "../../lib/store/audio-store";
import { useFriends, type FriendProfile, type FriendRequest } from "../../hooks/use-friends";
import { PageContainer, PageHeader } from "../../components/page/page-header";
import { EmptyState } from "../../components/page/empty-state";

type TabId = "friends" | "incoming" | "outgoing";

export default function FriendsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { friends, incoming, outgoing, isLoading, error, sendRequest, respond, remove } =
    useFriends(user?.id);
  const play = useAudioStore((s) => s.play);

  const [tab, setTab] = React.useState<TabId>("friends");
  const [filter, setFilter] = React.useState("");

  const loading = authLoading || isLoading;
  const query = filter.trim().toLowerCase();
  const shown = friends.filter(
    (f) => f.displayName.toLowerCase().includes(query) || f.username.toLowerCase().includes(query)
  );

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        icon={<Users />}
        title="Friends"
        description="Add people by their exact username, then invite them to a room."
        action={
          <Button asChild>
            <Link href="/rooms">
              <Swords className="h-4 w-4" aria-hidden />
              Play with friends
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4">
          {!authLoading && !user ? (
            <EmptyState
              icon={<Users />}
              title="Sign in to keep a friends list"
              body="Friends are tied to your account. Playing as a guest is enough; you can link Google later."
              action={
                <Button asChild>
                  <Link href="/login?next=/friends">
                    <LogIn className="h-4 w-4" aria-hidden />
                    Sign in or play as guest
                  </Link>
                </Button>
              }
            />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList aria-label="Friends and requests" className="w-full sm:w-auto">
                  <TabsTrigger value="friends" className="flex-1 sm:flex-none">
                    <Users aria-hidden />
                    Friends
                    <Count n={friends.length} />
                  </TabsTrigger>
                  <TabsTrigger value="incoming" className="flex-1 sm:flex-none">
                    <UserCheck aria-hidden />
                    Requests
                    <Count n={incoming.length} highlight />
                  </TabsTrigger>
                  <TabsTrigger value="outgoing" className="flex-1 sm:flex-none">
                    <Clock aria-hidden />
                    Sent
                    <Count n={outgoing.length} />
                  </TabsTrigger>
                </TabsList>

                {tab === "friends" && friends.length > 3 && (
                  <div className="relative sm:w-64">
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
              </div>

              {loading ? (
                <ListSkeleton />
              ) : error ? (
                <EmptyState
                  className="mt-4"
                  icon={<Info />}
                  title="Could not load your friends"
                  body={error}
                />
              ) : (
                <>
                  <TabsContent value="friends">
                    {shown.length === 0 ? (
                      friends.length === 0 ? (
                        <EmptyState
                          icon={<UserPlus />}
                          title="No friends yet"
                          body="Send a request with their exact username. Playora has no people search, on purpose."
                          action={
                            <Button onClick={() => document.getElementById("add-friend")?.focus()}>
                              <UserPlus className="h-4 w-4" aria-hidden />
                              Add a friend
                            </Button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={<Search />}
                          title="Nobody matches that"
                          body="Try another name or handle."
                          action={
                            <Button variant="secondary" onClick={() => setFilter("")}>
                              Clear filter
                            </Button>
                          }
                        />
                      )
                    ) : (
                      <ul className="space-y-2">
                        {shown.map((friend) => (
                          <li key={friend.userId}>
                            <FriendRow friend={friend} onRemove={() => remove(friend.userId)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="incoming">
                    {incoming.length === 0 ? (
                      <EmptyState
                        icon={<UserCheck />}
                        title="No requests"
                        body="Nobody is waiting on you. Requests people send you appear here."
                      />
                    ) : (
                      <ul className="space-y-2">
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
                    )}
                  </TabsContent>

                  <TabsContent value="outgoing">
                    {outgoing.length === 0 ? (
                      <EmptyState
                        icon={<Clock />}
                        title="Nothing sent"
                        body="Requests you send wait here until they answer."
                      />
                    ) : (
                      <ul className="space-y-2">
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
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </div>

        <aside className="space-y-4">
          <AddFriendCard
            disabled={!user}
            onSend={async (handle) => {
              const message = await sendRequest(handle);
              play(message ? "ui.error" : "ui.notify");
              if (!message) setTab("outgoing");
              return message;
            }}
          />
          <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Online status is not shown because nothing tracks it yet, not because your friends are
              offline.
            </span>
          </p>
        </aside>
      </div>
    </PageContainer>
  );
}

function Count({ n, highlight = false }: { n: number; highlight?: boolean }) {
  if (n === 0) return null;
  return (
    <span
      className={
        highlight
          ? "font-mono-num rounded-full bg-primary px-1.5 text-[11px] font-bold leading-4 text-primary-foreground"
          : "font-mono-num rounded-full bg-foreground/10 px-1.5 text-[11px] font-bold leading-4"
      }
    >
      {n}
    </span>
  );
}

function AddFriendCard({
  disabled,
  onSend,
}: {
  disabled: boolean;
  /** Resolves to an error message, or null when the request went out. */
  onSend: (handle: string) => Promise<string | null>;
}) {
  const [handle, setHandle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSent(false);
    const message = await onSend(handle);
    setBusy(false);
    setError(message);
    if (!message) {
      setHandle("");
      setSent(true);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <UserPlus className="h-4 w-4 text-primary-accent" aria-hidden />
        Add a friend
      </h2>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <label htmlFor="add-friend" className="sr-only">
          Their username
        </label>
        <Input
          id="add-friend"
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setError(null);
            setSent(false);
          }}
          placeholder="Their username"
          autoComplete="off"
          disabled={disabled}
        />
        <Button type="submit" className="w-full" disabled={disabled || busy || !handle.trim()}>
          {busy ? "Sending…" : "Send request"}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs">
        {error && <span className="text-destructive-ink">{error}</span>}
        {sent && <span className="text-success-ink">Request sent.</span>}
        {!error && !sent && disabled && (
          <span className="text-muted-foreground">Sign in to add friends.</span>
        )}
      </p>
    </Card>
  );
}

function Person({ profile, sub }: { profile: FriendProfile; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar src={profile.avatarUrl} alt="" aria-hidden fallbackText={profile.displayName} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="truncate">{profile.displayName}</span>
          {profile.isGuest && (
            <Badge variant="secondary" className="px-2 text-[10px]">
              Guest
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          @{profile.username}
          {sub}
        </p>
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  onRemove,
}: {
  friend: FriendProfile;
  /** Resolves to an error message, or null once they are gone. */
  onRemove: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <Person
        profile={friend}
        sub={
          <>
            {" · "}Level <span className="font-mono-num font-bold">{friend.level}</span>
          </>
        }
      />
      <Button asChild variant="secondary" size="sm">
        <Link href="/rooms">
          <Swords className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Invite to a room</span>
          <span className="sm:hidden">Invite</span>
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${friend.displayName}`}
            aria-haspopup="dialog"
            onClick={() => setConfirming(true)}
          >
            <X aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove friend</TooltipContent>
      </Tooltip>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        icon={<UserMinus />}
        title={`Remove ${friend.displayName}?`}
        description="They are not told. You can send a new request later."
        confirmLabel="Remove"
        onConfirm={async () => {
          const message = await onRemove();
          if (message) toast.error(message);
        }}
      />
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
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <Person profile={request} />
      {pending ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline">Waiting</Badge>
          <Button size="sm" variant="ghost" onClick={onDecline}>
            Withdraw
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={onAccept}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={onDecline}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-4 space-y-2">
      <span className="sr-only">Loading your friends</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
