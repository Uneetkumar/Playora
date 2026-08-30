import { describe, it, expect, vi } from "vitest";
import {
  runCinematic,
  CINEMATIC_ROOT_ATTR,
  CINEMATIC_ITEM_ATTR,
  type CinematicApi,
  type CinematicTimeline,
} from "../cinematic.js";

/**
 * The property under test is not "does it animate" — it is "does the content
 * always end up visible". A cinematic is decoration layered over a screen that
 * hides its own elements for one frame, so every failure path has to clear that
 * guard. If it does not, a decorative animation turns into a blank result
 * screen, which is far worse than no animation at all.
 */

function makeRoot(itemCount = 3): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute(CINEMATIC_ROOT_ATTR, "pending");
  for (let i = 0; i < itemCount; i++) {
    const el = document.createElement("div");
    el.setAttribute(CINEMATIC_ITEM_ATTR, `item-${i}`);
    root.appendChild(el);
  }
  document.body.appendChild(root);
  return root;
}

function fakeGsap(): { api: CinematicApi; timeline: CinematicTimeline; sets: unknown[] } {
  const sets: unknown[] = [];
  const timeline = {
    to: () => timeline,
    from: () => timeline,
    fromTo: () => timeline,
    set: () => timeline,
    progress: vi.fn(() => timeline),
    kill: vi.fn(),
  } as unknown as CinematicTimeline;

  const api: CinematicApi = {
    timeline: () => timeline,
    set: (_t, vars) => { sets.push(vars); },
  };
  return { api, timeline, sets };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("runCinematic", () => {
  it("reveals the content and never loads gsap under reduced motion", async () => {
    const root = makeRoot();
    const load = vi.fn(async () => fakeGsap().api);

    runCinematic({ root, build: () => {}, reduced: true, load });
    await flush();

    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
    expect(load).not.toHaveBeenCalled();
  });

  it("reveals the content when gsap cannot be loaded", async () => {
    const root = makeRoot();
    runCinematic({ root, build: () => {}, reduced: false, load: async () => null });
    await flush();

    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
  });

  it("reveals the content when the builder throws", async () => {
    const root = makeRoot();
    const { api } = fakeGsap();

    runCinematic({
      root,
      build: () => { throw new Error("bad timeline"); },
      reduced: false,
      load: async () => api,
    });
    await flush();

    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
  });

  it("reveals the content if gsap never arrives", async () => {
    vi.useFakeTimers();
    const root = makeRoot();

    runCinematic({
      root,
      build: () => {},
      reduced: false,
      load: () => new Promise(() => {}), // never settles
      timeoutMs: 500,
    });

    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("pending");
    vi.advanceTimersByTime(500);
    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
    vi.useRealTimers();
  });

  it("sets the opening state before lifting the guard", async () => {
    // Order matters: revealing first would paint every element at its final
    // position for one frame, then snap it back to the start of the animation.
    const root = makeRoot();
    const { api } = fakeGsap();
    const order: string[] = [];

    const observed: CinematicApi = {
      timeline: api.timeline,
      set: () => { order.push(`set:${root.getAttribute(CINEMATIC_ROOT_ATTR)}`); },
    };

    runCinematic({
      root,
      build: () => { order.push(`build:${root.getAttribute(CINEMATIC_ROOT_ATTR)}`); },
      reduced: false,
      load: async () => observed,
    });
    await flush();

    expect(order).toEqual(["set:pending", "build:done"]);
  });

  it("gives the builder the marked elements, addressable by name", async () => {
    const root = makeRoot(3);
    const { api } = fakeGsap();
    let seen: { count: number; named: number } | null = null;

    runCinematic({
      root,
      build: ({ items, select }) => {
        seen = { count: items.length, named: select("item-1").length };
      },
      reduced: false,
      load: async () => api,
    });
    await flush();

    expect(seen).toEqual({ count: 3, named: 1 });
  });

  it("jumps to the final frame before killing, so nothing is stranded", async () => {
    // kill() alone stops the timeline where it stands and leaves the inline
    // styles it wrote — for a fade-in that means content frozen at opacity 0.
    const root = makeRoot();
    const { api, timeline } = fakeGsap();

    const stop = runCinematic({
      root,
      build: ({ gsap }) => gsap.timeline(),
      reduced: false,
      load: async () => api,
    });
    await flush();
    stop();

    expect(timeline.progress).toHaveBeenCalledWith(1);
    expect(timeline.kill).toHaveBeenCalled();
    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
  });

  it("completes the timeline when the tab is backgrounded mid-sequence", async () => {
    // A hidden tab stops requestAnimationFrame, so GSAP's ticker stops too and
    // the sequence would otherwise freeze part-way with elements invisible.
    const root = makeRoot();
    const { api, timeline } = fakeGsap();

    runCinematic({ root, build: ({ gsap }) => gsap.timeline(), reduced: false, load: async () => api });
    await flush();

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(timeline.progress).toHaveBeenCalledWith(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not start a sequence in a tab that is already hidden", async () => {
    const root = makeRoot();
    const { api } = fakeGsap();
    const build = vi.fn();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });

    runCinematic({ root, build, reduced: false, load: async () => api });
    await flush();

    expect(build).not.toHaveBeenCalled();
    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not build a timeline after teardown", async () => {
    // An unmount that races the dynamic import must not animate a detached tree.
    const root = makeRoot();
    const { api } = fakeGsap();
    const build = vi.fn();

    const stop = runCinematic({ root, build, reduced: false, load: async () => api });
    stop();
    await flush();

    expect(build).not.toHaveBeenCalled();
    expect(root.getAttribute(CINEMATIC_ROOT_ATTR)).toBe("done");
  });
});
