import { describe, it, expect } from "vitest";
import {
  chromeOwnsKey,
  isMenuOpen,
  isTypingTarget,
  shellTransition,
  shortcutFor,
  type ShellEvent,
  type ShellState,
  type ShortcutEvent,
} from "../shell-logic";

const PLAYING: ShellState = { paused: false, confirm: null };
const MENU: ShellState = { paused: true, confirm: null };

function run(events: ShellEvent[], matchInProgress: boolean, from: ShellState = PLAYING) {
  const effects: string[] = [];
  let state = from;
  for (const event of events) {
    const next = shellTransition(state, event, matchInProgress);
    state = next.state;
    if (next.effect) effects.push(next.effect);
  }
  return { state, effects };
}

describe("shellTransition: pausing", () => {
  it("pauses and resumes", () => {
    expect(run([{ type: "pause" }], true).state).toEqual(MENU);
    expect(run([{ type: "pause" }, { type: "resume" }], true).state).toEqual(PLAYING);
  });

  it("keeps the same state object when already paused, so nothing re-renders", () => {
    expect(shellTransition(MENU, { type: "pause" }, true).state).toBe(MENU);
  });

  it("toggles with P, but not while a question is open", () => {
    expect(run([{ type: "toggle" }], true).state.paused).toBe(true);
    expect(run([{ type: "toggle" }, { type: "toggle" }], true).state.paused).toBe(false);
    const asking = run([{ type: "exit", from: "menu" }], true).state;
    expect(shellTransition(asking, { type: "toggle" }, true).state).toBe(asking);
  });
});

describe("shellTransition: leaving", () => {
  it("leaves at once when no match is in progress", () => {
    expect(run([{ type: "exit", from: "bar" }], false).effects).toEqual(["exit"]);
    expect(run([{ type: "exit", from: "menu" }], false, MENU).effects).toEqual(["exit"]);
  });

  it("asks first during a match, pausing behind the question", () => {
    const { state, effects } = run([{ type: "exit", from: "bar" }], true);
    expect(effects).toEqual([]);
    expect(state).toEqual({ paused: true, confirm: { kind: "leave", from: "bar" } });
    // The menu stays shut: the player pressed back, not pause.
    expect(isMenuOpen(state)).toBe(false);
  });

  it("leaves on confirm, still paused so the game does not run on while navigating", () => {
    const { state, effects } = run([{ type: "exit", from: "bar" }, { type: "confirm" }], true);
    expect(effects).toEqual(["exit"]);
    expect(state.paused).toBe(true);
  });

  it("goes straight back to the game when the top-bar question is cancelled", () => {
    expect(run([{ type: "exit", from: "bar" }, { type: "cancel" }], true).state).toEqual(PLAYING);
  });

  it("returns to the pause menu when a question asked from it is cancelled", () => {
    const { state } = run([{ type: "pause" }, { type: "exit", from: "menu" }, { type: "cancel" }], true);
    expect(state).toEqual(MENU);
    expect(isMenuOpen(state)).toBe(true);
  });

  it("keeps the menu open beneath a question asked from it", () => {
    const { state } = run([{ type: "pause" }, { type: "exit", from: "menu" }], true);
    expect(isMenuOpen(state)).toBe(true);
  });
});

describe("shellTransition: restarting", () => {
  it("restarts at once and resumes when no match is in progress", () => {
    const { state, effects } = run([{ type: "restart" }], false, MENU);
    expect(effects).toEqual(["restart"]);
    expect(state).toEqual(PLAYING);
  });

  it("asks first during a match, then restarts and resumes on confirm", () => {
    const asked = run([{ type: "pause" }, { type: "restart" }], true);
    expect(asked.effects).toEqual([]);
    expect(asked.state.confirm).toEqual({ kind: "restart", from: "menu" });

    const done = run([{ type: "confirm" }], true, asked.state);
    expect(done.effects).toEqual(["restart"]);
    expect(done.state).toEqual(PLAYING);
  });

  it("ignores confirm and cancel with no question open", () => {
    expect(run([{ type: "confirm" }, { type: "cancel" }], true, MENU)).toEqual({
      state: MENU,
      effects: [],
    });
  });
});

const key = (overrides: Partial<ShortcutEvent>): ShortcutEvent => ({
  key: "a",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  defaultPrevented: false,
  target: null,
  ...overrides,
});

describe("shortcutFor", () => {
  it("recognises Escape and P", () => {
    expect(shortcutFor(key({ key: "Escape" }), { pauseKey: true })).toBe("escape");
    expect(shortcutFor(key({ key: "p" }), { pauseKey: true })).toBe("pause-key");
    expect(shortcutFor(key({ key: "P" }), { pauseKey: true })).toBe("pause-key");
    expect(shortcutFor(key({ key: " " }), { pauseKey: true })).toBeNull();
  });

  it("leaves P alone when the game turns it off, and while typing", () => {
    expect(shortcutFor(key({ key: "p" }), { pauseKey: false })).toBeNull();
    const input = { tagName: "INPUT", type: "text" } as unknown as EventTarget;
    expect(shortcutFor(key({ key: "p", target: input }), { pauseKey: true })).toBeNull();
    // Escape still pauses from a text field.
    expect(shortcutFor(key({ key: "Escape", target: input }), { pauseKey: true })).toBe("escape");
  });

  it("ignores presses already handled, modified, repeated or mid-composition", () => {
    // Radix marks the Escape that closes a dialog as handled; acting on it
    // as well would reopen the pause menu the player just closed.
    expect(shortcutFor(key({ key: "Escape", defaultPrevented: true }), { pauseKey: true })).toBeNull();
    expect(shortcutFor(key({ key: "p", ctrlKey: true }), { pauseKey: true })).toBeNull();
    expect(shortcutFor(key({ key: "p", metaKey: true }), { pauseKey: true })).toBeNull();
    expect(shortcutFor(key({ key: "p", altKey: true }), { pauseKey: true })).toBeNull();
    expect(shortcutFor(key({ key: "p", repeat: true }), { pauseKey: true })).toBeNull();
    expect(shortcutFor(key({ key: "p", isComposing: true }), { pauseKey: true })).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const el = (props: Record<string, unknown>) => props as unknown as EventTarget;

  it("is true for text fields and editable content", () => {
    expect(isTypingTarget(el({ tagName: "INPUT" }))).toBe(true);
    expect(isTypingTarget(el({ tagName: "INPUT", type: "search" }))).toBe(true);
    expect(isTypingTarget(el({ tagName: "TEXTAREA" }))).toBe(true);
    expect(isTypingTarget(el({ tagName: "SELECT" }))).toBe(true);
    expect(isTypingTarget(el({ tagName: "DIV", isContentEditable: true }))).toBe(true);
  });

  it("is false for buttons, toggles, sliders and non-elements", () => {
    expect(isTypingTarget(el({ tagName: "BUTTON" }))).toBe(false);
    expect(isTypingTarget(el({ tagName: "INPUT", type: "checkbox" }))).toBe(false);
    expect(isTypingTarget(el({ tagName: "INPUT", type: "range" }))).toBe(false);
    expect(isTypingTarget(el({}))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("chromeOwnsKey", () => {
  const el = (tagName: string, attrs: Record<string, string> = {}, type?: string) =>
    ({ tagName, type, getAttribute: (name: string) => attrs[name] ?? null }) as unknown as EventTarget;
  const owns = (key: string, target: EventTarget | null) => chromeOwnsKey({ key, target });
  const button = el("BUTTON");

  it("keeps Enter, Space and Tab on a focused button", () => {
    expect(owns("Enter", button)).toBe(true);
    expect(owns(" ", button)).toBe(true);
    expect(owns("Tab", button)).toBe(true);
    expect(owns(" ", el("DIV", { role: "switch" }))).toBe(true);
  });

  it("lets every other key on a focused button through to the game", () => {
    // The regression: after a click on Mute, focus stays on it, and the game's
    // undo, material and mirror keys must still work.
    for (const key of ["2", "m", "d", "z", "Escape", "p", "ArrowLeft", "Backspace"]) {
      expect(owns(key, button), key).toBe(false);
    }
  });

  it("keeps arrows and paging keys only on controls they move", () => {
    const slider = el("SPAN", { role: "slider" });
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]) {
      expect(owns(key, slider), key).toBe(true);
    }
    expect(owns("ArrowUp", el("INPUT", {}, "range"))).toBe(true);
    expect(owns("ArrowDown", el("BUTTON", { role: "tab" }))).toBe(true);
    expect(owns("ArrowDown", button)).toBe(false);
    expect(owns("ArrowDown", el("DIV"))).toBe(false);
  });

  it("keeps everything typed into a text field", () => {
    const input = el("INPUT", {}, "text");
    for (const key of ["a", "2", " ", "ArrowLeft", "Backspace"]) {
      expect(owns(key, input), key).toBe(true);
    }
  });

  it("owns nothing pressed on a non-element", () => {
    expect(owns(" ", null)).toBe(false);
    expect(owns("Enter", el("DIV"))).toBe(false);
  });
});
