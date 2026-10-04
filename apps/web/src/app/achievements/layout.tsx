import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";

export const metadata: Metadata = pageMetadata(
  "Achievements",
  "All 25 Playora achievements and how to unlock them.",
  "/achievements"
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
