"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ROOM_CODE_LENGTH } from "@playora/game-types";
import { Button, Input, Spinner, cn } from "@playora/ui";
import { useRoomResolver } from "../../hooks/use-rooms";

/**
 * Joining a room by its code, from anywhere in the shell: the header's join
 * popover, the command palette, the phone's quick-play sheet and the QR
 * scanner all go through this, so "valid code, room exists, room not full,
 * then navigate" is decided once.
 */
export function useJoinRoom() {
  const router = useRouter();
  const { resolveCode, error, setError } = useRoomResolver();
  const [pending, setPending] = React.useState(false);

  /** Resolves and navigates. True when it navigated; otherwise `error` says why. */
  const join = React.useCallback(
    async (raw: string): Promise<boolean> => {
      setPending(true);
      const code = await resolveCode(raw);
      setPending(false);
      if (!code) return false;
      router.push(`/rooms/${code}`);
      return true;
    },
    [resolveCode, router],
  );

  const clearError = React.useCallback(() => setError(null), [setError]);

  return { join, pending, error, clearError, resolveCode };
}

/**
 * Code field plus Join. Uppercases as you type and accepts the separators
 * people paste ("ABC-123"); the resolver normalises the rest.
 */
export function RoomCodeForm({
  onJoined,
  autoFocus,
  className,
  initialCode = "",
  autoSubmit = false,
  idPrefix = "room-code",
}: {
  onJoined?: () => void;
  autoFocus?: boolean;
  className?: string;
  initialCode?: string;
  /**
   * Try `initialCode` straight away, for a code the player already typed
   * somewhere else (the palette's search box). A failure stays on screen,
   * next to the field, for them to correct.
   */
  autoSubmit?: boolean;
  /** Distinguishes the field when more than one form is mounted. */
  idPrefix?: string;
}) {
  const { join, pending, error, clearError } = useJoinRoom();
  const [code, setCode] = React.useState(initialCode);
  const inputId = `${idPrefix}-input`;
  const errorId = `${idPrefix}-error`;

  // Once per mount: the props are the code that opened this form.
  const autoSubmitted = React.useRef(false);
  React.useEffect(() => {
    if (!autoSubmit || !initialCode || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void join(initialCode).then((ok) => {
      if (ok) onJoined?.();
    });
  }, [autoSubmit, initialCode, join, onJoined]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || pending) return;
    if (await join(code)) onJoined?.();
  };

  return (
    <form onSubmit={submit} className={cn("space-y-2", className)} noValidate>
      <label htmlFor={inputId} className="sr-only">
        Room code
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) clearError();
          }}
          placeholder="K7P2QX"
          maxLength={ROOM_CODE_LENGTH + 2}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-11 flex-1 font-mono-num text-base font-bold uppercase tracking-[0.3em] placeholder:tracking-[0.3em]"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={!code.trim() || pending}>
          {pending ? <Spinner size="xs" tone="current" label="Joining" /> : <ArrowRight className="h-4 w-4" aria-hidden />}
          Join
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive-ink">
          {error}
        </p>
      )}
    </form>
  );
}
