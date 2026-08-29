import { ClientMessageSchema, type ClientMessage } from "./client.js";
import { ServerMessageSchema, type ServerMessage } from "./server.js";

export interface ProtocolEnvelope<T> {
  id: string;
  timestamp: number;
  data: T;
}

export function parseClientMessage(raw: string | unknown):
  | {
      success: true;
      data: ClientMessage;
    }
  | {
      success: false;
      error: string;
    } {
  try {
    const parsedJson = typeof raw === "string" ? JSON.parse(raw) : raw;
    const validation = ClientMessageSchema.safeParse(parsedJson);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      };
    }
    return { success: true, data: validation.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

export function parseServerMessage(raw: string | unknown):
  | {
      success: true;
      data: ServerMessage;
    }
  | {
      success: false;
      error: string;
    } {
  try {
    const parsedJson = typeof raw === "string" ? JSON.parse(raw) : raw;
    const validation = ServerMessageSchema.safeParse(parsedJson);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      };
    }
    return { success: true, data: validation.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }
}

export function serializeProtocolMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}
