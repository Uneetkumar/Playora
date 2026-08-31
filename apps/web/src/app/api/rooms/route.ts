import { NextResponse, type NextRequest } from "next/server";
import { generateRoomCode } from "@playora/game-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateRoomSchema, ListRoomsQuerySchema } from "@/lib/api/schemas";
import { apiError, invalidRequest, serverError, unauthorized } from "@/lib/api/responses";

const MAX_CODE_ATTEMPTS = 5;

/**
 * Lists joinable public rooms.
 *
 * Private rooms are excluded here and by RLS, so a private room is reachable
 * only by someone who already knows its code.
 */
export async function GET(request: NextRequest) {
  const parsed = ListRoomsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return invalidRequest("Invalid filter parameters.");

  const supabase = await createSupabaseServerClient();

  // Only consider rooms created in the last 1 hour as live waiting rooms.
  // Old rooms created in previous sessions or days ago are dead/played out.
  const liveCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Asynchronously clean up dead waiting rooms older than 1 hour
  void supabase
    .from("rooms")
    .update({ status: "abandoned" })
    .eq("status", "waiting")
    .lt("created_at", liveCutoff);

  let query = supabase
    .from("rooms")
    .select("id, code, name, status, is_private, max_players, created_at, games(slug, name)")
    .eq("is_private", false)
    .eq("status", "waiting")
    .gte("created_at", liveCutoff)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.game) {
    const { data: game } = await supabase
      .from("games")
      .select("id")
      .eq("slug", parsed.data.game)
      .maybeSingle();
    if (!game) return NextResponse.json({ rooms: [] });
    query = query.eq("game_id", game.id);
  }

  const { data, error } = await query;
  if (error) return serverError();

  return NextResponse.json({ rooms: data ?? [] });
}

/**
 * Creates a room owned by the signed-in user.
 *
 * The host is the authenticated user; a `hostId` in the body would be ignored
 * even if supplied. The room code is generated server-side so a client cannot
 * choose or squat one.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest("Request body must be valid JSON.");
  }

  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { gameSlug, name, isPrivate, maxPlayers } = parsed.data;

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, name, max_players, is_available")
    .eq("slug", gameSlug)
    .maybeSingle();

  if (gameError) return serverError();
  if (!game) return apiError(404, "GAME_NOT_FOUND", "That game doesn't exist.");
  if (!game.is_available) {
    return apiError(409, "GAME_UNAVAILABLE", "That game isn't available right now.");
  }

  const capacity = Math.min(maxPlayers ?? game.max_players, game.max_players);

  // The unique index on rooms.code is the real guard; retry on the rare clash.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        code,
        name: name ?? `${game.name} room`,
        host_id: user.id,
        game_id: game.id,
        status: "waiting",
        is_private: isPrivate,
        max_players: capacity,
        settings: {},
      })
      .select("id, code, name, status, is_private, max_players, created_at")
      .single();

    if (!error && room) {
      return NextResponse.json({ room, gameSlug }, { status: 201 });
    }
    // 23505 = unique_violation. Anything else is a real failure.
    if (error && error.code !== "23505") return serverError();
  }

  return serverError();
}
