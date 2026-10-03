/**
 * Search and social metadata, in one place.
 *
 * The audit found none of this existed: zero `generateMetadata` calls, no
 * sitemap, no robots.txt, no Open Graph or Twitter tags, no canonical URLs and
 * no structured data. Every game page was invisible to search and shared as a
 * bare link with no title or image — on a platform whose whole distribution
 * model is people finding and sharing games.
 *
 * Everything here derives from the same catalog the UI renders, so a game
 * cannot appear on the site and be missing from the sitemap.
 */

import type { Metadata } from "next";
import { GAME_CATALOG, isPlayable, type CatalogGame } from "./games/catalog";
import { imageForGame } from "../components/games/game-images";

export const SITE_NAME = "Playora";
export const SITE_TAGLINE = "Play. Connect. Compete.";
export const SITE_DESCRIPTION =
  "Play chess, UNO, 3D racing and a dozen arcade games free in your browser. " +
  "No download, no install — play solo against AI, with friends online, or on the same Wi-Fi.";

/**
 * The canonical origin.
 *
 * Falls back to localhost so a developer build produces valid absolute URLs
 * rather than throwing; production must set `NEXT_PUBLIC_APP_URL` or every
 * canonical and OG image will point at localhost.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";
  return raw.replace(/\/+$/, "");
}

export function absolute(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The share image for a game.
 *
 * Read from `game-images.ts` rather than from `artFor`, because that lives in
 * a `"use client"` module and the server cannot call it — the build failed on
 * exactly that. A game with no entry falls back to a real image rather than
 * producing `.../undefined`, which shares as a broken preview.
 */
export function shareImageFor(gameId: string): string {
  return absolute(imageForGame(gameId));
}

/** Games that should be in the sitemap: only ones a visitor can actually play. */
export function indexableGames(): CatalogGame[] {
  return GAME_CATALOG.filter(isPlayable);
}

/**
 * Metadata for a game's detail page.
 *
 * The description leads with what the game *is* and how many can play, because
 * that is what a search result has room to show and what decides the click.
 */
export function gameMetadata(game: CatalogGame): Metadata {
  const url = absolute(`/games/${game.id}`);
  const image = shareImageFor(game.id);
  const players =
    game.minPlayers === game.maxPlayers
      ? `${game.minPlayers} players`
      : `${game.minPlayers}–${game.maxPlayers} players`;

  const title = `${game.name} — Play Free Online`;
  const description = `${game.description} ${players}, ${game.duration}. Free in your browser on ${SITE_NAME}, no download needed.`;

  return {
    title,
    description,
    keywords: [game.name, game.category, ...game.tags, "free online game", "browser game"],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `${game.name} on ${SITE_NAME}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/**
 * Schema.org JSON-LD for a game.
 *
 * `VideoGame` is the accurate type and the one that earns a richer result;
 * `playMode` and `gamePlatform` are what tell a search engine this is playable
 * in the browser rather than a product to buy.
 */
export function gameJsonLd(game: CatalogGame): Record<string, unknown> {
  const multiplayer = game.maxPlayers > 1;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    description: game.description,
    url: absolute(`/games/${game.id}`),
    image: shareImageFor(game.id),
    genre: game.category,
    keywords: game.tags.join(", "),
    gamePlatform: "Web browser",
    operatingSystem: "Any",
    applicationCategory: "GameApplication",
    playMode: multiplayer ? ["SinglePlayer", "MultiPlayer"] : "SinglePlayer",
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: game.minPlayers,
      maxValue: game.maxPlayers,
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: siteUrl() },
    // Free to play, stated explicitly — without an offer the result can be
    // rendered as if the price were unknown.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

/** Site-level JSON-LD, emitted once from the root layout. */
export function siteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url: siteUrl(),
    description: SITE_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/games?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Breadcrumbs, so a result shows `Playora › Games › Chess` rather than a URL. */
export function breadcrumbJsonLd(game: CatalogGame): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: siteUrl() },
      { "@type": "ListItem", position: 2, name: "Games", item: absolute("/games") },
      {
        "@type": "ListItem",
        position: 3,
        name: game.name,
        item: absolute(`/games/${game.id}`),
      },
    ],
  };
}

/**
 * Metadata for a page that belongs to one signed-in person.
 *
 * `robots.txt` stops these being crawled, but a URL someone shares can still
 * be indexed without its content — a `noindex` tag is what actually keeps it
 * out. Both, because they fail in different ways.
 */
export function privateMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
  };
}

/** Metadata for a public page that is not a game. */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absolute(path),
    },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description },
  };
}
