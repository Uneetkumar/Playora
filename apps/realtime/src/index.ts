import { APP_VERSION } from "./version.js";
import type { Env } from "./types.js";
export { RoomDurableObject } from "./durable-objects/RoomDurableObject.js";
export { MatchmakingDurableObject } from "./durable-objects/MatchmakingDurableObject.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        service: "playora-realtime",
        timestamp: new Date().toISOString(),
      });
    }

    // Status endpoint
    if (url.pathname === "/status") {
      return Response.json({
        service: "playora-realtime",
        version: APP_VERSION,
        environment: env.ENVIRONMENT || "development",
        supportedProtocols: ["websocket", "http"],
        features: ["rooms", "presence", "game-sessions", "chat", "reactions"],
      });
    }

    // Matchmaking route: /matchmaking/:gameId
    // One Durable Object per game, so each game has its own pool.
    const mmMatch = url.pathname.match(/^\/matchmaking\/([^/]+)/);
    if (mmMatch) {
      const gameId = mmMatch[1];
      if (!gameId) return new Response("Game ID is required", { status: 400 });
      if (!url.searchParams.has("gameId")) url.searchParams.set("gameId", gameId);
      const stub = env.MATCHMAKING_DO.get(env.MATCHMAKING_DO.idFromName(gameId));
      return stub.fetch(new Request(url.toString(), request));
    }

    // WebSocket / Room route: /rooms/:roomId/ws
    const roomMatch = url.pathname.match(/^\/rooms\/([^/]+)/);
    if (roomMatch) {
      const roomId = roomMatch[1];
      if (!roomId) {
        return new Response("Room ID is required", { status: 400 });
      }

      // Route to named Durable Object
      const doId = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(doId);

      // Append roomId query parameter if not present
      if (!url.searchParams.has("roomId")) {
        url.searchParams.set("roomId", roomId);
      }

      const forwardRequest = new Request(url.toString(), request);
      return stub.fetch(forwardRequest);
    }

    return new Response("Not Found", { status: 404 });
  },
};
