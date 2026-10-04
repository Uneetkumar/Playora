"use client";

import * as React from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@playora/ui";
import {
  Gamepad2,
  LogIn,
  LogOut,
  Mic,
  Monitor,
  MousePointerClick,
  Music,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Sun,
  User,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { AUDIO_BUSES, BUS_LABELS, type AudioBus } from "@playora/audio";
import { useAudioStore } from "../../lib/store/audio-store";
import { useGameplayStore, type GameplayPrefs } from "../../lib/store/gameplay-store";
import { useAuthStore } from "../../lib/store/auth-store";
import {
  applyReduceMotion,
  applyTheme,
  readStoredReduceMotion,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "../../lib/theme";
import { useResolvedTheme } from "../../components/shell/use-shell-prefs";
import { BOARD_THEMES, themeById } from "../../games/chess/board-themes";
import { ChessPiece, PIECE_SETS, type PieceSetId } from "../../games/chess/pieces";
import { useBoardPrefs } from "../../games/chess/use-board-prefs";
import { GoogleMark } from "../../components/auth/google-mark";
import { PageContainer, PageHeader } from "../../components/page/page-header";

/**
 * Settings.
 *
 * Four groups, in the order people come looking: how it looks, how it
 * sounds, how games behave, then the account. Every control is wired to
 * something that reads it; settings that exist in the design but not in the
 * product (notifications, privacy) are named once at the bottom rather than
 * drawn as switches that do nothing. Changes apply and save immediately.
 */

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
  { id: "account", label: "Account", icon: User },
];

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<SettingsIcon />}
        title="Settings"
        description="Changes apply and save as you make them; there is no save button to forget."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <SectionNav />
        <div className="min-w-0 max-w-3xl space-y-6">
          <AppearanceSettings />
          <AudioSettings />
          <GameplaySettings />
          <AccountSettings />
          <p className="px-1 text-xs text-muted-foreground">
            Notification and privacy settings arrive with presence and invites; there is nothing to
            configure for them yet.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

/** Jump links: a scrolling row on a phone, a sticky column from lg. */
function SectionNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0 lg:sticky lg:top-[calc(var(--shell-header-h,4rem)+2rem)] lg:self-start"
    >
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-hover ease-out-expo hover:text-foreground lg:rounded-lg lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:hover:bg-foreground/[0.06]"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <Card className="p-0">
        <header className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-accent"
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h2 id={`${id}-heading`} className="font-display text-lg font-bold text-foreground">
              {title}
            </h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </header>
        <div className="divide-y divide-border">{children}</div>
      </Card>
    </section>
  );
}

/**
 * One setting: what it is on the left, the control on the right. `htmlFor`
 * makes the label click through to a Switch; `stack` puts a wide control
 * (a slider, a segmented control on a phone) under the text instead.
 *
 * By default the control drops under the text on a phone, where a button or
 * a segmented control has no room beside it. A Switch is narrow enough to
 * stay on the right at every width, as it does in a phone's own settings, so
 * switch rows pass `inline`.
 */
function SettingRow({
  label,
  description,
  htmlFor,
  labelId,
  stack = false,
  inline = false,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  labelId?: string;
  stack?: boolean;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 px-5 py-4 sm:px-6",
        stack
          ? "flex-col"
          : inline
            ? "flex-row items-center justify-between gap-4 sm:gap-6"
            : "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      )}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <label
            htmlFor={htmlFor}
            id={labelId}
            className="block cursor-pointer text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : (
          <p id={labelId} className="text-sm font-medium text-foreground">
            {label}
          </p>
        )}
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ───────────────────────────── Appearance ───────────────────────────── */

const THEME_OPTIONS: Array<{ id: ThemeChoice; label: string; icon: LucideIcon }> = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
];

function AppearanceSettings() {
  const [theme, setTheme] = React.useState<ThemeChoice>("dark");
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [osReduced, setOsReduced] = React.useState(false);
  // The sidebar's theme switch can change the theme while this page is open;
  // re-reading the saved choice whenever the theme on screen changes keeps
  // this control from showing a stale answer.
  const resolved = useResolvedTheme();

  React.useEffect(() => {
    setTheme(readStoredTheme());
  }, [resolved]);

  React.useEffect(() => {
    setReduceMotion(readStoredReduceMotion());
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setOsReduced(query.matches);
    const onChange = () => setOsReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const chooseTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    applyTheme(choice);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      /* storage unavailable: the theme lasts for this page only */
    }
  };

  const toggleMotion = (on: boolean) => {
    setReduceMotion(on);
    applyReduceMotion(on);
  };

  return (
    <SettingsSection id="appearance" icon={Palette} title="Appearance">
      <SettingRow
        label="Theme"
        labelId="theme-label"
        description="System follows your device, and switches with it."
      >
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(v) => v && chooseTheme(v as ThemeChoice)}
          aria-labelledby="theme-label"
          className="w-full sm:w-auto"
        >
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <ToggleGroupItem key={id} value={id} className="flex-1 sm:flex-none">
              <Icon aria-hidden />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SettingRow>

      <SettingRow
        label="Reduce motion"
        htmlFor="reduce-motion"
        inline
        description={
          osReduced
            ? "Your device already asks for reduced motion, and Playora follows it whatever this is set to."
            : "Turns off card dealing, hover previews, carousel auto-advance and other movement."
        }
      >
        <Switch
          id="reduce-motion"
          checked={reduceMotion || osReduced}
          disabled={osReduced}
          onCheckedChange={toggleMotion}
        />
      </SettingRow>
    </SettingsSection>
  );
}

/* ───────────────────────────────── Audio ─────────────────────────────── */

/**
 * Volume controls, wired to the live mixer.
 *
 * Releasing a slider plays a sound on the bus being changed — a volume slider
 * you cannot hear is guesswork, and it doubles as proof the audio system is
 * awake. On release rather than per step, or dragging fires a click per pixel.
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
    <SettingsSection
      id="audio"
      icon={Volume2}
      title="Audio"
      description="Sounds are made in the browser: nothing to download, and nothing plays until you interact."
    >
      <SettingRow
        label="Mute everything"
        htmlFor="mute-all"
        inline
        description="Silences Playora without losing your levels."
      >
        <Switch
          id="mute-all"
          checked={mixer.muted}
          onCheckedChange={setMuted}
          disabled={!hydrated}
        />
      </SettingRow>

      <div className="space-y-1 px-5 py-3 sm:px-6">
        <VolumeRow
          id="vol-master"
          label="Master"
          icon={Volume2}
          value={mixer.master}
          disabled={!hydrated || mixer.muted}
          onChange={setMaster}
          onCommit={() => play("ui.click")}
        />
        {AUDIO_BUSES.map((bus) => (
          <VolumeRow
            key={bus}
            id={`vol-${bus}`}
            label={BUS_LABELS[bus]}
            icon={BUS_ICONS[bus]}
            value={mixer.volumes[bus]}
            disabled={!hydrated || mixer.muted || mixer.mutedBuses.includes(bus)}
            muted={mixer.mutedBuses.includes(bus)}
            onToggleMute={() => toggleBusMuted(bus)}
            onChange={(v) => setVolume(bus, v)}
            onCommit={() => play(commitSound(bus))}
          />
        ))}
      </div>
    </SettingsSection>
  );
}

const BUS_ICONS: Record<AudioBus, LucideIcon> = {
  music: Music,
  sfx: Gamepad2,
  ui: MousePointerClick,
  voice: Mic,
};

function commitSound(bus: AudioBus) {
  return bus === "music" ? "ui.notify" : "ui.click";
}

function VolumeRow({
  id,
  label,
  icon: Icon,
  value,
  disabled = false,
  muted = false,
  onChange,
  onCommit,
  onToggleMute,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  value: number;
  disabled?: boolean;
  muted?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
  onToggleMute?: () => void;
}) {
  const pct = Math.round(value * 100);
  // Phone: name, value and mute on one line, the slider full width under them.
  // From sm: one line each, in name / slider / value / mute columns.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)_3rem_2.5rem]">
      <span
        id={`${id}-label`}
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
        {label}
      </span>
      <span className="font-mono-num text-right text-xs text-muted-foreground sm:order-3">
        {muted ? "Off" : pct}
      </span>
      <span className="flex justify-end sm:order-4">
        {onToggleMute && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                // Fills its 40px column on a phone; the compact 32px from `sm`.
                className="sm:h-8 sm:w-8"
                onClick={onToggleMute}
                aria-pressed={muted}
                aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
              >
                {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{muted ? `Unmute ${label}` : `Mute ${label}`}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <Slider
        aria-labelledby={`${id}-label`}
        className="col-span-3 sm:order-2 sm:col-span-1"
        min={0}
        max={100}
        step={1}
        value={[pct]}
        disabled={disabled}
        onValueChange={([v]) => onChange((v ?? 0) / 100)}
        onValueCommit={onCommit}
      />
    </div>
  );
}

/* ─────────────────────────────── Gameplay ────────────────────────────── */

const GAMEPLAY_COPY: Array<{
  key: keyof GameplayPrefs;
  game: "Chess" | "UNO";
  label: string;
  hint: string;
}> = [
  {
    key: "showLegalMoves",
    game: "Chess",
    label: "Show legal moves",
    hint: "Dots on empty squares you can move to, rings on pieces you can take.",
  },
  {
    key: "highlightLastMove",
    game: "Chess",
    label: "Highlight the last move",
    hint: "Tints the two squares the previous move used.",
  },
  {
    key: "autoQueen",
    game: "Chess",
    label: "Always promote to a queen",
    hint: "Skips the promotion picker. Turn this off to underpromote.",
  },
  {
    key: "sortUnoHand",
    game: "UNO",
    label: "Sort my UNO hand",
    hint: "Groups your cards by colour instead of the order they were dealt.",
  },
];

/** Preferences that change how a game plays, as opposed to how it looks. */
function GameplaySettings() {
  const { prefs, hydrated, hydrate, toggle } = useGameplayStore();
  const play = useAudioStore((s) => s.play);
  const board = useBoardPrefs();

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <SettingsSection
      id="gameplay"
      icon={Gamepad2}
      title="Gameplay"
      description="Saved on this device, so a phone and a desk can differ."
    >
      {GAMEPLAY_COPY.map(({ key, game, label, hint }) => (
        <SettingRow
          key={key}
          htmlFor={`pref-${key}`}
          inline
          label={
            <span className="flex items-center gap-2">
              {label}
              <Badge variant="secondary" className="px-2 text-[10px]">
                {game}
              </Badge>
            </span>
          }
          description={hint}
        >
          <Switch
            id={`pref-${key}`}
            checked={prefs[key]}
            disabled={!hydrated}
            onCheckedChange={() => {
              toggle(key);
              play("ui.click");
            }}
          />
        </SettingRow>
      ))}

      <div className="flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-start sm:px-6">
        <BoardPreview themeId={board.themeId} pieceSet={board.pieceSet} />
        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label id="board-theme-label" className="text-sm font-medium text-foreground">
              Chess board
            </label>
            <Select value={board.themeId} onValueChange={board.chooseTheme}>
              <SelectTrigger aria-labelledby="board-theme-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_THEMES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2.5">
                      <span
                        className="grid h-4 w-4 shrink-0 grid-cols-2 overflow-hidden rounded-sm ring-1 ring-border"
                        aria-hidden
                      >
                        <span style={{ background: t.light }} />
                        <span style={{ background: t.dark }} />
                        <span style={{ background: t.dark }} />
                        <span style={{ background: t.light }} />
                      </span>
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label id="piece-set-label" className="text-sm font-medium text-foreground">
              Chess pieces
            </label>
            <Select
              value={board.pieceSet}
              onValueChange={(v) => board.choosePieceSet(v as PieceSetId)}
            >
              <SelectTrigger aria-labelledby="piece-set-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIECE_SETS.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The same choices are beside the board while you play; either place changes both.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}

/** A corner of a board in the chosen colours and set, so the choice is seen, not imagined. */
function BoardPreview({ themeId, pieceSet }: { themeId: string; pieceSet: PieceSetId }) {
  const theme = themeById(themeId);
  const pieces: Record<number, { type: "n" | "q" | "p"; color: "w" | "b" }> = {
    1: { type: "q", color: "b" },
    6: { type: "n", color: "w" },
    9: { type: "p", color: "w" },
    10: { type: "p", color: "b" },
  };
  return (
    <div
      className="grid h-24 w-24 shrink-0 grid-cols-4 overflow-hidden rounded-lg shadow-card ring-1 ring-border"
      aria-hidden
    >
      {Array.from({ length: 16 }, (_, i) => {
        const light = (Math.floor(i / 4) + i) % 2 === 0;
        const piece = pieces[i];
        return (
          <span
            key={i}
            className="relative p-0.5"
            style={{ background: light ? theme.light : theme.dark }}
          >
            {piece && <ChessPiece type={piece.type} color={piece.color} set={pieceSet} />}
          </span>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────── Account ────────────────────────────── */

function AccountSettings() {
  const { user, isLoading, isConfigured, signOut, linkGoogleAccount } = useAuthStore();

  return (
    <SettingsSection id="account" icon={User} title="Account">
      {isLoading ? (
        <div className="px-5 py-4 text-sm text-muted-foreground sm:px-6">
          Checking your account…
        </div>
      ) : user ? (
        <>
          <SettingRow label="Display name">
            <span className="text-sm text-foreground">{user.displayName}</span>
          </SettingRow>
          <SettingRow label="Username">
            <span className="font-mono-num text-sm text-muted-foreground">@{user.username}</span>
          </SettingRow>
          <SettingRow
            label="Account type"
            description={
              user.isGuest
                ? "Linking Google keeps your ratings, history and level; nothing is lost."
                : "Signed in with Google."
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={user.isGuest ? "warning" : "success"}>
                {user.isGuest ? "Guest" : "Google"}
              </Badge>
              {user.isGuest && (
                <Button size="sm" onClick={() => void linkGoogleAccount()}>
                  <GoogleMark className="h-4 w-4" />
                  Link Google
                </Button>
              )}
            </div>
          </SettingRow>
          <SettingRow label="Sign out" description="Your progress stays on the account.">
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </SettingRow>
        </>
      ) : (
        <SettingRow
          label="Not signed in"
          description={
            isConfigured
              ? "Sign in, or play as a guest, to keep ratings, history and achievements."
              : "Accounts are not set up on this copy of Playora. Everything on this page still works."
          }
        >
          {isConfigured && (
            <Button asChild size="sm">
              <Link href="/login?next=/settings">
                <LogIn className="h-4 w-4" aria-hidden />
                Sign in
              </Link>
            </Button>
          )}
        </SettingRow>
      )}
    </SettingsSection>
  );
}
