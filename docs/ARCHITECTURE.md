# Game Platform Architecture

This document details the multi-tier production architecture of the **Game Platform** multiplayer platform.

## High-Level Architectural Responsibilities

```
+-------------------------------------------------------------------------+
|                               Next.js (Web UI)                          |
|    - App Router, responsive layouts, pages (Home, Rooms, Games, etc.)   |
|    - Zustand client stores, Tailwind CSS & shadcn/ui components         |
+-------------------+---------------------------------+-------------------+
                    |                                 |
                    | (WebSockets & REST)             | (PostgreSQL Client)
                    v                                 v
+-----------------------------------+   +---------------------------------+
|   Cloudflare Durable Objects      |   |       Supabase PostgreSQL       |
|   (apps/realtime)                 |   |   - Profiles & Auth Records     |
|   - Live Room State               |   |   - Games Catalog               |
|   - Tick-level Game Execution     |   |   - Match History & Results     |
|   - Player Presence & Heartbeats  |   |   - Friends & Invites           |
|   - Chat & Reactions              |   |   - Reports & Moderation        |
+-----------------------------------+   +---------------------------------+
                    |
                    +---------------------------------+
                    |                                 |
                    v                                 v
+-----------------------------------+   +---------------------------------+
|             Phaser 3              |   |             LiveKit             |
|   - 2D Canvas Game Rendering      |   |   - Realtime WebRTC Voice Chat  |
|   - Visual Interpolation          |   |   - Audio Channels & Token Auth |
+-----------------------------------+   +---------------------------------+
```

---

## Component Breakdown

### 1. Supabase PostgreSQL (Persistent Data)

- **Role**: Persistent system of record for accounts, player stats, global rankings, game definitions, match summaries, friendships, and user moderation.
- **Rule**: High-frequency realtime game state (such as 60 FPS physics coordinates or in-flight card hands) is **NEVER** stored in PostgreSQL.

### 2. Cloudflare Durable Objects (Realtime In-Memory Room Coordination)

- **Role**: Distributed, single-threaded actors running on Cloudflare edge workers.
- Each active game room maps to a dedicated `RoomDurableObject` instance.
- Handles WebSocket upgrades, client authentication, heartbeat pings/pongs, and player presence.
- Executes the deterministic `@playora/game-engine` instances in-memory.
- Guarantees strict ordering of actions without database locks.

### 3. Next.js App Router (Frontend Platform)

- **Role**: Responsive web client, room browser, game launcher, social hub, and user profile management.
- Uses **Zustand** stores (`auth-store`, `room-store`, `game-store`) for reactive UI state.
- Strictly decoupled from low-level database operations and backend state mutations.

### 4. Phaser 3 (2D Game Rendering)

- **Role**: Canvas / WebGL game view for top-down racing, board rendering, and visual animations.
- Subscribes to state updates emitted by the game engine and interpolates player movements.

### 5. LiveKit (WebRTC Audio & Voice)

- **Role**: Low-latency spatial or room-based voice communication for multiplayer lobbies.
- Authenticated via server-generated LiveKit tokens.

---

## Monorepo Packages

| Package                | Purpose                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `packages/config`      | Shared TypeScript, ESLint, and Prettier configurations.              |
| `packages/game-types`  | Shared domain models (Player, Room, Game, GameSession, Result).      |
| `packages/game-engine` | Abstract deterministic engine interface and registry.                |
| `packages/protocol`    | Strongly typed WebSocket client/server Zod schemas.                  |
| `packages/auth`        | User & guest authentication abstractions and session utilities.      |
| `packages/database`    | Browser-safe and server-only Supabase client factories.              |
| `packages/ui`          | Tailwind + shadcn shared UI primitives (Button, Card, Dialog, etc.). |
