"use client";

import * as React from "react";

/**
 * The theme currently applied to <html>, kept live.
 *
 * The app's theme is a class on the root element (apps/web lib/theme.ts), not
 * a React context, so a component that has to pass the theme to a library —
 * sonner picks its icon and close-button styling from it — watches the class
 * instead. Dark is the default and the server snapshot, matching :root.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function snapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function useDocumentTheme(): "light" | "dark" {
  return React.useSyncExternalStore(subscribe, snapshot, () => "dark");
}
