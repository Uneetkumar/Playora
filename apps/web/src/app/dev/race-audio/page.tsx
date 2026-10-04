import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RaceAudioBench } from "./race-audio-bench";

/**
 * A bench for the race's sound and controls: every engine in the garage on
 * sliders, every one-shot on a button, an opponent flying past, and a live
 * readout of what the keyboard, a gamepad or the mouse is sending. Sound is
 * tuned by ear and controls by feel, and neither is quick to reach inside a
 * race. The self-test renders the engine offline and measures it, which is how
 * the headless checks know it is not silent.
 *
 * Development only. A production build answers 404, so the page cannot be
 * found, indexed or shipped by accident.
 */
export const metadata: Metadata = {
  title: "Race audio bench",
  robots: { index: false, follow: false },
};

export default function RaceAudioBenchPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RaceAudioBench />;
}
