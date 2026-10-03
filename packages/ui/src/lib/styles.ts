/**
 * Class strings shared by more than one component. Internal, so they can
 * change without breaking callers, except `focusRing`, which the index
 * exports as `focusRingClass` for app code that styles its own controls.
 *
 * Kept as plain literals because Tailwind finds classes by scanning source
 * text; a class assembled at runtime would never be generated.
 */

/**
 * The focus-visible ring every interactive element uses: 2px of `--ring`,
 * offset 2px in the page colour so it clears the element's own edge.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Text fields sit one step *below* the surface they are on (the page colour),
 * so in a card they read as wells to type into rather than as more card.
 */
export const fieldClassName = [
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground",
  "transition-[border-color,box-shadow] duration-hover ease-out-expo",
  // Muted, not subtle: a placeholder is often the only hint of what goes in
  // the field, so it needs text contrast (subtle is 3.3:1 on raised).
  "placeholder:text-muted-foreground hover:border-foreground/20",
  focusRing,
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
].join(" ");

/**
 * The top-right close button on dialogs and sheets. 40px, the smallest touch
 * target the design allows; inset 12px rather than 16px so the icon sits
 * where it did when the button was 32px.
 */
export const overlayCloseClassName = [
  "absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors",
  "hover:bg-foreground/[0.08] hover:text-foreground disabled:pointer-events-none",
  focusRing,
].join(" ");

/**
 * Floating panels (popover, dropdown, select, hover card): raised surface,
 * and the tailwindcss-animate enter/exit that slides in from the side Radix
 * placed them on.
 */
export const floatingPanelClassName = [
  "z-modal rounded-xl border border-border bg-popover text-popover-foreground shadow-raised outline-none",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
].join(" ");

/**
 * A row in a menu-like list (dropdown, select, command). Highlighted rows take
 * a primary tint: `accent` in this palette is the cyan, not the neutral that
 * upstream shadcn uses it for.
 */
export const menuItemClassName = [
  "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
].join(" ");
