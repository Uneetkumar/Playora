import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LobbyPreview } from "./lobby-preview";

/**
 * A workbench for the room lobby and the in-match layout, with fixtures in
 * place of the realtime server: seats in every state, a chat with history,
 * spectators, and a real engine-dealt UNO hand for the match view. For
 * screenshots and for checking a change against both themes without running
 * the Worker; nothing links here.
 *
 *   /dev/lobby?game=uno&as=host|guest|spectator&view=lobby|match|result&chat=open
 *
 * `view=result` is the screen after a match; add `left=1` for the case where
 * everyone else has gone, so Rematch is a seat short.
 *
 * Development only. A production build answers 404, so the page cannot be
 * found, indexed or shipped by accident.
 */
export const metadata: Metadata = {
  title: "Lobby preview",
  robots: { index: false, follow: false },
};

export default function LobbyPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LobbyPreview />;
}
