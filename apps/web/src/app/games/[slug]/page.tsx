import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAME_CATALOG } from "../../../lib/games/catalog";
import { gameMetadata, gameJsonLd, breadcrumbJsonLd, indexableGames } from "../../../lib/seo";
import { GameDetailClient } from "./game-detail-client";

/**
 * Server shell for the game detail page.
 *
 * The page was a single client component, which cannot export
 * `generateMetadata` — so every game shared as a bare link with no title, no
 * description and no image, and search engines had nothing to index. The
 * interactive half is unchanged and now lives in `game-detail-client.tsx`;
 * this file exists to give each game a real identity on the web.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Pre-renders every playable game at build time.
 *
 * Fifteen pages is nothing to build, and a statically rendered page is what
 * lets a crawler see the metadata without executing any JavaScript.
 */
export function generateStaticParams(): Array<{ slug: string }> {
  return indexableGames().map((g) => ({ slug: g.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = GAME_CATALOG.find((g) => g.id === slug);
  // An unknown slug 404s below; giving it noindex here stops a mistyped link
  // being indexed as a real page in the meantime.
  if (!game) return { title: "Game not found", robots: { index: false, follow: false } };
  return gameMetadata(game);
}

export default async function GameDetailPage({ params }: Props) {
  const { slug } = await params;
  const game = GAME_CATALOG.find((g) => g.id === slug);
  if (!game) notFound();

  return (
    <>
      {/*
        * Structured data, rendered server-side so a crawler sees it in the
        * HTML rather than after hydration. `VideoGame` is what earns a richer
        * result; the breadcrumb is what makes it read as
        * `Playora › Games › Chess` instead of a raw URL.
        */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameJsonLd(game)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(game)) }}
      />
      <GameDetailClient />
    </>
  );
}
