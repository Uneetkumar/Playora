"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2, QrCode } from "lucide-react";
import {
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  themes,
  toast,
} from "@playora/ui";

interface QrDisplayProps {
  joinUrl: string;
  roomCode: string;
  gameName: string;
}

/**
 * The host's QR code, room code and join link.
 *
 * The code is drawn dark on white in both themes, on a plate that takes the
 * light theme's card colour: a scanner needs dark modules on a light quiet
 * zone, and a light-on-dark code (what the dark theme would otherwise give)
 * is one jsQR is told not to try. The colours are the light theme's tokens,
 * not literals, so the plate and the code always agree.
 */
export function QrDisplay({ joinUrl, roomCode, gameName }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);

  React.useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: { dark: themes.light.foreground, light: themes.light.card },
      errorCorrectionLevel: "M",
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error("Could not render QR code", err));
  }, [joinUrl]);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (what: "code" | "link") => {
    try {
      // Absent on a plain-http LAN address, which is exactly where this page
      // is most often opened, so it is a normal case and not an exception.
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(what === "code" ? roomCode : joinUrl);
      setCopied(what);
    } catch {
      toast.error("Copying is not available on this address. Select the text and copy it instead.");
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="light rounded-2xl bg-card p-3 shadow-card ring-1 ring-border">
        {dataUrl ? (
          // A data URL generated in the browser: next/image has nothing to optimise.
          <img
            src={dataUrl}
            alt={`QR code to join the ${gameName} game on this network`}
            className="h-52 w-52 rounded-lg sm:h-60 sm:w-60"
          />
        ) : (
          <Skeleton className="flex h-52 w-52 items-center justify-center rounded-lg sm:h-60 sm:w-60">
            <QrCode className="h-10 w-10 text-muted-foreground" aria-hidden />
          </Skeleton>
        )}
      </div>

      <p className="mt-5 text-tag uppercase text-muted-foreground">Room code</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="font-mono-num text-4xl font-bold tracking-[0.2em] text-foreground">
          {roomCode}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // 40px to tap on a phone, the compact 32px from `sm`.
              className="sm:h-8 sm:w-8"
              onClick={() => void copy("code")}
              aria-label={copied === "code" ? "Room code copied" : "Copy room code"}
            >
              {copied === "code" ? (
                <Check className="text-success-ink" aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied === "code" ? "Copied" : "Copy code"}</TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-4 flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 select-all truncate text-left font-mono text-xs text-muted-foreground">
          {joinUrl}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 px-3 sm:h-7 sm:px-2"
          onClick={() => void copy("link")}
        >
          {copied === "link" ? (
            <>
              <Check className="h-3.5 w-3.5 text-success-ink" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
