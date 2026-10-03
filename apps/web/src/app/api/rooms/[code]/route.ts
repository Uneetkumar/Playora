import { NextResponse } from "next/server";
import { isValidRoomCode, normalizeRoomCode } from "@playora/game-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, invalidRequest, roomNotFound } from "@/lib/api/responses";

/**
 * Resolves a room code before the client opens a WebSocket.
 *
 * Doing capacity and lifecycle checks here means a player gets a clear message
 * instead of a socket that connects and is then closed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;

  if (!isValidRoomCode(rawCode)) {
    return invalidRequest("That doesn't look like a valid room code.");
  }
  const code = normalizeRoomCode(rawCode);

  const supabase = await createSupabaseServerClient();
  const { data: room, error } = await supabase
    .from("rooms")
    .select(
      "id, code, name, status, is_private, max_players, host_id, created_at, games(slug, name, min_players, max_players)",
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.warn("GET /api/rooms/[code] error:", error.message);
    return roomNotFound();
  }
  if (!room) return roomNotFound();

  if (room.status === "finished" || room.status === "abandoned") {
    return apiError(410, "ROOM_CLOSED", "That game has already finished.");
  }

  const { count } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  const seatsTaken = count ?? 0;
  return NextResponse.json({
    room,
    seatsTaken,
    isFull: seatsTaken >= room.max_players,
    canSpectate: room.status === "in_game",
  });
}
