/**
 * The GameShell's decisions, as pure functions: when to pause, when leaving
 * or restarting needs a confirmation, and which key presses are the shell's
 * to handle. The component only wires these to state and the DOM, so the
 * rules can be tested without rendering anything.
 */

export type ConfirmKind = "leave" | "restart";

/**
 * A question on screen, and where it was asked from. A confirmation opened
 * from the pause menu returns there when cancelled. One opened from the top
 * bar's exit arrow goes straight back to the game, because the player never
 * asked for the menu.
 */
export interface PendingConfirm {
  kind: ConfirmKind;
  from: "menu" | "bar";
}

export interface ShellState {
  paused: boolean;
  confirm: PendingConfirm | null;
}

export type ShellEvent =
  | { type: "pause" }
  | { type: "resume" }
  /** The P key: pauses, or resumes from the menu. Ignored while a question is open. */
  | { type: "toggle" }
  | { type: "exit"; from: "menu" | "bar" }
  | { type: "restart" }
  | { type: "confirm" }
  | { type: "cancel" };

/** What the component must do after applying the new state. */
export type ShellEffect = "exit" | "restart" | null;

export interface ShellTransition {
  state: ShellState;
  effect: ShellEffect;
}

const stay = (state: ShellState): ShellTransition => ({ state, effect: null });

/**
 * Applies one event. `matchInProgress` decides whether leaving and restarting
 * ask first: throwing away a live match deserves a question, while leaving a
 * finished one, or a level select, does not.
 */
export function shellTransition(
  state: ShellState,
  event: ShellEvent,
  matchInProgress: boolean,
): ShellTransition {
  switch (event.type) {
    case "pause":
      return state.paused ? stay(state) : stay({ ...state, paused: true });

    case "resume":
      return stay({ paused: false, confirm: null });

    case "toggle":
      if (state.confirm) return stay(state);
      return stay({ ...state, paused: !state.paused });

    case "exit":
      if (!matchInProgress) return { state, effect: "exit" };
      // Paused while the question is open, so the match does not carry on
      // behind it.
      return stay({ paused: true, confirm: { kind: "leave", from: event.from } });

    case "restart":
      if (!matchInProgress) return { state: { paused: false, confirm: null }, effect: "restart" };
      return stay({ paused: true, confirm: { kind: "restart", from: "menu" } });

    case "confirm":
      if (!state.confirm) return stay(state);
      if (state.confirm.kind === "leave") {
        // Stays paused: the game must not resume for the frames it takes to
        // navigate away.
        return { state: { paused: true, confirm: null }, effect: "exit" };
      }
      return { state: { paused: false, confirm: null }, effect: "restart" };

    case "cancel":
      if (!state.confirm) return stay(state);
      if (state.confirm.from === "bar") return stay({ paused: false, confirm: null });
      return stay({ ...state, confirm: null });
  }
}

/** Whether the pause menu itself is showing: paused, and not hidden behind a top-bar question. */
export function isMenuOpen(state: ShellState): boolean {
  return state.paused && state.confirm?.from !== "bar";
}

/* -------------------------------------------------------------------------- */
/* Keyboard                                                                    */
/* -------------------------------------------------------------------------- */

export type ShellShortcut = "escape" | "pause-key" | null;

/** The parts of a KeyboardEvent the shortcut rules read. */
export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
}

const NON_TEXT_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * Whether a key press is going into a text field, where P is a letter and not
 * a command. Duck-typed rather than `instanceof HTMLElement` so it also works
 * for elements from another frame and in tests without a DOM.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: boolean; type?: unknown } | null;
  if (!el || typeof el.tagName !== "string") return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = typeof el.type === "string" ? el.type.toLowerCase() : "text";
  return !NON_TEXT_INPUTS.has(type);
}

/**
 * Which shell shortcut a key press is, if any.
 *
 * A press something else already handled (`defaultPrevented`) is left alone.
 * That is how Escape closing a Radix dialog avoids immediately reopening the
 * pause menu: Radix marks the event handled before it reaches the shell.
 * Modified presses (Ctrl+P prints) and held-key repeats are not shortcuts.
 */
export function shortcutFor(event: ShortcutEvent, options: { pauseKey: boolean }): ShellShortcut {
  if (event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key === "Escape") return "escape";
  if (options.pauseKey && (event.key === "p" || event.key === "P") && !isTypingTarget(event.target)) {
    return "pause-key";
  }
  return null;
}

const ACTIVATING_TAGS = new Set(["BUTTON", "A", "SUMMARY", "INPUT"]);
const ACTIVATING_ROLES = new Set([
  "button",
  "link",
  "switch",
  "checkbox",
  "radio",
  "tab",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
]);
const ARROW_ROLES = new Set([
  "slider",
  "spinbutton",
  "tab",
  "radio",
  "option",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
]);
const ARROW_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** The parts of a key press `chromeOwnsKey` reads. */
export interface ChromeKeyEvent {
  key: string;
  target: EventTarget | null;
}

/**
 * Whether a key pressed on one of the top bar's controls is that control's,
 * and so must not also reach the game's own `window` listeners.
 *
 * Only the keys a control actually uses: Tab; Enter and Space on something
 * they press; arrows, Home/End and Page Up/Down on something they move; and
 * anything typed into a text field. Everything else goes on to the game.
 *
 * Narrow on purpose. The browser leaves focus on a button after it is
 * clicked, so if every key from the top bar stopped there, one click on Mute
 * would leave the game deaf to its controls until the board was clicked, and
 * Space would toggle Mute again instead of doing the game's action.
 * Duck-typed, like `isTypingTarget`.
 */
export function chromeOwnsKey(event: ChromeKeyEvent): boolean {
  if (event.key === "Tab") return true;
  if (isTypingTarget(event.target)) return true;
  const el = event.target as {
    tagName?: unknown;
    type?: unknown;
    getAttribute?: (name: string) => string | null;
  } | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toUpperCase();
  const role = typeof el.getAttribute === "function" ? (el.getAttribute("role") ?? "") : "";
  if (event.key === "Enter" || event.key === " ") {
    return ACTIVATING_TAGS.has(tag) || ACTIVATING_ROLES.has(role);
  }
  if (ARROW_KEYS.has(event.key)) {
    const type = typeof el.type === "string" ? el.type.toLowerCase() : "";
    return ARROW_ROLES.has(role) || (tag === "INPUT" && (type === "range" || type === "radio"));
  }
  return false;
}
