import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { catalogDay } from "../../../components/games/card-logic";
import { CardsPreview } from "./cards-preview";

/**
 * A workbench for the catalogue components: every card variant over all
 * games, rails in each state, and the hero. For screenshots and for checking
 * a change against both themes at once; nothing links here.
 *
 * Development only. A production build answers 404, so the page cannot be
 * found, indexed or shipped by accident.
 */
export const metadata: Metadata = {
  title: "Card preview",
  robots: { index: false, follow: false },
};

export default function CardsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  // One clock for the whole page, read on the server and handed down, so the
  // badges the server renders are the ones the browser hydrates. The day, as
  // the real pages read it.
  return <CardsPreview now={catalogDay()} />;
}
