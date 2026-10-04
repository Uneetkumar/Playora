"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { GameId } from "@playora/game-types";
import { Moon, Sun } from "lucide-react";
import {
  ScrollArea,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  focusRingClass,
} from "@playora/ui";
import { useAuthStore } from "../../lib/store/auth-store";
import { useStaffRole } from "../../hooks/use-staff";
import { useRecentlyPlayed } from "../../hooks/use-recently-played";
import { getCatalogGame, isGameId } from "../../lib/games/catalog";
import type { GameGenre } from "../../lib/games/meta";
import { parseBrowseParams } from "../../lib/games/browse-url";
import { GENRE_NAV, NAV, NAV_SECTIONS, isNavActive, type NavItem } from "./nav";
import { GameThumb } from "./game-thumb";
import { toggleTheme, useResolvedTheme, useSidebarCollapsed } from "./use-shell-prefs";

/**
 * The navigation itself, shared by the desktop sidebar and the phone/tablet
 * menu sheet so the two can never list different things.
 *
 * As the sidebar (`rail`), it can be collapsed to a 72px icon rail. The
 * collapse is CSS keyed off `data-sidebar="collapsed"` on <html>, set before
 * first paint (sidebar-bootstrap.ts), so labels and widths are right on the
 * very first frame; React only reads the state to turn the rail's tooltips
 * on. Collapsed labels stay in the DOM as `sr-only`, so every link keeps its
 * accessible name.
 */

const LIBRARY_SIZE = 5;

/** Hides a label on the collapsed rail, keeping it for screen readers. */
const railLabel = "[[data-sidebar=collapsed]_&]:sr-only";
/** Removes decoration (counts, empty-state copy) from the collapsed rail. */
const railHidden = "[[data-sidebar=collapsed]_&]:hidden";

interface PanelContext {
  rail: boolean;
  /** Tooltips are on only while the rail is collapsed. */
  collapsed: boolean;
  onNavigate?: () => void;
}

const Ctx = React.createContext<PanelContext>({ rail: false, collapsed: false });

const rowClassName = (active: boolean) =>
  cn(
    "relative flex w-full items-center gap-3 rounded-lg px-3.5 text-sm font-medium",
    "transition-colors duration-hover ease-out-expo",
    focusRingClass,
    active
      ? "bg-primary/10 text-foreground"
      : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
  );

/** The sidebar's left-edge marker on the current page. */
function ActiveBar() {
  return <span aria-hidden className="absolute -left-3 bottom-2 top-2 w-1 rounded-r-full bg-primary" />;
}

/** A tooltip naming the row, on the collapsed rail only. */
function RailTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  const { rail, collapsed } = React.useContext(Ctx);
  // Always controlled: switching `open` between a value and undefined as the
  // rail collapses would flip Radix between controlled and uncontrolled.
  const [open, setOpen] = React.useState(false);
  if (!rail) return children;
  return (
    <Tooltip open={collapsed && open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavRow({
  item,
  active,
  leading,
  trailing,
  dense = false,
}: {
  item: NavItem;
  active: boolean;
  /** Replaces the icon, e.g. a game's cover. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  dense?: boolean;
}) {
  const { rail, onNavigate } = React.useContext(Ctx);
  const Icon = item.icon;
  return (
    <li>
      <RailTooltip label={item.label}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={cn(rowClassName(active), dense ? "h-9" : "h-10")}
        >
          {active && rail && <ActiveBar />}
          {leading ?? (
            <Icon
              className={cn("h-5 w-5 shrink-0", active && "text-primary-accent")}
              aria-hidden
            />
          )}
          <span className={cn("min-w-0 flex-1 truncate", rail && railLabel)}>{item.label}</span>
          {trailing && <span className={cn("shrink-0", rail && railHidden)}>{trailing}</span>}
        </Link>
      </RailTooltip>
    </li>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  const { rail } = React.useContext(Ctx);
  return (
    <>
      <p
        id={id}
        className={cn(
          "px-3.5 pb-1.5 pt-5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground",
          rail && railLabel,
        )}
      >
        {children}
      </p>
      {/* On the rail the heading collapses to a hairline between groups. */}
      {rail && (
        <div aria-hidden className="mx-3.5 my-3 hidden h-px bg-border [[data-sidebar=collapsed]_&]:block" />
      )}
    </>
  );
}

function LibrarySection({ pathname }: { pathname: string }) {
  const { rail } = React.useContext(Ctx);
  const { entries, isLoading } = useRecentlyPlayed();

  const games = React.useMemo(() => {
    const ids: GameId[] = [];
    for (const e of entries) {
      if (isGameId(e.gameSlug) && !ids.includes(e.gameSlug)) ids.push(e.gameSlug);
      if (ids.length === LIBRARY_SIZE) break;
    }
    return ids;
  }, [entries]);

  return (
    <div className={cn(games.length === 0 && !isLoading && rail && railHidden)}>
      <SectionHeading id={`${rail ? "rail" : "sheet"}-library`}>Your library</SectionHeading>
      {isLoading ? (
        <div className="space-y-2 px-3.5 py-1" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <p className={cn("px-3.5 pb-1 text-meta text-muted-foreground", rail && railHidden)}>
          Games you play show up here.
        </p>
      ) : (
        <ul aria-labelledby={`${rail ? "rail" : "sheet"}-library`} className="space-y-0.5">
          {games.map((id) => {
            const href = `/games/${id}`;
            return (
              <NavRow
                key={id}
                item={{ id, label: getCatalogGame(id)?.name ?? id, href, icon: NAV.browse.icon }}
                active={pathname === href}
                leading={<GameThumb id={id} sizes="28px" className="-mx-1 h-7 w-7 rounded-sm" />}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ThemeRow() {
  const { rail } = React.useContext(Ctx);
  const light = useResolvedTheme() === "light";
  const label = light ? "Dark theme" : "Light theme";
  const Icon = light ? Moon : Sun;
  return (
    <li>
      <RailTooltip label={`Switch to ${label.toLowerCase()}`}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${label.toLowerCase()}`}
          className={cn(rowClassName(false), "h-10")}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className={cn("truncate", rail && railLabel)} aria-hidden>
            {label}
          </span>
        </button>
      </RailTooltip>
    </li>
  );
}

export function NavPanel({
  variant,
  activeGenres,
  onNavigate,
  header,
}: {
  variant: "rail" | "sheet";
  /** The genres Browse is filtered by: each one's shortcut is lit. */
  activeGenres: readonly GameGenre[];
  /** Called on every link, so the sheet can close itself. */
  onNavigate?: () => void;
  /** Content above the scrolling list (the sheet's account row). */
  header?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const user = useAuthStore((s) => s.user);
  const { isStaff } = useStaffRole(user?.id);
  const collapsed = useSidebarCollapsed();
  const rail = variant === "rail";
  const ctx = React.useMemo<PanelContext>(
    () => ({ rail, collapsed: rail && collapsed, onNavigate }),
    [rail, collapsed, onNavigate],
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex h-full min-h-0 flex-col">
        {header}
        {/* Radix's viewport wraps content in a `display: table` box, which
            defeats `truncate`; forcing it to block keeps long names in bounds. */}
        <ScrollArea className="min-h-0 flex-1" viewportClassName="[&>div]:!block">
          <nav aria-label="Main menu" className="px-3 pb-4 pt-3">
            {NAV_SECTIONS.map((section) => {
              const headingId = `${variant}-nav-${section.id}`;
              const items = section.id === "you" && isStaff ? [...section.items, NAV.staff] : section.items;
              return (
                <div key={section.id}>
                  {section.label && <SectionHeading id={headingId}>{section.label}</SectionHeading>}
                  <ul aria-labelledby={section.label ? headingId : undefined} className="space-y-0.5">
                    {items.map((item) => (
                      <NavRow key={item.id} item={item} active={isNavActive(item, pathname, activeGenres)} />
                    ))}
                  </ul>
                </div>
              );
            })}

            <LibrarySection pathname={pathname} />

            <SectionHeading id={`${variant}-nav-genres`}>Genres</SectionHeading>
            <ul aria-labelledby={`${variant}-nav-genres`} className="space-y-0.5">
              {GENRE_NAV.map((item) => (
                <NavRow
                  key={item.id}
                  item={item}
                  dense
                  active={isNavActive(item, pathname, activeGenres)}
                  trailing={
                    // aria-label on a plain span is ignored when the link's
                    // name is computed, which read as "Racing2"; spell it out.
                    <>
                      <span className="numeric text-xs text-muted-foreground" aria-hidden>
                        {item.count}
                      </span>
                      <span className="sr-only">, {item.count} games</span>
                    </>
                  }
                />
              ))}
            </ul>
          </nav>
        </ScrollArea>

        <div className="border-t border-border px-3 py-3">
          <ul className="space-y-0.5">
            <NavRow item={NAV.settings} active={isNavActive(NAV.settings, pathname)} />
            <ThemeRow />
          </ul>
        </div>
      </div>
    </Ctx.Provider>
  );
}

const NO_GENRES: readonly GameGenre[] = [];

function NavPanelWithParams(props: Omit<React.ComponentProps<typeof NavPanel>, "activeGenres">) {
  // Read as Browse reads them (any case, repeated or comma-separated), so a
  // row is lit exactly when Browse shows that genre's chip as on.
  const genres = parseBrowseParams(useSearchParams()).genres;
  return <NavPanel {...props} activeGenres={genres} />;
}

/**
 * The panel with the genres from the URL. `useSearchParams` suspends a
 * statically rendered page, so the server draws the same panel with no genre
 * lit, and the highlight lands on hydration without moving anything.
 */
export function NavPanelForRoute(props: Omit<React.ComponentProps<typeof NavPanel>, "activeGenres">) {
  return (
    <React.Suspense fallback={<NavPanel {...props} activeGenres={NO_GENRES} />}>
      <NavPanelWithParams {...props} />
    </React.Suspense>
  );
}
