/**
 * The `next` a sign-in returns to, kept to a path on this site.
 *
 * Checking the string's prefix is not enough: `/\evil.com` starts with one
 * slash, but browsers (and Next's router, which resolves a link with
 * `new URL(href, location.href)`) read a backslash in a URL's path as a
 * slash, so it lands on `//evil.com`, another site. So the value is resolved
 * the way the browser would resolve it, against a placeholder origin, and
 * only a result on that same origin is kept: its path, query and hash.
 *
 * Shared by the login page, which navigates to it client-side, and the OAuth
 * callback route, which redirects to it.
 */
const PLACEHOLDER_ORIGIN = "http://same.invalid";

export function safeNextPath(raw: string | null | undefined, fallback = "/rooms"): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    // A path that still opens with two slashes would read as a host again
    // wherever it is used as a link.
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
