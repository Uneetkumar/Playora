"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ChevronRight, Plus, ScanLine, Zap } from "lucide-react";
import type { GameId } from "@playora/game-types";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  cn,
  focusRingClass,
} from "@playora/ui";
import { GAME_CATALOG, isGameId } from "../../lib/games/catalog";
import { readyModes } from "../../lib/play/modes";
import { useRecentlyPlayed } from "../../hooks/use-recently-played";
import { GameThumb } from "./game-thumb";
import { RoomCodeForm } from "./room-code-form";

/**
 * What the bottom bar's Play button opens, on phones: every way into a game
 * with other people, one thumb-reach away. A drawer rather than a page
 * because it is a question ("with whom, how?"), and dragging it away is the
 * answer "never mind".
 */

/** Games Quick Match can service, from the same table the detail page offers modes from. */
const QUICK_MATCH_GAMES: readonly GameId[] = GAME_CATALOG.filter((g) =>
  readyModes(g.id).some((m) => m.id === "online-random"),
).map((g) => g.id);

const NAMES = new Map(GAME_CATALOG.map((g) => [g.id, g.name]));

const optionClassName = cn(
  "group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left",
  "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.04]",
  focusRingClass,
);

function Option({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-meta text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
}

export function QuickPlayDrawer({
  open,
  onOpenChange,
  onOpenScanner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScanner: () => void;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<"menu" | "quick">("menu");
  const { entries } = useRecentlyPlayed();

  React.useEffect(() => {
    if (open) setView("menu");
  }, [open]);

  // Games you have played lead the picker; the rest keep catalog order.
  const quickGames = React.useMemo(() => {
    const played = entries.map((e) => e.gameSlug).filter(isGameId);
    const rank = (id: GameId) => {
      const i = played.indexOf(id);
      return i === -1 ? Infinity : i;
    };
    return [...QUICK_MATCH_GAMES].sort((a, b) => rank(a) - rank(b));
  }, [entries]);

  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{view === "menu" ? "Play" : "Quick match"}</DrawerTitle>
          <DrawerDescription>
            {view === "menu"
              ? "Jump into a game with other people."
              : "Pick a game and we will find you an opponent."}
          </DrawerDescription>
        </DrawerHeader>

        {view === "menu" ? (
          <div className="overflow-y-auto px-4 pb-4">
            <ul className="space-y-2">
              <li>
                <button type="button" className={optionClassName} onClick={() => setView("quick")}>
                  <Option icon={Zap} title="Quick match" description="Get paired with a player at your level" />
                </button>
              </li>
              <li>
                <Link href="/rooms?create=1" className={optionClassName} onClick={close}>
                  <Option icon={Plus} title="Create a room" description="Invite friends with a code" />
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className={optionClassName}
                  onClick={() => {
                    close();
                    onOpenScanner();
                  }}
                >
                  <Option icon={ScanLine} title="Scan a QR code" description="Join a room, or a game on this Wi-Fi" />
                </button>
              </li>
            </ul>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-foreground">Have a room code?</p>
              <RoomCodeForm idPrefix="quick-play-join" onJoined={close} />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="px-2">
              <Button variant="ghost" size="sm" onClick={() => setView("menu")}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            </div>
            <ul className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto px-4 pb-4 pt-2">
              {quickGames.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      router.push(`/play?game=${id}&quick=1`);
                    }}
                    className={cn(
                      "block w-full overflow-hidden rounded-xl border border-border bg-surface text-left shadow-card",
                      "transition-colors duration-hover ease-out-expo hover:bg-foreground/[0.04]",
                      focusRingClass,
                    )}
                  >
                    <GameThumb id={id} sizes="(max-width: 768px) 45vw, 240px" className="aspect-video w-full" />
                    <span className="block truncate px-3 py-2.5 text-sm font-semibold text-foreground">
                      {NAMES.get(id)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
