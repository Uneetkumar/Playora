/**
 * Playora design tokens — the single source of truth for colour, type, spacing,
 * radius, elevation and motion.
 *
 * The design brief is explicit: "Use centralized design tokens rather than
 * hard-coded values." Anything that needs a colour reads it from here (or from
 * the CSS variables generated from these values), never as a literal.
 */

/** Brand palette, as authored in the design pack. */
export const palette = {
  primary: "#6C5DD3", // purple — primary actions, brand
  blue: "#38BDF8", // electric blue — secondary accent
  cyan: "#22D3EE", // utility accent, info
  pink: "#FF4D8D", // social and reward moments
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  backgroundDark: "#0D0E14",
  cardDark: "#151722",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
} as const;

/**
 * The same values as HSL triplets, for CSS custom properties.
 * Tailwind consumes these as `hsl(var(--token))` so opacity modifiers work.
 */
export const hslTokens = {
  primary: "248 57% 60%",
  blue: "198 93% 60%",
  cyan: "188 86% 53%",
  pink: "338 100% 65%",
  success: "142 71% 45%",
  warning: "38 92% 50%",
  danger: "0 84% 60%",
  background: "232 21% 6%",
  surface: "231 24% 11%",
  surfaceElevated: "230 22% 15%",
  border: "230 18% 20%",
  textPrimary: "0 0% 100%",
  textSecondary: "240 5% 65%",
} as const;

/** 8px grid (design brief: "Spacing: 8px grid system"). */
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  "3xl": "64px",
} as const;

/** "Radius: 12px / 16px for modern cards & buttons". */
export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
} as const;

export const typography = {
  /** Geometric display face for headings and big numbers. */
  display: "var(--font-display), Poppins, system-ui, sans-serif",
  /** Highly readable UI face for body text. */
  body: "var(--font-body), Inter, system-ui, sans-serif",
  scale: {
    display: "clamp(2.5rem, 6vw, 4.5rem)",
    h1: "clamp(2rem, 4vw, 3rem)",
    h2: "clamp(1.5rem, 3vw, 2rem)",
    h3: "1.25rem",
    body: "1rem",
    label: "0.875rem",
    caption: "0.75rem",
  },
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

/** Restrained depth: controlled glow, not neon bloom. */
export const elevation = {
  card: "0 1px 2px rgb(0 0 0 / 0.4)",
  raised: "0 8px 24px -8px rgb(0 0 0 / 0.6)",
  overlay: "0 24px 48px -12px rgb(0 0 0 / 0.7)",
  glowPrimary: "0 0 24px -4px rgb(108 93 211 / 0.45)",
  glowSuccess: "0 0 24px -4px rgb(34 197 94 / 0.35)",
} as const;

/** Fast and purposeful; every consumer must respect prefers-reduced-motion. */
export const motion = {
  instant: "80ms",
  fast: "150ms",
  base: "220ms",
  slow: "360ms",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
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

export type PaletteToken = keyof typeof palette;
