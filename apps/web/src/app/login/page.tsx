"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@playora/ui";
import { Gamepad2, User, ArrowRight, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useAuthStore } from "../../lib/store/auth-store";
import { GoogleMark } from "../../components/auth/google-mark";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get("next") || "/rooms";
  const callbackError = searchParams?.get("error");

  const {
    initialize,
    signInWithGoogle,
    signInAsGuest,
    isAuthenticated,
    isLoading,
    isConfigured,
    error,
  } = useAuthStore();

  const [guestName, setGuestName] = React.useState("");
  const [pending, setPending] = React.useState<"google" | "guest" | null>(null);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

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

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-border bg-card/90 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/30 mb-4">
            <Gamepad2 className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black text-white">Play together</CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            Sign in with Google, or jump straight in as a guest.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!isConfigured && (
            <div
              role="status"
              className="flex gap-3 rounded-lg border border-amber-800/60 bg-amber-950/40 p-3 text-sm text-amber-200"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
              <div>
                <p className="font-semibold">Sign-in isn&apos;t configured yet</p>
                <p className="mt-1 text-amber-300/80">
                  Add your Supabase keys to{" "}
                  <code className="rounded bg-amber-900/40 px-1">apps/web/.env.local</code>. See
                  docs/ENVIRONMENT_SETUP.md.
                </p>
              </div>
            </div>
          )}

          {message && (
            <div
              role="alert"
              className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200"
            >
              We couldn&apos;t sign you in. {message}
            </div>
          )}

          <Button
            variant="outline"
            disabled={!isConfigured || pending !== null}
            className="w-full justify-center gap-3 h-11 border-border bg-background/80 hover:bg-border"
            onClick={handleGoogle}
          >
            {pending === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <GoogleMark className="h-5 w-5" />
            )}
            <span className="font-semibold">
              {pending === "google" ? "Redirecting…" : "Continue with Google"}
            </span>
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
              Or play instantly
            </span>
          </div>

          <form onSubmit={handleGuest} className="space-y-4">
            <div>
              <label htmlFor="guest-name" className="text-xs font-semibold text-foreground">
                Choose a nickname (optional)
              </label>
              <div className="relative mt-1">
                <User
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. StarWarrior"
                  className="pl-9"
                  maxLength={20}
                  disabled={!isConfigured || pending !== null}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={!isConfigured || pending !== null}
              className="w-full gap-2 h-11 shadow-primary/25"
            >
              {pending === "guest" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Setting you up…</span>
                </>
              ) : (
                <>
                  <span>Play as guest</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <div className="flex items-center justify-center space-x-2 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
            <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
            <span>You can link a Google account later and keep your progress</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginContent />
    </React.Suspense>
  );
}
