import Link from "next/link";
import { Gamepad2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/40 py-8">
      <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <span className="text-sm">
            &copy; {new Date().getFullYear()} Playora. Play. Connect. Compete.
          </span>
        </div>
        <nav aria-label="Footer" className="flex items-center space-x-6 text-sm text-muted-foreground">
          <Link href="/games" className="hover:text-foreground transition-colors">
            Games
          </Link>
          <Link href="/rooms" className="hover:text-foreground transition-colors">
            Rooms
          </Link>
          <Link href="/friends" className="hover:text-foreground transition-colors">
            Friends
          </Link>
        </nav>
      </div>
    </footer>
  );
}
