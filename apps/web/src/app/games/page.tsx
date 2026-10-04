import * as React from "react";
import { GAME_CATALOG, isPlayable } from "../../lib/games/catalog";
import { EMPTY_BROWSE } from "../../lib/games/browse-url";
import { sortGames } from "../../lib/games/browse";
import { SITE_NAME, absolute } from "../../lib/seo";
import { catalogDay } from "../../components/games/card-logic";
import { BrowseCatalog } from "./browse-catalog";
import { BrowseView } from "./browse-view";

/**
 * Browse: the whole catalogue, filterable. (It used to redirect to the home
 * page, so every "All games" link and the site search's `/games?q=` landed
 * somewhere else.)
 *
 * The filters live in the URL, which a statically rendered page cannot read
 * on the server, so the URL-reading part sits in a Suspense boundary whose
 * fallback is the same view with no filters: what most visitors ask for, and
 * what a crawler gets, a real grid of every game rather than a spinner. With
 * filters in the address bar, the browser swaps in the filtered grid as soon
 * as it has read them.
 *
 * Title and description come from this folder's layout.
 */
export const revalidate = 3600;

/** Structured data: the catalogue as an ordered list of game pages. */
function catalogJsonLd(): Record<string, unknown> {
  const games = sortGames(GAME_CATALOG.filter(isPlayable), "popular");
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `All games | ${SITE_NAME}`,
    url: absolute("/games"),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: games.length,
      itemListElement: games.map((game, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: game.name,
        url: absolute(`/games/${game.id}`),
      })),
    },
  };
}

export default function GamesPage() {
  // One clock for the server's HTML and the browser's swap, so a badge does
  // not change as the page hydrates.
  const now = catalogDay();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(catalogJsonLd()) }}
      />
      <React.Suspense fallback={<BrowseView state={EMPTY_BROWSE} now={now} />}>
        <BrowseCatalog now={now} />
      </React.Suspense>
    </>
  );
}
