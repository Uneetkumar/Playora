"use client";

import { cn } from "@playora/ui";
import { NavPanelForRoute } from "./nav-panel";

export const SIDEBAR_ID = "app-sidebar";

/**
 * The desktop sidebar (lg and up): 232px with labels, or a 72px icon rail.
 *
 * It sits in the page flow, sticky under the header, rather than fixed over
 * a padded <main>, so the content column simply takes whatever width is left:
 * no offsets to keep in step with the two widths, and nothing for a page to
 * get wrong. The width is CSS keyed off `data-sidebar` on <html>, which the
 * head bootstrap sets before the first paint, so a collapsed rail never loads
 * expanded and then snaps shut. It used to expand on mouse hover only, which
 * no keyboard ever triggered; the header's menu button now toggles it and the
 * choice is remembered.
 */
export function AppSidebar() {
  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className={cn(
        "sticky top-[var(--shell-header-h)] z-sticky hidden h-[calc(100dvh-var(--shell-header-h))] w-[232px] shrink-0 self-start border-r border-border bg-surface lg:block",
        "transition-[width] duration-hover ease-out-expo [[data-sidebar=collapsed]_&]:w-[72px]",
      )}
    >
      <NavPanelForRoute variant="rail" />
    </aside>
  );
}
