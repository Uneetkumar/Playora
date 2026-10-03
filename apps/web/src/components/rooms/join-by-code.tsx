"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@playora/ui";
import { Hash, ArrowRight, Loader2 } from "lucide-react";
import { ROOM_CODE_LENGTH } from "@playora/game-types";
import { useRoomResolver } from "../../hooks/use-rooms";

/**
 * Join a friend's room straight from the home page.
 *
 * The code is validated and the room resolved server-side before navigating, so
 * a wrong or full code says so here instead of opening a room that immediately
 * closes.
 */
export function JoinByCode({ className }: { className?: string }) {
  const router = useRouter();
  const { resolveCode, error, setError } = useRoomResolver();
  const [code, setCode] = React.useState("");
  const [isJoining, setIsJoining] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsJoining(true);
    const resolved = await resolveCode(code);
    setIsJoining(false);
    if (resolved) router.push(`/rooms/${resolved}`);
  };

  return (
    <div className={className}>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Hash
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="join-code" className="sr-only">
            Room code
          </label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="ENTER ROOM CODE"
            maxLength={ROOM_CODE_LENGTH + 2}
            autoComplete="off"
            spellCheck={false}
            className="pl-9 uppercase tracking-[0.2em] font-mono"
          />
        </div>
        <Button type="submit" disabled={!code.trim() || isJoining} className="gap-2 sm:w-auto">
          {isJoining ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden />
          )}
          <span>{isJoining ? "Checking…" : "Join"}</span>
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
