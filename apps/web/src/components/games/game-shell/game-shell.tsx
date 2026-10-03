"use client";

import * as React from "react";
import type { GameId } from "@playora/game-types";
import {
  Avatar,
  Button,
  ConfirmDialog,
  Kbd,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  focusRingClass,
  toast,
} from "@playora/ui";
import {
  ArrowLeft,
  LogOut,
  Maximize,
  Menu,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { getCatalogGame } from "../../../lib/games/catalog";
import { GAME_META } from "../../../lib/games/meta";
import { isSoloGame } from "../../../lib/play/modes";
import { useSfx } from "../../../lib/audio/use-sfx";
import { PauseMenu } from "./pause-menu";
import { useFullscreen } from "./use-fullscreen";
import {
  chromeOwnsKey,
  isMenuOpen,
  shellTransition,
  shortcutFor,
  type PendingConfirm,
  type ShellEvent,
  type ShellState,
} from "./shell-logic";

export interface GameShellPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** Whose turn it is, or who is speaking. */
  active?: boolean;
  score?: number | string;
  /** Seat colour (Ludo red, the X player's blue): rings the avatar. */
  color?: string;
}

export interface GameShellProps {
  gameId: GameId;
  title: string;
  subtitle?: string;
  roomCode?: string;
  /** The centre of the top bar: turn, score, clock. Moves under the title on narrow screens. */
  status?: React.ReactNode;
  players?: GameShellPlayer[];
  /** Leaves the game. Asked first only while `matchInProgress`. */
  onExit: () => void;
  /** Offered in the pause menu when given. Asked first only while `matchInProgress`. */
  onRestart?: () => void;
  /**
   * True while leaving or restarting would throw away a match in progress.
   * Only then do Leave and Restart ask for confirmation; a finished match, a
   * menu or a level select lets the player go straight away.
   */
  matchInProgress: boolean;
  /**
   * When set, the top bar's back arrow does this instead of leaving: a level
   * screen going back to its level list. Leave stays in the pause menu.
   */
  onBack?: () => void;
  /** The back arrow's label when `onBack` is set. */
  backLabel?: string;
  /** Rules for the pause menu. Defaults to the catalogue's rules for `gameId`. */
  howToPlay?: string[];
  /** Extra controls for the pause menu's Settings section. */
  settings?: React.ReactNode;
  /** Game-specific buttons for the top bar, left of mute. Keep to one or two icon buttons. */
  actions?: React.ReactNode;
  /** Controlled pause. Omit both to let the shell own it; children read it with `useGameShell`. */
  paused?: boolean;
  onPauseChange?: (paused: boolean) => void;
  /**
   * Whether the game can stop at all. Turn off for an online match, which
   * carries on on the server, turn clock included, whatever this tab does.
   * The menu then opens as "Menu" with "Back to game" and says the match
   * continues; `useGameShell().paused` stays false, `paused` and
   * `onPauseChange` are ignored, and the tab being hidden opens nothing.
   */
  pausable?: boolean;
  /**
   * Pause when the tab is hidden. Defaults to true for solo games, which
   * nobody else is waiting on, and false otherwise: an online match carries
   * on on the server whether this tab looks or not.
   */
  autoPauseOnHidden?: boolean;
  /**
   * Whether P pauses. Turn off for games that take typed letters. Escape
   * always pauses.
   */
  pauseKey?: boolean;
  /**
   * Offered Escape first. Return true when the game used it (cancelling a
   * drag, deselecting a piece) and the pause menu should stay shut.
   */
  onEscape?: () => boolean;
  /** The game's accent hex. Defaults to the game's own, from `GAME_META`. */
  accent?: string;
  className?: string;
  /** The game surface. Fills the height left under the top bar. */
  children: React.ReactNode;
}

export interface GameShellContextValue {
  paused: boolean;
  pause: () => void;
  resume: () => void;
}

const GameShellContext = React.createContext<GameShellContextValue | null>(null);

/**
 * The shell's pause state, for a game surface rendered inside it. Null
 * outside a shell, so a view can still be used on its own.
 */
export function useGameShell(): GameShellContextValue | null {
  return React.useContext(GameShellContext);
}

/**
 * The chrome every game shares: a top bar (back, title, room code; status
 * and players; mute, fullscreen, pause), a pause menu on Escape or P, and
 * the leave and restart confirmations.
 *
 * About eighteen views each drew their own back button, mute toggle and exit
 * dialog, so every game put them somewhere different and most had no pause
 * at all. This is the one place those live now.
 *
 * Games listen for their keys on `window`, so the shell keeps from them only
 * the keys its own controls use (`chromeOwnsKey`): Space pressing a focused
 * top-bar button, an arrow moving the volume slider. Every key typed in the
 * pause menu or a confirmation stays there, since those are modal. A mouse or
 * touch press on a top-bar button also gives focus up again, so the game's
 * keys keep working after a click on Mute. When the menu closes, focus goes
 * to the game surface rather than back to the Pause button for the same
 * reason.
 */
export function GameShell({
  gameId,
  title,
  subtitle,
  roomCode,
  status,
  players,
  onExit,
  onRestart,
  matchInProgress,
  onBack,
  backLabel = "Back",
  howToPlay,
  settings,
  actions,
  paused: pausedProp,
  onPauseChange,
  pausable = true,
  autoPauseOnHidden,
  pauseKey = true,
  onEscape,
  accent,
  className,
  children,
}: GameShellProps) {
  const [pausedState, setPausedState] = React.useState(false);
  const [confirm, setConfirm] = React.useState<PendingConfirm | null>(null);
  // For a game that cannot pause, `paused` is only "the menu is open", which
  // is the shell's business alone.
  const controlled = pausable && pausedProp !== undefined;
  const paused = controlled ? pausedProp : pausedState;
  const state: ShellState = { paused, confirm };

  const { muted, setMuted } = useSfx();
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLElement>(null);
  // What had focus when the game paused, so resuming can put it back if it
  // was in the game surface.
  const focusBeforePause = React.useRef<Element | null>(null);

  const autoPause = pausable && (autoPauseOnHidden ?? isSoloGame(gameId));
  const rules = howToPlay ?? getCatalogGame(gameId)?.rules ?? [];
  const gameAccent = accent ?? GAME_META[gameId].accent;

  /*
   * Every event goes through `shellTransition`, against state a ref carries so
   * the window listeners below need not re-subscribe on each change. The ref
   * is advanced as soon as an event is applied, so two events in one tick (a
   * visibility change landing with a key press) build on each other instead
   * of both reading the last render.
   */
  const latest = React.useRef({ state, matchInProgress, controlled, pausable, onPauseChange, onExit, onRestart });
  latest.current = { state, matchInProgress, controlled, pausable, onPauseChange, onExit, onRestart };

  const send = React.useCallback((event: ShellEvent) => {
    const {
      state: current,
      matchInProgress: live,
      controlled: isControlled,
      pausable: canPause,
      ...callbacks
    } = latest.current;
    const { state: next, effect } = shellTransition(current, event, live);
    if (next.confirm !== current.confirm) setConfirm(next.confirm);
    if (next.paused !== current.paused) {
      if (next.paused) focusBeforePause.current = document.activeElement;
      if (!isControlled) setPausedState(next.paused);
      if (canPause) callbacks.onPauseChange?.(next.paused);
    }
    latest.current = { ...latest.current, state: next };
    if (effect === "exit") callbacks.onExit();
    else if (effect === "restart") callbacks.onRestart?.();
  }, []);

  const onEscapeRef = React.useRef(onEscape);
  onEscapeRef.current = onEscape;

  const handleShortcut = React.useCallback(
    (event: KeyboardEvent | React.KeyboardEvent) => {
      const shortcut = shortcutFor(event, { pauseKey });
      if (shortcut === "escape") {
        if (latest.current.state.paused) return;
        if (onEscapeRef.current?.()) return;
        event.preventDefault();
        send({ type: "pause" });
      } else if (shortcut === "pause-key") {
        event.preventDefault();
        send({ type: "toggle" });
      }
    },
    [pauseKey, send],
  );

  // Shortcuts pressed anywhere in the game surface, or with nothing focused.
  React.useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleShortcut]);

  /*
   * Keys from the top bar and the overlays. Portalled overlays bubble through
   * here too, because React events follow the component tree, not the DOM;
   * a target outside the header's DOM is in one of them.
   *
   * A key kept here is stopped, and the shell's own shortcuts are run for it
   * since the window listener above will not see it. Any other key is left
   * alone for the window listeners, the shell's and the game's alike. React
   * 19 dispatches at the document, so stopping here really does keep it from
   * `window`.
   */
  const onChromeKeyDown = (event: React.KeyboardEvent) => {
    const inOverlay = !headerRef.current?.contains(event.target as Node);
    if (!inOverlay && !chromeOwnsKey(event)) return;
    handleShortcut(event);
    event.stopPropagation();
  };

  /*
   * Resuming focuses the game, not the Pause button the menu was opened from:
   * a focused top-bar button would take the next Space or Enter for itself.
   * The element that had focus goes back only if it was in the game surface
   * (a game's own focused board, say).
   */
  const returnFocusToGame = (event: Event) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    const previous = focusBeforePause.current;
    focusBeforePause.current = null;
    if (previous instanceof HTMLElement && previous.isConnected && surface?.contains(previous)) {
      previous.focus({ preventScroll: true });
    } else {
      surface?.focus({ preventScroll: true });
    }
  };

  // The browser keeps Escape for leaving fullscreen and never passes it on,
  // so an exit the shell did not ask for is treated as the Escape it was.
  const fullscreen = useFullscreen(() => send({ type: "pause" }));

  React.useEffect(() => {
    if (!autoPause) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoPause, send]);

  const context = React.useMemo<GameShellContextValue>(
    () => ({
      paused: pausable && paused,
      pause: () => send({ type: "pause" }),
      resume: () => send({ type: "resume" }),
    }),
    [pausable, paused, send],
  );

  // The question keeps its wording while the dialog animates closed, after
  // `confirm` has already gone back to null.
  const lastConfirm = React.useRef<PendingConfirm | null>(null);
  if (confirm) lastConfirm.current = confirm;
  const asking = confirm ?? lastConfirm.current;
  const restarting = asking?.kind === "restart";

  const accentStyle = gameAccent
    ? ({ "--game-accent": gameAccent } as React.CSSProperties)
    : undefined;
  const hasCentre = Boolean(status) || Boolean(players?.length);

  return (
    <GameShellContext.Provider value={context}>
      <div
        data-game-shell=""
        data-paused={(pausable && paused) || undefined}
        style={accentStyle}
        className={cn(
          "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground",
          className,
        )}
      >
        <div className="contents" onKeyDown={onChromeKeyDown}>
          <header
            ref={headerRef}
            className={cn(
              "relative z-header grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center",
              "border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/75",
              hasCentre && "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
            )}
          >
            <div className="col-start-1 row-start-1 flex h-14 min-w-0 items-center gap-1.5 pl-[max(0.5rem,env(safe-area-inset-left))] sm:gap-2 sm:pl-[max(0.75rem,env(safe-area-inset-left))]">
              <ShellIconButton
                label={onBack ? backLabel : "Leave game"}
                onClick={onBack ?? (() => send({ type: "exit", from: "bar" }))}
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </ShellIconButton>
              <div className="min-w-0">
                <h1 className="truncate font-display text-base font-bold leading-tight tracking-tight sm:text-lg">
                  {title}
                </h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              {roomCode && <RoomCodeChip code={roomCode} />}
            </div>

            {hasCentre && (
              <div
                className={cn(
                  "col-span-2 row-start-2 flex min-w-0 items-center justify-center gap-3 border-t border-border/60 px-3 py-1.5",
                  "md:col-span-1 md:col-start-2 md:row-start-1 md:h-14 md:border-0 md:px-2 md:py-0",
                )}
              >
                {status && <div className="flex min-w-0 shrink-0 items-center">{status}</div>}
                {players && players.length > 0 && <PlayerStrip players={players} />}
              </div>
            )}

            <div
              className={cn(
                "col-start-2 row-start-1 flex h-14 items-center justify-end gap-0.5 pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-1 sm:pr-[max(0.75rem,env(safe-area-inset-right))]",
                hasCentre && "md:col-start-3",
              )}
            >
              {actions}
              <ShellIconButton label="Mute" pressed={muted} onClick={() => setMuted(!muted)}>
                {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
              </ShellIconButton>
              {fullscreen.supported && (
                <ShellIconButton label="Fullscreen" pressed={fullscreen.active} onClick={fullscreen.toggle}>
                  {fullscreen.active ? (
                    <Minimize className="h-5 w-5" aria-hidden />
                  ) : (
                    <Maximize className="h-5 w-5" aria-hidden />
                  )}
                </ShellIconButton>
              )}
              <ShellIconButton
                label={pausable ? "Pause" : "Menu"}
                shortcut={pauseKey ? "Escape P" : "Escape"}
                hint={pauseKey ? ["Esc", "P"] : ["Esc"]}
                onClick={() => send({ type: "pause" })}
              >
                {pausable ? <Pause className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </ShellIconButton>
            </div>
          </header>

          <PauseMenu
            open={isMenuOpen(state)}
            title={title}
            roomCode={roomCode}
            howToPlay={rules}
            settings={settings}
            canRestart={Boolean(onRestart)}
            pauseKey={pauseKey}
            pausable={pausable}
            onCloseAutoFocus={returnFocusToGame}
            onResume={() => send({ type: "resume" })}
            onRestart={() => send({ type: "restart" })}
            onLeave={() => send({ type: "exit", from: "menu" })}
          />

          <ConfirmDialog
            open={confirm !== null}
            variant="destructive"
            icon={restarting ? <RotateCcw /> : <LogOut />}
            title={restarting ? "Restart this game?" : `Leave ${title}?`}
            description={
              restarting
                ? "The game in progress ends and a new one starts from the beginning."
                : "The game in progress ends. You can't come back to it."
            }
            confirmLabel={restarting ? "Restart" : "Leave game"}
            cancelLabel={asking?.from === "bar" ? "Keep playing" : "Cancel"}
            onConfirm={() => send({ type: "confirm" })}
            onCancel={() => send({ type: "cancel" })}
          />
        </div>

        {/* Focusable only from code (tabIndex -1), so resuming has somewhere
            in the game to put focus. */}
        <div
          ref={surfaceRef}
          tabIndex={-1}
          className="relative flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] focus:outline-none"
        >
          {children}
        </div>
      </div>
    </GameShellContext.Provider>
  );
}

/**
 * An icon button with its name in a tooltip, as the top bar uses: pass these
 * in `actions` so a game's own buttons match the shell's. `pressed` makes it
 * a toggle: the name stays fixed ("Mute") and the state is announced as
 * pressed or not, rather than the name flipping to "Unmute" under the
 * reader's cursor.
 *
 * A mouse or touch press gives focus up afterwards, so the game's keys go
 * back to the game; keyboard activation (`detail` 0) keeps it, so a keyboard
 * user stays where they were.
 */
export function ShellIconButton({
  label,
  pressed,
  shortcut,
  hint,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  /** For `aria-keyshortcuts`, e.g. "Escape P". */
  shortcut?: string;
  /** Key caps shown in the tooltip. */
  hint?: string[];
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          aria-keyshortcuts={shortcut}
          onClick={(event) => {
            onClick();
            if (event.detail > 0) event.currentTarget.blur();
          }}
          className={cn("shrink-0", pressed && "bg-foreground/[0.08] text-primary-accent")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-1.5">
        {label}
        {hint?.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The room code, in mono so 0/O and 1/I cannot be confused; a tap copies it.
 * Drawn 28px tall, with an invisible band taking the hit area to 40px.
 */
function RoomCodeChip({ code }: { code: string }) {
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(
      () => toast.success("Room code copied"),
      () => {},
    );
  };
  return (
    <button
      type="button"
      onClick={(event) => {
        copy();
        if (event.detail > 0) event.currentTarget.blur();
      }}
      aria-label={`Room code ${code.split("").join(" ")}. Copy`}
      className={cn(
        "relative hidden h-7 shrink-0 items-center rounded-full border border-border bg-card px-2.5 sm:inline-flex",
        "before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']",
        "font-mono-num text-xs font-bold tracking-widest text-foreground transition-colors duration-hover ease-out-expo hover:border-foreground/20",
        focusRingClass,
      )}
    >
      {code}
    </button>
  );
}

/**
 * Who is playing. Names show from `lg` up; below that the avatars carry them
 * for screen readers, and a seat colour rings each avatar.
 *
 * The player whose turn it is gets the game's accent and also a pointer and
 * a doubled edge, because colour alone fails anyone who cannot tell a red
 * accent from the grey border: on a phone, with names hidden, the avatar is
 * all there is.
 */
function PlayerStrip({ players }: { players: GameShellPlayer[] }) {
  return (
    <ul aria-label="Players" className="scrollbar-none flex min-w-0 items-center gap-1.5 overflow-x-auto">
      {players.map((player) => (
        <li
          key={player.id}
          aria-current={player.active ? "true" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 transition-colors duration-hover ease-out-expo",
            player.active
              ? "border-game-accent bg-game-accent-soft pl-1.5 ring-1 ring-game-accent"
              : "border-border bg-card/60",
          )}
        >
          {player.active && (
            <Play className="h-2.5 w-2.5 shrink-0 fill-current text-game-accent" aria-hidden />
          )}
          <span aria-hidden>
            <Avatar
              size="xs"
              src={player.avatarUrl}
              fallbackText={player.name}
              style={
                player.color
                  ? ({ "--tw-ring-color": player.color } as React.CSSProperties)
                  : undefined
              }
            />
          </span>
          <span aria-hidden className="hidden max-w-[7rem] truncate text-xs font-semibold lg:inline">
            {player.name}
          </span>
          {player.score !== undefined && (
            <span aria-hidden className="font-mono-num text-xs font-bold">
              {player.score}
            </span>
          )}
          <span className="sr-only">
            {player.name}
            {player.score !== undefined ? `, ${player.score}` : ""}
            {player.active ? ", playing now" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
