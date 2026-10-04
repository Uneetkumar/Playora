import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
/*
 * Imported by relative path rather than from "@playora/ui": the package entry
 * re-exports every React component, which the Tailwind config loader has no
 * business evaluating. tokens.ts is dependency-free for exactly this reason.
 */
import { motion, radius, typography, zIndex } from "../../packages/ui/src/tokens";

/*
 * Colours are `hsl(var(--token))` over the triplets in globals.css, so `/50`
 * style opacity modifiers work and both themes come from one class.
 */
const hsl = (token: string) => `hsl(var(--${token}))`;

/*
 * The per-game accent is a hex a component sets inline (`--game-accent`), so
 * it cannot take Tailwind's opacity modifier; `soft` is the pre-mixed tint to
 * use instead of `bg-game-accent/15`.
 */
const gameAccent = "var(--game-accent, hsl(var(--primary)))";

const fontSize = Object.fromEntries(
  Object.entries(typography.scale).map(([name, style]) => [
    name,
    [
      style.size,
      {
        lineHeight: style.lineHeight,
        fontWeight: String(style.weight),
        ...("tracking" in style ? { letterSpacing: style.tracking } : {}),
      },
    ],
  ]),
) as Record<string, [string, { lineHeight: string; fontWeight: string; letterSpacing?: string }]>;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/*/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/dist/**/*.{js,mjs}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        background: hsl("background"),
        foreground: hsl("foreground"),
        primary: {
          DEFAULT: hsl("primary"),
          foreground: hsl("primary-foreground"),
          hover: hsl("primary-hover"),
          pressed: hsl("primary-pressed"),
          /** Primary as text. See globals.css. */
          accent: hsl("primary-accent"),
        },
        secondary: {
          DEFAULT: hsl("secondary"),
          foreground: hsl("secondary-foreground"),
        },
        destructive: {
          DEFAULT: hsl("destructive"),
          foreground: hsl("destructive-foreground"),
          /** As text on a `bg-destructive/15` tint. See tokens.ts. */
          ink: hsl("destructive-ink"),
        },
        muted: {
          DEFAULT: hsl("muted"),
          foreground: hsl("muted-foreground"),
        },
        // Both spellings resolve to the one variable, so `text-subtle` and
        // the shadcn-shaped `text-subtle-foreground` cannot drift apart.
        subtle: {
          DEFAULT: hsl("subtle-foreground"),
          foreground: hsl("subtle-foreground"),
        },
        accent: {
          DEFAULT: hsl("accent"),
          foreground: hsl("accent-foreground"),
        },
        popover: {
          DEFAULT: hsl("popover"),
          foreground: hsl("popover-foreground"),
        },
        card: {
          DEFAULT: hsl("card"),
          foreground: hsl("card-foreground"),
        },
        surface: {
          DEFAULT: hsl("surface"),
          foreground: hsl("surface-foreground"),
        },
        raised: hsl("raised"),
        play: {
          DEFAULT: hsl("play"),
          foreground: hsl("play-foreground"),
        },
        success: {
          DEFAULT: hsl("success"),
          foreground: hsl("success-foreground"),
          ink: hsl("success-ink"),
        },
        warning: {
          DEFAULT: hsl("warning"),
          foreground: hsl("warning-foreground"),
          ink: hsl("warning-ink"),
        },
        reward: {
          DEFAULT: hsl("reward"),
          /** As text on a `bg-reward/15` tint. See tokens.ts. */
          ink: hsl("reward-ink"),
        },
        streak: hsl("streak"),
        pink: hsl("pink"),
        /*
         * The dimming layer behind dialogs and sheets. Its opacity is a theme
         * token (heavier in dark), so this colour carries its own alpha and
         * takes no `/50` modifier.
         */
        scrim: "rgb(0 0 0 / var(--scrim-opacity))",
        badge: {
          live: hsl("badge-live"),
          new: hsl("badge-new"),
          hot: hsl("badge-hot"),
          updated: hsl("badge-updated"),
          top: hsl("badge-top"),
          soon: hsl("badge-soon"),
          foreground: hsl("badge-foreground"),
          "soon-foreground": hsl("badge-soon-foreground"),
        },
        /* Words on cover art and the scrim under them: the same in both
           themes, like the badges. See `.scrim-art` in globals.css. */
        art: {
          scrim: hsl("art-scrim"),
          foreground: hsl("art-foreground"),
          "muted-foreground": hsl("art-muted-foreground"),
        },
        "game-accent": {
          DEFAULT: gameAccent,
          soft: `color-mix(in srgb, ${gameAccent} 16%, transparent)`,
        },
      },
      // The stacks are tokens.ts's; globals.css reads them back with
      // `theme(fontFamily.*)`, so there is one copy of each.
      fontFamily: {
        display: [typography.family.display],
        sans: [typography.family.body],
        mono: [typography.family.mono],
      },
      // `text-display`, `text-h1`, `text-rail`, `text-card-title`, `text-meta`,
      // `text-tag`: each carries its own leading, weight and tracking.
      fontSize,
      screens: {
        // Sizes the brief calls out individually, so layouts can be designed
        // for them rather than scaled down from desktop.
        xs: "320px",
        "sm-plus": "390px",
        mobile: "430px",
      },
      boxShadow: {
        // Theme-aware: the variables differ between :root and .light.
        card: "var(--shadow-card)",
        // Lift plus a 1px ring in the game's accent (brand primary outside a
        // game). The ring lives here, not in the variable, because a custom
        // property resolves where it is declared — on :root, where no
        // `--game-accent` exists — not on the card that uses it.
        "card-hover": `var(--shadow-card-hover), 0 0 0 1px ${gameAccent}`,
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
        glow: `0 0 24px -4px color-mix(in srgb, ${gameAccent} 45%, transparent)`,
        "glow-primary": "0 0 24px -4px hsl(var(--primary) / 0.45)",
      },
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        "2xl": radius["2xl"],
        "3xl": radius["3xl"],
      },
      zIndex: {
        dropdown: String(zIndex.dropdown),
        sticky: String(zIndex.sticky),
        header: String(zIndex.header),
        drawer: String(zIndex.drawer),
        modal: String(zIndex.modal),
        toast: String(zIndex.toast),
        tooltip: String(zIndex.tooltip),
      },
      /*
       * Named, and not left to `duration-[80ms]`: tailwindcss-animate also
       * owns the `duration-` and `ease-` prefixes (for animation timing), so an
       * arbitrary value there is ambiguous and Tailwind silently emits nothing.
       * Named values set both properties, which is what shadcn expects.
       */
      transitionDuration: {
        press: motion.duration.press,
        hover: motion.duration.hover,
        sheet: motion.duration.sheet,
        "sheet-exit": motion.duration.sheetExit,
      },
      transitionTimingFunction: {
        "out-expo": motion.easeOut,
      },
      // `hover:brightness-hover`: lighter in dark theme, darker in light.
      brightness: {
        hover: "var(--hover-brightness)",
      },
      keyframes: {
        // Starts from -100% explicitly, so it also works on an element that
        // is not already translated off to the left.
        shimmer: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
        // The LIVE badge's dot.
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.8)" },
        },
        // Ambient bob for decorative art. Never on anything that holds text.
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // The QR scanner's sweep line (`animate-[scan_...]`), which named
        // these keyframes long before they existed.
        scan: {
          "0%, 100%": { top: "0%" },
          "50%": { top: "calc(100% - 2px)" },
        },
        // AccordionContent's open and close. shadcn's, not tailwindcss-animate's:
        // Radix measures the panel into this variable.
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "accordion-down": `accordion-down ${motion.duration.hover} ${motion.easeOut}`,
        "accordion-up": `accordion-up ${motion.duration.hover} ${motion.easeOut}`,
      },
    },
  },
  // shadcn's `animate-in fade-in zoom-in-95` classes come from this plugin;
  // without it they compile to nothing and every enter animation is skipped.
  plugins: [animate],
};

export default config;
