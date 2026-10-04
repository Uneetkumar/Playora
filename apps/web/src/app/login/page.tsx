"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { GameId } from "@playora/game-types";
import { Button, Card, Input, Skeleton } from "@playora/ui";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { GoogleMark } from "../../components/auth/google-mark";
import { BrandMark } from "../../components/shell/brand";
import { GAME_META } from "../../lib/games/meta";
import { safeNextPath } from "../../lib/safe-next";

/** The covers on the art panel, two by two. */
const ART: GameId[] = ["car-race", "uno", "chess", "bike-race"];

const PERKS = [
  { icon: Zap, text: "Play in the browser, nothing to install" },
  { icon: Users, text: "Rooms, Quick Match and same Wi-Fi play" },
  { icon: Trophy, text: "A rating per game, and achievements" },
] as const;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only a path on this site: a `next` of "https://…" (or "/\evil.com", which
  // the browser reads as "//evil.com") must not turn sign-in into a redirect
  // to somewhere else.
  const nextPath = safeNextPath(searchParams?.get("next"));
  const callbackError = searchParams?.get("error");

  const { signInWithGoogle, signInAsGuest, isAuthenticated, isLoading, isConfigured, error } =
    useAuthStore();

  const [guestName, setGuestName] = React.useState("");
  const [pending, setPending] = React.useState<"google" | "guest" | null>(null);

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(nextPath);
  }, [isLoading, isAuthenticated, nextPath, router]);

  const handleGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("guest");
    const session = await signInAsGuest(guestName);
    setPending(null);
    if (session) router.push(nextPath);
  };

  const handleGoogle = async () => {
    setPending("google");
    await signInWithGoogle(nextPath);
    // On success the browser navigates to Google, so this only runs on failure.
    setPending(null);
  };

  const message = callbackError ?? error;
  const disabled = !isConfigured || pending !== null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-8 sm:px-6 lg:py-16">
      <Card className="grid w-full max-w-md overflow-hidden rounded-2xl p-0 shadow-overlay lg:max-w-5xl lg:grid-cols-[1.15fr_1fr]">
        <ArtPanel />

        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
              Playora
            </span>
          </div>

          <h1 className="mt-6 font-display text-h1 text-foreground lg:mt-0">Play together</h1>
          <p className="mt-1.5 text-muted-foreground">
            Sign in with Google, or jump straight in as a guest.
          </p>

          <div className="mt-6 space-y-5">
            {!isConfigured && (
              <div
                role="status"
                className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
                <div className="text-foreground">
                  <p className="font-semibold text-warning-ink">Sign-in isn&apos;t set up here</p>
                  <p className="mt-1 text-muted-foreground">
                    Add your Supabase keys to{" "}
                    <code className="rounded bg-muted px-1 font-mono text-xs text-foreground">
                      apps/web/.env.local
                    </code>
                    ; docs/ENVIRONMENT_SETUP.md has the steps. Games against the AI work without it.
                  </p>
                </div>
              </div>
            )}

            {message && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-ink"
              >
                We couldn&apos;t sign you in. {message}
              </div>
            )}

            <Button
              variant="secondary"
              size="lg"
              disabled={disabled}
              className="w-full"
              onClick={() => void handleGoogle()}
            >
              {pending === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <GoogleMark className="h-5 w-5" />
              )}
              {pending === "google" ? "Redirecting…" : "Continue with Google"}
            </Button>

            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="text-tag uppercase text-muted-foreground">Or play instantly</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleGuest} className="space-y-3">
              <div>
                <label htmlFor="guest-name" className="text-sm font-medium text-foreground">
                  Nickname <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. StarWarrior"
                    className="h-11 pl-9"
                    maxLength={20}
                    autoComplete="nickname"
                    disabled={disabled}
                  />
                </div>
              </div>

              <Button type="submit" size="lg" disabled={disabled} className="w-full">
                {pending === "guest" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Setting you up…
                  </>
                ) : (
                  <>
                    Play as guest
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </Button>
            </form>

            <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-success-ink" aria-hidden />
              Link a Google account later and keep everything: ratings, history and level.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * The brand side of the card, from lg up: four covers tilted behind a scrim,
 * the mark, and what an account gets you. Decorative art; the form does not
 * depend on anything here.
 */
function ArtPanel() {
  return (
    <aside className="relative hidden min-h-[36rem] flex-col justify-end overflow-hidden border-r border-border bg-surface p-10 lg:flex">
      <div
        className="absolute -left-10 -right-10 -top-16 grid -rotate-6 grid-cols-2 gap-4 opacity-90"
        aria-hidden
      >
        {ART.map((id) => (
          <div
            key={id}
            className="relative aspect-video overflow-hidden rounded-xl shadow-card ring-1 ring-border"
          >
            <Image
              src={GAME_META[id].covers.landscape}
              alt=""
              fill
              sizes="320px"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {/* Fades the art into the panel so the text below sits on a plain surface in either theme. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-surface via-surface/90 to-surface/10"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-secondary/10"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 rounded-xl [&_svg]:h-7 [&_svg]:w-7" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Playora
          </span>
        </div>
        <p className="mt-5 text-balance font-display text-3xl font-bold leading-tight text-foreground">
          Play. Connect. Compete.
        </p>
        <ul className="mt-6 space-y-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-accent">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4">
          <Skeleton className="h-[30rem] w-full max-w-md rounded-2xl" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
