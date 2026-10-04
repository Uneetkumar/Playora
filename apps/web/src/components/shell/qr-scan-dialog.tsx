"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@playora/ui";
import { QrScanner } from "../lan/qr-scanner";
import { useRoomResolver } from "../../hooks/use-rooms";

/**
 * The camera QR scanner, as a real dialog.
 *
 * It used to be a hand-built `fixed inset-0` overlay inside the header, and
 * the header's backdrop blur made the header its containing block: the
 * "full-screen" scanner was laid out inside a 64px bar, with no focus trap and
 * no Escape. Radix portals it to <body> and supplies both.
 *
 * What a scan means:
 * - a Playora link (a room or a LAN host) opens that page. Only the path and
 *   query are kept, resolved against this site, so a code cannot send anyone
 *   off-site;
 * - anything else is treated as a typed code: an online room if one exists,
 *   otherwise a LAN host's code.
 */
export function QrScanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolveCode } = useRoomResolver();

  // Stable on purpose: QrScanner restarts the camera whenever onScan changes.
  const handleScan = React.useCallback(
    (data: string) => {
      onOpenChange(false);
      if (data.includes("/lan") || data.includes("/rooms")) {
        try {
          const url = new URL(data, window.location.origin);
          router.push(url.pathname + url.search);
        } catch {
          /* not a URL after all; nothing sensible to open */
        }
        return;
      }
      void (async () => {
        const code = await resolveCode(data);
        router.push(code ? `/rooms/${code}` : `/lan?code=${encodeURIComponent(data)}&role=guest`);
      })();
    },
    [onOpenChange, resolveCode, router],
  );

  const cancel = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-sm gap-0 border-0 bg-transparent p-0 shadow-none"
      >
        <DialogTitle className="sr-only">Scan a QR code</DialogTitle>
        <DialogDescription className="sr-only">
          Point the camera at a room or local Wi-Fi QR code, or type its code below.
        </DialogDescription>
        {/* Mounted only while open, so the camera is off the moment it closes. */}
        {open && <QrScanner onScan={handleScan} onCancel={cancel} />}
      </DialogContent>
    </Dialog>
  );
}
