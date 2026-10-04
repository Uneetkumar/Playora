import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SignedInProfile } from "./signed-in-profile";

/**
 * The real profile page with a made-up player signed in, because the page
 * shows nothing but "Sign in" on a dev server without accounts.
 *
 * Development only: a production build answers 404.
 */
export const metadata: Metadata = {
  title: "Profile preview",
  robots: { index: false, follow: false },
};

export default function ProfilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SignedInProfile />;
}
