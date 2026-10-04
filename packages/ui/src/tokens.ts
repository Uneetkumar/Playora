/**
 * Playora design tokens — the single source of truth for colour, type, spacing,
 * radius, elevation and motion. docs/DESIGN_SYSTEM.md explains how to use them.
 *
 * The design brief is explicit: "Use centralized design tokens rather than
 * hard-coded values." Components reach colour through Tailwind classes backed
 * by CSS variables (`bg-card`, `text-muted-foreground`, `bg-play`); this file
 * is where those variables' values are decided.
 *
 * apps/web/src/app/globals.css is not generated from this file — it mirrors it
 * by hand. `cssVariables()` at the bottom renders exactly the declarations the
 * CSS should contain, so drift is one diff away from being caught; the command
 * is in the comment at the top of globals.css. apps/web/tailwind.config.ts
 * imports the non-colour scales (radius, type, z-index) from here directly.
 *
 * Deliberately dependency-free, so the Tailwind config loader and plain Node
 * (with type stripping) can both import it without pulling in React.
 */

/* -------------------------------------------------------------------------- */
/* Colour                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Brand palette as authored, dark-first. JS consumers that cannot read CSS
 * variables — canvas, three.js, generated OG images — take colours from here.
 */
export const palette = {
  // Surfaces, darkest to lightest.
  background: "#0B0C12",
  /** Chrome: sidebar, header, bottom nav. Between page and card on purpose. */
  surface: "#101119",
  card: "#161824",
  /** Floating surfaces (menus, popovers, toasts) and the muted fill. */
  raised: "#1E2130",
  border: "#2A2E40",

  // Text, strongest to weakest.
  foreground: "#F4F5FA",
  mutedForeground: "#A3A8BC",
  /**
   * Tertiary ink. 4:1 on the page and 3.3:1 on raised surfaces, so it is for
   * disabled and decorative text only: anything a player needs to read uses
   * `mutedForeground`. Still 3:1 or better on every surface, so it can draw a
   * control's edge or an "off" track.
   */
  subtleForeground: "#6B7088",

  // Brand violet. As a fill it is `primary`; as text on a dark surface it
  // measures too dark to read comfortably, so text uses `primaryText`.
  primary: "#7C6CF2",
  primaryHover: "#8E80FF",
  primaryPressed: "#6656E0",
  primaryText: "#A79BFF",

  cyan: "#22D3EE",

  /**
   * Launch green, for the single primary Play action on a screen — the
   * convention Steam, Xbox and Chess.com share. Not a success colour; using it
   * for anything else teaches players that green buttons are not the game.
   */
  play: "#3DDC84",
  playForeground: "#06210F",

  destructive: "#F04452",
  warning: "#F5A524",
  success: "#22C55E",

  /** Legacy social/reward accent. Kept because existing screens use it. */
  pink: "#FF4D8D",

  /** Dark-theme destructive as *text* on a destructive tint: #F04452 is 4.1:1 there. */
  destructiveText: "#FF6B76",

  white: "#FFFFFF",
} as const;

// The catalogue's TOP and HOT colours, which dark theme also uses for rewards
// and streaks (see `reward` below). `badgeColors` reads the same constants.
const badgeTop = "#FBBF24";
const badgeHot = "#FF5A3C";

/**
 * Every themed colour, keyed by its CSS variable name (without the `--`).
 *
 * shadcn's names are kept as-is (`card`, `popover`, `muted`, `accent`...) so
 * shadcn components drop in unmodified. `primary-accent` predates this file
 * and means "primary as text"; it is kept under that name because about fifty
 * call sites use `text-primary-accent`.
 */
const dark = {
  background: palette.background,
  foreground: palette.foreground,
  surface: palette.surface,
  "surface-foreground": palette.foreground,
  card: palette.card,
  "card-foreground": palette.foreground,
  raised: palette.raised,
  popover: palette.raised,
  "popover-foreground": palette.foreground,
  primary: palette.primary,
  // The page ink, not white. White on #7C6CF2 is 3.97:1, and a 14px or 16px
  // semibold button label is not WCAG "large text" (that starts at 18.66px
  // bold), so it needs 4.5:1. Dark ink gives 4.91:1 at rest and 6.21:1 on
  // the hover fill. See DESIGN_SYSTEM.md "Contrast".
  "primary-foreground": palette.background,
  "primary-hover": palette.primaryHover,
  "primary-pressed": palette.primaryPressed,
  "primary-accent": palette.primaryText,
  secondary: palette.cyan,
  "secondary-foreground": palette.background,
  muted: palette.raised,
  "muted-foreground": palette.mutedForeground,
  "subtle-foreground": palette.subtleForeground,
  accent: palette.cyan,
  "accent-foreground": palette.background,
  play: palette.play,
  "play-foreground": palette.playForeground,
  destructive: palette.destructive,
  // Dark ink for the same reason as primary: white on #F04452 is 3.71:1, dark
  // ink 5.26:1.
  "destructive-foreground": palette.background,
  success: palette.success,
  "success-foreground": palette.background,
  warning: palette.warning,
  "warning-foreground": palette.background,
  /*
   * Status colours as *text on their own 15% tint* (status badges, rating
   * deltas). The tint lowers the contrast the plain colour has on the page,
   * so each gets an ink that still clears 4.5:1 on the tint over card,
   * raised and page. In dark only destructive needs a lighter one.
   */
  "success-ink": palette.success,
  "warning-ink": palette.warning,
  "destructive-ink": palette.destructiveText,
  /*
   * Gold and flame for rewards and streaks on page surfaces: a best-score
   * trophy, earned stars, a combo counter. Not the catalogue badge colours,
   * which stay the same in both themes because they sit on cover art; on a
   * white card that gold is 1.7:1 and disappears.
   */
  reward: badgeTop,
  /** Reward as text on its own 15% tint (the lobby's Host chip). */
  "reward-ink": badgeTop,
  streak: badgeHot,
  pink: palette.pink,
  border: palette.border,
  input: palette.border,
  ring: palette.primary,
} as const;

/**
 * Light is designed, not an inverted dark. Every text colour here measures at
 * least 4.5:1 on the page (#F6F7FB) and on white, and every label on a fill
 * at least 4.5:1 on that fill. The one exception is the legacy `pink` (4.1:1),
 * kept only for the screens that already use it. DESIGN_SYSTEM.md "Contrast"
 * lists the numbers for both themes.
 *
 * Chrome, card and floating surfaces are all white: on a near-white page the
 * border and shadow do the separating, where a grey bar would read as disabled.
 * Hover darkens rather than lightens, mirroring dark.
 */
const light = {
  background: "#F6F7FB",
  foreground: "#12131A",
  surface: "#FFFFFF",
  "surface-foreground": "#12131A",
  card: "#FFFFFF",
  "card-foreground": "#12131A",
  raised: "#FFFFFF",
  popover: "#FFFFFF",
  "popover-foreground": "#12131A",
  primary: "#6656E0",
  "primary-foreground": "#FFFFFF",
  "primary-hover": "#5747D1",
  "primary-pressed": "#4A3BC2",
  "primary-accent": "#5646CF",
  // Bright cyan has no contrast on white, so the light sibling is a deep teal
  // that works both as a fill under white text and as text itself (5:1).
  secondary: "#0E7490",
  "secondary-foreground": "#FFFFFF",
  muted: "#EDEFF5",
  "muted-foreground": "#5A5F73",
  // 5.2:1 on white, 4.9:1 on the page.
  "subtle-foreground": "#676C7F",
  accent: "#0E7490",
  "accent-foreground": "#FFFFFF",
  play: "#1FA463",
  // Dark ink, as in dark theme. White on #1FA463 is 3.21:1, and the Play
  // labels (14px and 16px bold) are not large text. Dark ink is 5.31:1.
  "play-foreground": "#06210F",
  destructive: "#D02A3A",
  "destructive-foreground": "#FFFFFF",
  success: "#15803D",
  "success-foreground": "#FFFFFF",
  warning: "#A05D00",
  "warning-foreground": "#FFFFFF",
  // Each is 5.2:1 or better on its 15% tint over the page or a card.
  "success-ink": "#166534",
  "warning-ink": "#8A4B00",
  "destructive-ink": "#A61E2D",
  // 4.6:1 and 4.8:1 on the page: legible as text, and well past 3:1 as an icon.
  reward: "#A16207",
  // `reward` is 4.0:1 on its own tint, so a chip's words take this: 5.6:1
  // on the tint over a card, 5.3:1 over the page.
  "reward-ink": "#854D0E",
  streak: "#C2410C",
  pink: "#E4256B",
  border: "#E2E5EE",
  // Darker than `border`: an input's edge is its affordance, and #E2E5EE on a
  // white card is all but invisible.
  input: "#C9CEDB",
  ring: "#6656E0",
} satisfies Record<keyof typeof dark, string>;

export const themes = { dark, light } as const;

export type ThemeName = keyof typeof themes;
export type ColorToken = keyof typeof dark;

/**
 * Catalogue badge colours. Theme-independent on purpose: badges sit on cover
 * art, and the art does not change with the theme.
 */
export const badgeColors = {
  live: "#22C55E",
  new: "#22D3EE",
  hot: badgeHot,
  updated: "#A79BFF",
  top: badgeTop,
  soon: "#3A3F55",
  /** Ink for every badge but SOON; each fill gives it at least 6.3:1. */
  foreground: "#0B0C12",
  "soon-foreground": "#E4E6EF",
} as const;

export type BadgeToken = keyof typeof badgeColors;

/**
 * Words laid straight on cover art (a game card's title and meta line) and
 * the scrim under them. Theme-independent for the badges' reason: art is
 * art. A scrim in the page colour turned light theme's covers into a white
 * haze, with dark words fighting whatever showed through it; the dark-theme
 * ink with light words reads the same over any cover in either theme.
 * `muted-foreground` is 8.3:1 on the scrim's own colour.
 */
export const artColors = {
  scrim: palette.background,
  foreground: palette.foreground,
  "muted-foreground": palette.mutedForeground,
} as const;

export type ArtToken = keyof typeof artColors;

/** Round to one decimal and drop a trailing `.0`, as shadcn writes them. */
function fmt(n: number): string {
  const v = Math.round(n * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** `#7C6CF2` → `247.2 83.7% 68.6%`, the bare triplet `hsl(var(--x) / a)` needs. */
export function hexToHslTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  return `${fmt(hue)} ${fmt(s * 100)}% ${fmt(l * 100)}%`;
}

function toTriplets<K extends string>(colors: Record<K, string>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of Object.keys(colors) as K[]) out[key] = hexToHslTriplet(colors[key]);
  return out;
}

/**
 * The same colours as HSL triplets — the form the CSS variables hold, so that
 * Tailwind's `hsl(var(--token) / <alpha-value>)` opacity modifiers work.
 */
export const hslTokens = {
  dark: toTriplets(themes.dark),
  light: toTriplets(themes.light),
  badge: toTriplets(badgeColors),
  art: toTriplets(artColors),
} as const;

/**
 * A themed colour as a CSS value, for inline styles and SVG attributes where a
 * Tailwind class cannot reach. Follows the theme, unlike a hex from `palette`.
 */
export function cssColor(token: ColorToken, alpha?: number): string {
  return alpha === undefined ? `hsl(var(--${token}))` : `hsl(var(--${token}) / ${alpha})`;
}

/* -------------------------------------------------------------------------- */
/* Shape and space                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Radius scale. Keys match Tailwind's (`rounded-xl` is 16px), which the
 * Tailwind config enforces by reading this object.
 */
export const radius = {
  sm: "8px",
  md: "10px",
  lg: "12px",
  xl: "16px",
  "2xl": "20px",
  "3xl": "24px",
  full: "9999px",
} as const;

/** Which radius each kind of thing gets. Say "card", not "16px". */
export const radiusFor = {
  chip: radius.full,
  badge: radius.full,
  button: radius.lg,
  input: radius.lg,
  tile: radius.lg,
  card: radius.xl,
  modal: radius["2xl"],
  sheet: radius["2xl"],
  hero: radius["3xl"],
} as const;

/**
 * 8px grid with a 4px half-step. Keys are Tailwind's spacing keys (`p-4` is
 * 16px), so this doubles as the lookup from a design value to a class.
 */
export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

/** Page rhythm. The comments are the classes that produce each value. */
export const layout = {
  /** `px-4 sm:px-6 lg:px-8` */
  gutter: { mobile: "16px", tablet: "24px", desktop: "32px" },
  /** `gap-10 lg:gap-12` between page sections. */
  sectionGap: { mobile: "40px", desktop: "48px" },
  /** `gap-3 lg:gap-4` between cards in a rail. */
  railGap: { mobile: "12px", desktop: "16px" },
} as const;

/**
 * Breakpoints the brief calls out individually. Mobile sizes are listed
 * separately because layouts are designed for them, not scaled down to them.
 */
export const breakpoints = {
  xs: 320,
  sm: 375,
  smPlus: 390,
  md: 430,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
  wide: 1440,
  ultrawide: 1920,
} as const;

/* -------------------------------------------------------------------------- */
/* Type                                                                        */
/* -------------------------------------------------------------------------- */

export interface TypeStyle {
  size: string;
  lineHeight: string;
  weight: number;
  tracking?: string;
}

export const typography = {
  family: {
    /** Sora: headings, hero titles, big numbers that are art rather than data. */
    display: "var(--font-display), Sora, system-ui, sans-serif",
    /** Inter: everything else. `.numeric` adds tabular figures for scores. */
    body: "var(--font-body), Inter, system-ui, sans-serif",
    /** JetBrains Mono: clocks, room codes, anything read character by character. */
    mono: "var(--font-mono), 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  },
  /** Each becomes a Tailwind `text-*` size carrying its own weight and leading. */
  scale: {
    display: { size: "clamp(2.5rem, 5vw, 4rem)", lineHeight: "1.05", weight: 800, tracking: "-0.02em" },
    h1: { size: "2rem", lineHeight: "2.5rem", weight: 700, tracking: "-0.02em" },
    h2: { size: "1.5rem", lineHeight: "2rem", weight: 700, tracking: "-0.02em" },
    /** Rail and section headers. */
    rail: { size: "1.25rem", lineHeight: "1.75rem", weight: 700, tracking: "-0.01em" },
    "card-title": { size: "0.9375rem", lineHeight: "1.25rem", weight: 700 },
    /** Players, duration, genre: the line under a card title. */
    meta: { size: "0.8125rem", lineHeight: "1.125rem", weight: 500 },
    /** Badge text. Pair with `uppercase`; the size is set for capitals. */
    tag: { size: "0.6875rem", lineHeight: "1rem", weight: 800, tracking: "0.06em" },
  } satisfies Record<string, TypeStyle>,
} as const;

/* -------------------------------------------------------------------------- */
/* Depth                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Shadows, per theme, because the dark values (70% black) are a smear on a
 * light page. They become `--shadow-*` variables; Tailwind's `shadow-card`
 * and `shadow-card-hover` read those, so one class is right in both themes.
 */
export const elevation = {
  dark: {
    card: "0 1px 2px rgb(0 0 0 / 0.4)",
    "card-hover": "0 16px 32px -12px rgb(0 0 0 / 0.7)",
    raised: "0 8px 24px -8px rgb(0 0 0 / 0.6)",
    overlay: "0 24px 48px -12px rgb(0 0 0 / 0.7)",
  },
  light: {
    card: "0 1px 2px rgb(18 19 26 / 0.06), 0 1px 3px rgb(18 19 26 / 0.06)",
    "card-hover": "0 16px 32px -12px rgb(18 19 26 / 0.22)",
    raised: "0 8px 24px -8px rgb(18 19 26 / 0.18)",
    overlay: "0 24px 48px -12px rgb(18 19 26 / 0.28)",
  },
} as const;

/**
 * Per-theme values that are not colours, so a component never has to pick
 * one with `dark:`. A scrim must be heavier over a dark page than a light one
 * to read as a scrim at all. A fill with no hover token of its own (play,
 * destructive) brightens on hover in dark and darkens in light, as primary's
 * hover token does. Read through Tailwind's `bg-scrim` and
 * `hover:brightness-hover`.
 */
export const themeEffects = {
  dark: { "scrim-opacity": "0.7", "hover-brightness": "1.1" },
  light: { "scrim-opacity": "0.4", "hover-brightness": "0.95" },
} as const;

export const zIndex = {
  base: 0,
  dropdown: 20,
  sticky: 30,
  header: 40,
  drawer: 50,
  modal: 60,
  toast: 70,
  tooltip: 80,
} as const;

/* -------------------------------------------------------------------------- */
/* Motion                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * CSS-side motion. The framer-motion side — springs, seconds, variants — is
 * `@playora/animation`, which uses the same numbers; change them together.
 * Everything that moves must also stop moving under reduced motion.
 */
export const motion = {
  duration: {
    /** Press feedback (`active:scale-[.97]`). */
    press: "80ms",
    /** Hover and focus states. The spec allows 180–220ms. */
    hover: "200ms",
    /** Sheets, drawers, dialogs arriving. The spec allows 280–360ms. */
    sheet: "320ms",
    /** The same leaving: exits run a little faster than entrances. */
    sheetExit: "280ms",
  },
  /** easeOutExpo: fast start, long settle. The default for anything arriving. */
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  pressScale: 0.97,
  /**
   * The two reduced-motion sources: the OS query, and the class Settings puts
   * on <html>. @playora/animation declares the same pair (REDUCE_MOTION_CLASS)
   * because neither package may depend on the other; apps/web's
   * lib/__tests__/reduced-motion-sync.test.ts fails if the two drift.
   */
  reducedMotionQuery: "(prefers-reduced-motion: reduce)",
  reduceMotionClass: "reduce-motion",
} as const;

/* -------------------------------------------------------------------------- */
/* CSS mirror                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The custom-property declarations globals.css should hold for a theme, one
 * per line. `dark` is the `:root` block, so it also carries the theme-agnostic
 * variables (badges, art, radius); `light` only overrides what differs.
 */
export function cssVariables(theme: ThemeName): string[] {
  const lines: string[] = [];
  const colors = hslTokens[theme];
  for (const key of Object.keys(colors) as ColorToken[]) {
    lines.push(`--${key}: ${colors[key]};`);
  }
  if (theme === "dark") {
    for (const key of Object.keys(hslTokens.badge) as BadgeToken[]) {
      lines.push(`--badge-${key}: ${hslTokens.badge[key]};`);
    }
    for (const key of Object.keys(hslTokens.art) as ArtToken[]) {
      lines.push(`--art-${key}: ${hslTokens.art[key]};`);
    }
    // shadcn's base radius; Tailwind's scale is fixed from `radius` above.
    lines.push(`--radius: ${radius.lg};`);
  }
  const shadows = elevation[theme];
  for (const key of Object.keys(shadows) as Array<keyof typeof shadows>) {
    lines.push(`--shadow-${key}: ${shadows[key]};`);
  }
  const effects = themeEffects[theme];
  for (const key of Object.keys(effects) as Array<keyof typeof effects>) {
    lines.push(`--${key}: ${effects[key]};`);
  }
  return lines;
}
