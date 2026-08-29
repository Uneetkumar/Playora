import { NextResponse } from "next/server";

/**
 * Error envelope for the room API.
 *
 * `code` is stable and machine-readable; `message` is written for a player, not
 * an engineer (spec section 50: never surface raw technical errors).
 */
export interface ApiError {
  code: string;
  message: string;
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json<{ error: ApiError }>({ error: { code, message } }, { status });
}

export const unauthorized = () =>
  apiError(401, "UNAUTHENTICATED", "Please sign in to do that.");

export const roomNotFound = () =>
  apiError(404, "ROOM_NOT_FOUND", "We couldn't find a room with that code.");

export const invalidRequest = (message: string) =>
  apiError(400, "INVALID_REQUEST", message);

export const serverError = () =>
  apiError(500, "SERVER_ERROR", "Something went wrong on our side. Please try again.");
