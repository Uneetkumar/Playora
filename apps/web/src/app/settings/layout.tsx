import type { Metadata } from "next";
import { privateMetadata } from "../../lib/seo";

/** Per-person page: kept out of the index. See `privateMetadata`. */
export const metadata: Metadata = privateMetadata(
  "Settings",
  "Appearance, audio, gameplay and accessibility settings."
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
