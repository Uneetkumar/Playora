import Link from "next/link";
import { Gamepad2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/60 bg-slate-950/40 py-8">
      <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center space-x-2 text-slate-400">
          <Gamepad2 className="h-5 w-5 text-indigo-500" />
          <span className="text-sm">
            &copy; {new Date().getFullYear()} Game Platform. Production Multiplayer Engine.
          </span>
        </div>
        <nav aria-label="Footer" className="flex items-center space-x-6 text-sm text-slate-500">
          <Link href="/games" className="hover:text-slate-300 transition-colors">
            Games
          </Link>
          <Link href="/rooms" className="hover:text-slate-300 transition-colors">
            Rooms
          </Link>
          <Link href="/friends" className="hover:text-slate-300 transition-colors">
            Friends
          </Link>
        </nav>
      </div>
    </footer>
  );
}
