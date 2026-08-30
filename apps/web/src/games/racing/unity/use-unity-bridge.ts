"use client";

import * as React from "react";
import {
  parseUnityEvent,
  UNITY_BRIDGE_GLOBAL,
  UNITY_RECEIVER_METHOD,
  UNITY_RECEIVER_OBJECT,
  type UnityCommand,
  type UnityEvent,
} from "@playora/protocol";

/** What Unity's generated loader hands back. */
interface UnityInstance {
  SendMessage: (objectName: string, methodName: string, value: string) => void;
  Quit: () => Promise<void>;
  SetFullscreen?: (on: number) => void;
}

interface UnityLoaderConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
  streamingAssetsUrl: string;
  companyName: string;
  productName: string;
  productVersion: string;
}

declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: UnityLoaderConfig,
      onProgress?: (progress: number) => void,
    ) => Promise<UnityInstance>;
    [UNITY_BRIDGE_GLOBAL]?: { receive: (json: string) => void };
    __playoraUnityPending?: string[];
  }
}

export interface UnityBuildPaths {
  loaderUrl: string;
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
  streamingAssetsUrl: string;
}

/** Where a build for a game is expected to live once one has been produced. */
export function buildPathsFor(gameId: string): UnityBuildPaths {
  const base = `/unity/${gameId}/Build`;
  return {
    loaderUrl: `${base}/${gameId}.loader.js`,
    dataUrl: `${base}/${gameId}.data.br`,
    frameworkUrl: `${base}/${gameId}.framework.js.br`,
    codeUrl: `${base}/${gameId}.wasm.br`,
    streamingAssetsUrl: `/unity/${gameId}/StreamingAssets`,
  };
}

/**
 * Whether a Unity build is actually present.
 *
 * Checked at runtime rather than assumed, because the build is produced by the
 * Unity Editor and committed separately from the code that hosts it. Without
 * this the racing page would show a permanently black canvas whenever the build
 * was missing, which is indistinguishable from a crash.
 */
export async function unityBuildExists(gameId: string): Promise<boolean> {
  try {
    const response = await fetch(buildPathsFor(gameId).loaderUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export type UnityStatus =
  | { phase: "idle" }
  | { phase: "loading"; progress: number; label: string }
  | { phase: "ready" }
  | { phase: "racing" }
  | { phase: "finished" }
  | { phase: "error"; message: string };

/**
 * Hosts a Unity WebGL instance and speaks the bridge protocol to it.
 *
 * Unity owns the world; this owns the canvas element, the instance lifecycle
 * and the message boundary. Everything crossing that boundary is validated by
 * the schemas in `@playora/protocol` — Unity is a separate build artefact that
 * can be older than the page hosting it, so its messages are treated as
 * untrusted input rather than assumed to match.
 */
export function useUnityBridge(
  gameId: string,
  onEvent: (event: UnityEvent) => void,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const instanceRef = React.useRef<UnityInstance | null>(null);
  const [status, setStatus] = React.useState<UnityStatus>({ phase: "idle" });

  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let scriptEl: HTMLScriptElement | null = null;

    // Unity boots before React mounts on a cold load, so the .jslib buffers
    // anything emitted before a listener exists. Draining it here means the
    // READY event is never lost to a race.
    const dispatcher = {
      receive: (json: string) => {
        const event = parseUnityEvent(json);
        if (!event) {
          console.warn("[playora] discarded malformed Unity event", json);
          return;
        }
        if (event.type === "LOAD_PROGRESS") {
          setStatus({ phase: "loading", progress: event.progress, label: event.label });
        } else if (event.type === "LOADED") {
          setStatus({ phase: "ready" });
        } else if (event.type === "RACE_STARTED") {
          setStatus({ phase: "racing" });
        } else if (event.type === "RACE_FINISHED") {
          setStatus({ phase: "finished" });
        } else if (event.type === "ERROR") {
          setStatus({ phase: "error", message: event.message });
        }
        onEventRef.current(event);
      },
    };

    window[UNITY_BRIDGE_GLOBAL] = dispatcher;
    for (const buffered of window.__playoraUnityPending ?? []) dispatcher.receive(buffered);
    window.__playoraUnityPending = [];

    const paths = buildPathsFor(gameId);
    setStatus({ phase: "loading", progress: 0, label: "Loading the game" });

    scriptEl = document.createElement("script");
    scriptEl.src = paths.loaderUrl;
    scriptEl.async = true;

    scriptEl.onerror = () => {
      if (cancelled) return;
      setStatus({
        phase: "error",
        // Never a code (spec section 96): this is the message the player reads.
        message: "This game could not be loaded. It may not be installed yet.",
      });
    };

    scriptEl.onload = () => {
      if (cancelled || !window.createUnityInstance) return;

      window
        .createUnityInstance(
          canvas,
          {
            dataUrl: paths.dataUrl,
            frameworkUrl: paths.frameworkUrl,
            codeUrl: paths.codeUrl,
            streamingAssetsUrl: paths.streamingAssetsUrl,
            companyName: "Playora",
            productName: gameId,
            productVersion: "0.1.0",
          },
          (progress) => {
            if (!cancelled) {
              // Unity's own download progress, before the game can report its own.
              setStatus({ phase: "loading", progress: progress * 0.7, label: "Downloading" });
            }
          },
        )
        .then((instance) => {
          if (cancelled) {
            void instance.Quit();
            return;
          }
          instanceRef.current = instance;
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("[playora] Unity failed to start", error);
          setStatus({ phase: "error", message: "The game failed to start on this device." });
        });
    };

    document.body.appendChild(scriptEl);

    return () => {
      cancelled = true;
      // Unity holds a WebGL context and browsers cap how many a page may have,
      // so a discarded instance must be quit rather than garbage collected.
      void instanceRef.current?.Quit();
      instanceRef.current = null;
      scriptEl?.remove();
      delete window[UNITY_BRIDGE_GLOBAL];
    };
  }, [gameId]);

  const send = React.useCallback((command: UnityCommand) => {
    const instance = instanceRef.current;
    if (!instance) {
      console.warn("[playora] dropped command, Unity is not running", command.type);
      return;
    }
    instance.SendMessage(
      UNITY_RECEIVER_OBJECT,
      UNITY_RECEIVER_METHOD,
      JSON.stringify(command),
    );
  }, []);

  return { canvasRef, status, send };
}
