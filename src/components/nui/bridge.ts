"use client";

/**
 * Bridge between the in-game UI and whatever is hosting it.
 *
 * The MDT runs inside an iframe: in the game that parent is the resource's own
 * `nui://` page, in the preview it is the preview page. Both speak this
 * protocol, so the UI itself is identical in both places - what you preview is
 * what players open.
 *
 * Nothing here is trusted for security: the UI is only a client, and every
 * request is authorised server-side against the token it was handed.
 */

export type HostMessage =
  | { type: "mdt:init"; token?: string | null; apiBase?: string | null; character?: CharacterContext | null; resource?: string | null }
  | { type: "mdt:close" };

export type UiMessage =
  | { type: "mdt:ready" }
  | { type: "mdt:close" }
  | { type: "mdt:notify"; level: "info" | "success" | "error"; message: string }
  | { type: "mdt:opened"; path: string };

export type CharacterContext = {
  citizenId?: string | null;
  job?: string | null;
  grade?: number | null;
  callsign?: string | null;
  name?: string | null;
};

const MESSAGE_ORIGIN = "*"; // The host origin differs per deployment (nui://, https://…).

/** Sends a message to the page hosting the iframe (the game or the preview). */
export function postToHost(message: UiMessage): void {
  if (typeof window === "undefined") return;
  const parent = window.parent;
  if (!parent || parent === window) return;
  try {
    parent.postMessage(message, MESSAGE_ORIGIN);
  } catch {
    // The host went away (resource restarted); nothing to do.
  }
}

/** Subscribes to messages from the host. Returns an unsubscribe function. */
export function onHostMessage(handler: (message: HostMessage) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: MessageEvent) => {
    const data = event.data as HostMessage | undefined;
    if (!data || typeof data !== "object" || typeof data.type !== "string") return;
    if (!data.type.startsWith("mdt:")) return;
    handler(data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

/** True when the UI is embedded in another page (game or preview). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.parent;
  } catch {
    return true;
  }
}
