import Link from "next/link";
import { APP_VERSION } from "../lib/version";
import { BrandMark } from "./shell/brand";
import { NAV } from "./shell/nav";

const LINKS = [NAV.browse, NAV.rooms, NAV.lan, NAV.leaderboard, NAV.settings] as const;

/**
 * A quiet footer under the content column. It sits inside the column, beside
 * the sidebar rather than under it, so it lines up with the page above at
 * either sidebar width, and the shell's bottom padding keeps it clear of the
 * phone's tab bar. The version is the real one from lib/version.ts; the
 * menu drawer used to print a made-up "v2.0".
 */
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-6 w-6 rounded-md [&_svg]:h-4 [&_svg]:w-4" />
          <span>
            &copy; {new Date().getFullYear()} Playora · <span className="numeric">v{APP_VERSION}</span>
          </span>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="rounded-sm transition-colors duration-hover ease-out-expo hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
