import { themes } from "@playora/ui";

/*
 * The Playora gem for the generated images (Apple touch icon, Open Graph
 * card). The same four facets as `BrandMark` in components/shell/brand.tsx,
 * drawn here as plain SVG because these images are rendered by `next/og`,
 * which takes inline styles and SVG rather than Tailwind classes.
 *
 * Colours come from the dark theme's tokens, so the icon, the card and the
 * app agree: a light gem on the brand violet, the violet running from the
 * hover shade to the pressed one.
 */

const dark = themes.dark;

export const BRAND = {
  tileFrom: dark["primary-hover"],
  tileTo: dark["primary-pressed"],
  gem: dark.foreground,
  page: dark.background,
  surface: dark.surface,
  card: dark.card,
  text: dark.foreground,
  muted: dark["muted-foreground"],
  accent: dark["primary-accent"],
  secondary: dark.secondary,
  border: dark.border,
} as const;

/** The gem alone, on a 32-unit grid, in `color`. */
export function GemSvg({ size, color = BRAND.gem }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M16 4L28 13L16 28L4 13L16 4Z" fill={color} fillOpacity="0.3" />
      <path d="M16 4L28 13L16 19L4 13L16 4Z" fill={color} fillOpacity="0.95" />
      <path d="M16 19L28 13L16 28Z" fill={color} fillOpacity="0.6" />
      <path d="M16 19L4 13L16 28Z" fill={color} fillOpacity="0.45" />
    </svg>
  );
}

/** The gem on its violet tile, `size` square, corners at `radius`. */
export function BrandTile({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(135deg, ${BRAND.tileFrom}, ${BRAND.tileTo})`,
      }}
    >
      <GemSvg size={Math.round(size * 0.66)} />
    </div>
  );
}
