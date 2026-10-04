"use client";

import * as React from "react";
import { ArrowDownUp, LayoutGrid, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ToggleGroup,
  ToggleGroupItem,
  cn,
  focusRingClass,
} from "@playora/ui";
import { GAME_GENRES, type GameGenre } from "../../lib/games/meta";
import { gameViews } from "../../lib/games/view";
import {
  GAME_SORTS,
  MODE_FILTERS,
  PLAYERS_FILTERS,
  isGameSort,
  isModeFilter,
  isPlayersFilter,
  type GameSort,
  type ModeFilter,
  type PlayersFilter,
} from "../../lib/games/browse";
import {
  MAX_QUERY_LENGTH,
  browseResults,
  effectiveSort,
  genreCounts,
  hasFilters,
  type BrowseState,
} from "../../lib/games/browse-url";
import { useEdgeFade } from "../../hooks/use-edge-fade";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useReducedMotionPref } from "../../lib/motion";
import { GameCard } from "../../components/games/game-card";
import { MODE_ICON } from "../../components/games/mode-chips";
import { GENRE_ICONS } from "../../components/shell/nav";

/**
 * The catalogue, filtered: a sticky bar of filters over a grid of cards.
 *
 * Purely a view of `state`. Where that state lives (the URL) and how changes
 * get there is `BrowseCatalog`'s business; this only reports them through
 * `onChange`. That split is what lets the server render the unfiltered page
 * for crawlers and first paint with the same component, before the browser
 * has read the address bar.
 *
 * Genres are toggles that combine ("Cards" and "Party" shows both), because
 * the home page's shelves pair genres and their "See all" opens exactly that
 * pair. Players and Mode are one-of groups; pressing the chosen option again
 * clears it. From `xl` everything sits in the bar; below it Players, Mode and
 * (on phones) the order move into a sheet behind a Filters button, so the bar
 * stays two rows tall.
 */

export interface BrowseChangeOptions {
  /** Wait this long for more typing before writing the URL. */
  debounceMs?: number;
}

export interface BrowseViewProps {
  state: BrowseState;
  /** The moment badges are judged by; the page reads it once. */
  now: number;
  onChange?: (patch: Partial<BrowseState>, options?: BrowseChangeOptions) => void;
  /** Write any change still waiting on the debounce, now. */
  onFlush?: () => void;
}

const noop = () => {};

const SPOKEN_PLAYERS: Readonly<Record<PlayersFilter, string>> = {
  "1p": "One player",
  "2p": "Two players",
  "2-4p": "Three or four players",
  party: "Five or more players",
};

const SORT_LABEL: Readonly<Record<GameSort | "relevance", string>> = {
  relevance: "Best match",
  ...(Object.fromEntries(GAME_SORTS.map((s) => [s.id, s.label])) as Record<GameSort, string>),
};

/**
 * The grid fits as many columns as keep each card at least 240px wide, the
 * design system's smallest landscape card. Narrower, the meta row has no room
 * and the genre truncates to a letter. Counting columns from the space
 * rather than from breakpoints also follows the sidebar as it collapses.
 */
const GRID_CLASS = "grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]";

/**
 * A cell's width for the covers' `sizes`, as that grid lays out beside the
 * sidebar: one column on a phone, two on a tablet, three around 1280px,
 * four or more from 1440px.
 */
const GRID_SIZES =
  "(min-width: 1440px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 36vw, (min-width: 640px) 46vw, 92vw";

export function BrowseView({ state, now, onChange = noop, onFlush = noop }: BrowseViewProps) {
  const views = React.useMemo(() => gameViews({ now }), [now]);
  const results = React.useMemo(() => browseResults(state, views), [state, views]);
  const counts = React.useMemo(() => genreCounts(state, views), [state, views]);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const clearAll = () => onChange({ genres: [], players: null, mode: null, q: "" });
  const filtered = hasFilters(state);
  const q = state.q.trim();
  // Shown under the bar where the bar does not show them itself.
  const hiddenFilters = (state.players ? 1 : 0) + (state.mode ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <header className="max-w-2xl">
        <h1 className="flex items-center gap-3 font-display text-h1 text-foreground">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary-accent"
          >
            <LayoutGrid className="h-5 w-5" />
          </span>
          Browse games
        </h1>
        <p className="mt-2 text-muted-foreground">
          Every game on Playora, free in your browser. Narrow it down by genre, by how many of you
          are playing, or by how you want to play.
        </p>
      </header>

      <div
        role="search"
        aria-label="Filter games"
        className={cn(
          "sticky top-[var(--shell-header-h)] z-sticky mt-6 space-y-3 border-b border-border py-3",
          "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
          "bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <SearchField
            value={state.q}
            onChange={(value) => onChange({ q: value }, { debounceMs: 250 })}
            onClear={() => onChange({ q: "" })}
            onSubmit={onFlush}
          />

          <div className="hidden items-center gap-3 xl:flex">
            <PlayersToggle value={state.players} onChange={(players) => onChange({ players })} />
            <ModeToggle value={state.mode} onChange={(mode) => onChange({ mode })} />
          </div>

          <SortSelect
            state={state}
            onChange={(sort) => onChange({ sort })}
            className="hidden sm:flex"
          />

          <Button
            variant="outline"
            className="shrink-0 xl:hidden"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal aria-hidden className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Filters</span>
            {hiddenFilters > 0 && (
              <span className="numeric grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                {hiddenFilters}
                <span className="sr-only"> on</span>
              </span>
            )}
          </Button>
        </div>

        <GenreToggles
          value={state.genres}
          counts={counts}
          onChange={(genres) => onChange({ genres })}
        />
      </div>

      <div className="mt-5 flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          <span className="numeric font-semibold text-foreground">{results.length}</span>{" "}
          {results.length === 1 ? "game" : "games"}
          {q && (
            <>
              {" "}
              for <span className="font-semibold text-foreground">&ldquo;{q}&rdquo;</span>
            </>
          )}
        </p>

        {/* The filters the bar hides below xl, as chips that remove themselves. */}
        {hiddenFilters > 0 && (
          <ul role="list" className="flex flex-wrap gap-2 xl:hidden">
            {state.players && (
              <li>
                <RemovableChip
                  label={
                    PLAYERS_FILTERS.find((f) => f.id === state.players)?.label ?? state.players
                  }
                  spoken={SPOKEN_PLAYERS[state.players]}
                  onRemove={() => onChange({ players: null })}
                />
              </li>
            )}
            {state.mode && (
              <li>
                <RemovableChip
                  label={MODE_FILTERS.find((f) => f.id === state.mode)?.label ?? state.mode}
                  onRemove={() => onChange({ mode: null })}
                />
              </li>
            )}
          </ul>
        )}

        {filtered && (
          <Button
            variant="ghost"
            onClick={clearAll}
            // A 40px target on a phone; the compact size from `sm`.
            className="text-muted-foreground hover:text-foreground sm:h-8 sm:rounded-md sm:px-3 sm:text-xs"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {results.length > 0 ? (
        <ul role="list" aria-label="Games" className={cn("mt-4 grid gap-3 lg:gap-4", GRID_CLASS)}>
          {/* No `priority`: Next sends it as a preload header whose srcset
              Chrome cannot parse, so each one also fetches the 3840px file
              and never uses it. The first row is in view and loads at once. */}
          {results.map((game) => (
            <li key={game.id}>
              <GameCard game={game} variant="landscape" layout="grid" sizes={GRID_SIZES} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState query={q} onClear={clearAll} />
      )}

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        state={state}
        resultCount={results.length}
        onChange={onChange}
      />
    </div>
  );
}

/* ─── Controls ──────────────────────────────────────────────────────────── */

function SearchField({
  value,
  onChange,
  onClear,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <form
      className="relative min-w-0 flex-1 xl:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
        // On a phone, the keyboard's Search key means "show me": put the
        // keyboard away so the results are visible.
        if (window.matchMedia("(hover: none)").matches) input.current?.blur();
      }}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, MAX_QUERY_LENGTH))}
        placeholder="Search games"
        aria-label="Search games"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className="pl-9 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onClear();
            input.current?.focus();
          }}
          aria-label="Clear search"
          className={cn(
            "absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground",
            "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.06] hover:text-foreground",
            focusRingClass
          )}
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

function PlayersToggle({
  value,
  onChange,
  stretch = false,
}: {
  value: PlayersFilter | null;
  onChange: (value: PlayersFilter | null) => void;
  stretch?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="Players"
      value={value ?? ""}
      onValueChange={(next) => onChange(isPlayersFilter(next) ? next : null)}
      className={cn(stretch && "flex w-full")}
    >
      {PLAYERS_FILTERS.map((f) => (
        <ToggleGroupItem
          key={f.id}
          value={f.id}
          aria-label={SPOKEN_PLAYERS[f.id]}
          className="numeric"
        >
          {f.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ModeToggle({
  value,
  onChange,
  stretch = false,
}: {
  value: ModeFilter | null;
  onChange: (value: ModeFilter | null) => void;
  stretch?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="How to play"
      value={value ?? ""}
      onValueChange={(next) => onChange(isModeFilter(next) ? next : null)}
      className={cn(stretch && "grid w-full grid-cols-2 sm:flex")}
    >
      {MODE_FILTERS.map((f) => {
        const Icon = MODE_ICON[f.id];
        return (
          <ToggleGroupItem key={f.id} value={f.id}>
            <Icon aria-hidden />
            {f.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function SortSelect({
  state,
  onChange,
  className,
}: {
  state: BrowseState;
  onChange: (sort: GameSort | null) => void;
  className?: string;
}) {
  const searching = state.q.trim() !== "";
  const value = effectiveSort(state);
  return (
    <Select
      value={value}
      onValueChange={(next) =>
        // The default order is stored as no order, so the URL stays clean and
        // a later search can fall back to relevance.
        onChange(isGameSort(next) && !(next === "popular" && !searching) ? next : null)
      }
    >
      {/* Icon and value as the trigger's own children: it clamps each child
          span to one line, which would stack a wrapper's contents. */}
      <SelectTrigger
        aria-label="Sort games"
        className={cn("w-[10.5rem] shrink-0 justify-start [&>span]:flex-1", className)}
      >
        <ArrowDownUp aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        <SelectValue>{SORT_LABEL[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {searching && <SelectItem value="relevance">{SORT_LABEL.relevance}</SelectItem>}
        {GAME_SORTS.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The value Radix gives the "All" toggle; never a genre name. */
const ALL = "all";

function GenreToggles({
  value,
  counts,
  onChange,
}: {
  value: readonly GameGenre[];
  counts: Record<GameGenre, number>;
  onChange: (genres: GameGenre[]) => void;
}) {
  const total = GAME_GENRES.reduce((sum, g) => sum + counts[g], 0);
  const scroller = React.useRef<HTMLDivElement>(null);
  const fade = useEdgeFade(scroller);
  const reduced = useReducedMotionPref();

  // Bring the first chosen genre into the row's view, on arrival and on each
  // change: on a phone the row is a scroller, and /games?genre=Party (from the
  // menu, say) showed All, Racing and Cards with nothing lit. Horizontal only,
  // so a restored page scroll is left alone; clear of the edge fade.
  const chosen = value.join(",");
  const arrived = React.useRef(false);
  React.useEffect(() => {
    const el = scroller.current;
    const on = el?.querySelector<HTMLElement>('[data-state="on"]');
    if (!el || !on) return;
    const box = el.getBoundingClientRect();
    const chip = on.getBoundingClientRect();
    const clear = 40;
    const delta =
      chip.left < box.left + clear
        ? chip.left - box.left - clear
        : chip.right > box.right - clear
          ? chip.right - box.right + clear
          : 0;
    if (delta !== 0) {
      el.scrollBy({ left: delta, behavior: arrived.current && !reduced ? "smooth" : "auto" });
    }
    arrived.current = true;
    // `chosen` stands for `value`, which may be a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  const itemClassName = cn(
    "h-9 shrink-0 rounded-full border border-border bg-card px-3 text-foreground shadow-card",
    "hover:border-foreground/20 data-[state=on]:border-primary/50"
  );

  return (
    <ToggleGroup
      ref={scroller}
      type="multiple"
      variant="outline"
      aria-label="Genres"
      style={fade}
      value={value.length > 0 ? [...value] : [ALL]}
      onValueChange={(next) => {
        // Pressing "All" while genres are on clears them, and so does
        // turning the last genre off. Pressing a genre while "All" is on
        // replaces it, which the filter below does by dropping ALL.
        const pressedAll = next.includes(ALL) && value.length > 0;
        const genres = GAME_GENRES.filter((g) => next.includes(g));
        onChange(pressedAll && genres.length === value.length ? [] : genres);
      }}
      // The padding is room for the focus ring, which the scroller clips.
      // A tighter gap from `xl`, so all nine fit beside the expanded sidebar
      // at 1440 rather than clipping the last count by a few pixels.
      className="scrollbar-none -m-1 flex justify-start gap-2 overflow-x-auto p-1 xl:gap-1.5"
    >
      <ToggleGroupItem value={ALL} aria-label={`All, ${total} games`} className={itemClassName}>
        <LayoutGrid aria-hidden />
        All
        <ChipCount value={total} />
      </ToggleGroupItem>
      {GAME_GENRES.map((genre) => {
        const Icon = GENRE_ICONS[genre];
        const n = counts[genre];
        return (
          <ToggleGroupItem
            key={genre}
            value={genre}
            aria-label={`${genre}, ${n} ${n === 1 ? "game" : "games"}`}
            className={cn(itemClassName, n === 0 && "opacity-60")}
          >
            <Icon aria-hidden />
            {genre}
            <ChipCount value={n} />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

function ChipCount({ value }: { value: number }) {
  return (
    <span
      aria-hidden
      className="numeric grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 text-xs font-bold text-muted-foreground"
    >
      {value}
    </span>
  );
}

function RemovableChip({
  label,
  spoken,
  onRemove,
}: {
  label: string;
  spoken?: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${spoken ?? label}`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/15 pl-3 pr-2 text-xs font-semibold text-primary-accent",
        "transition-colors duration-hover ease-out-expo hover:bg-primary/25",
        focusRingClass
      )}
    >
      {label}
      <X aria-hidden className="h-3.5 w-3.5" />
    </button>
  );
}

/* ─── Sheet ─────────────────────────────────────────────────────────────── */

/**
 * Players, Mode and (on phones) the order, for screens too narrow to show
 * them in the bar. Changes apply as they are made, so the count on the
 * button is always the grid behind the sheet.
 */
function FilterSheet({
  open,
  onOpenChange,
  state,
  resultCount,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: BrowseState;
  resultCount: number;
  onChange: (patch: Partial<BrowseState>) => void;
}) {
  const wide = useMediaQuery("(min-width: 768px)");
  const searching = state.q.trim() !== "";
  const sort = effectiveSort(state);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? "right" : "bottom"} className="gap-6 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Results update as you choose.</SheetDescription>
        </SheetHeader>

        <FilterGroup label="Players">
          <PlayersToggle
            value={state.players}
            onChange={(players) => onChange({ players })}
            stretch
          />
        </FilterGroup>

        <FilterGroup label="How to play">
          <ModeToggle value={state.mode} onChange={(mode) => onChange({ mode })} stretch />
        </FilterGroup>

        <FilterGroup label="Order" className="sm:hidden">
          <ToggleGroup
            type="single"
            size="sm"
            aria-label="Order"
            value={sort}
            onValueChange={(next) => {
              if (!next) return;
              onChange({
                sort: isGameSort(next) && !(next === "popular" && !searching) ? next : null,
              });
            }}
            className="flex w-full"
          >
            {searching && (
              <ToggleGroupItem value="relevance">{SORT_LABEL.relevance}</ToggleGroupItem>
            )}
            {GAME_SORTS.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id}>
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FilterGroup>

        <SheetFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onChange({ players: null, mode: null, sort: null })}
            disabled={!state.players && !state.mode && !state.sort}
          >
            Reset
          </Button>
          {/* One span: the button spaces its children apart. */}
          <Button onClick={() => onOpenChange(false)}>
            <span>
              Show <span className="numeric">{resultCount}</span>{" "}
              {resultCount === 1 ? "game" : "games"}
            </span>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {children}
    </div>
  );
}

/* ─── Results ───────────────────────────────────────────────────────────── */

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <SearchX aria-hidden className="h-5 w-5" />
      </span>
      <h2 className="font-display text-lg font-bold text-foreground">No games match</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {query
          ? `Nothing called “${query}” with these filters. Check the spelling, or clear the filters to search everything.`
          : "No game fits all of these at once. Try turning one off."}
      </p>
      <Button onClick={onClear} className="mt-1">
        Clear filters
      </Button>
    </div>
  );
}
