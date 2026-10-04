"use client";

import * as React from "react";
import { Hash, Menu, ScanLine, Search } from "lucide-react";
import {
  Button,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  focusRingClass,
} from "@playora/ui";
import { BrandLink } from "./brand";
import { FriendsPopover } from "./friends-popover";
import { NotificationPopover } from "./notification-popover";
import { UserMenu } from "./user-menu";
import { MobileMenuSheet } from "./mobile-menu-sheet";
import { RoomCodeForm } from "./room-code-form";
import { SIDEBAR_ID } from "./app-sidebar";
import { useShellActions } from "./shell-actions";
import { setSidebarCollapsed, useModifierKeyLabel, useSidebarCollapsed } from "./use-shell-prefs";

/**
 * The top bar: menu, logo, search, the two ways into a friend's game (a code
 * or a QR), and you.
 *
 * Search is a button that opens the command palette rather than a field with
 * a dropdown, so the same box works from the header, from Ctrl/Cmd+K and
 * from "/", and so the results get a whole panel instead of a list hanging
 * off a 40px input. Everything that opens from here is portalled, which
 * matters because the bar's backdrop blur would otherwise become the
 * containing block for anything `fixed` inside it.
 */
export function AppHeader() {
  const { openPalette, openScanner } = useShellActions();
  const collapsed = useSidebarCollapsed();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const modKey = useModifierKeyLabel();

  return (
    <header
      className={cn(
        "sticky top-0 z-header border-b border-border bg-surface/85 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70",
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="flex h-16 items-center gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-3 lg:pl-4 lg:pr-6">
        {/* Below lg: opens the menu sheet. */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
        {/* lg and up: collapses the sidebar to its icon rail. Centred over
            the rail's icons, so the column of icons starts here. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden shrink-0 lg:inline-flex"
              onClick={() => setSidebarCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls={SIDEBAR_ID}
              aria-expanded={!collapsed}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>

        <BrandLink className="mr-1 lg:mr-4" />

        {/* Search: a full field-shaped button from sm, an icon below. */}
        <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search games"
            aria-keyshortcuts="Control+K Meta+K /"
            className={cn(
              "hidden h-10 w-full max-w-xl items-center gap-2.5 rounded-lg border border-input bg-background/60 px-3 text-sm text-muted-foreground sm:flex",
              "transition-[border-color,background-color] duration-hover ease-out-expo hover:border-foreground/20 hover:bg-background",
              focusRingClass,
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate text-left">Search games</span>
            <Kbd className="hidden md:inline-flex">{modKey === "⌘" ? "⌘K" : "Ctrl K"}</Kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 sm:hidden"
            onClick={openPalette}
            aria-label="Search games"
          >
            <Search className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Joining by code or QR; on phones these live in the Play sheet. */}
          <div className="hidden items-center gap-1.5 md:flex">
            <JoinRoomPopover onScan={openScanner} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={openScanner} aria-label="Scan a QR code">
                  <ScanLine className="h-5 w-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Scan a QR code</TooltipContent>
            </Tooltip>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          </div>

          {/* Friends has its own tab in the phone's bottom bar. */}
          <div className="hidden md:block">
            <FriendsPopover />
          </div>
          <NotificationPopover />
          <div className="ml-1">
            <UserMenu />
          </div>
        </div>
      </div>

      <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}

function JoinRoomPopover({ onScan }: { onScan: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="h-9 px-3" aria-label="Join a room by code">
          <Hash className="h-4 w-4" aria-hidden />
          <span className="hidden xl:inline">Join room</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h2 className="font-display text-base font-bold text-foreground">Join a room</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">Enter the code from your host&apos;s screen.</p>
        <RoomCodeForm idPrefix="header-join" autoFocus onJoined={() => setOpen(false)} />
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mt-2 text-muted-foreground"
          onClick={() => {
            setOpen(false);
            onScan();
          }}
        >
          <ScanLine className="h-4 w-4" aria-hidden />
          Scan a QR code instead
        </Button>
      </PopoverContent>
    </Popover>
  );
}
