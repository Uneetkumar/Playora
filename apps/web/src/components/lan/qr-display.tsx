"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, Wifi, Share2 } from "lucide-react";
import { Button } from "@playora/ui";

interface QrDisplayProps {
  joinUrl: string;
  roomCode: string;
  gameName: string;
}

export function QrDisplay({ joinUrl, roomCode, gameName }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  React.useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: "#0F111E",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error("Could not render QR code", err));
  }, [joinUrl]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Compact header label */}
      <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50">
        <QrCode className="h-3.5 w-3.5 text-cyan-400" />
        <span>Scan to Join · <span className="text-cyan-400 font-mono tracking-widest">{roomCode}</span></span>
      </div>

      {/* Glowing QR Container */}
      <div className="relative group">
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#7C3AED] via-[#C084FC] to-[#06B6D4] opacity-50 blur-xl group-hover:opacity-75 transition-all" />
        <div className="relative overflow-hidden rounded-3xl border-4 border-white/20 bg-white p-4 shadow-2xl">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`Scan QR Code to join ${gameName} LAN room`}
              className="h-56 w-56 sm:h-64 sm:w-64 object-contain rounded-xl"
            />
          ) : (
            <div className="flex h-56 w-56 sm:h-64 sm:w-64 items-center justify-center bg-gray-100 rounded-xl">
              <QrCode className="h-12 w-12 text-gray-400 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* LAN Wi-Fi Instructions */}
      <div className="mt-4 space-y-1.5 max-w-sm">
        <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-400">
          <Wifi className="h-4 w-4" />
          <span>Same Wi-Fi Direct Sync</span>
        </div>
        <p className="text-xs text-white/70">
          Open camera or use the built-in scanner on any device connected to the same Wi-Fi network.
        </p>
      </div>

      {/* Room Code & Direct URL */}
      <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-sm">
        <div className="flex items-center justify-between w-full rounded-xl border border-white/10 bg-[#0F111E]/90 px-3.5 py-1.5 shadow-inner text-xs">
          <span className="text-[10px] uppercase font-bold text-white/40">LAN Code:</span>
          <span className="font-mono text-base font-black tracking-widest text-[#C084FC]">
            {roomCode}
          </span>
        </div>

        <div className="flex items-center gap-1.5 w-full rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-3 py-1.5 text-[11px] font-mono text-cyan-200">
          <span className="truncate flex-1 text-left select-all">{joinUrl}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1 rounded hover:bg-white/10 text-cyan-400 hover:text-cyan-200 shrink-0"
            title="Copy URL"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-1 w-full">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyCode}
            className="gap-1.5 border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 flex-1"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedCode ? "Copied Code" : "Copy Code"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="gap-1.5 border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-9 flex-1"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedLink ? "Copied Link" : "Copy Link"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
