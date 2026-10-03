"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Kbd,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Slider,
  Switch,
} from "@playora/ui";
import {
  prefersReducedMotion,
  readInAppReducedMotion,
  subscribeReducedMotionPref,
} from "@playora/animation";
import { BookOpen, LogOut, Play, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import { useAudioStore } from "../../../lib/store/audio-store";
import { applyReduceMotion } from "../../../lib/theme";

const serverFalse = () => false;
const subscribeNever = () => () => {};

function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, serverFalse);
}

function readCanHover(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export interface PauseMenuProps {
  open: boolean;
  title: string;
  roomCode?: string;
  howToPlay: string[];
  /** Game-specific controls, shown under the shell's own settings. */
  settings?: React.ReactNode;
  canRestart: boolean;
  /** Whether P pauses in this game; the shortcut hint only mentions it when it does. */
  pauseKey: boolean;
  /** False for a game that keeps running (an online match): a "Menu", not "Paused". */
  pausable: boolean;
  /** Where focus goes when the menu closes. GameShell sends it to the game surface. */
  onCloseAutoFocus?: (event: Event) => void;
  onResume: () => void;
  onRestart: () => void;
  onLeave: () => void;
}

/**
 * The pause menu: Resume first and focused, so Enter or a tap goes straight
 * back to the game; Restart; the rules and settings folded away; Leave last
 * and in red. Whether Restart and Leave ask first is the shell's decision,
 * not this component's.
 *
 * A bottom sheet on phones, where it sits under the thumb, and a side sheet
 * from 768px up, where a bottom sheet would stretch a short menu across a
 * wide screen. Dismissing it any way (Escape, the close button, tapping the
 * scrim) resumes.
 *
 * For a game that cannot pause it is the same menu under another name, and
 * it says plainly that the match goes on behind it.
 */
export function PauseMenu({
  open,
  title,
  roomCode,
  howToPlay,
  settings,
  canRestart,
  pauseKey,
  pausable,
  onCloseAutoFocus,
  onResume,
  onRestart,
  onLeave,
}: PauseMenuProps) {
  const wide = useMediaQuery("(min-width: 768px)");
  const canHover = React.useSyncExternalStore(subscribeNever, readCanHover, serverFalse);
  const resumeRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onResume()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className="gap-5 overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          resumeRef.current?.focus();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader>
          <SheetTitle className="text-h2">{pausable ? "Paused" : "Menu"}</SheetTitle>
          <SheetDescription className="truncate">
            {title}
            {roomCode && (
              <>
                {" · Room "}
                <span className="font-mono-num font-bold text-foreground">{roomCode}</span>
              </>
            )}
          </SheetDescription>
          {!pausable && (
            <p className="text-sm text-muted-foreground">The match carries on while this is open.</p>
          )}
        </SheetHeader>

        <div className="grid gap-2">
          <Button ref={resumeRef} size="lg" onClick={onResume}>
            <Play className="h-4 w-4 fill-current" aria-hidden />
            {pausable ? "Resume" : "Back to game"}
          </Button>
          {canRestart && (
            <Button size="lg" variant="secondary" onClick={onRestart}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Restart
            </Button>
          )}
        </div>

        <Accordion type="multiple" className="-mt-1">
          {howToPlay.length > 0 && (
            <AccordionItem value="how-to-play">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden />
                  How to play
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {/* Numbers drawn, not ::marker: a marker hangs outside the
                    list box, where the accordion's overflow clip cuts it off. */}
                <ol className="space-y-2">
                  {howToPlay.map((rule, i) => (
                    <li key={rule} className="flex gap-3">
                      <span className="w-4 shrink-0 text-right font-mono-num text-muted-foreground" aria-hidden>
                        {i + 1}
                      </span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="settings">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                Settings
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ShellSettings extra={settings} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button
          variant="outline"
          size="lg"
          onClick={onLeave}
          // A 5% tint, not 10%: at 10% the red label on it drops below 4.5:1.
          className="border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/5"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Leave game
        </Button>

        {/* Only where a keyboard is likely; on a phone it is noise. */}
        {canHover && (
          <p className="text-center text-xs text-muted-foreground">
            <Kbd>Esc</Kbd>
            {pauseKey && (
              <>
                {" or "}
                <Kbd>P</Kbd>
              </>
            )}{" "}
            {pausable ? "pauses and resumes" : "opens and closes this menu"}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Volume and motion, the two settings a player reaches for mid-game. Both
 * write the same global state the Settings page does, so a change here holds
 * everywhere and survives a reload.
 */
function ShellSettings({ extra }: { extra?: React.ReactNode }) {
  const master = useAudioStore((s) => s.mixer.master);
  const muted = useAudioStore((s) => s.mixer.muted);
  const setMaster = useAudioStore((s) => s.setMaster);
  const setMuted = useAudioStore((s) => s.setMuted);
  const play = useAudioStore((s) => s.play);

  const inAppReduced = React.useSyncExternalStore(
    subscribeReducedMotionPref,
    readInAppReducedMotion,
    serverFalse,
  );
  const osReduced = React.useSyncExternalStore(
    subscribeReducedMotionPref,
    prefersReducedMotion,
    serverFalse,
  );

  const volumeId = React.useId();
  const motionId = React.useId();
  const percent = Math.round(master * 100);

  return (
    <div className="space-y-5 pt-1">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Label id={volumeId}>Volume</Label>
          <span className="font-mono-num text-xs text-muted-foreground" aria-hidden>
            {muted ? "Muted" : `${percent}%`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {/* Full 40px and never squeezed: the slider beside it takes the rest. */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Mute"
            aria-pressed={muted}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </Button>
          <Slider
            aria-labelledby={volumeId}
            min={0}
            max={100}
            step={5}
            value={[percent]}
            disabled={muted}
            onValueChange={([value]) => setMaster((value ?? 0) / 100)}
            // A level you cannot hear is guesswork: play one click at the new
            // level once the thumb is let go, not on every step of a drag.
            onValueCommit={() => play("ui.click")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={motionId}>Reduce motion</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {osReduced
              ? "Your device already asks for less motion."
              : "Calmer effects: no screen shake or sweeping transitions."}
          </p>
        </div>
        <Switch id={motionId} checked={inAppReduced} onCheckedChange={applyReduceMotion} />
      </div>

      {extra}
    </div>
  );
}
