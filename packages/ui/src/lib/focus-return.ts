"use client";

import * as React from "react";

type AutoFocusHandler = (event: Event) => void;

/**
 * Puts focus back where it was when a modal overlay closes.
 *
 * Radix's modal Dialog always cancels FocusScope's own focus return and
 * focuses the dialog's Trigger instead (react-dialog 1.1.23,
 * DialogContentModal). An overlay opened without a Trigger, such as a
 * controlled pause menu or a confirmation asked from code, therefore leaves
 * focus on <body> when it closes, and a keyboard or screen-reader user loses
 * their place.
 *
 * This remembers what had focus as the overlay opened and returns there on
 * close. The caller's handlers run first: a caller that moves focus itself on
 * close says so with `event.preventDefault()` and this steps aside. When
 * nothing usable had focus (it was <body>, or the element has since been
 * removed), Radix's own behaviour, focusing the Trigger if there is one,
 * carries on.
 */
export function useFocusReturn(
  onOpenAutoFocus?: AutoFocusHandler,
  onCloseAutoFocus?: AutoFocusHandler,
): { onOpenAutoFocus: AutoFocusHandler; onCloseAutoFocus: AutoFocusHandler } {
  const saved = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event) => {
      // FocusScope fires this before it moves focus, so this is still the
      // element the overlay was opened from.
      const active = document.activeElement;
      saved.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      const target = saved.current;
      saved.current = null;
      if (event.defaultPrevented || !target?.isConnected) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}
