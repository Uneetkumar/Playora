"use client";

import type * as React from "react";
import { Toaster as Sonner, toast } from "sonner";
import { useDocumentTheme } from "../lib/theme.js";

export type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts (sonner), coloured from the design tokens.
 *
 * Sonner reads its palette from CSS custom properties on the toaster element
 * (`--normal-bg` and friends). Setting them inline to our variables means a
 * theme switch restyles open toasts with no re-render, and the inline values
 * outrank sonner's built-in light/dark sets. `theme` still tracks the <html>
 * class because sonner also uses it for its icons and close button.
 *
 * Mount one <Toaster /> near the root; call `toast()` from anywhere.
 */
export function Toaster({ style, toastOptions, ...props }: ToasterProps) {
  const theme = useDocumentTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      gap={8}
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--success-bg": "hsl(var(--popover))",
          "--success-text": "hsl(var(--success))",
          "--success-border": "hsl(var(--success) / 0.35)",
          "--error-bg": "hsl(var(--popover))",
          "--error-text": "hsl(var(--destructive))",
          "--error-border": "hsl(var(--destructive) / 0.35)",
          "--warning-bg": "hsl(var(--popover))",
          "--warning-text": "hsl(var(--warning))",
          "--warning-border": "hsl(var(--warning) / 0.35)",
          "--info-bg": "hsl(var(--popover))",
          "--info-text": "hsl(var(--foreground))",
          "--info-border": "hsl(var(--border))",
          "--border-radius": "16px",
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          // Scoped through the toaster's `group` class so these outrank
          // sonner's own [data-sonner-toast][data-styled] rules.
          toast:
            "group toast group-[.toaster]:font-sans group-[.toaster]:text-sm group-[.toaster]:shadow-raised",
          title: "font-semibold",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:!rounded-md group-[.toast]:!bg-primary group-[.toast]:!font-semibold group-[.toast]:!text-primary-foreground",
          cancelButton:
            "group-[.toast]:!rounded-md group-[.toast]:!bg-raised group-[.toast]:!text-muted-foreground",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast };
