import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlatformPreview } from "./platform-preview";

/**
 * A workbench for the platform pages' data states: the leaderboard podium and
 * rows, earned achievements, match rows and the result card. Without a
 * database those pages only ever show their empty states, so this is where
 * the full ones can be seen and screenshotted in both themes.
 *
 * Development only. A production build answers 404, so the page cannot be
 * found, indexed or shipped by accident.
 */
export const metadata: Metadata = {
  title: "Platform preview",
  robots: { index: false, follow: false },
};

export default function PlatformPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  // One clock for the whole page, read on the server and handed down, so the
  // "2h ago" labels the server renders are the ones the browser hydrates.
  return <PlatformPreview now={Date.now()} />;
}
