/**
 * Board colourways.
 *
 * Each theme sets the two square colours plus the highlight tints that sit on
 * top of them. Highlights are defined per theme rather than globally because a
 * yellow that reads clearly on wood disappears on a green tournament board.
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
    light: "#3E4A6B",
    dark: "#232A42",
    lastMove: "rgba(108,93,211,0.45)",
    selected: "rgba(108,93,211,0.65)",
    legal: "rgba(255,255,255,0.30)",
    capture: "rgba(239,68,68,0.75)",
    check: "rgba(239,68,68,0.55)",
    coordLight: "rgba(255,255,255,0.55)",
    coordDark: "rgba(255,255,255,0.40)",
  },
  {
    id: "wood",
    label: "Wood",
    light: "#E8CFA3",
    dark: "#9C6B43",
    lastMove: "rgba(226,169,46,0.55)",
    selected: "rgba(226,169,46,0.75)",
    legal: "rgba(60,40,20,0.32)",
    capture: "rgba(180,30,30,0.75)",
    check: "rgba(200,40,40,0.6)",
    coordLight: "rgba(80,50,25,0.7)",
    coordDark: "rgba(255,240,215,0.75)",
  },
  {
    id: "forest",
    label: "Forest",
    light: "#EDEED3",
    dark: "#779455",
    lastMove: "rgba(246,234,110,0.6)",
    selected: "rgba(246,234,110,0.8)",
    legal: "rgba(40,60,30,0.28)",
    capture: "rgba(190,40,40,0.75)",
    check: "rgba(210,50,50,0.6)",
    coordLight: "rgba(70,90,50,0.75)",
    coordDark: "rgba(240,245,220,0.8)",
  },
  {
    id: "ocean",
    label: "Ocean",
    light: "#DEE9F2",
    dark: "#5A87B5",
    lastMove: "rgba(56,189,248,0.5)",
    selected: "rgba(56,189,248,0.7)",
    legal: "rgba(20,45,70,0.28)",
    capture: "rgba(220,60,60,0.75)",
    check: "rgba(230,60,60,0.6)",
    coordLight: "rgba(40,70,105,0.7)",
    coordDark: "rgba(235,245,255,0.8)",
  },
  {
    id: "slate",
    label: "Slate",
    light: "#C9CBD1",
    dark: "#6E7280",
    lastMove: "rgba(108,93,211,0.5)",
    selected: "rgba(108,93,211,0.7)",
    legal: "rgba(30,32,38,0.3)",
    capture: "rgba(210,55,55,0.75)",
    check: "rgba(225,60,60,0.6)",
    coordLight: "rgba(50,52,60,0.7)",
    coordDark: "rgba(245,246,250,0.8)",
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
