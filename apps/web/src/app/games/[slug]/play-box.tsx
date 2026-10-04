"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bot,
  Car,
  ChevronRight,
  DoorOpen,
  Play,
  Timer,
  Trophy,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { readReducedMotionPref } from "@playora/animation";
import { AI_LEVELS, AI_LEVEL_LABELS, RECOMMENDED_AI_LEVEL, type AiLevel } from "@playora/bot-engine";
import type { GameId } from "@playora/game-types";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@playora/ui";
import type { PlayMode, PlayModeId } from "../../../lib/play/modes";
import { VehicleSelect, useChosenVehicle } from "../../../games/racing/VehicleSelect";
import { TrackSelect, TRACK_PRESETS, type TrackOption } from "../../../games/racing/TrackSelect";
import {
  CHESS_CLOCK,
  defaultMode,
  isRacingGame,
  modeCopy,
  playHref,
  usesBotLevel,
  usesTrackTheme,
} from "./play-options";

/**
 * The play box: pick a way to play, set it up, press Play.
 *
 * It replaces a grid of up to six cards that each carried their own button,
 * plus a hero button that silently started the first of them. Every route
 * those buttons produced is still produced, by `playHref`, from the same
 * choices (mode, bot level, circuit); the test beside this file pins them.
 *
 * One Play button, in the play colour, whose label says what it will do. The
 * mode is a single-select toggle group (one tab stop, arrow keys inside), and
 * only the presets that apply to the chosen mode are drawn: a bot level for a
 * bot, a circuit for a race drawn on this device.
 *
 * `id="play"` is the anchor the catalogue's cards link to (`/games/<id>#play`)
 * for any game with more than one way to play. A page load scrolls to it on
 * its own, but a client navigation commits the URL while the route's loading
 * skeleton is up, when there is no #play to find, and Next does not look
 * again; so the box brings itself into view when it mounts under that hash.
 */

const MODE_ICON: Record<PlayModeId, LucideIcon> = {
  solo: Play,
  "offline-ai": Bot,
  "offline-career": Trophy,
  "offline-local": Users,
  "online-friends": DoorOpen,
  "online-random": Zap,
  lan: Wifi,
};

/** What the Play button shows: a start for anything on this device, the destination otherwise. */
const ACTION_ICON: Record<PlayModeId, LucideIcon> = {
  solo: Play,
  "offline-ai": Play,
  "offline-career": Play,
  "offline-local": Play,
  "online-friends": DoorOpen,
  "online-random": Zap,
  lan: Wifi,
};

export interface PlayBoxProps {
  gameId: GameId;
  gameName: string;
  modes: readonly PlayMode[];
  /** Called as any Play link is followed, to record the play. */
  onPlay: () => void;
  className?: string;
}

export function PlayBox({ gameId, gameName, modes, onPlay, className }: PlayBoxProps) {
  const racing = isRacingGame(gameId);
  const [modeId, setModeId] = React.useState<PlayModeId | undefined>(() => defaultMode(modes)?.id);
  const [aiLevel, setAiLevel] = React.useState<AiLevel>(RECOMMENDED_AI_LEVEL);
  const [track, setTrack] = React.useState<TrackOption>(TRACK_PRESETS[0]!);

  const mode = modes.find((m) => m.id === modeId) ?? defaultMode(modes);
  const [playLink, setPlayLink] = React.useState<HTMLAnchorElement | null>(null);
  const playInView = useInView(playLink);
  const hintId = React.useId();
  const modeLabelId = React.useId();

  const boxRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (window.location.hash !== "#play") return;
    // Asked fresh: during hydration the hook's value is still the server's.
    boxRef.current?.scrollIntoView({ block: "start", behavior: readReducedMotionPref() ? "auto" : "smooth" });
  }, []);

  if (!mode) return null;

  const ready = mode.status === "ready";
  const copy = modeCopy(mode.id, gameId);
  const href = playHref(mode.id, gameId, { aiLevel, trackTheme: racing ? track.themeKey : undefined });
  const ActionIcon = ACTION_ICON[mode.id];

  return (
    <>
      <section
        ref={boxRef}
        id="play"
        aria-labelledby="play-title"
        className={cn(
          "relative scroll-mt-[calc(var(--shell-header-h)+1rem)] overflow-hidden rounded-xl border border-border bg-card p-5 shadow-raised sm:p-6 lg:p-5 xl:p-6",
          className,
        )}
      >
        {/* The game's colour along the top edge: this box belongs to this game. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-game-accent" />

        <h2 id="play-title" className="font-display text-rail text-foreground">
          Play {gameName}
        </h2>

        {/* A little tighter from `lg`, where the box is sticky: a racing
            game's box, the tallest, then keeps its Play button inside a
            1280x720 window. */}
        <div className="mt-5 space-y-5 lg:mt-4 lg:space-y-4">
          {modes.length > 1 && (
            <div className="space-y-2">
              <p id={modeLabelId} className="text-tag uppercase text-muted-foreground">
                Mode
              </p>
              <ToggleGroup
                type="single"
                value={mode.id}
                // A mode is always chosen: ignore Radix's "unselect" on a second press.
                onValueChange={(v) => v && setModeId(v as PlayModeId)}
                aria-labelledby={modeLabelId}
                size="lg"
                className="grid w-full grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-2"
              >
                {modes.map((m) => (
                  <ModeOption key={m.id} mode={m} gameId={gameId} />
                ))}
              </ToggleGroup>
            </div>
          )}

          <p id={hintId} className="text-sm text-muted-foreground">
            {ready ? copy.hint : (mode.note ?? "This way to play isn't ready yet.")}
          </p>

          {ready && usesBotLevel(mode.id) && <BotLevel value={aiLevel} onChange={setAiLevel} />}

          {ready && usesTrackTheme(gameId, mode.id) && (
            <RacingSetup gameId={gameId} track={track} onTrack={setTrack} />
          )}

          {gameId === "chess" && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Timer aria-hidden className="h-4 w-4" />
                Clock
              </span>
              <span className="font-semibold text-foreground">
                <span aria-hidden className="font-mono-num">
                  {CHESS_CLOCK.minutes} + {CHESS_CLOCK.incrementSeconds}
                </span>
                <span className="sr-only">
                  {CHESS_CLOCK.minutes} minutes each, no increment
                </span>
              </span>
            </div>
          )}

          <div className="space-y-3">
            {ready ? (
              <Button asChild variant="play" size="xl" className="w-full">
                <Link ref={setPlayLink} href={href} prefetch={false} onClick={onPlay} aria-describedby={hintId}>
                  <ActionIcon aria-hidden className={cn("h-5 w-5", ActionIcon === Play && "fill-current")} />
                  {copy.action}
                </Link>
              </Button>
            ) : (
              <Button variant="play" size="xl" className="w-full" disabled>
                Coming soon
              </Button>
            )}
            <ModeFacts mode={mode} />
          </div>
        </div>
      </section>

      {ready && (
        <MobilePlayBar
          visible={!playInView}
          href={href}
          label={copy.action}
          gameName={gameName}
          setup={setupSummary(mode.id, gameId, copy.option, aiLevel, track)}
          icon={ActionIcon}
          onPlay={onPlay}
        />
      )}
    </>
  );
}

function ModeOption({ mode, gameId }: { mode: PlayMode; gameId: GameId }) {
  const copy = modeCopy(mode.id, gameId);
  const Icon = mode.id === "offline-local" && isRacingGame(gameId) ? Timer : MODE_ICON[mode.id];
  const item = (
    <ToggleGroupItem value={mode.id} disabled={mode.status !== "ready"} className="justify-start px-3">
      <Icon aria-hidden />
      <span className="truncate">{copy.option}</span>
    </ToggleGroupItem>
  );
  if (mode.status === "ready") return item;

  // A disabled button fires no pointer events and takes no focus, so the
  // reason it is off is hung on a focusable wrapper instead.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {item}
          <span className="sr-only">, {mode.note ?? "coming soon"}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{mode.note ?? "Coming soon"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Bot level as a segmented slider: seven steps in one track, filled up to
 * the chosen one so it reads as a scale, with the chosen level's name above
 * and the two ends named below.
 */
function BotLevel({ value, onChange }: { value: AiLevel; onChange: (level: AiLevel) => void }) {
  const labelId = React.useId();
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-sm font-semibold text-foreground">
          Bot level
        </span>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{AI_LEVEL_LABELS[value]}</span>
          {value === RECOMMENDED_AI_LEVEL && " · Recommended"}
        </span>
      </div>
      <ToggleGroup
        type="single"
        value={String(value)}
        onValueChange={(v) => v && onChange(Number(v) as AiLevel)}
        aria-labelledby={labelId}
        className="w-full gap-0.5"
      >
        {AI_LEVELS.map((level) => (
          <ToggleGroupItem
            key={level}
            value={String(level)}
            aria-label={`Level ${level}, ${AI_LEVEL_LABELS[level]}`}
            // 40px tall to tap on a phone.
            className={cn("numeric h-10 min-w-0 px-0 sm:h-9", level < value && "bg-primary/[0.08] text-primary-accent")}
          >
            {level}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
        <span>{AI_LEVEL_LABELS[AI_LEVELS[0]!]}</span>
        <span>{AI_LEVEL_LABELS[AI_LEVELS[AI_LEVELS.length - 1]!]}</span>
      </div>
    </div>
  );
}

/**
 * The circuit, as a quick pick, and the full garage (car or bike, plus the
 * circuit gallery) one tap away in a side panel. The garage's own components
 * are used as they are: their choices are what the race reads, the vehicle
 * through localStorage and the circuit through the `theme` this box puts in
 * the Play link.
 */
function RacingSetup({
  gameId,
  track,
  onTrack,
}: {
  gameId: GameId;
  track: TrackOption;
  onTrack: (track: TrackOption) => void;
}) {
  const [garageOpen, setGarageOpen] = React.useState(false);
  const { vehicleId, chooseVehicle } = useChosenVehicle(gameId);
  const selectId = React.useId();
  const vehicle = gameId === "bike-race" ? "bike" : "car";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={selectId}>Circuit</Label>
        <Select
          value={track.id}
          onValueChange={(id) => onTrack(TRACK_PRESETS.find((t) => t.id === id) ?? TRACK_PRESETS[0]!)}
        >
          <SelectTrigger id={selectId} className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRACK_PRESETS.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                <span className="text-muted-foreground"> · {t.difficulty}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" className="h-11 w-full justify-between" onClick={() => setGarageOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <Car aria-hidden className="h-4 w-4 text-muted-foreground" />
          Choose your {vehicle}
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Sheet open={garageOpen} onOpenChange={setGarageOpen}>
        <SheetContent side="right" className="w-full gap-6 overflow-y-auto p-4 sm:w-[min(100vw,72rem)] sm:p-6">
          <SheetHeader>
            <SheetTitle>Garage</SheetTitle>
            <SheetDescription>
              Your {vehicle} is remembered for every race on this device. The circuit applies to the next race you start
              here.
            </SheetDescription>
          </SheetHeader>
          {/* Mounted only while open: the showroom is a WebGL scene. */}
          {garageOpen && (
            <div className="space-y-6">
              <VehicleSelect gameId={gameId} selectedId={vehicleId} onSelect={chooseVehicle} />
              <TrackSelect selectedTrackId={track.id} onSelectTrack={onTrack} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Whether the mode needs a connection or an account, said before the press rather than after it. */
function ModeFacts({ mode }: { mode: PlayMode }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="inline-flex items-center gap-1.5">
        {mode.needsInternet ? (
          <Wifi aria-hidden className="h-3.5 w-3.5" />
        ) : (
          <WifiOff aria-hidden className="h-3.5 w-3.5" />
        )}
        {mode.needsInternet ? "Needs internet" : "Works offline"}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <UserRound aria-hidden className="h-3.5 w-3.5" />
        {mode.needsAuth ? "Sign-in needed, guest is fine" : "No account needed"}
      </li>
    </ul>
  );
}

/**
 * Play, pinned above the tab bar on a phone while the play box's own button
 * is off screen.
 *
 * On a phone the box sits under the hero, and its button is a screen or more
 * down; this is the same link, with the same choices, where a thumb can
 * reach it. It is never on screen together with the box's button, so the
 * page still has one Play. From `lg` the box itself is sticky and this is
 * not drawn.
 */
/** The bar's second line: the mode, and the one setting that matters most for it. */
function setupSummary(modeId: PlayModeId, gameId: GameId, option: string, aiLevel: AiLevel, track: TrackOption): string {
  if (usesBotLevel(modeId)) return `${option} · ${AI_LEVEL_LABELS[aiLevel]}`;
  if (usesTrackTheme(gameId, modeId)) return `${option} · ${track.name}`;
  return option;
}

function MobilePlayBar({
  visible,
  href,
  label,
  gameName,
  setup,
  icon: Icon,
  onPlay,
}: {
  visible: boolean;
  href: string;
  label: string;
  gameName: string;
  setup: string;
  icon: LucideIcon;
  onPlay: () => void;
}) {
  return (
    <div
      aria-hidden={!visible || undefined}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 z-sticky border-t border-border bg-surface px-4 pt-3 shadow-overlay lg:hidden",
        // Above the tab bar on a phone, with room under the button for the
        // tab bar's raised Play, which rises 1.5rem into this bar; at the
        // bottom edge from `md`, where there is no tab bar.
        "bottom-[calc(4rem+env(safe-area-inset-bottom))] pb-7 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "transition-[transform,opacity] duration-hover ease-out-expo",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <p className="min-w-0 flex-1">
          <span className="block truncate text-xs text-muted-foreground">{gameName}</span>
          <span className="block truncate text-sm font-semibold text-foreground">{setup}</span>
        </p>
        <Button asChild variant="play" size="lg" className="shrink-0">
          <Link href={href} prefetch={false} onClick={onPlay}>
            <Icon aria-hidden className={cn("h-5 w-5", Icon === Play && "fill-current")} />
            {label}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Whether an element is on screen, above the phone tab bar. Starts true, so
 * the server render and the first paint draw no floating bar; the observer
 * corrects it a frame later.
 */
function useInView(el: HTMLElement | null): boolean {
  const [inView, setInView] = React.useState(true);
  React.useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      // The tab bar and this bar's own height cover the bottom of the viewport.
      { rootMargin: "0px 0px -160px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return inView;
}
