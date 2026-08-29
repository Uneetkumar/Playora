# Realtime Layer

Cloudflare Worker + one `RoomDurableObject` per room. The Durable Object is the
authoritative owner of live room and game state; Postgres owns persistent
platform data (see `docs/DATABASE.md` when it lands).

## Routing

```
wss://<worker>/rooms/:roomId/ws?gameId=chess&spectator=false
```

The Worker maps `:roomId` to a Durable Object via `idFromName(roomId)`, so a
room code resolves to exactly one object globally. `GET /rooms/:roomId/status`
returns a non-authoritative snapshot for health checks.

## Two invariants

### 1. Identity is never taken from the client

A socket carries **no identity** when it opens. `ConnectionAttachment.userId` is
`null` until an `AUTH` message has been verified against Supabase's signing
keys. Until then the only accepted message is `PING`; everything else is
answered with `ERROR / UNAUTHENTICATED`, and unauthenticated sockets are closed
by the alarm after 10 seconds.

Query parameters are treated as untrusted input. `?userId=` is ignored entirely
— it is not read anywhere in the Durable Object. Player identity, display name,
avatar and guest status all come from verified JWT claims.

Verification lives in `@playora/auth` (`SupabaseTokenVerifier`) and prefers
asymmetric JWKS so no shared secret is deployed to the edge; it falls back to
the legacy HS256 project secret when configured. Signature, expiry, issuer and
audience are all checked.

`GAME_ACTION.playerId` is likewise set from the verified session, never from the
message body — a client cannot submit a move "as" another player.

### 2. All state is durable

Durable Objects are evicted routinely when idle. Nothing that matters may live
only in instance fields.

| Concern | Mechanism |
|---|---|
| Room + game state | `state.storage` under a single `room` key |
| Restore after eviction | `blockConcurrencyWhile` in the constructor |
| Sockets | WebSocket Hibernation API (`acceptWebSocket`) |
| Per-connection state | `serializeAttachment` / `deserializeAttachment` |
| Disconnect grace period | `state.storage.setAlarm()` |

Because sockets hibernate, handlers are methods on the object
(`webSocketMessage`, `webSocketClose`, `webSocketError`, `alarm`) rather than
event listeners captured in a closure.

## Connection lifecycle

```
open socket
   ↓
AUTH { token }            ← mandatory first message
   ↓ verify JWT
CONNECTED { userId }
ROOM_STATE
GAME_STATE                ← only if a match is in progress
   ↓
… gameplay …
   ↓
close
   ↓
status = disconnected, seat held      ← only during an active game
alarm fires after 60s → seat forfeited → PLAYER_LEFT
```

Reconnecting with a valid token before the deadline cancels the countdown,
restores the seat, and replays `ROOM_STATE` plus the player's `GAME_STATE`.
A second live connection for the same user supersedes the first; the superseded
socket is closed and deliberately does not evict the session that replaced it.

## Hidden information

`broadcastGameState` calls `engine.getPlayerView(state, userId)` **per socket**,
so each player receives only what they are entitled to see (spec §64). The
`initialState` in `GAME_STARTED` uses the `null` (public) view. Unauthenticated
sockets never receive a broadcast of any kind.

## Rate limiting

Token buckets per connection, in `src/lib/rate-limit.ts`:

| Action | Burst | Refill |
|---|---|---|
| `CHAT_SEND` | 5 | 1/s |
| `REACTION_SEND` | 8 | 2/s |
| `GAME_ACTION` | 20 | 10/s |

Buckets are in-memory and reset on eviction — they exist to stop flooding within
a live session, not to enforce a long-lived quota.

## Authorization

Host-only actions re-read `room.hostUserId` from authoritative state at the
moment of the check, so a transferred host cannot be impersonated by whoever
held the role when the socket opened. Spectators are rejected from `GAME_ACTION`.

## Testing

`apps/realtime/test/` runs against real workerd via
`@cloudflare/vitest-pool-workers`. 19 integration tests cover authentication and
impersonation, room lifecycle and host authority, storage durability, resync,
and abuse controls.

```bash
pnpm --filter @playora/realtime test
```

Tokens are minted locally with HS256 against a test secret bound in
`vitest.config.ts`. This is the same legacy verification path Supabase itself
supports — not a test-only bypass. There is no way to authenticate without a
correctly signed token in any environment.

## Not yet implemented

- Persisting `game_sessions` / `game_results` to Supabase on finish (Slice 3)
- Room registry, discovery, and privacy enforcement beyond capacity (Slice 3)
- Chess clock enforcement via alarms
- `KICK` / explicit host transfer messages
