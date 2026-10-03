import type { Metadata } from "next";
import { privateMetadata } from "../../lib/seo";

/** Per-person page: kept out of the index. See `privateMetadata`. */
export const metadata: Metadata = privateMetadata("Your profile", "Your Playora profile, stats and rating.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
