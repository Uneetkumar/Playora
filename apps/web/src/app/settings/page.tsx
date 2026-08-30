"use client";

import * as React from "react";
import { Card, Button, Badge } from "@playora/ui";
import {
  User, Palette, Volume2, VolumeX, Gamepad2, Bell, Shield, Accessibility, Check,
} from "lucide-react";
import { AUDIO_BUSES, BUS_LABELS } from "@playora/audio";
import { useAudioStore } from "../../lib/store/audio-store";
import { useGameplayStore, type GameplayPrefs } from "../../lib/store/gameplay-store";
import { useAuthStore } from "../../lib/store/auth-store";

/**
 * Settings.
 *
 * The sidebar linked here before the page existed, which is how a 404 ended up
 * being reachable from the main navigation. Appearance and accessibility are
 * wired now because they are purely client-side; the rest are marked plainly as
 * not yet built rather than shown as controls that do nothing.
 */

type ThemeChoice = "dark" | "light" | "system";

const SECTIONS = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
] as const;

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  const prefersLight =
    choice === "light" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);

  root.classList.toggle("light", prefersLight);
  root.classList.toggle("dark", !prefersLight);
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [theme, setTheme] = React.useState<ThemeChoice>("dark");
  const [reduceMotion, setReduceMotion] = React.useState(false);

  // Restore the saved choices before first paint of this page.
  React.useEffect(() => {
    try {
      const saved = (localStorage.getItem("playora:theme") as ThemeChoice) ?? "dark";
      setTheme(saved);
      applyTheme(saved);
      setReduceMotion(localStorage.getItem("playora:reduce-motion") === "1");
    } catch {
      // Private browsing or blocked storage: defaults are fine.
    }
  }, []);

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    applyTheme(choice);
    try {
      localStorage.setItem("playora:theme", choice);
    } catch {
      /* storage unavailable */
    }
  };

  const toggleMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    document.documentElement.classList.toggle("reduce-motion", next);
    try {
      localStorage.setItem("playora:reduce-motion", next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold text-foreground">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Changes save as you make them — there is no save button to forget.
      </p>

      <nav aria-label="Settings sections" className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-5">
        <Card id="account" className="border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <User className="h-5 w-5 text-primary" aria-hidden />
            Account
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Display name</dt>
              <dd className="text-foreground">{user?.displayName ?? "Not signed in"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Account type</dt>
              <dd>
                {user ? (
                  <Badge variant={user.isGuest ? "warning" : "success"}>
                    {user.isGuest ? "Guest" : "Google"}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
          {user?.isGuest && (
            <p className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              You&apos;re playing as a guest. Linking a Google account keeps your
              ratings, history and level — nothing is lost.
            </p>
          )}
        </Card>

        <Card id="appearance" className="border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Palette className="h-5 w-5 text-primary" aria-hidden />
            Appearance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Theme</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["dark", "light", "system"] as ThemeChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => chooseTheme(choice)}
                aria-pressed={theme === choice}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  theme === choice
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {theme === choice && <Check className="h-3.5 w-3.5" aria-hidden />}
                {choice}
              </button>
            ))}
          </div>
        </Card>

        <Card id="accessibility" className="border-border bg-card p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Accessibility className="h-5 w-5 text-primary" aria-hidden />
            Accessibility
          </h2>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-foreground">Reduce motion</span>
              <span className="block text-xs text-muted-foreground">
                Turns off card dealing, throws and other animations.
              </span>
            </span>
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={toggleMotion}
              className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary"
            />
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            Your system setting is respected automatically; this forces it on.
          </p>
        </Card>

        <AudioSettings />

        <GameplaySettings />

        {/* Sections that exist in the design but not yet in the product. Listed
            plainly rather than shown as controls that would do nothing. */}
        <Card className="border-dashed border-border bg-card/50 p-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Not built yet
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {SECTIONS.filter(
              (s) =>
                !["account", "appearance", "accessibility", "audio", "gameplay"].includes(s.id),
            ).map(
              ({ id, label, icon: Icon }) => (
                <li key={id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </li>
              ),
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Notifications and privacy need the friends system.
          </p>
        </Card>
      </div>

      {!user && (
        <div className="mt-6 text-center">
          <Button variant="outline">Sign in to change account settings</Button>
        </div>
      )}
    </div>
  );
}

/**
 * Volume controls, wired to the live mixer.
 *
 * Every change plays a sound on the bus being changed — a volume slider you
 * cannot hear is guesswork, and it doubles as proof the audio system is awake.
 */
function AudioSettings() {
  const { mixer, hydrated, hydrate, setMaster, setVolume, setMuted, toggleBusMuted, play } =
    useAudioStore();

  // The server has no stored mixer, so the first paint has to match the
  // defaults and the real values arrive right after mount.
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Card id="audio" className="border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <Volume2 className="h-5 w-5 text-primary" aria-hidden />
        Audio
      </h2>

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-foreground">Mute everything</span>
          <span className="block text-xs text-muted-foreground">
            Silences the platform without losing your levels.
          </span>
        </span>
        <input
          type="checkbox"
          checked={mixer.muted}
          onChange={(e) => setMuted(e.target.checked)}
          className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary"
        />
      </label>

      <div className="mt-5 space-y-4">
        <VolumeSlider
          label="Master"
          value={mixer.master}
          disabled={mixer.muted}
          onChange={(v) => setMaster(v)}
          onCommit={() => play("ui.click")}
        />

        {AUDIO_BUSES.map((bus) => (
          <VolumeSlider
            key={bus}
            label={BUS_LABELS[bus]}
            value={mixer.volumes[bus]}
            disabled={mixer.muted || mixer.mutedBuses.includes(bus)}
            muted={mixer.mutedBuses.includes(bus)}
            onToggleMute={() => toggleBusMuted(bus)}
            onChange={(v) => setVolume(bus, v)}
            onCommit={() => play(bus === "music" ? "ui.notify" : "ui.click")}
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {hydrated
          ? "Sounds are generated in the browser, so there is nothing to download and nothing plays until you interact with the page."
          : "Loading your levels\u2026"}
      </p>
    </Card>
  );
}

function VolumeSlider({
  label,
  value,
  disabled = false,
  muted = false,
  onChange,
  onCommit,
  onToggleMute,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  muted?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
  onToggleMute?: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label
          htmlFor={`vol-${label}`}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="numeric text-xs text-muted-foreground">
            {Math.round(value * 100)}
          </span>
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-pressed={muted}
              aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" aria-hidden />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>
      <input
        id={`vol-${label}`}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        // Preview on release rather than on every step, or dragging the slider
        // fires a click sound per pixel.
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:opacity-40"
      />
    </div>
  );
}

const GAMEPLAY_COPY: Array<{
  key: keyof GameplayPrefs;
  label: string;
  hint: string;
}> = [
  {
    key: "showLegalMoves",
    label: "Show legal moves",
    hint: "Chess: dots on empty squares you can move to, rings on pieces you can take.",
  },
  {
    key: "highlightLastMove",
    label: "Highlight the last move",
    hint: "Chess: tints the two squares the previous move used.",
  },
  {
    key: "autoQueen",
    label: "Always promote to a queen",
    hint: "Chess: skips the promotion picker. Turn this off to underpromote.",
  },
  {
    key: "sortUnoHand",
    label: "Sort my UNO hand",
    hint: "Groups your cards by colour instead of leaving them in the order they were dealt.",
  },
];

/** Preferences that change how a game plays, as opposed to how it looks. */
function GameplaySettings() {
  const { prefs, hydrate, toggle } = useGameplayStore();
  const play = useAudioStore((s) => s.play);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Card id="gameplay" className="border-border bg-card p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <Gamepad2 className="h-5 w-5 text-primary" aria-hidden />
        Gameplay
      </h2>

      <div className="mt-4 space-y-4">
        {GAMEPLAY_COPY.map(({ key, label, hint }) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={() => {
                toggle(key);
                play("ui.click");
              }}
              className="h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary"
            />
          </label>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Board colours and piece sets are changed beside the board while you play, not here.
      </p>
    </Card>
  );
}
