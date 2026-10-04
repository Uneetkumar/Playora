"use client";

import { toast } from "@playora/ui";

/**
 * Getting a room code or link to someone else: the clipboard, the share sheet
 * and the messages that say which of them happened.
 */

/** The link that opens this room, on whatever host the page is served from. */
export function roomInviteUrl(code: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/rooms/${encodeURIComponent(code)}`;
}

/**
 * Copies text, falling back to a hidden textarea where the async clipboard is
 * unavailable (an insecure origin on a LAN address, an older WebView).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused: try the old way.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyRoomCode(code: string): Promise<void> {
  if (await copyText(code)) toast.success("Room code copied", { description: code });
  else toast.error("Couldn't copy the code", { description: `Read it out instead: ${code}` });
}

export async function copyInviteLink(code: string): Promise<void> {
  const url = roomInviteUrl(code);
  if (await copyText(url)) toast.success("Invite link copied", { description: "Send it to a friend to join." });
  else toast.error("Couldn't copy the link", { description: url });
}

/**
 * The system share sheet where there is one (phones, Safari, Edge), else the
 * link on the clipboard. Dismissing the sheet is not an error.
 */
export async function shareRoomInvite(code: string, gameName: string): Promise<void> {
  const url = roomInviteUrl(code);
  const data: ShareData = {
    title: `Join my ${gameName} room`,
    text: `Join my ${gameName} room on Playora. Code ${code}`,
    url,
  };
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    if (!navigator.canShare || navigator.canShare(data)) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else: fall through to the clipboard.
      }
    }
  }
  await copyInviteLink(code);
}
