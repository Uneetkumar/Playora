import type { Metadata } from "next";
import { privateMetadata } from "../../lib/seo";

/** Per-person page: kept out of the index. See `privateMetadata`. */
export const metadata: Metadata = privateMetadata("Game rooms", "Join or create a room to play with friends.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
