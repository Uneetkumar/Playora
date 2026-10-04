import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

/** The /dev preview routes: mocked states for `next dev`, never for players. */
function isDevPreview(pathname: string): boolean {
  return pathname === "/dev" || pathname.startsWith("/dev/");
}

export async function middleware(request: NextRequest) {
  // Each /dev page calls notFound() in production too, but the root
  // loading.tsx puts it inside a Suspense boundary, so the build prerenders
  // the shell and a skeleton with a 200 and the 404 only arrives client-side.
  // Answered here, before any rendering, it is a real 404.
  if (process.env.NODE_ENV === "production" && isDevPreview(request.nextUrl.pathname)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
    });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
