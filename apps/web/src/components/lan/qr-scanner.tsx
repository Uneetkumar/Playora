"use client";

import * as React from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Hash, ArrowRight, X } from "lucide-react";
import { Button, Input } from "@playora/ui";

interface QrScannerProps {
  onScan: (scannedData: string) => void;
  onCancel?: () => void;
}

export function QrScanner({ onScan, onCancel }: QrScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [manualCode, setManualCode] = React.useState("");
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number | null = null;

    async function startCamera() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setCameraError("Camera access not supported on this device/browser.");
          setHasPermission(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setHasPermission(true);
          scanFrames();
        }
      } catch (err) {
        console.warn("Camera permission denied or unavailable", err);
        setCameraError("Camera access was denied or is unavailable. You can enter the LAN code manually below.");
        setHasPermission(false);
      }
    }

    function scanFrames() {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          onScan(code.data);
          return;
        }
      }
      animId = requestAnimationFrame(scanFrames);
    }

    void startCamera();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScan(manualCode.trim().toUpperCase());
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      {/* Viewfinder Card */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-foreground/20 bg-card shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3 bg-[#16192E]">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-foreground">Scan LAN QR Code</span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close scanner"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Video / Camera View */}
        <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Animated Scanning Reticle */}
          {hasPermission && (
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-cyan-300" />
              <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-cyan-300" />
              <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-cyan-300" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-cyan-300" />

              {/* Laser Scan Line */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          )}

          {/* Camera Error / Denied Fallback */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-card/95">
              <CameraOff className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-xs font-semibold text-foreground/80">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Bottom Manual Entry Section */}
        <div className="p-4 bg-[#121526] border-t border-foreground/10 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <Hash className="h-3.5 w-3.5" />
            <span>Or Enter 4-Letter Code</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="e.g. WI7F"
              maxLength={8}
              className="h-10 rounded-xl bg-foreground/5 border-border text-center font-mono text-sm font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground focus:border-cyan-400"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!manualCode.trim()}
              className="h-10 bg-cyan-600 hover:bg-cyan-500 text-white px-4 font-bold rounded-xl gap-1.5 shadow-md shrink-0"
            >
              <span>Join</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
