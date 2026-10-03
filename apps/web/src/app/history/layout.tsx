import type { Metadata } from "next";
import { privateMetadata } from "../../lib/seo";

/** Per-person page: kept out of the index. See `privateMetadata`. */
export const metadata: Metadata = privateMetadata("Match history", "Every match you have played on Playora.");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
