"use client";

import { Search } from "lucide-react";
import { Button, type ButtonProps } from "@playora/ui";
import { useShellActions } from "./shell-actions";

/**
 * Opens the command palette, for pages that are otherwise server-rendered
 * (the 404) and want to offer search as a way out.
 */
export function OpenSearchButton({ children = "Search games", ...props }: ButtonProps) {
  const { openPalette } = useShellActions();
  return (
    <Button type="button" onClick={openPalette} {...props}>
      <Search className="h-4 w-4" aria-hidden />
      {children}
    </Button>
  );
}
