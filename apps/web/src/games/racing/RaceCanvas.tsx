"use client";

import * as React from "react";
import type { RacingPlayerView, TrackSpec, VehicleInput } from "@playora/game-engine";
import { RaceScene } from "./RaceScene";

interface RaceCanvasProps {
  track: TrackSpec;
  isBike: boolean;
  followId: string;
  /** Registers a callback the game loop calls with every simulated frame. */
  onReady: (draw: (view: RacingPlayerView) => void) => void;
  setInput: (patch: Partial<VehicleInput>) => void;
  /** Steering is disabled while the result screen is up. */
  interactive: boolean;
}

/** How fast the steering follows the keys, in units per second. */
const KEY_STEER_RATE = 3.2;
const KEY_STEER_RETURN = 4.5;

/**
 * The 3D view, and everything that drives it.
 *
 * The canvas is mounted once per track and handed to a plain Three.js scene.
 * Nothing in here is React state: the draw callback is registered upward, the
 * game loop calls it sixty times a second, and this component re-renders only
 * when the track or the vehicle type changes.
 *
 * Steering is smoothed rather than binary. A key press that snaps the wheel to
 * full lock is unusable at speed — the vehicle darts — so held keys ramp
 * towards lock and released keys ramp back to centre.
 */
export function RaceCanvas({
  track,
  isBike,
  followId,
  onReady,
  setInput,
  interactive,
}: RaceCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const sceneRef = React.useRef<RaceScene | null>(null);
  const keysRef = React.useRef({ left: false, right: false, throttle: false, brake: false });
  const steerRef = React.useRef(0);
  const pointerSteerRef = React.useRef<number | null>(null);
  const setInputRef = React.useRef(setInput);
  setInputRef.current = setInput;

  // Build the scene. Rebuilt only when the track changes, because building it
  // means uploading the whole road to the GPU.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new RaceScene(canvas, track, { isBike });
    sceneRef.current = scene;

    onReady((view) => scene.update(view, followId));

    const observer = new ResizeObserver(() => scene.resize());
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [track, isBike, followId, onReady]);

  // Steering ramp. Runs on its own animation frame so it is smooth regardless
  // of how often keys arrive.
  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;

      const keys = keysRef.current;
      const pointer = pointerSteerRef.current;

      if (pointer !== null) {
        // Pointer steering is absolute: where the cursor is across the canvas
        // is where the wheel is, which is how the reference game reads.
        steerRef.current += (pointer - steerRef.current) * Math.min(1, delta * 12);
      } else if (keys.left && !keys.right) {
        steerRef.current = Math.max(-1, steerRef.current - KEY_STEER_RATE * delta);
      } else if (keys.right && !keys.left) {
        steerRef.current = Math.min(1, steerRef.current + KEY_STEER_RATE * delta);
      } else {
        const back = KEY_STEER_RETURN * delta;
        steerRef.current =
          Math.abs(steerRef.current) <= back
            ? 0
            : steerRef.current - Math.sign(steerRef.current) * back;
      }

      setInputRef.current({
        steer: steerRef.current,
        throttle: keys.throttle,
        brake: keys.brake,
      });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (!interactive) return;

    const down = (e: KeyboardEvent) => {
      const keys = keysRef.current;
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          keys.throttle = true;
          break;
        case "s":
        case "arrowdown":
          keys.brake = true;
          break;
        case "a":
        case "arrowleft":
          keys.left = true;
          break;
        case "d":
        case "arrowright":
          keys.right = true;
          break;
        case "n":
        case " ":
          setInputRef.current({ nitro: true });
          break;
        default:
          return;
      }
      // Arrows and space scroll the page otherwise, which is disastrous
      // mid-race.
      e.preventDefault();
    };

    const up = (e: KeyboardEvent) => {
      const keys = keysRef.current;
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          keys.throttle = false;
          break;
        case "s":
        case "arrowdown":
          keys.brake = false;
          break;
        case "a":
        case "arrowleft":
          keys.left = false;
          break;
        case "d":
        case "arrowright":
          keys.right = false;
          break;
        default:
          break;
      }
    };

    // A tab switch mid-corner would otherwise leave a key stuck down.
    const blur = () => {
      keysRef.current = { left: false, right: false, throttle: false, brake: false };
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [interactive]);

  const pointerSteer = (clientX: number, target: HTMLElement) => {
    const bounds = target.getBoundingClientRect();
    const across = (clientX - bounds.left) / Math.max(1, bounds.width);
    // A dead zone through the middle third, so holding the cursor roughly
    // centred drives straight instead of weaving.
    const centred = (across - 0.5) * 2;
    pointerSteerRef.current = Math.max(-1, Math.min(1, centred * 1.35));
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none rounded-xl"
      aria-label="Race view"
      onPointerDown={(e) => {
        if (!interactive) return;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        keysRef.current.throttle = true;
        pointerSteer(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => {
        if (!interactive) return;
        // Only steer with the pointer while it is down, or a resting cursor
        // would hold the wheel over.
        if (e.buttons > 0) pointerSteer(e.clientX, e.currentTarget);
      }}
      onPointerUp={() => {
        keysRef.current.throttle = false;
        pointerSteerRef.current = null;
      }}
      onPointerLeave={() => {
        keysRef.current.throttle = false;
        pointerSteerRef.current = null;
      }}
    />
  );
}
