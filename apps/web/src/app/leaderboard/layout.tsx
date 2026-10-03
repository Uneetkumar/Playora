import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata(
  "Leaderboards",
  "Global and per-game leaderboards for every Playora game.",
  "/leaderboard",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
