import type { MetadataRoute } from "next";
import { themes } from "@playora/ui";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/seo";

/*
 * The web app manifest, so Playora installs to a home screen as an app.
 *
 * Colours are tokens, not literals: the splash background is the dark page
 * and the bar is the dark chrome surface, matching the theme the app opens
 * in. The PNG icons in public/icons are rendered from app/icon.svg; the
 * maskable one keeps the gem inside the safe zone Android crops to.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: themes.dark.background,
    theme_color: themes.dark.surface,
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icons/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icons/maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
