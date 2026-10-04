"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CommandPalette } from "./command-palette";
import { QuickPlayDrawer } from "./quick-play-drawer";

/*
 * The scanner pulls in jsQR (and asks for the camera), so it is loaded the
 * first time someone opens it rather than on every page.
 */
const QrScanDialog = dynamic(() => import("./qr-scan-dialog").then((m) => m.QrScanDialog), {
  ssr: false,
});

/**
 * The shell's overlays, opened from anywhere: the command palette, the QR
 * scanner and the phone's quick-play drawer. Each is mounted once, here,
 * whatever opened it, so the header button, the keyboard shortcut, the 404
 * page and the bottom bar all reach the same instance.
 */
export interface ShellActions {
  openPalette: () => void;
  openScanner: () => void;
  openQuickPlay: () => void;
}

const noop = () => {};
const ShellActionsContext = React.createContext<ShellActions>({
  openPalette: noop,
  openScanner: noop,
  openQuickPlay: noop,
});

export function useShellActions(): ShellActions {
  return React.useContext(ShellActionsContext);
}

/** Typing in a field, where "/" is a character and not a shortcut. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ShellActionsProvider({
  children,
  shortcuts,
}: {
  children: React.ReactNode;
  /**
   * Whether Ctrl/Cmd+K and "/" open the palette. Off on game routes: the
   * game owns the keyboard there, and a slash in a chat box or a key a game
   * binds must not pop a search over the board.
   */
  shortcuts: boolean;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [scannerLoaded, setScannerLoaded] = React.useState(false);
  const [quickPlayOpen, setQuickPlayOpen] = React.useState(false);

  React.useEffect(() => {
    if (!shortcuts) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);

  const openScanner = React.useCallback(() => {
    setScannerLoaded(true);
    setScannerOpen(true);
  }, []);

  const actions = React.useMemo<ShellActions>(
    () => ({
      openPalette: () => setPaletteOpen(true),
      openScanner,
      openQuickPlay: () => setQuickPlayOpen(true),
    }),
    [openScanner],
  );

  return (
    <ShellActionsContext.Provider value={actions}>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onOpenScanner={openScanner} />
      <QuickPlayDrawer open={quickPlayOpen} onOpenChange={setQuickPlayOpen} onOpenScanner={openScanner} />
      {scannerLoaded && <QrScanDialog open={scannerOpen} onOpenChange={setScannerOpen} />}
    </ShellActionsContext.Provider>
  );
}
