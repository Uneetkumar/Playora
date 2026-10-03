import { describe, it, expect } from "vitest";
import { InputManager, DEFAULT_BINDINGS } from "../input.js";

describe("input as actions", () => {
  it("holds an action until it is released", () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("BOOST", true);
    expect(im.isDown("BOOST")).toBe(true);
    im.endStep();
    expect(im.isDown("BOOST")).toBe(true);
    im.setAction("BOOST", false);
    expect(im.isDown("BOOST")).toBe(false);
  });

  it("fires justPressed for exactly one step", () => {
    // A tap that spans four frames must still fire one action, or holding a
    // button machine-guns whatever it is bound to.
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("ACTION", true);
    expect(im.justPressed("ACTION")).toBe(true);
    im.endStep();
    expect(im.justPressed("ACTION")).toBe(false);
    expect(im.isDown("ACTION")).toBe(true);
  });

  it("does not re-fire justPressed while already held", () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("ACTION", true);
    im.endStep();
    im.setAction("ACTION", true);
    expect(im.justPressed("ACTION")).toBe(false);
  });

  it("fires justReleased for exactly one step", () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("PAUSE", true);
    im.endStep();
    im.setAction("PAUSE", false);
    expect(im.justReleased("PAUSE")).toBe(true);
    im.endStep();
    expect(im.justReleased("PAUSE")).toBe(false);
  });

  it("ignores a release for an action that was never held", () => {
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("BRAKE", false);
    expect(im.justReleased("BRAKE")).toBe(false);
  });

  it("treats an on-screen button as the same thing as a key", () => {
    // The whole point: a game asks for ACCELERATE and never learns whether a
    // thumb or a keyboard produced it.
    const im = new InputManager(DEFAULT_BINDINGS);
    im.setAction("ACCELERATE", true);
    expect(im.isDown("ACCELERATE")).toBe(true);
  });

  it("rebinds at runtime", () => {
    const im = new InputManager({ JUMP: { keys: ["Space"] } });
    im.setBindings({ JUMP: { keys: ["KeyJ"] } });
    im.setAction("JUMP", true);
    expect(im.isDown("JUMP")).toBe(true);
  });

  it("starts with a pointer that is up and still", () => {
    const im = new InputManager();
    const p = im.getPointer();
    expect(p.down).toBe(false);
    expect(p.dx).toBe(0);
    expect(p.dy).toBe(0);
  });

  it("ships bindings for the actions games actually use", () => {
    for (const a of ["MOVE_LEFT", "MOVE_RIGHT", "ACCELERATE", "BRAKE", "ACTION", "PAUSE"]) {
      expect(DEFAULT_BINDINGS[a]).toBeDefined();
    }
  });

  it("binds every default action to a key, not only a gamepad", () => {
    // A gamepad-only binding is unreachable for most players.
    for (const [action, b] of Object.entries(DEFAULT_BINDINGS)) {
      expect(b.keys?.length, action).toBeGreaterThan(0);
    }
  });
});
