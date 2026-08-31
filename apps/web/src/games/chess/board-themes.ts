/**
 * Board colourways.
 *
 * Each theme sets the two square colours plus the highlight tints that sit on
 * top of them. Highlights are defined per theme rather than globally.
 */
export interface BoardTheme {
  id: string;
  label: string;
  light: string;
  dark: string;
  /** Squares of the move just played. */
  lastMove: string;
  /** The square a player has selected. */
  selected: string;
  /** Dot marking a legal destination. */
  legal: string;
  /** Ring marking a capturable piece. */
  capture: string;
  /** Glow behind a king in check. */
  check: string;
  /** Coordinate labels drawn on the board edge. */
  coordLight: string;
  coordDark: string;
}

export const BOARD_THEMES: readonly BoardTheme[] = [
  {
    id: "midnight",
    label: "Midnight",
    light: "#3A4466",
    dark: "#1E2438",
    lastMove: "rgba(124, 58, 237, 0.45)",
    selected: "rgba(124, 58, 237, 0.7)",
    legal: "rgba(255, 255, 255, 0.35)",
    capture: "rgba(239, 68, 68, 0.8)",
    check: "rgba(239, 68, 68, 0.65)",
    coordLight: "rgba(255, 255, 255, 0.65)",
    coordDark: "rgba(255, 255, 255, 0.45)",
  },
  {
    id: "wood",
    label: "Walnut",
    light: "#EAD7B2",
    dark: "#A66D38",
    lastMove: "rgba(245, 183, 0, 0.55)",
    selected: "rgba(245, 183, 0, 0.75)",
    legal: "rgba(70, 45, 20, 0.35)",
    capture: "rgba(200, 30, 30, 0.8)",
    check: "rgba(220, 38, 38, 0.65)",
    coordLight: "#7A4D20",
    coordDark: "#F7EAD0",
  },
  {
    id: "emerald",
    label: "Tournament",
    light: "#FFFFDD",
    dark: "#86A666",
    lastMove: "rgba(245, 230, 90, 0.6)",
    selected: "rgba(245, 230, 90, 0.8)",
    legal: "rgba(40, 65, 25, 0.35)",
    capture: "rgba(220, 38, 38, 0.8)",
    check: "rgba(220, 38, 38, 0.65)",
    coordLight: "#6B874B",
    coordDark: "#FFFFE8",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    light: "#2D1B4E",
    dark: "#130924",
    lastMove: "rgba(0, 240, 255, 0.5)",
    selected: "rgba(255, 0, 128, 0.65)",
    legal: "rgba(0, 240, 255, 0.45)",
    capture: "rgba(255, 0, 128, 0.85)",
    check: "rgba(255, 0, 80, 0.75)",
    coordLight: "#00F0FF",
    coordDark: "#A855F7",
  },
  {
    id: "marble",
    label: "Marble",
    light: "#E5E7EB",
    dark: "#374151",
    lastMove: "rgba(59, 130, 246, 0.5)",
    selected: "rgba(59, 130, 246, 0.75)",
    legal: "rgba(17, 24, 39, 0.35)",
    capture: "rgba(239, 68, 68, 0.8)",
    check: "rgba(239, 68, 68, 0.65)",
    coordLight: "#4B5563",
    coordDark: "#F3F4F6",
  },
  {
    id: "ocean",
    label: "Ocean",
    light: "#DCEBF7",
    dark: "#4B7EAE",
    lastMove: "rgba(14, 165, 233, 0.55)",
    selected: "rgba(14, 165, 233, 0.75)",
    legal: "rgba(15, 45, 80, 0.35)",
    capture: "rgba(225, 29, 72, 0.8)",
    check: "rgba(225, 29, 72, 0.65)",
    coordLight: "#335E8A",
    coordDark: "#EDF5FC",
  },
  {
    id: "crimson",
    label: "Crimson",
    light: "#E8B4B8",
    dark: "#8C2D38",
    lastMove: "rgba(251, 146, 60, 0.55)",
    selected: "rgba(251, 146, 60, 0.75)",
    legal: "rgba(70, 15, 20, 0.35)",
    capture: "rgba(255, 255, 255, 0.85)",
    check: "rgba(254, 202, 202, 0.75)",
    coordLight: "#6B1D25",
    coordDark: "#FDE8EA",
  },
  {
    id: "slate",
    label: "Slate",
    light: "#9CA3AF",
    dark: "#4B5563",
    lastMove: "rgba(99, 102, 241, 0.55)",
    selected: "rgba(99, 102, 241, 0.75)",
    legal: "rgba(17, 24, 39, 0.4)",
    capture: "rgba(239, 68, 68, 0.8)",
    check: "rgba(239, 68, 68, 0.65)",
    coordLight: "#374151",
    coordDark: "#F9FAFB",
  },
] as const;

export const DEFAULT_THEME_ID = "midnight";

export function themeById(id: string): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]!;
}

/** Material value, for the captured-pieces advantage readout. */
export const PIECE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
