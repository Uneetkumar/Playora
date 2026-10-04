# Design system

How Playora looks and moves, and which piece to use for what. If a screen
needs a colour, size or duration that is not listed here, add a token rather
than writing a literal. Hex literals in components are the reason the light
theme breaks on the pages that use them.

## Where things live

| What | File |
|---|---|
| Token values (colour, type, radius, spacing, elevation, motion, z-index) | `packages/ui/src/tokens.ts` |
| The same colours as CSS variables, for both themes | `apps/web/src/app/globals.css` |
| Tailwind classes over those variables | `apps/web/tailwind.config.ts` |
| Fonts | `apps/web/src/app/layout.tsx` |
| Motion presets, springs, reduced-motion preference | `packages/animation/src` |
| `useReducedMotionPref()` and `useCountUp()` hooks | `apps/web/src/lib/motion.ts` |
| Theme switching, plus restoring the saved reduce-motion setting | `apps/web/src/lib/theme.ts` |
| Components | `packages/ui/src/components`, imported from `@playora/ui` |

`globals.css` mirrors `tokens.ts` by hand. It is not generated, so a change goes
in both places. This prints what the CSS should contain:

```bash
node --experimental-strip-types -e 'import("./packages/ui/src/tokens.ts").then((t) => console.log(t.cssVariables("dark").join("\n")))'
# and "light" for the .light block
```

The Tailwind config imports radius, type scale, z-index and motion from
`tokens.ts` directly, so those values cannot drift.

## Themes

Dark is the default and is what `:root` holds. Light is the `.light` class on
`<html>`. The theme bootstrap applies it before first paint, and Settings
switches it with `applyTheme()`. Light was designed as its own palette, not an
inverted dark. "Contrast" below lists the few pairs in either theme that fall
short of 4.5:1, and what they may be used for.

**A component never chooses colours per theme.** Write `bg-card text-foreground`
and both themes are handled. The usual sign that a component breaks in light
theme is `text-white`, `bg-[#...]` or `border-white/10` on a page surface. The
same goes for `dark:` variants: anything that differs by theme and is not a
colour (the scrim's opacity, the hover filter) is a token too.

## Colour

Each token is a CSS variable that holds an HSL triplet, so opacity modifiers
work: `bg-primary/15`, `border-foreground/10`.

### Surfaces and text

| Token / class | Dark | Light | Use for |
|---|---|---|---|
| `bg-background` | `#0B0C12` | `#F6F7FB` | The page |
| `bg-surface` | `#101119` | `#FFFFFF` | Chrome: sidebar, header, bottom nav |
| `bg-card` | `#161824` | `#FFFFFF` | Cards and panels |
| `bg-raised`, `bg-popover` | `#1E2130` | `#FFFFFF` | Floating surfaces: menus, popovers, tooltips, toasts |
| `bg-muted` | `#1E2130` | `#EDEFF5` | Fills inside a card: skeletons, slider tracks, inactive segments |
| `border-border` | `#2A2E40` | `#E2E5EE` | Every border (it is the default, so plain `border` works) |
| `border-input` | `#2A2E40` | `#C9CEDB` | Form-field edges. Darker in light, because the edge is the affordance |
| `text-foreground` | `#F4F5FA` | `#12131A` | Body text and headings |
| `text-muted-foreground` | `#A3A8BC` | `#5A5F73` | Secondary text and descriptions |
| `text-subtle` | `#6B7088` | `#676C7F` | Disabled and decorative text only, and control edges such as the Switch's off track. Below 4.5:1 in dark, so never anything a player needs to read: placeholders, menu labels and shortcuts use `text-muted-foreground` |

In light theme, chrome, cards and floating surfaces are all white. The border
and the shadow separate them. Use `bg-muted` for a fill inside a card, not
`bg-raised`.

### Brand and status

| Token / class | Dark | Light | Use for |
|---|---|---|---|
| `bg-primary` + `text-primary-foreground` | `#7C6CF2` / `#0B0C12` | `#6656E0` / white | Default buttons, selected states, the focus ring. Dark-theme labels are the page ink, not white (see "Contrast") |
| `bg-primary-hover` / `bg-primary-pressed` | `#8E80FF` / `#6656E0` | `#5747D1` / `#4A3BC2` | Explicit hover and press fills, when a filter will not do |
| `text-primary-accent` | `#A79BFF` | `#5646CF` | Primary used as **text or an icon**. The fill colour is too dark to read on the dark page |
| `bg-secondary`, `bg-accent` | `#22D3EE` | `#0E7490` | Cyan for info and secondary highlights. Light uses deep teal, because cyan on white has no contrast |
| `bg-play` + `text-play-foreground` | `#3DDC84` / `#06210F` | `#1FA463` / `#06210F` | **Only** the single primary Play action on a screen |
| `bg-destructive` + `text-destructive-foreground` | `#F04452` / `#0B0C12` | `#D02A3A` / white | Leave, delete, forfeit |
| `bg-success` | `#22C55E` | `#15803D` | Confirmations, wins, "ready" |
| `bg-warning` | `#F5A524` | `#A05D00` | Caution, a connection degrading |
| `text-success-ink`, `text-warning-ink`, `text-destructive-ink` | `#22C55E`, `#F5A524`, `#FF6B76` | `#166534`, `#8A4B00`, `#A61E2D` | Status colour as text on its own 15% tint |
| `text-reward`, `bg-reward/15` | `#FBBF24` | `#A16207` | Gold on a page surface: best-score trophies, earned stars |
| `text-reward-ink` | `#FBBF24` | `#854D0E` | Gold as text on its own 15% tint (a chip such as the lobby's Host). Light `reward` is 4.0:1 there, its ink 5.6:1 |
| `text-streak` | `#FF5A3C` | `#C2410C` | Flame on a page surface: combos, win streaks |
| `bg-pink` | `#FF4D8D` | `#E4256B` | Legacy. Existing screens only; do not add new uses |

Every fill has a `-foreground` partner (`bg-success text-success-foreground`).
Status chips use the tint pattern instead, with the colour's ink for the text:
`bg-success/15 text-success-ink`. The plain colour loses too much contrast on
its own tint (light-theme success is 3.8:1 there, its ink 5.5:1).

`reward` and `streak` are the badge gold and flame in dark theme, and darker
in light. Use them on page surfaces. The `badge-*` colours stay the same in
both themes because they belong on cover art, and on a white card the gold is
1.7:1.

**Contrast.** Text needs 4.5:1. WCAG's "large text", which may go to 3:1,
starts at 24px regular or 18.66px bold, so no button label qualifies: a
default button is 14px semibold and `size="lg"` is 16px. Measured:

| Pair | Ratio | Status |
|---|---|---|
| Dark primary, page-ink label (hover, pressed) | 4.91 (6.21, 3.69) | Pass at rest and on hover. White would be 3.97 |
| Dark destructive, page-ink label | 5.26 | Pass. White would be 3.71 |
| Light play, `#06210F` label | 5.31 | Pass. White would be 3.21 |
| Light primary and destructive, white label | 5.29, 5.15 | Pass |
| Dark `subtle-foreground` on page, card, raised | 4.00, 3.61, 3.27 | **Fails** for text. Disabled or decorative text only. It clears 3:1 for a control's edge |
| Light `subtle-foreground` on white, page | 5.21, 4.87 | Pass |
| Light `pink` on page | 4.11 | **Fails.** Legacy, no new uses |

Non-text indicators (a switch track, an icon that carries meaning, a focus
ring) need 3:1 against what they sit on.

### Badges

Badge colours are the same in both themes, because badges sit on cover art and
the art does not change with the theme.

Which badge a game gets is decided in one place, `badgeFor` in
`apps/web/src/lib/games/view.ts`, and every card reads it from `gameView()`
rather than deciding again. The windows are constants there, and so are the
limits: a badge singles a game out, so only the few most recent games in a
window wear it, never the whole catalogue after a big release day.

| Class | Colour | Meaning |
|---|---|---|
| `bg-badge-live` | `#22C55E` | Live now, with an online count. Has a pulsing dot (`animate-pulse-dot`) |
| `bg-badge-new` | `#22D3EE` | Released in the last 30 days (`NEW_WINDOW_DAYS`); the four most recent at most (`NEW_LIMIT`) |
| `bg-badge-updated` | `#A79BFF` | Updated in the last 14 days (`UPDATED_WINDOW_DAYS`); the four most recent at most (`UPDATED_LIMIT`) |
| `bg-badge-hot` | `#FF5A3C` | Featured: in the hero rotation (`FEATURED_GAME_IDS`) |
| `bg-badge-top` | `#FBBF24` | Top-ranked |
| `bg-badge-soon` | `#3A3F55` | Not playable yet (`playable` is false) |

Text on every badge except SOON is `text-badge-foreground` (dark ink, 6.3:1 or
better). SOON uses `text-badge-soon-foreground`. The `<Badge variant="live">`
and related variants already apply these colours.

### Words on cover art

For the same reason, text laid straight on cover art (a game card's title and
meta line) does not follow the theme either. A scrim in the page colour turns
light theme's covers into a white haze with dark words fighting the art; the
art's own dark ink with light words reads over any cover in both themes.

| Class | Use for |
|---|---|
| `.scrim-art` | The gradient under the words: `art-scrim` at 92% at the edge, 20% at 55%, then clear |
| `from-art-scrim/70` | Deepening that gradient behind the title only |
| `text-art-foreground` | The title. 17.9:1 on the scrim's colour |
| `text-art-muted-foreground` | The meta line. 8.3:1 on the scrim's colour |
| `.text-halo-art` | On the words' container: a soft halo in the scrim's ink, for a bright highlight in the art the gradient cannot predict |

`.scrim-bottom` and `.scrim-left` stay in the page colour: they are for art
that fades *into the page* (the hero, a room's header), where the words sit on
the page rather than on the picture.

### Per-game accent

Each game has an accent colour in its presentation data, `GAME_META[id].accent`
in `apps/web/src/lib/games/meta.ts` (kept apart from `GAME_CATALOG` on purpose).
Components expose it as a CSS variable with `gameAccentStyle(id)` and never
hard-code it. GameShell sets it on its root, so everything inside a game can
read it:

```tsx
<article style={gameAccentStyle(game.id)}>
  <span className="text-game-accent">…</span>         {/* accent text or icon */}
  <div className="bg-game-accent-soft">…</div>         {/* 16% tint */}
  <div className="hover:shadow-card-hover">…</div>     {/* lift plus 1px accent ring */}
</article>
```

`game-accent` falls back to brand primary when no game is set. The variable
holds a hex value, so Tailwind's `/15` opacity modifier cannot apply to it. Use
`bg-game-accent-soft` instead. The `.game-accent` class sets text colour to the
accent and works for SVG `currentColor`.

## Type

| Font | Variable | Tailwind | Use for |
|---|---|---|---|
| Sora 600/700/800 | `--font-display` | `font-display` | Headings, hero titles (`h1`–`h3` get it automatically) |
| Inter, variable | `--font-body` | `font-sans` (the default) | Everything else |
| JetBrains Mono 500/700 | `--font-mono` | `font-mono` | Clocks, room codes, monospace data |

The stacks are `typography.family` in `tokens.ts`. The Tailwind config builds
`font-display`, `font-sans` and `font-mono` from them, and `globals.css` reads
those back with `theme(fontFamily.*)`, so each stack is written once.

The scale is defined in `typography.scale`. Each size class carries its own
weight, line height and tracking:

| Class | Size | Weight | Use for |
|---|---|---|---|
| `text-display` | clamp(40px, 5vw, 64px) | 800 | Hero title |
| `text-h1` | 32px | 700 | Page title |
| `text-h2` | 24px | 700 | Section title on a content page |
| `text-rail` | 20px | 700 | Rail and section headers on browse pages |
| `text-card-title` | 15px | 700 | Game-card title (one line, `truncate`) |
| `text-meta` | 13px | 500 | Players · duration · genre under a title |
| `text-tag` | 11px | 800 | Badge text. Add `uppercase` |

Body copy is the Tailwind default `text-base` / `text-sm`.

Numbers:

- `.numeric`: Inter with tabular figures (`cv11`, `tnum`). Use it for scores,
  ratings and counters that change, so the digits do not shift sideways. It
  sets no weight; add `font-bold` yourself.
- `.font-mono-num`: JetBrains Mono with tabular figures. Use it for clocks,
  room codes and big HUD numbers.
- `text-balance` (built into Tailwind 3.4): use it on multi-line headings.

## Space and layout

The grid is 8px with a 4px half-step: 4, 8, 12, 16, 24, 32, 48, 64 (Tailwind
`1 2 3 4 6 8 12 16`).

| | Mobile | Tablet | Desktop | Classes |
|---|---|---|---|---|
| Page gutter | 16 | 24 | 32 | `px-4 sm:px-6 lg:px-8` |
| Section gap | 40 | | 48 | `gap-10 lg:gap-12` (or `space-y-*`) |
| Rail gap (between cards) | 12 | | 16 | `gap-3 lg:gap-4` |

## Radius

| Thing | Radius | Class |
|---|---|---|
| Chip, badge, avatar | pill | `rounded-full` |
| Button, input, small tile | 12px | `rounded-lg` |
| Card | 16px | `rounded-xl` |
| Modal, sheet, drawer | 20px | `rounded-2xl` |
| Hero | 24px | `rounded-3xl` |

`rounded-sm` is 8px and `rounded-md` is 10px, for nested elements inside the
sizes above. Inner radius = outer radius − padding.

## Elevation and focus

| Class | Use for |
|---|---|
| `shadow-card` | Resting card |
| `shadow-card-hover` | Hovered or focused card: a deep drop shadow plus a 1px ring in the game accent |
| `shadow-raised` | Popovers, menus |
| `shadow-overlay` | Dialogs, sheets |
| `shadow-glow` | Accent glow, sparingly. Rewards and the selected game |
| `bg-scrim` | The dimming layer behind dialogs, sheets and drawers. 70% black in dark, 40% in light, from `--scrim-opacity`. Takes no `/50` modifier |

Shadows come from `--shadow-*` variables and are softer in light theme. The
same class is right in both themes. A literal like `shadow-[0_16px_32px_-12px_rgb(0_0_0/0.7)]`
is not: it smears on a light page.

**Focus.** Every focusable element gets a 2px `--ring` outline, offset 2px, on
`:focus-visible`. That is a global rule in `globals.css`, so plain links and
buttons are covered with no extra work. Components that draw their own ring
(`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`) turn the
outline off with `focus-visible:outline-none`. That ring is exported as
`focusRingClass` from `@playora/ui`, for app code that styles its own
controls; use it rather than copying the class list. `.focus-ring` puts the
outline back on an element whose styles removed it. Never remove focus without
replacing it.

## Motion

| What | Duration / spring | Where it lives |
|---|---|---|
| Press | 80ms, scale to 0.97 | `duration-press`, `active:scale-[.97]`, `pressProps()` |
| Hover, focus | 200ms, easeOutExpo | `duration-hover ease-out-expo` |
| Sheet, drawer, dialog | 320ms in, 280ms out, or the `panel` spring | `duration-sheet`, `duration-sheet-exit`, `SPRING.panel` |
| Micro interactions (Motion) | `SPRING.micro` (500 / 30) | `@playora/animation` |
| Panels (Motion) | `SPRING.panel` (300 / 32) | `@playora/animation` |
| Ambient drift (Motion) | `SPRING.ambient` (120 / 20) | `@playora/animation` |

The easing is `cubic-bezier(0.16, 1, 0.3, 1)` (`EASE.out` / `EASE_CSS.out`).
Entrances use the variant builders in `@playora/animation`: `riseIn`, `popIn`,
`slideIn`, `celebrate` and `staggerChildren`. Tailwind keyframes are
`animate-shimmer` (skeleton sweep), `animate-pulse-dot` (LIVE dot),
`animate-float` (decorative bob) and `animate-accordion-down` /
`animate-accordion-up` (Accordion's open and close, 200ms easeOutExpo). shadcn's
`animate-in fade-in zoom-in-95` classes work through `tailwindcss-animate`.

Use the named classes, not `duration-[80ms]` or `ease-[cubic-bezier(…)]`.
tailwindcss-animate also owns the `duration-` and `ease-` prefixes (for
animation timing), so an arbitrary value there matches two utilities. Tailwind
logs "ambiguous" and **emits nothing**. A named value such as `duration-press`
or `ease-out-expo` sets both the transition and the animation timing.

```tsx
import { motion } from "framer-motion";
import { liftProps, pressProps, riseIn } from "@playora/animation";
import { useReducedMotionPref } from "@/lib/motion";

const reduced = useReducedMotionPref();
<motion.div variants={riseIn(reduced)} initial="hidden" animate="visible" {...liftProps(reduced)} />
<motion.button {...pressProps(reduced)} />
```

### Reduced motion is not optional

There are two sources, and both count: the OS setting, and **Settings → Reduce
motion**, which puts `.reduce-motion` on `<html>`. The theme bootstrap restores
that class on every load.

- **CSS** handles both sources already. Transitions and animations shrink to
  0.01ms and run once.
- **Motion and JS** must ask. Use `useReducedMotionPref()`, **not**
  framer-motion's `useReducedMotion()`, which only sees the OS setting.
- When reduced is on: no hover video previews, no carousel auto-advance, no
  parallax or ambient drift. Transforms become plain fades or nothing. Content
  must never be left hidden: a reduced variant's `hidden` state is `opacity: 1`.

## Icons

Use lucide-react only. Never use emoji as a UI icon: emoji render differently
on every platform, and screen readers read their names aloud. Mark decorative
icons `aria-hidden`. An icon-only button needs an `aria-label`, and a tooltip
too if the meaning is not obvious.

## Components: what to use for what

All of these come from `@playora/ui`.

| Need | Use | Not |
|---|---|---|
| The one primary "Play" action on a screen | `<Button variant="play" size="lg">` | A green `default` button, or more than one Play per screen |
| Any other primary action | `<Button>` (variant `default`) | |
| Secondary / tertiary actions | `variant="secondary"`, `"outline"`, `"ghost"` | |
| Leave, delete, forfeit | `variant="destructive"`, confirmed with `ConfirmDialog` while a match is live | |
| A link that looks like a button | `<Button asChild><Link …/></Button>` | `<Link><Button/></Link>`, which nests two interactive elements and creates two tab stops |
| Status label in content | `<Badge variant="success" \| "warning" \| …>` | |
| The badge on a game card | `<Badge variant="live" \| "new" \| "hot" \| "updated" \| "top" \| "soon">` | More than one per card |
| A blocking question or a form in a modal | `Dialog`. Modal only: it takes no `modal` prop | A hand-built `fixed inset-0` overlay, which has no focus trap or Escape handling |
| Confirm a consequence | `ConfirmDialog` | `window.confirm` |
| A side panel (filters, settings, chat on desktop) | `Sheet` | |
| A menu that slides in, like GameShell's pause menu | `Sheet`: `side="bottom"` below 768px, `side="right"` from 768px up | |
| A panel the thumb drags down to dismiss (room chat on mobile, the mode picker) | `Drawer` (vaul) | |
| A small panel anchored to a control (friends, notifications) | `Popover` | |
| Preview on hover (a player card) | `HoverCard`. Never the only way to reach the content | |
| Name an icon-only control | `Tooltip` | `title=` attributes |
| An action menu (account, more) | `DropdownMenu` | |
| Switch views on one page | `Tabs` | |
| Pick one of 2–5 options (mode, time control, player count) | `ToggleGroup type="single"` | A row of `Button`s with hand-managed state |
| On/off setting | `Switch` | An unstyled checkbox |
| Volume, sensitivity | `Slider` | |
| A scrolling panel inside the page | `ScrollArea` | |
| Loading placeholder | `Skeleton` | A spinner where the layout is known |
| Rules / FAQ | `Accordion` | |
| Toast | sonner's `toast()`. `<Toaster />` is mounted once in the root layout | Hand-rolled fixed-position toasts |

## Game card anatomy

```
┌──────────────────────────────┐  rounded-xl, bg-card, shadow-card,
│ [LIVE • 128]   [users] [fav] │  style={{ "--game-accent": game.accent }}
│                              │
│        cover art             │  ← fills the card at the rail's ratio,
│     (no text baked in)       │    16:9 landscape · 2:3 portrait · 1:1 grid
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← .scrim-art (dark in both themes)
│ Game title                   │  text-card-title text-art-foreground, truncate
│ 2–4 players · 5 min · Cards  │  text-meta text-art-muted-foreground
└──────────────────────────────┘
```

- **Top left:** at most one badge: `gameView(id).badge`, or SOON for a game
  that is not playable. The priority, set by `badgeFor`, is LIVE (with the
  online count), then NEW, UPDATED, HOT. NEW outranks UPDATED because a game
  under a month old has, trivially, been updated recently. HOT is the
  editorial fallback for a featured game that is neither. On a card under
  160px wide (a 132px portrait card in a phone's rail) LIVE drops its count
  so it clears the heart; the link's label still says it.
- **Top right:** a multiplayer icon (lucide `Users`). The favourite heart
  appears on hover or focus, and is always visible once favourited.
- **Bottom:** a scrim, the title, then a meta row. The player count comes from
  the game's capabilities, not the catalogue's marketing range.
- **Hover or focus-visible:** lift (`-translate-y-1 scale-[1.02]`, or
  `liftProps()`) plus `shadow-card-hover`, over 200ms easeOutExpo. Wait 450ms
  before crossfading to a muted preview video, if the game has one. Nothing
  moves under reduced motion.
- **Keyboard:** the whole card is one link with a visible focus ring. Every
  hover effect has a `group-focus-visible:` twin.
- **Touch:** the first tap opens the details page. Nothing is reachable by
  hover alone.
- **Fixed widths in rails** (`shrink-0`): landscape 240 / 288 / 320px, portrait
  132 / 176 / 200px at mobile / desktop / xl.

## Do and don't

**Do**

- Use tokens for every colour, through classes: `bg-card`, `text-muted-foreground`,
  `border-border`.
- Put one Play button in green per screen, and make it the thing the screen is for.
- Use `text-primary-accent` for violet text, and `bg-primary` for violet fills.
- Give every hover effect a focus-visible twin.
- Use `useReducedMotionPref()` for any JS-driven motion, and test with
  Settings → Reduce motion on.
- Use `.numeric` or `.font-mono-num` for any number that changes while you
  watch.
- Check both themes before calling a screen done.

**Don't**

- Don't write `text-white`, `bg-black/40` or `bg-[#…]` on a page surface. They
  are invisible or wrong in light theme. On top of a photo or game canvas they
  are fine, because those do not change with the theme.
- Don't hard-code a game's colour. Set `--game-accent` and read it.
- Don't use green for anything but Play. Success states use `success`.
- Don't stack badges, or bake text into cover art.
- Don't remove the focus outline without drawing a replacement.
- Don't invent durations or springs. Pick one from the motion table, and use
  its named class (`duration-hover`, not `duration-[200ms]`).
- Don't use emoji as icons.
- Don't use arbitrary values that are not on Tailwind's scale (`w-84`,
  `border-white/8`, `scale-102`). They compile to nothing, silently.
