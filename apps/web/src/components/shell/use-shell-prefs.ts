"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, THEME_STORAGE_KEY } from "../../lib/theme";
import { SIDEBAR_ATTRIBUTE, SIDEBAR_COLLAPSED, SIDEBAR_STORAGE_KEY } from "./sidebar-bootstrap";

/*
 * Shell preferences that live on <html> rather than in React: the sidebar's
 * collapsed state (`data-sidebar`) and the resolved theme (`.light`). Both
 * are put there before first paint by inline bootstraps, and Settings can
 * change the theme from elsewhere, so components subscribe to the element
 * itself and every reader stays in step with whoever wrote it last.
 *
 * The server snapshots are the defaults (expanded, dark), so hydration
 * matches the markup; the real value arrives one commit later, by which time
 * CSS keyed off the same attributes has already drawn the right thing.
 */

function observeHtml(attributes: string[]) {
  return (onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: attributes });
    return () => observer.disconnect();
  };
}

const subscribeSidebar = observeHtml([SIDEBAR_ATTRIBUTE]);
const subscribeTheme = observeHtml(["class"]);

function readCollapsed(): boolean {
  return document.documentElement.getAttribute(SIDEBAR_ATTRIBUTE) === SIDEBAR_COLLAPSED;
}

function readLight(): boolean {
  return document.documentElement.classList.contains("light");
}

const serverFalse = () => false;

/** True while the desktop sidebar is the 72px icon rail. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribeSidebar, readCollapsed, serverFalse);
}

export function setSidebarCollapsed(collapsed: boolean): void {
  const root = document.documentElement;
  if (collapsed) root.setAttribute(SIDEBAR_ATTRIBUTE, SIDEBAR_COLLAPSED);
  else root.removeAttribute(SIDEBAR_ATTRIBUTE);
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? SIDEBAR_COLLAPSED : "expanded");
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/** The theme actually on screen, with "system" already resolved. */
export function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribeTheme, readLight, serverFalse) ? "light" : "dark";
}

/**
 * Flips between light and dark and saves the choice, exactly as picking it in
 * Settings would. A saved "system" becomes an explicit choice: someone who
 * pressed the switch wants the other theme now, whatever the OS says.
 */
export function toggleTheme(): void {
  const next = readLight() ? "dark" : "light";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* storage unavailable: the theme lasts for this page only */
  }
}

const subscribeNothing = () => () => {};

/**
 * "⌘" on Apple platforms, "Ctrl" elsewhere, for shortcut hints. Ctrl until
 * hydrated, which is what most visitors see anyway.
 */
export function useModifierKeyLabel(): string {
  return useSyncExternalStore(
    subscribeNothing,
    () => (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
