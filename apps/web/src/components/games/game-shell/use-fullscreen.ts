"use client";

import * as React from "react";

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const CHANGE_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;

function doc(): FullscreenDocument | null {
  return typeof document === "undefined" ? null : (document as FullscreenDocument);
}

function currentElement(): Element | null {
  const d = doc();
  return d ? (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) : null;
}

function readSupported(): boolean {
  const d = doc();
  return Boolean(d && (d.fullscreenEnabled || d.webkitFullscreenEnabled));
}

function readActive(): boolean {
  return currentElement() !== null;
}

function subscribe(onChange: () => void): () => void {
  const d = doc();
  if (!d) return () => {};
  for (const name of CHANGE_EVENTS) d.addEventListener(name, onChange);
  return () => {
    for (const name of CHANGE_EVENTS) d.removeEventListener(name, onChange);
  };
}

// Support never changes during a page's life, so there is nothing to observe.
const subscribeNever = () => () => {};
const serverFalse = () => false;

// requestFullscreen rejects when the browser refuses (no user gesture, an
// iframe without allowfullscreen); older Safari returns undefined instead of
// a promise. Either way the toggle simply stays off.
function settle(result: Promise<void> | void): void {
  if (result && typeof result.catch === "function") result.catch(() => {});
}

function exitFullscreen(): void {
  const d = doc();
  if (!d || !currentElement()) return;
  if (d.exitFullscreen) settle(d.exitFullscreen());
  else if (d.webkitExitFullscreen) settle(d.webkitExitFullscreen());
}

/**
 * Fullscreen for the whole page, with Safari's prefixed API as a fallback.
 *
 * The target is <html>, not the shell's own root, on purpose. In fullscreen
 * the browser paints only the fullscreen element's subtree, and every overlay
 * the shell opens (the pause sheet, the leave confirmation, tooltips, toasts)
 * is portalled to <body> by Radix and sonner. Fullscreening the shell root
 * would hide the pause menu exactly when it is needed. Game routes already
 * draw the shell edge to edge, so the result looks the same.
 *
 * `supported` is false on the server and on iPhone Safari, which only allows
 * fullscreen for video; the shell hides its button rather than offering one
 * that does nothing. Fullscreen the shell entered is exited on unmount, so
 * leaving a game does not strand the next page in fullscreen.
 *
 * `onExternalExit` runs when fullscreen ends without `toggle`: almost always
 * Escape. The browser keeps that Escape to itself and never delivers the
 * keydown, so without this the shell's "Esc pauses" would quietly fail in
 * fullscreen, leaving the game running as the screen shrinks.
 */
export function useFullscreen(
  onExternalExit?: () => void,
): { supported: boolean; active: boolean; toggle: () => void } {
  const supported = React.useSyncExternalStore(subscribeNever, readSupported, serverFalse);
  const active = React.useSyncExternalStore(subscribe, readActive, serverFalse);
  const enteredRef = React.useRef(false);
  // Set while `toggle` is leaving, so that exit is not reported as external.
  const leavingRef = React.useRef(false);
  const wasActiveRef = React.useRef(active);
  const onExternalExitRef = React.useRef(onExternalExit);
  onExternalExitRef.current = onExternalExit;

  React.useEffect(() => {
    if (wasActiveRef.current && !active && !leavingRef.current) onExternalExitRef.current?.();
    if (!active) leavingRef.current = false;
    wasActiveRef.current = active;
  }, [active]);

  const toggle = React.useCallback(() => {
    if (currentElement()) {
      enteredRef.current = false;
      leavingRef.current = true;
      exitFullscreen();
      return;
    }
    const el = document.documentElement as FullscreenElement;
    enteredRef.current = true;
    leavingRef.current = false;
    if (el.requestFullscreen) settle(el.requestFullscreen({ navigationUI: "hide" }));
    else if (el.webkitRequestFullscreen) settle(el.webkitRequestFullscreen());
  }, []);

  React.useEffect(
    () => () => {
      if (enteredRef.current && currentElement() === document.documentElement) exitFullscreen();
    },
    [],
  );

  return { supported, active, toggle };
}
