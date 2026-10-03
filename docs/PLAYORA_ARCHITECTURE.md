# Playora — Architecture & Audit

Phase 1 of the platform transformation. This is the state of the repository as
measured, not as intended: every claim below was checked against the code.

---

## 1. Current architecture

```text
                          PLAYORA (Turborepo + pnpm)
                                     |
        +----------------------------+----------------------------+
        |                            |                            |
     apps/web                   apps/realtime                 packages/*
     Next.js 15                 Cloudflare Worker             12 workspace pkgs
     React 19                   Durable Objects
     Tailwind                   WS Hibernation
        |                            |                            |
        +----------------------------+----------------------------+
                                     |
                                 Supabase
                        Postgres · Auth · RLS (18 tables)
```

**Stack.** Next.js 15.1.7 (App Router), React 19, TypeScript strict, Tailwind,
Turborepo, pnpm workspaces. Realtime is a Cloudflare Worker with Durable Objects
and WebSocket Hibernation. Persistence is Supabase Postgres with Row Level
Security. Observability is Sentry + PostHog. Data fetching is TanStack Query.
Post-match work runs through Cloudflare Queues.

**Workspace packages.** `analytics`, `animation`, `audio`, `auth`, `bot-engine`,
`config`, `database`, `game-engine`, `game-types`, `progression`, `protocol`,
`ui`.

**Routes.** 18 pages + 5 API routes: home, games, games/[slug], play, rooms,
rooms/[code], history, history/[sessionId], leaderboard, achievements, friends,
profile, settings, login, lan, admin, admin/reports.

**Games.** 15 in the catalog, 4 families in code: chess, UNO (+ No Mercy),
racing (car + bike, Three.js), and 11 arcade games.

---

## 2. What is genuinely strong — keep and build on

These are not placeholders. They are the platform's real assets.

- **Server-authoritative racing.** `packages/game-engine` runs a fixed 60 Hz
  deterministic simulation with seeded procedural tracks. The client sends
  input; the server decides position, lap and finish. This already satisfies the
  anti-cheat posture most of the spec asks for.
- **Realtime infrastructure.** Durable Objects with WebSocket Hibernation, a
  versioned `protocol` package, and a reconnect path with capped exponential
  backoff.
- **Database and security.** 18 tables across 9 migrations, RLS on every user
  table, service-role keys confined to the Worker. Migration `00007` exists
  because `friendships` shipped with RLS enabled and *no policies*, which denied
  every read and write — that class of bug is now covered by tests.
- **Progression.** Elo per game, XP, levels, rank tiers, 25 achievements awarded
  server-side, seasons with soft reset and idempotent close.
- **Bots.** Chess, UNO and racing, with difficulty ladders that were measured
  rather than guessed.
- **Design system.** Tokens in `packages/ui/src/tokens.ts`, consumed through CSS
  variables. Light and dark both now measure **zero WCAG AA contrast failures**
  across nine routes.
- **Test discipline.** Unit + integration + live verification scripts, and a
  full gate (`version:check`, `lint`, `typecheck`, `test`, `build`) that is
  green.

---

## 3. Findings

Ordered by how much they cost. Each has the evidence that produced it.

### F1 — Arcade gameplay runs on React state and `setInterval` (critical)

Nine of eleven arcade views drive gameplay with `setInterval`; only two touch
`requestAnimationFrame`. Game state lives in `useState`, so every simulation
step is a React re-render.

Consequences, all observed:

- **No fixed timestep.** Simulation speed follows timer drift, and browsers
  throttle background intervals — the Rope Rescue blade froze while its
  survivors kept moving, because the two ran on different clocks.
- **No frame budget.** Spec target is 60 FPS; a `setInterval` loop cannot
  synchronise with the compositor and will tear or stutter under load.
- **No pooling, atlases or draw-call control** — `grep` finds none.

This is the single largest gap between Playora and a platform-grade runtime, and
it is what §15 of the brief means by "avoid tying gameplay logic directly to
React rendering".

### F2 — There is no game SDK (critical)

Games reach directly into hooks and stores. There is no `playora.*` surface, so
every new game re-implements scoring, persistence, analytics and lifecycle by
hand — which is why the same scoring bug appeared in four files.

### F3 — No input abstraction; mobile support is incidental rather than designed

Stated precisely, because the first version of this finding overstated it: the
arcade games are click-driven, and browsers synthesise `click` from a tap, so
they *are* tappable on a phone. Nine of eleven have no
`onTouchStart`/`onPointerDown`, but that does not by itself make them unplayable.

What is actually missing:

- **No input abstraction.** Each game reads its own device events, so adding a
  control scheme means editing eleven files.
- **No continuous or drag input.** Anything needing a held direction, a swipe or
  a joystick has nowhere to come from.
- **No gamepad support** anywhere in the codebase.
- **No orientation, safe-area or hit-target sizing policy**, so small targets
  near a notch or a home indicator are a per-game accident.

Racing is the exception — it has `touch-controls.ts` — which is also why racing
scores highest on mobile in the table below.

### F4 — The catalog is hardcoded, not data-driven

A `games` table exists and is read for room creation, ratings and leaderboards,
but the *catalog the UI renders* is a 333-line TypeScript literal
(`apps/web/src/lib/games/catalog.ts`). The admin panel therefore cannot add,
feature, categorise or unpublish a game — the thing §37 and §56 exist for.

### F5 — No SEO whatsoever

Zero `generateMetadata` in the app, no `sitemap.ts`, no `robots.txt`, no Open
Graph or Twitter tags, no structured data, no canonical URLs. Every game page is
currently invisible to search — for a discovery-driven product this is the
cheapest large win available.

### F6 — Missing platform tables

Absent: `favorites`, `recently_played`, `game_progress`, `game_events`,
`categories`, `tags`, `game_tags`. So favourites, continue-playing, per-game
saves and behavioural recommendations cannot be built yet.

### F7 — No fullscreen anywhere

`requestFullscreen` appears nowhere in the codebase.

### F8 — 34 MB of Phaser that nothing imports

`phaser@3.90.0` is declared in `apps/web/package.json` and never imported —
verified by grep across all sources. It is 34 MB in `node_modules`. It does not
reach the browser bundle (nothing imports it), so this is install and CI cost,
not runtime cost — but it is also a decision that was never actually made.

### F9 — No adaptive quality, no PWA, no CDN pipeline for game assets

No LOW/MEDIUM/HIGH tiers, no device capability detection, no manifest or service
worker, and game assets are served from the Next.js app rather than storage/CDN.

---

## 4. Scoring the existing games

Assessed by playing them, not by reading them.

| Game | Gameplay | Visuals | Perf | Mobile | UX | Audio | Replay |
|---|---|---|---|---|---|---|---|
| Car Race | 8 | 8 | 7 | 7 | 7 | 6 | 8 |
| Bike Race | 8 | 8 | 7 | 7 | 7 | 6 | 8 |
| Chess | 8 | 7 | 9 | 6 | 7 | 5 | 8 |
| UNO / No Mercy | 7 | 7 | 9 | 6 | 7 | 5 | 7 |
| Ant Attack | 6 | 5 | 5 | 3 | 5 | 3 | 5 |
| Pin Puzzle | 6 | 4 | 8 | 4 | 6 | 2 | 5 |
| Rope Rescue | 5 | 4 | 5 | 2 | 5 | 2 | 4 |
| Bridge Builder | 5 | 4 | 8 | 3 | 5 | 2 | 4 |
| Target Rush | 5 | 4 | 5 | 3 | 5 | 2 | 4 |
| Colour Rush | 4 | 4 | 6 | 3 | 5 | 2 | 4 |
| Falling Floor | 4 | 3 | 6 | 2 | 4 | 2 | 3 |
| Hot Potato | 4 | 3 | 6 | 3 | 4 | 2 | 3 |
| Bomb Pass | 4 | 3 | 6 | 3 | 4 | 2 | 3 |
| Ice Breaker | 4 | 3 | 6 | 2 | 4 | 2 | 3 |

The pattern is consistent: the two engine-backed families (racing, chess/UNO)
score well; the eleven React-state arcade games score poorly on exactly the axes
F1 and F3 predict — mobile, performance and audio.

---

## 5. What this means

The platform layer is in far better shape than the game layer. Auth, realtime,
progression, security and the design system are production-grade. The arcade
games are prototypes wearing the platform's UI.

So the work is **not** a rewrite. It is:

1. Give games a real runtime (loop, input, pooling) — fixes F1, F3.
2. Give games one API to talk to the platform through — fixes F2.
3. Move the catalog into the database — fixes F4, unlocks the admin panel.
4. Add the missing discovery surface — fixes F5, F6, F7.

Sequencing and status live in [PLAYORA_MIGRATION.md](PLAYORA_MIGRATION.md).
