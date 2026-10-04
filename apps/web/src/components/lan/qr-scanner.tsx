"use client";

import * as React from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Hash, ArrowRight, X } from "lucide-react";
import { Button, Input, cn } from "@playora/ui";

interface QrScannerProps {
  onScan: (scannedData: string) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Camera QR scanner with a typed-code fallback.
 *
 * Self-contained card: the header's scan dialog shows it on a transparent
 * dialog, and the LAN page shows it inline, so it draws its own surface. The
 * typed code is always there, not only when the camera fails: plenty of
 * laptops have no rear camera, and a code read aloud across a room is often
 * quicker than holding a phone up to a screen.
 */
export function QrScanner({ onScan, onCancel, className }: QrScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [manualCode, setManualCode] = React.useState("");
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
  const codeId = React.useId();

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let cancelled = false;

    async function startCamera() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setCameraError("This browser cannot use the camera here. Type the code below instead.");
          setHasPermission(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Unmounted while the permission prompt was up: release it at once.
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setHasPermission(true);
          scanFrames();
        }
      } catch (err) {
        console.warn("Camera permission denied or unavailable", err);
        setCameraError("No camera, or permission was refused. Type the code below instead.");
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
      cancelled = true;
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
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-overlay",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Camera className="h-4 w-4 text-primary-accent" aria-hidden />
          Scan a QR code
        </span>
        {onCancel && (
          <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Close scanner">
            <X aria-hidden />
          </Button>
        )}
      </div>

      {/* The viewfinder. The camera image covers the muted fill once it starts. */}
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {hasPermission === null && !cameraError && (
          <p className="absolute inset-x-0 bottom-4 text-center text-xs text-muted-foreground">
            Starting the camera…
          </p>
        )}

        {hasPermission && (
          <div className="pointer-events-none absolute inset-10" aria-hidden>
            {/* Corner brackets only: a full frame hides the code it is meant to aim at. */}
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-primary" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-primary" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-primary" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-primary" />
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-muted-foreground ring-1 ring-border">
              <CameraOff className="h-6 w-6" aria-hidden />
            </span>
            <p className="max-w-[16rem] text-sm text-muted-foreground" role="status">
              {cameraError}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-2 border-t border-border p-4">
        <label
          htmlFor={codeId}
          className="flex items-center gap-1.5 text-tag uppercase text-muted-foreground"
        >
          <Hash className="h-3.5 w-3.5" aria-hidden />
          Or type the code
        </label>
        <div className="flex gap-2">
          <Input
            id={codeId}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="e.g. WI7F"
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 text-center font-mono text-base font-bold uppercase tracking-[0.3em]"
          />
          <Button type="submit" size="lg" className="h-11 shrink-0" disabled={!manualCode.trim()}>
            Join
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </form>
    </div>
  );
}
