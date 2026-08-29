# Realtime Architecture & WebSocket Protocol

The Realtime layer (`apps/realtime`) is powered by **Cloudflare Workers** and **Durable Objects**.

## Durable Object Lifecycle

Every active room is represented by a single `RoomDurableObject` instance identified by its unique Room ID or Room Code:

```
[ Client A ] --- WebSocket ---> \
[ Client B ] --- WebSocket --->   [ RoomDurableObject (Edge Actor) ]
[ Client C ] --- WebSocket ---> /
```

### Connection Flow

1. Client establishes WebSocket upgrade to `/rooms/:roomId/ws?userId=...&username=...`.
2. The Worker forwards the connection to `env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId))`.
3. The Durable Object accepts the socket, issues a `CONNECTED` message, and broadcasts `PLAYER_JOINED` to all active members.
4. The client receives the initial `ROOM_STATE` snapshot.

---

## WebSocket Messages Protocol (`@playden/protocol`)

All messages are typed JSON envelopes validated via **Zod schemas**.

### Client to Server Messages

| Message Type        | Description                                       |
| ------------------- | ------------------------------------------------- |
| `AUTH`              | Authenticates connection with JWT or guest token  |
| `JOIN_ROOM`         | Joins a room as player or spectator               |
| `LEAVE_ROOM`        | Gracefully leaves the active room                 |
| `READY` / `UNREADY` | Toggles player readiness state                    |
| `START_GAME`        | Host triggers the match start                     |
| `GAME_ACTION`       | Submits a player move or input to the game engine |
| `CHAT_SEND`         | Sends a chat message to the room                  |
| `REACTION_SEND`     | Emits an emoji reaction                           |
| `PING`              | Heartbeat keepalive                               |
| `RESYNC`            | Requests full room and game state snapshot        |

### Server to Client Messages

| Message Type          | Description                                         |
| --------------------- | --------------------------------------------------- |
| `CONNECTED`           | Acknowledges successful socket connection           |
| `ROOM_STATE`          | Full state of players, settings, and room metadata  |
| `PLAYER_JOINED`       | Notifies that a new player entered                  |
| `PLAYER_LEFT`         | Notifies that a player departed                     |
| `PLAYER_READY`        | Notifies readiness changes                          |
| `GAME_STARTED`        | Broadcasts game session initialization              |
| `GAME_STATE`          | Updated game state after action execution           |
| `GAME_EVENT`          | Ephemeral match events (animations, sound triggers) |
| `CHAT_MESSAGE`        | Broadcasts chat message                             |
| `REACTION`            | Broadcasts player emoji reaction                    |
| `PLAYER_DISCONNECTED` | Warns of player connection loss and grace period    |
| `PLAYER_RECONNECTED`  | Notifies successful reconnect                       |
| `GAME_FINISHED`       | Final match result and rankings                     |
| `ERROR`               | Typed error notification                            |
| `RESYNC_STATE`        | Synchronized full state recovery payload            |
