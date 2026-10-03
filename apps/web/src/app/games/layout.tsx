import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata(
  "All games",
  "Browse every game on Playora — chess, UNO, 3D racing and a dozen arcade games, all free in your browser.",
  "/games",
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
