# Project Context — Session Handoff

**Purpose.** Paste-able state of this project so a new chat/tab can resume with
zero loss of context. Read this file first, then `docs/ARCHITECTURE.md`.

**Maintenance rule:** update the *Status Ledger*, *Decision Log*, and *Next Action*
sections at the end of every milestone. Everything else changes rarely.

**Last updated:** 2026-08-30 · **Version:** 0.1.0 · **Phase:** platform shell rebuilt to reference UI

---

## 1. How to resume in a new tab

Paste this into the new session:

> Read `docs/CONTEXT.md`, `docs/ENVIRONMENT_SETUP.md`, and `docs/ARCHITECTURE.md`
> in this repo, then continue from the "Next Action" section of CONTEXT.md.
> Follow the master spec's non-negotiable engineering rules (§104).

---

## 2. What this project is

### The six play modes (product definition, 2026-08-29)

| Mode | Login | Internet | Runs on | Status |
|---|---|---|---|---|
| Offline vs AI | no | no | browser | ✅ works |
| Offline pass & play | no | no | browser | ✅ works |
| Online with friends (room code) | guest or Google | yes | Durable Object | ✅ **verified** by `pnpm sim` |
| Online vs random (Quick Match) | guest or Google | yes | Durable Object | ✅ **live**, verified by `pnpm verify:matchmaking` |
| Online vs AI | guest or Google | yes | DO + server-side bot | ✅ **live**, BOT badge in lobby |
| Same wifi, no internet | no | LAN only | peer device | ❌ deferred, see D4 |

`apps/web/src/lib/play/modes.ts` is the single source of truth; home, games and
the play hub all read from it, so a mode is never advertised in one place and
missing in another.


A production-quality browser-based multiplayer gaming platform — **one platform,
many games**, not five game sites. Platform owns identity, social, matchmaking,
rooms, progression, history, moderation. Games own only rules, state, actions,
AI, rendering, audio events.

Games, in build order: **Chess → UNO → UNO No Mercy → Car Race → Bike Race.**

Governed by a two-part master specification supplied by the user (108 sections).
Key non-negotiables: server is authoritative; never trust client game state; game
rules never in React; high-frequency state never in Postgres; bots never bypass
`GameEngine` validation; strict TypeScript, no `any`.

**Name: Playora.** Tagline "Play. Connect. Compete." Package scope `@playora/*`,
Worker `playora-realtime`. Renamed from Playden on 2026-08-29 when the UI/UX
design pack arrived branded PLAYORA — 241 references in one pass, before publish.

---

## 3. Stack (fixed by spec — do not substitute without strong reason)

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui, Zustand, Zod |
| Realtime | Cloudflare Workers + Durable Objects + WebSockets |
| Data / Auth | Supabase Postgres, Supabase Auth (Google OAuth + Anonymous) |
| Games | chess.js (rules), Phaser (2D racing) |
| Voice | LiveKit / WebRTC (Phase 14) |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Build | pnpm + Turborepo |
| Observability | Sentry, PostHog |

---

## 4. Repository map

```
apps/
  web/        Next.js app — 7 pages, chess board UI, chat, reactions, room socket hook
  realtime/   Cloudflare Worker + RoomDurableObject
packages/
  protocol/     Zod-validated WebSocket message union  ← solid, keep
  game-engine/  GameEngine interface + AbstractGameEngine + registry + ChessEngine
  game-types/   Shared domain types
  auth/         ⚠️ currently fake — see §6
  database/     Supabase clients — ⚠️ DEAD CODE, zero importers
  ui/           7 shadcn-style components
  bot-engine/   BotEngine interface + ChessBot (alpha-beta, 7 levels)
  progression/  Elo rating, XP, levels, rank tiers (pure, 25 tests)
  config/       5 tsconfig presets
supabase/
  migrations/00001_initial_schema.sql   11 tables, FKs, indexes, RLS
scripts/
  sync-version.mjs   version single-source-of-truth propagation
docs/
  CONTEXT.md (this) · ENVIRONMENT_SETUP.md · ARCHITECTURE.md
  DEVELOPMENT.md · REALTIME.md · GAME_ENGINE.md
```

---

## 5. Verification baseline (measured 2026-08-30)

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ 20/20 |
| `pnpm test` | ✅ **362 tests** (game-engine 128, realtime 56, bot-engine 44, progression 37, audio 20, auth 20, game-types 18, animation 16, protocol 10, analytics 8, db 2, ui 3) |
| `pnpm build` | ✅ 18 routes |
| `pnpm version:check` | ✅ in sync at 0.1.0 |
| `pnpm lint` | ✅ clean |
| `pnpm test:e2e` | ✅ 2/2 (Playwright, chromium) |

Reproduce with: `pnpm install && pnpm version:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

### Live verification scripts (need a Worker on :8787 and `apps/web/.env.local`)

Start the Worker with `pnpm --filter @playora/realtime dev`, then:

| Script | Proves |
|---|---|
| `node scripts/sim-match.mjs` | two clients play a full match (16 checks) |
| `node scripts/verify-persistence.mjs` | rooms and results reach Postgres (9) |
| `node scripts/verify-matchmaking.mjs` | Quick Match pairs players (9) |
| `node scripts/verify-progression.mjs` | Elo and XP applied, zero-sum (12) |
| `node scripts/verify-uno-online.mjs` | online UNO deals, hides hands, rejects illegal plays (10) |
| `node scripts/verify-uno-ai.mjs` | UNO and No Mercy bots play online (10) |
| `node scripts/verify-rematch.mjs` | rematch needs both votes, deals a fresh session (8) |
| `node scripts/verify-history.mjs` | match history filter and rating history (11) |
| `node scripts/verify-leaderboard.mjs` | leaderboard ordering and counted rank (7) |
| `node scripts/verify-admin.mjs` | staff roles, reports and the moderation audit trail (16) |
| `node scripts/verify-seasons.mjs` | season standings, overlap, and closing (20) |
| `node scripts/verify-progression-accrual.mjs` | three real matches, same accounts: rating, XP, streak and season all accrue (15) — needs the Worker on :8787 |
| `node scripts/verify-achievements.mjs` | achievements awarded server-side; clients cannot self-award (8) |
| `node scripts/verify-friends.mjs` | friendship RLS, including every negative (10) |
| `node scripts/verify-racing-online.mjs` | the server owns the race clock; clients cannot tick or teleport (22) |

---

## 6. Critical findings — READ BEFORE WRITING CODE

Phases 0–3 are ~70% complete *in shape*, but the foundation is **not trustworthy**.
Three defects are load-bearing; do not build features on top of them.

### ✅ F1 — Identity is forgeable end-to-end — **FIXED (Slice 2)**
The Durable Object no longer reads `userId` from the query string at all. A
socket carries no identity until an `AUTH` message is verified against Supabase's
signing keys (`SupabaseTokenVerifier` in `@playora/auth`, JWKS-first with legacy
HS256 fallback; signature, expiry, issuer and audience all checked). Until then
only `PING` is accepted. `GAME_ACTION.playerId` is set from the verified session.

Proven by test, not assertion: `apps/realtime/test/auth.test.ts` connects with
`?userId=<victim>` and authenticates as an attacker — the established identity is
the attacker's, not the victim's. Forged signatures, `alg: none`, expired tokens,
wrong issuer and wrong audience are all rejected.

**Still outstanding:** the web client cannot obtain a real Supabase token until
Slice 1, so the app cannot connect end-to-end yet. This is correct behaviour —
it previously "worked" only because it was insecure.

### ✅ F2 — The Durable Object persists nothing — **FIXED (Slice 2)**
Room and game state persist to `state.storage` and restore via
`blockConcurrencyWhile` on construction. Sockets use the WebSocket Hibernation
API with `serializeAttachment`, so connections survive eviction. The `setTimeout`
disconnect grace was replaced with `state.setAlarm()`. Verified by tests that
read storage directly after a game starts.

### ✅ F3 — Supabase is dead code — **FIXED AND VERIFIED (Slice 1)**
Auth is now wired end to end in code: `@supabase/ssr` browser + server clients,
session-refresh middleware, `/auth/callback` OAuth exchange, Zod-validated public
env, and an auth store backed by real Supabase sessions. The forgeable guest
token system is **deleted** — `guest.ts` and `client.ts` are gone, and guests now
get a genuine Supabase anonymous session.

`supabase/migrations/00002_auth_profile_bootstrap.sql` ties `profiles.id` to
`auth.users(id)`, creates a profile on signup (guests included), and handles the
guest→Google upgrade by refreshing display fields while keeping the same user id
— so ratings, history and achievements survive the link (spec §12).

**Verified end to end against the live project** (`pvjdziltmjwcchjbukaa`,
ap-south-1) on 2026-08-29:

| Check | Result |
|---|---|
| Anonymous sign-in | real ES256 JWT issued |
| JWT claims | `iss`, `aud: authenticated`, `is_anonymous: true` |
| `00002` trigger | auto-created profile, `is_guest: true`, rating 1200 |
| `SupabaseTokenVerifier` vs live JWKS | **accepted** — no shared secret at the edge |
| Tampered token | rejected, `TOKEN_INVALID_SIGNATURE` |
| Browser guest login | nickname "UneetTest" → profile `uneettest` |
| Games catalog via anon key | 5 rows readable — RLS confirmed |

Still open: **Google provider is not enabled** in the dashboard, so only the
guest path is proven. Rooms/results persistence remains Slice 3.

### 🟠 Secondary

### ✅ Resolved this session
- **Shell rebuilt against the CrazyGames reference the user supplied.**
  Fixed header (logo, centred game search, join-by-code, friends/notifications/
  avatar), a collapsed icon rail that expands on hover with labels, and a home
  page that is horizontal rows of game tiles rather than a marketing hero.
  Progress and recent matches moved to a side column: they are context, not the
  reason anyone opens the page.
- **UNO hand geometry corrected from a screen recording.** The reference is a
  flat, squared-up overlapping stack — each card showing about its left 40% —
  not the arced fan I had built. An arc spreads cards out and reads as a row of
  tiles; the stack reads as a hand. Same treatment for opponents, face-down.
  Also added the colour diamond and direction mark from the reference, and a
  deep felt-table ground behind the centre.
- Game tiles get per-game artwork treatments rather than one shared gradient —
  a wall of identical tiles is what makes a catalogue look unfinished.
- **"The server keeps restarting while I play."** Root cause was me editing
  files against the same dev server the user was playing on. Fixed structurally
  rather than by asking them to wait: `pnpm play` builds to `.next-stable` and
  used to serve on :3000, isolated from `.next` (removed — see 11c item 4)
  can disturb a session in progress.
- **UNO animations were written but did not play.** Three defects, all mine:
  the deal stagger ran entirely while cards were at `opacity: 0` and then snapped
  in together; an `exit` animation on hand cards overrode the shared `layoutId`
  so a played card faded instead of travelling; and opponent throws were never
  implemented. Replaced `layoutId` with an explicit flight overlay, which works
  across component boundaries and — unlike a shared layout id — can animate an
  opponent's card, whose cards were never in the DOM.
- **Home was a landing page, not the dashboard the design pack specifies.**
  Raised three times before it was fixed. `/` now branches: strangers get the
  landing page, signed-in players get `HomeDashboard` — Quick Play hero, Your
  Progress with the XP bar, Continue Playing from real per-game ratings, Games,
  Recent Matches from `game_results`, and search at the top. Sections with no
  real data show an honest empty state with the next action, never invented
  placeholder content.
- **UNO board rebuilt with real card anatomy and motion** (framer-motion):
  white border, coloured body, rotated white ellipse, centre glyph, mirrored
  corner marks, conic-gradient wilds, UNO oval on card backs. Dealing stagger,
  `layoutId` so a played card travels from hand to discard, fanned hand that
  tightens as it grows, and rule-alert banners (SKIPPED / REVERSE / +2 / +4 /
  +6 / +10 / WILD). All gated on `prefers-reduced-motion`.
- **Double reconnect fixed.** The room page passed
  `roomInfo?.gameSlug ?? currentRoom?.gameId ?? "chess"`, which changed twice per
  load — once when the lookup resolved, again when ROOM_STATE arrived — tearing
  the socket down each time. The hook now takes a `ready` flag and holds the
  connection until the game is known. Third bug in this family (after the
  infinite reconnect loop and the guest-identity loss); all three were React
  effect dependencies that looked stable and were not.
- **UNO No Mercy playable.** A rule set on `UnoEngine` per §17, not a second
  engine: 168-card deck, stacking draw penalties, 0 passes hands, 7 swaps them,
  Discard All, Skip Everyone, elimination at 25 cards. 22 tests.
- **Changes needed a restart to appear — three real causes, all fixed:**
  1. Library packages compile to `dist/` and had **no watch script**, so editing
     `packages/*/src` did nothing until someone ran a build by hand. All eight
     now run `tsc --watch` under `turbo dev`. Verified: editing a package source
     rebuilt its `dist` in **1 second**.
  2. `transpilePackages` was missing `@playora/progression` and
     `@playora/bot-engine` — added later and never listed, so Next silently
     ignored them.
  3. Turbo capped concurrent persistent tasks at 10; with 2 apps + 8 watchers
     that is exactly 10, so `turbo dev` refused to start. Concurrency now 16.
  Also: `pnpm build` and `pnpm dev` both write `apps/web/.next`, so running them
  together makes the dev server serve 500s. Documented.
- **Catalog opened every game as Chess.** Cards linked to `/play` with no game,
  and the play page defaulted to chess. They now link `/play?game=<id>`, which
  the page honours.
- **Removed the game switcher.** Choosing UNO from the catalog then being shown
  a Chess tab is noise; a deliberate choice should not be second-guessed. A game
  chosen explicitly locks the page to it, with a quiet "Choose a different game"
  link. Landing on bare `/play` shows a chooser instead of guessing.
- **Global game search on home.** Ranked over name, category, tags and
  description; keyboard-first (arrows/Enter/Escape); results state plainly
  whether a game is playable or which phase it is due in.
- **Game catalog de-duplicated** into `lib/games/catalog.ts`. It was copied
  across home and the games page — exactly how a search index drifts from the
  thing it searches.
- **UNO built and playable.** `UnoEngine` with the full rule set — 108-card
  deck, seeded deterministic shuffle, skip/reverse/draw2/wild/wild-draw-four,
  stacking penalties, UNO call with a two-card penalty for forgetting,
  discard reshuffling when the draw pile empties. **35 tests** covering §87's
  edge-case list.
  `getPlayerView` reduces opponents to a card count, and a test asserts an
  opponent's card ids never appear anywhere in the serialised view (§5, §64).
- **UNO UI**: card faces with symbols as well as colour (§32), playable-card
  highlighting, wild colour picker, per-card accessible names
  ("green Reverse, playable").
- **Play hub is game-aware.** A game picker lists only games with a registered
  engine, and mode availability is derived per game — UNO correctly shows
  "Play vs AI: No AI opponent for this game yet", because no UnoBot exists.
- Verified in the browser: dealt 7/7 with a 93-card draw pile (108 − 15), played
  a green Reverse, and the turn returned to the same player — the two-player
  reverse-as-skip rule, confirmed through the real UI.
- **Progression verified end to end** (`pnpm verify:progression`, 12/12) against
  the live Worker and Supabase: winner 1200→1219, loser 1200→1180, zero-sum,
  rating history rows written, XP awarded to **both** players, streak set for the
  winner and reset for the loser.
- **Profile page rebuilt on real data.** Level + XP bar, games/wins/win-rate/
  streak tiles, and per-game rating cards with rank and "N rating to <next>".
  Verified in the browser with a real guest who played a real rated match:
  Level 1 · 60 XP · Chess 1220 · Silver. The three systems are visibly distinct,
  which is the point of §11/§104.6.
- Footer still said "Game Platform"; rebranded.
- **Progression built.** `packages/progression` holds Elo, XP, levels and rank
  tiers as pure functions with 25 tests — the spec asks for tested rating maths
  (§25), which rules out putting it in SQL.
  Migration `00004` adds `game_ratings` (per user **per game**) and
  `rating_history`, plus XP/level/streaks on profiles.
  `00001` had a single global `profiles.rating`, which cannot express "strong at
  chess, new to racing" — it is now marked deprecated in a column comment.
  The Worker applies progression after the result is written, never before.
- **Three systems kept separate** (§11, §104.6/7): platform XP/level measures
  participation, game rating measures skill, rank is derived from rating and not
  stored. Bot and offline matches award XP but **do not** move rating (§13).
- **Mobile had no navigation at all.** The only nav was `hidden md:flex`, so on
  a phone you could reach the home page and then were stuck — a functional bug,
  not a styling gap. Added `MobileNav`: bottom bar with Home / Games / Play /
  Friends / Profile, Play raised as the primary action, 44px touch targets,
  `env(safe-area-inset-bottom)` for the iOS home indicator, and `aria-current`
  plus a screen-reader label so the active tab is not signalled by colour alone
  (§32). Verified at 375x812.
- Brand tagline wrapped and crowded the mobile header; hidden below `sm`.
- **Quick Match shipped and verified.** `useMatchmaking` + a panel covering
  searching / match found / timeout / cancelled / error with human-readable copy
  (spec §4, §50). `pnpm verify:matchmaking` proves it end to end: 9/9 — two real
  guests queued, not matched while alone, paired into the same room, each sees
  the other as opponent, and the room is persisted **and private** so matched
  rooms are never publicly listed.
- **Playora design system adopted.** `packages/ui/src/tokens.ts` is the single
  source for colour, spacing, radius, type, elevation, motion and z-index. Exact
  pack palette (#6C5DD3 / #38BDF8 / #22D3EE / #FF4D8D / #0D0E14 / #151722),
  Poppins display + Inter body via `next/font`, 8px grid, 12/16px radii.
  **382 hardcoded colours across 22 files** replaced with tokens — the brief
  forbids hardcoded values, and light mode is impossible without them.
- **Light mode designed, not inverted** (explicit brief requirement), and
  `prefers-reduced-motion` honoured globally.
- **Renamed Playden → Playora** across 241 references; gate green after.
- Applying Poppins immediately exposed a clipped hero: my global `h1`
  letter-spacing compounded with `tracking-tight`, and `bg-clip-text` crops the
  last glyph of a wide face. Both fixed.
- **"All games open Chess" — root cause found.** Two separate problems:
  1. Only Chess has an engine. UNO, UNO No Mercy, Car Race and Bike Race are
     catalog rows with no rules (Phases 9-13). Every surface now derives
     playability from `gameEngineRegistry` via `isGameImplemented()`, so the
     catalog shows "Coming in Phase N" and offers no route in. The hand-kept
     `isPlayable` flags on the games page are deleted — they could drift.
  2. **A real bug**: the room page passed `currentRoom?.gameId || "chess"` to
     the socket, but `currentRoom` only exists *after* ROOM_STATE arrives — so
     the first connection always said chess, and the room was created as a chess
     room whatever game it was for. Now resolved via `useRoomInfo(code)` before
     connecting.
- **Join by code on the home page.** Primary placement under the hero; the code
  is validated and resolved server-side before navigating, so a bad or full code
  says so instead of opening a room that closes immediately.
- **Rooms are persisted.** `rooms/page.tsx` uses the room API: server-generated
  codes, real listing, loading skeletons and an error banner with retry.
- **Match results persist.** `lib/result-store.ts` writes `game_sessions` and
  `game_results` over PostgREST with the service-role key, after the broadcast
  so a database problem can never break a match (§67). Bot winners are kept out
  of `winner_id` (no profile row -> FK violation) but stay in `scores`.
- **§92 first vertical slice PROVEN.** `pnpm sim` runs a full two-client match
  against the live Worker and live Supabase: two real guest identities, host
  authority, ready, start, 6 relayed moves, both clients converging on the same
  FEN, distinct colours, illegal move rejected, chat, disconnect with 60s grace,
  reconnect reclaiming the seat, and resync restoring the match. 16/16 checks.
- **Server-side AI shipped.** `ADD_BOT` / `REMOVE_BOT` in the protocol,
  `isBot` / `botLevel` on the player model, `handlers/bot-handler.ts` in the
  Worker. Bot actions go through the **same** `executeAction` path as humans —
  extracted specifically so a bot cannot bypass validation (§104.5). Verified
  live: human played a3, server-side bot replied Nc6.
- **Test env was not hermetic.** Adding `.dev.vars` broke 17 realtime tests: the
  pool loads it, so the real `SUPABASE_URL` made the verifier enforce that
  project's issuer and reject locally-signed test tokens. `vitest.config.ts` now
  blanks those bindings explicitly. The tests had been passing only because the
  file did not exist.
- **Realtime handshake proven end to end.** A browser guest session's real
  Supabase token is accepted by `RoomDurableObject`'s AUTH gate against live
  JWKS: `auth.accepted userId=... isGuest=true`. Slices 1 and 2 meet correctly.
- **Two client bugs found by running it, not by reading it:**
  1. *Infinite reconnect loop.* `currentRoom` was a dependency of `connect`, so
     every `ROOM_STATE` changed the callback identity, tore the socket down and
     reconnected — ~80 connects/sec until the browser hit "Insufficient
     resources". Fixed by reading room state via `useRoomStore.getState()`
     inside the message handler and holding caller callbacks in refs.
  2. *Guest identity lost on every page load.* The hook minted a new anonymous
     Supabase user whenever `session` was null — including while `initialize()`
     was still restoring it. Six accounts were created in a handful of reloads.
     Fixed by gating the connect effect on `authLoading`. Verified: two reloads,
     same `userId`, profile count unchanged.
- **"Why can't I just play?" fixed.** Every route funnelled into Create/Join
  Room. Home's hero CTA, home game cards and the games list now lead to `/play`,
  a hub showing all six modes with the three ready ones playable in one click.
  Home copy also replaced engineering jargon ("Cloudflare Durable Objects
  Realtime") with what a player actually gets.
- **Quick Play shipped and verified in a browser.** Offline Pass & Play and
  Play-with-AI both work with no Supabase, no auth and no server — the first
  genuinely playable path in the product. Confirmed by playing: e4, AI replied
  Nc6, move list and clocks updated; Pass & Play flips the board per turn.
- **ChessBot latency bounded.** A depth-5 search took **20s** in the opening and
  **124s** in a midgame position. A node cap could not fix it (chess.js costs
  ~100us/node and varies wildly by position), so the search now runs to a
  wall-clock deadline and returns its best line so far. Worst case is ~1.5s in
  any position. Levels 6-7 are therefore depth-limited in practice; genuine
  master strength needs Stockfish WASM (spec section 54 already lists it).
- **Durable Object split.** 898 → 521 lines, with `handlers/auth-handler.ts`
  (173) and `handlers/game-handler.ts` (280) reached through a narrow
  `RoomContext` seam. All 19 integration tests passed unchanged, which is what
  made the refactor safe to do.
- **Unawaited storage writes fixed.** The upgrade path used
  `void this.persist()`, so a socket could be accepted before the room was
  durable and the write could be dropped on teardown. Now awaited. Found via a
  test-teardown race, not by reading the code.
- **Slice 1 code written (unverified).** See F3 above. The old auth test
  claiming to "reject forged guest tokens" only tested malformed strings — a
  well-formed forgery would have passed. Replaced with real signature tests.
- **Slice 2 complete.** See F1/F2 above. Also fixed in passing: chat/reaction/
  action rate limiting (token buckets), hardcoded `maxPlayers: 2` (now from the
  engine), stale host role (re-read from authoritative state at check time),
  and a client/env mismatch where the hook read `NEXT_PUBLIC_REALTIME_URL` while
  `.env.example` defined `NEXT_PUBLIC_REALTIME_WS_URL` — so the variable never
  applied.
- **Upgraded to vitest 4** monorepo-wide. `@cloudflare/vitest-pool-workers`
  0.13+ requires it, and pinning an older pool would have meant a stale workerd.
  This surfaced that `__tests__` were being compiled into `dist/` and collected
  twice; tsconfigs now exclude tests from build output.
- **Slice 0 complete.** Scope renamed to `@playora/*`; git repo initialised with
  `main` + `develop`; all 22 lint errors fixed with real types (not suppressions);
  E2E suite repaired and passing; version system implemented; CI workflows added.
  Full gate green — see §5.
- **Two latent bugs surfaced by removing `any`** in `RoomDurableObject.ts`:
  `broadcastGameState` dereferenced `currentGameState` without a null guard, and
  the disconnect-timer lookup passed a possibly-`undefined` handle to
  `clearTimeout`. Both fixed. This is why §104.20 matters.
- **Leaked `service_role` key.** `.env.example` contained a *live* Supabase
  `service_role` JWT (project ref `wlnzuxjbebkdnioliozd`, exp 2036) plus the real
  anon key and project URL — and `.gitignore:22` un-ignores that file, so it
  would have shipped in the first commit. File sanitized to placeholders; leaked
  copy stashed outside the repo. **User must still rotate/recreate the project**
  — see `docs/ENVIRONMENT_SETUP.md` Step 0.

---

## 7. Implementation plan

Ordering rationale: per §30 and §104.18, preserve existing code and repair the
foundation before building on it. Shipping Chess UX / UNO / racing on top of an
impersonatable, non-persistent realtime layer means rewriting them later.

| Slice | Scope | Blocked by |
|---|---|---|
| ~~0 — Hygiene~~ | ✅ **DONE** — rename, git init, 22 lint fixes, E2E repair, version system, CI | — |
| 🟡 1 — Real identity | Code complete; **awaiting credentials to verify** end to end | Supabase project |
| ~~2 — Trusted realtime~~ | ✅ **DONE** — AUTH gate, hibernation, storage, alarms, rate limiting, 19 integration tests | — |
| **3 — Rooms + persistence** (§6, §69) | Real room create/list/join with privacy + capacity enforcement; DO writes `game_sessions` / `game_results` to Supabase via Worker secret | Slices 1–2 |
| **4 — Close the §92 loop** | Result screen, Elo rating, XP, history, stats, Play Again; multiplayer simulation harness (2/4/8 clients, concurrent rooms) per §86 | Slice 3 |

Then §93 Quick Play → §94 AI → §8 social → UNO → racing → voice.

---

## 8. Open decisions

| # | Decision | Status |
|---|---|---|
| D4 | Same-wifi play approach | ✅ **WebRTC + QR signalling, built last** (2026-08-29) |
| D1 | ~~Repo / product name~~ | ✅ **Playora** (2026-08-29) |
| D2 | Supabase JWT signing: asymmetric (ES256/RS256 via JWKS, preferred) vs legacy HS256 shared secret | ⏳ depends on what the dashboard offers |
| D3 | Cloudflare plan — Durable Objects may require Workers Paid (~$5/mo); verify current terms | ⏳ not blocking local dev |

---

## 9. Decision log

- **2026-08-29** — Renamed to Playora immediately rather than later. The pack,
  tagline and all 70 screens say Playora; nothing was published yet, so the cost
  only ever grows.
- **2026-08-29** — The design pack's suggested stack (Node/Express/Socket.io/
  MongoDB) is **not** adopted. The pack labels it "for reference", its README
  names the prompt as the source of truth, and the prompt specifies no stack.
  The master spec mandates Cloudflare + Supabase, which is built and verified.
- **2026-08-29** — Restyle existing screens before building new ones. The pack
  specifies 70 screens, most resting on features that do not exist yet
  (leaderboards, seasons, admin, analytics); building shells first would mean
  rebuilding them.
- **2026-08-29** — Playability derives from the engine registry, never from a
  per-screen flag. A catalog entry and a working game are different things, and
  the UI must not be able to claim otherwise.
- **2026-08-29** — Result persistence is fire-and-forget after the broadcast.
  Players are told the outcome by the realtime layer; Postgres is the record,
  not the source of truth for the match that just ended.
- **2026-08-29** — Bots are seated as normal players carrying `isBot`, never as
  a parallel entity type. One seat model keeps room, turn and result logic
  game-agnostic, and makes "never pretend a bot is human" (§8) a data property
  rather than a UI convention.
- **2026-08-29** — `executeAction` extracted as the single action path. Humans
  hit it after permission checks; bots hit it directly. Neither can reach the
  engine any other way.
- **2026-08-29** — Realtime verification is done against the live Worker plus
  live Supabase, not mocks. Both client bugs above were invisible to the unit
  and integration suites because they live in React effect wiring, not in the
  protocol or engine. Browser verification stays part of "done".
- **2026-08-29** — Same-wifi play will use WebRTC with QR-code signalling, built
  *after* the other five modes. A browser cannot host a LAN server (no listening
  socket, no mDNS), so QR exchange is the only true browser-only answer. It also
  shares no code with the online modes, whereas those compound.
- **2026-08-29** — Play modes derived from the engine and bot registries rather
  than hardcoded per screen, so availability cannot drift between pages.
- **2026-08-29** — Added offline/AI Quick Play ahead of the remaining online
  work. It needs no credentials, so it makes the product demonstrable today and
  exercises ChessEngine through a second, independent caller.
- **2026-08-29** — Offline and AI games are unrated and unsaved (spec section
  13). The UI says so on screen rather than silently discarding results.
- **2026-08-29** — Bots return *actions* run through `engine.executeAction`,
  never direct state mutation (spec section 104.5). The bot tests assert this by
  construction: `executeAction` throws on an illegal action, so a passing test
  proves the move survived full validation.
- **2026-08-29** — Deleted the guest-token system outright rather than keeping
  it behind a flag. Two auth paths, one of them forgeable, is worse than a
  temporary gap.
- **2026-08-29** — Google credentials live only in the Supabase dashboard; the
  app never sees them, so there is no `GOOGLE_CLIENT_SECRET` in this repo.
- **2026-08-29** — `env.ts` degrades to a visible setup notice rather than
  throwing, so an unconfigured checkout still renders instead of white-screening.
- **2026-08-29** — Slice 2 shipped before Slice 1 because it needed no
  credentials, and it is the higher-severity finding. Consequence: the web app
  cannot connect until Slice 1 lands. Accepted deliberately — an insecure
  working state is not worth preserving.
- **2026-08-29** — No dev-only auth bypass, despite the temporary breakage. Tests
  use HS256 with a bound test secret, which is a real Supabase verification path,
  not a backdoor. There is no way to authenticate without a valid signature in
  any environment.
- **2026-08-29** — Product named **Playora** (play + den: a place you go to play
  with people). Chosen for being game-agnostic, matching the "PLAY TOGETHER"
  landing thesis, and near-certainly available as a coined compound.
- **2026-08-29** — Promoted `roomId` / `sessionId` from `ChessConfig` to
  `BaseGameConfig`: every game needs match context from the realtime layer, and
  the duplication only surfaced once `any` was removed from the registry.
- **2026-08-29** — Added `AnyGameEngine` (base-type-constrained) rather than
  `GameEngine<any,...>` so the registry and realtime layer stay generic without
  discarding type safety.
- **2026-08-29** — Preserve the existing monorepo rather than restart. Protocol,
  game-engine, and schema are sound; the gap is trust, not structure.
- **2026-08-29** — Fix foundation (auth + DO persistence) *before* any new game
  or UI work. Justified by §30, §104.1, §104.18.
- **2026-08-29** — Version strategy: single source of truth = root
  `package.json`; Conventional Commits → release-please → auto CHANGELOG + tag.
  Chosen over Changesets because all packages are `private` (never published to
  npm) and version in lockstep as one product, so per-package changeset authoring
  is pure friction. See §10.
- **2026-08-29** — Google OAuth credentials live in the Supabase dashboard, never
  in this app's env. Hence no `GOOGLE_CLIENT_SECRET` in `.env.example`.

---

## 10. Version system (implemented ✅)

**Single source of truth: root `package.json` `version`.**

`scripts/sync-version.mjs` propagates it to every workspace `package.json` and
regenerates `apps/realtime/src/version.ts` and `apps/web/src/lib/version.ts`.
No version string is hand-written anywhere — the previously hardcoded
`version: "0.1.0"` at `apps/realtime/src/index.ts:21` now reads `APP_VERSION`.

```bash
pnpm version:sync    # write
pnpm version:check   # verify, non-zero exit on drift (runs in CI)
```
Also runs automatically via root `prebuild`, so every build reports the true version.

**Automatic release flow** (activates once the GitHub repo exists):

1. Commit using Conventional Commits — `feat:`, `fix:`, `perf:`, `security:`,
   `refactor:`, `docs:`, `test:`, `chore:`. A `feat!:` or `BREAKING CHANGE:`
   footer triggers a major bump.
2. Push to `main` → `.github/workflows/release.yml` runs `release-please`, which
   opens/updates a **"chore(main): release X.Y.Z"** PR accumulating all changes.
3. The `sync-versions` job pushes propagated workspace versions into that PR so
   `version:check` stays green.
4. **Merge the PR** → version bumped, `CHANGELOG.md` written, git tag `vX.Y.Z`
   created, GitHub Release published. Fully automatic from there.

Config: `.github/release-please-config.json`, `.github/.release-please-manifest.json`.
CI gate: `.github/workflows/ci.yml` — version:check → lint → typecheck → test →
build, plus a separate Playwright E2E job.

---

## 11. Environment status

**Live project:** `pvjdziltmjwcchjbukaa` · ap-south-1 (Mumbai) · new-style keys
(`sb_publishable_` / `sb_secret_`) · **asymmetric ES256** JWT signing, so the
Worker verifies via JWKS and no secret is deployed to the edge.

`pnpm env:check` reports 6/6. Anonymous sign-ins ON. Google provider OFF.

⚠️ The Supabase secret key and Google client secret were both pasted into chat
during setup. Fine for local dev; rotate both before any real deployment.

Full walkthrough: **`docs/ENVIRONMENT_SETUP.md`**.

| Service | Needed for | Status |
|---|---|---|
| Supabase | Slice 1+ | ⏳ user provisioning; old project must be rotated/deleted |
| Google OAuth | Slice 1 | ⏳ pending |
| Cloudflare | deployment only | ⏳ not needed for local `wrangler dev` |
| LiveKit / Sentry / PostHog | Phase 14 / deploy / Phase 5 | ⏸️ deferred, placeholders in `.env.example` |

Value destinations (a frequent source of mistakes):
`.env.example` = placeholders, committed · `apps/web/.env.local` = Next.js vars ·
`apps/realtime/.dev.vars` = Worker secrets local · `wrangler secret put` = Worker
secrets production. **The Worker does not read `.env.local`.**

---

## 11b. Spec v2 — the racing architecture conflict

Uneet supplied a v2 master specification. Most of it matches what is built. One
section does not, and it is the important one.

**§44 requires racing to be Unity 6 + C# + WebGL + Photon Fusion 2**, and says
in terms: *"Do NOT use React to render the 3D racing world."* Car Race and Bike
Race are currently Three.js inside React, with the simulation server-authoritative
in the Durable Object.

What cannot be done from a coding session:
- Unity WebGL builds need the Unity Editor (GUI, or a licensed CLI) — not
  installable or runnable here.
- Photon Fusion 2 needs an App ID from Photon's dashboard.

**Recommendation: do not delete the working implementation first.** Scaffold the
Unity project and the React↔Unity bridge *alongside* it, and swap the render and
simulation layer once an actual WebGL build exists. The Three.js version already
proves the whole platform-side loop — lobby, countdown, race, finish, result,
rating, XP, history — which is the part that does not change when Unity takes
over the world. Deleting it would leave the platform with no racing game and no
way to test that loop until Unity is producing builds.

Note also §102: *"DO NOT build both racing games simultaneously. First: CAR
RACE."* Both were built. Bike Race shares the engine and tuning, so it costs
little, but the v2 sequencing is Car Race first, Bike Race only once the
architecture is stable.

**Decided: scaffold Unity alongside, keep the web build running.**

What exists now:
- `unity/car-race/` — Unity 6 project with the C# architecture. `VehicleController`
  is Rigidbody + WheelCollider and assigns no transforms (§47); `RacingAgent`
  drives only through `SetInput`, the same path a player uses (§56);
  `QualityTiers` auto-detects LOW/MEDIUM/HIGH (§100).
- `packages/protocol/src/unity-bridge.ts` — the contract, with Zod schemas and
  10 tests. The C# in `Core/BridgeTypes.cs` mirrors it.
- `apps/web/src/games/racing/unity/` — the loader, lifecycle, session handover
  and the engine switch.

**The switch:** `useRacingRenderer` sends a HEAD request for the Unity loader.
Build present → Unity. Build absent → the existing web build. Dropping a build
into `apps/web/public/unity/car-race/Build/` changes the engine with no code
change and no flag.

**Not compiled.** A Unity WebGL build needs the Editor and a Photon App ID,
neither of which exist in a coding session. `unity/car-race/README.md` lists
exactly what a person with Unity open has to do.

**The rule to hold on to:** §58 forbids trusting position, lap, finish or winner
from a browser. `RaceDirector` reports what it saw and tags it `authority:
"local"` or `"photon"`. `UnityRaceRun.tsx` only records progression from a
`local` report, because an offline career race has nobody to cheat — a rated
online race must be arbitrated before any rating is written.

## 11c. Open bugs reported by Uneet (2026-08-30)

Reported after looking at the running app. Numbered as he sent them.

1. ✅ **"All modes" back button does nothing.** Introduced by the picker dedup:
   `/play` now derives `started` from the URL, so clearing it locally is
   immediately undone by the effect that reads the URL again. The button has to
   navigate to `/games/[slug]` rather than mutate state.
2. ✅ **Every sidebar item looks selected.** `isActive` strips the query string, so
   `/games?sort=recent`, `?sort=new`, `?sort=popular` and `?sort=top` all match
   `/games` and all four highlight at once.
3. ✅ **The chess view is poor.** The Appearance panel now docks beside the
   board on wide screens (it was `absolute right-0 mt-2`, dropping straight over
   it) and is a centred sheet below `lg`. Classic pieces were rendering at 52%
   of a square and now sit at 74%, which is where a real set sits. The Appearance popover covers the board instead of
   sitting beside it, and the board/piece treatment needs work.
4. **Two ports.** ✅ Fixed. `pnpm play`, `build:stable` and `start:stable` are
   gone, along with the `PLAYORA_STABLE` dist branch. One app server, on :8000.
   `PLAYORA_DIST_DIR` still gives an extra server its own build directory when
   one is genuinely needed.
5. (Uneet's list ended here.)

## 11d. Spec v2 gaps, in the order they are worth doing

Nothing below exists yet. Ordered by what unblocks the most.

| Gap | Why it is where it is |
|---|---|
| ~~**Animation tokens (§6)**~~ | ✅ `packages/animation` — durations, springs, easings, Motion variants, 16 tests. Every variant honours reduced motion, and a reduced transition is `duration: 0` rather than a shortened spring (a zero-duration spring still oscillates). |
| ~~**Sentry + PostHog**~~ | ✅ `packages/analytics` — the §80 event list as a closed union, 8 tests. Both SDKs load dynamically and only when a key is set, so a fresh clone ships neither. Autocapture and session recording are off: nothing records what people type or say. |
| ~~**TanStack Query**~~ | ✅ Six hooks migrated — progression, match history, match detail, recent matches, leaderboard, achievements, friends. Keys live in `lib/query/keys.ts` so two files cannot cache the same data under different names. The client is created in a ref, not at module scope: a module-level client is shared across server requests and leaks one visitor's cache into another's page. |
| ~~**Cloudflare Queues**~~ | ✅ `lib/match-queue.ts` + `handlers/match-consumer.ts`. The room enqueues and returns; without a queue binding the identical work runs inline, because Queues need a paid plan and a match must never go unrecorded because billing is not configured. Producer/consumer config is written but commented in `wrangler.toml`. 5 tests. |
| ~~**Admin panel**~~ | 🟨 Dashboard and the report queue with moderation actions are built, on migration `00008`. **Roles deliberately do not live on `profiles`**: migration 00002 lets a user update their own profile row, so a `role` column there would be writable by its own subject and any player could make themselves an administrator. `user_roles` has no client-writable policy at all. Verified by `scripts/verify-admin.mjs`, 16/16 — nearly all negatives. Remaining sections from §78: users, games, rooms, matches, matchmaking, system health, configuration. |
| **LiveKit voice** | Needs a LiveKit project and credentials from Uneet. |
| **Rive** | Needs authored `.riv` files, which are a design deliverable, not code. |
| ~~**GSAP**~~ | ✅ `packages/animation/src/cinematic.ts` — GSAP for the one thing Motion handles badly: a sequence of eight or ten elements timed relative to each other. **Motion stays the default and nothing built with it was replaced.** Loaded on demand (three lazy chunks, nothing in the 106 kB shared bundle), so a player who never reaches a cinematic never downloads it. Applied to the race result. 10 tests, all about the same property: the content ends up visible on every path — reduced motion, load failure, a builder that throws, a timeout, unmount, and a backgrounded tab. |
| ~~**Seasons**~~ | ✅ Migration `00009`. The decision that was blocking it: **a season does not reset `game_ratings`.** Season standings live in their own `season_ratings` rows seeded from a soft reset, so "how good is this player" and "how are they doing now" stay two answerable questions — overwriting the first to express the second destroys the only long-run skill record we hold, and it is not recoverable. `close_season()` is idempotent and revoked from `anon`/`authenticated`. Season One runs to 2026-11-28. Verified by `scripts/verify-seasons.mjs`, 20/20. |

## 12. Next Action

Work is tracked in **`docs/BACKLOG.md`** — one ordered list, worked top-down.
This section records only where that list currently stands.

### Playable right now, no setup needed
`pnpm dev` → `/play?game=chess` (or `uno`, `uno-no-mercy`) → Pass & Play or
Play vs AI. Works offline, no account.

### Landed in the overnight run (backlog 8–18, 22)

**Games and AI**
- **Online UNO verified** through a real room: 7-card deals, opponents reduced
  to counts, illegal plays refused server-side.
- **UnoBot** for UNO and No Mercy, online and offline. The difficulty ladder is
  measured, not guessed — the note in `UnoBot.ts` records that blunder rate is
  the only lever the win rate responds to, and that a one-ply lookahead was
  tried and *lost* games, because UNO rewards tempo over a flexible hand.

**Bugs found by building on top of existing code**
1. `UnoEngine.validateAction` rejected *any* play while a draw penalty stood,
   so No Mercy's headline stacking rule was unreachable by anyone.
2. The 25-card elimination rule was implemented and unit-tested but never
   called from `applyAction`. Four-player No Mercy games ran forever. Found by
   a full-game fuzz; unit tests could not have caught it.
3. **The online room page rendered chess for every game.** An online UNO room
   dealt real cards on the server and drew a chessboard.
4. **`use-recent-matches` could not scale**: it fetched the newest 40 results
   platform-wide and filtered in the browser, so it returns nothing once other
   people play between visits.
5. **`friendships` had RLS enabled and no policies at all** — every read
   returned zero rows and every write was denied. The friends page looked
   "empty" rather than broken, which is how it survived.
6. **`eslint-plugin-react-hooks` was never installed.** Once enabled it found
   exactly one violation, in the hook responsible for all three reconnect bugs.
7. **`reports` had RLS enabled and no policies**, same shape as (5). Found
   while building the admin panel.
8. **No player's rating had ever advanced past their first match.** Both rating
   upserts posted `Prefer: resolution=merge-duplicates` with no `on_conflict`
   target. PostgREST defaults that to the primary key, and `game_ratings` has a
   surrogate `id` that never collides, so every write after the first fell
   through to the composite unique constraint and returned **409**. Nothing
   checked the response, so it was silent: `rating_history` filled with deltas
   the rating row never received. Live data confirmed it — 15 rating rows, max
   `games_played` of 1. Fixed by naming the conflict target and routing both
   upserts through a checked helper that logs failures. Five tests in
   `apps/realtime/test/progression-store.test.ts` pin it.

   The general lesson, worth remembering before the next upsert: **a PostgREST
   upsert against a table whose uniqueness is composite must name
   `on_conflict`,** and a write whose response is discarded is a write that can
   fail for months without anyone noticing.

   It also survived because **every existing check played exactly one match per
   account.** `scripts/verify-progression-accrual.mjs` now plays the same two
   accounts three times, which is the only shape of test that could have caught
   it. The audit that followed found two more unchecked writes: `rating_history`
   (a silent gap in the rating chart) and the XP `PATCH` — the second reported
   XP and level-ups to the result screen whether or not the write landed, so it
   now returns nothing rather than animate a level the player does not have.

**Built**
- Match result screens (rating count-up, XP bar, level-up, streak, unlocked
  achievements), fed by a new `MATCH_PROGRESSION` message — the progression
  store already computed those numbers and threw them away.
- A real rematch handshake (`REMATCH` / `REMATCH_STATE`): one player's click no
  longer restarts anything, and bots do not get a vote.
- `/history` and `/history/[sessionId]`, `/leaderboard` (per game, global and
  friends), `/games/[slug]`, `/achievements`, a working `/friends`.
- `packages/audio`: master/music/SFX/UI/voice buses, 21 procedurally
  synthesised sounds, persistence, settings UI, wired into both games.
- Settings gained working audio and gameplay sections. Every control does
  something — the gameplay toggles are read by the chess board and UNO hand.

**Migrations applied to the live project**
`00005` match-history indexes (GIN on `game_results.scores`), `00006`
`user_achievements`, `00007` friendship RLS policies.

### Racing (backlog 19–20) — all five games are now playable

**Three.js, not Phaser.** Phaser is a 2D engine and the reference Uneet gave is
a 3D chase-camera racer. Phaser is still in `apps/web/package.json` and is
unused; it can go when nothing 2D is planned.

- `packages/game-engine/src/racing/` — a server-authoritative engine at a fixed
  60 Hz. Clients may only send `SET_INPUT`; the engine rejects a `TICK` from any
  player id but the server's, so a client can express intent and nothing else.
- Tracks are generated from a seed and **sent as a seed**, not as geometry. That
  took a snapshot from 17,865 bytes to 1,467 while doubling the broadcast rate:
  87 KB/s per player down to 14.
- `apps/realtime/src/handlers/race-handler.ts` — the server's race clock. Twenty
  wakeups a second carrying three physics ticks each, broadcasting ten
  snapshots a second, stopped whenever the room is not racing.
- `apps/web/src/lib/racing/use-remote-race.ts` — entity interpolation, holding
  the picture ~120 ms behind so ten snapshots a second render as continuous
  motion. No prediction yet; see backlog #37.
- `RacingBot` drives rather than following waypoints: it scores lanes for
  blockage, racing line and coins, brakes for what it can see, and saves nitro
  for a straight. Difficulty is how far ahead it looks, never a speed bonus.

**Presentation pass (after Uneet saw it running)**
- Vehicles are built from parts in `games/racing/vehicles.ts`, not boxes. Every
  wheel has a bright rim, spokes and tread blocks — a smooth dark cylinder
  spinning at speed looks completely still, which is why the first build read as
  a box on rails. The body leans and pitches; the wheels stay on the road.
- `games/racing/effects.ts` — a pooled particle system (nitro flame, crash
  sparks, runoff dust, coin pickup) and camera-parented speed lines.
- **Bloom**, via Three's own `UnrealBloomPass`. On a neon night scene this is
  the single largest visual gain available: without it the rails, headlights and
  coins are brightly coloured polygons rather than light sources.
- Obstacles are recognisable objects — coned base and reflective band, striped
  barrier, chevroned block — because an unlit grey box at ninety metres is an
  unfair game rather than a hard one.
- **An eight-level career ladder per game** (`racing/levels.ts` in the engine,
  so the unlock rules are tested rather than clicked through). Difficulty rises
  on four axes at once: length, rivals, rival skill, and the finishing position
  required. Progress is per-device localStorage; see backlog #40.
- The HUD shows the actual key on each control. Restart displayed an "R" that
  had never been bound to anything.
- A **minimap** built from the same centreline the physics uses, showing the
  track shape, start, finish and every driver, plus a **running order** with
  names and gaps. Map dot colours are drawn from the same list, in the same
  order, as the cars in the 3D scene — a car that is red on the track and blue
  on the map is worse than no map at all.
- `GameRow` can wrap. "Playable now" was a horizontal scroller, so on a wide
  screen Bike Race sat just past the right edge and was effectively invisible.

**Circuits and laps (from the racing UI design pack)**
- The track generator was rewritten to produce **closed circuits**. The old one
  walked curvature forward and hoped: it could not return to its start, so laps
  were impossible and the minimap was a squiggle. The shape is now a closed
  polar curve — a circle with a few low harmonics — which closes by
  construction rather than by correction.
- **Laps, lap timing and a race clock.** Vehicles carry total distance, so laps
  are `floor(distance / lapLength)` and the standings order a field spread
  across different laps by comparing one number.
- The level ladder now raises **lap count** rather than lap length. A single
  long loop is geometrically forced to be gentle — a 5 km circle has an 800 m
  radius and no corner worth the name — so difficulty comes from a tighter
  circuit driven more times.
- HUD rebuilt to the pack: POS/LAP plates, race clock with best lap, running
  order, minimap top-right, current/last lap, bottom-centre dial with gear and
  km/h, nitro and brake. Plus a pause menu — which pauses for real offline, and
  offers only to leave online, where the server's clock does not stop.

**Bugs found while building it**
1. `offRoadDrag` was set equal to `acceleration`, so a car that stopped on the
   runoff had exactly as much drag as thrust and could never move again.
2. The tightest corner had more centrifugal force than the car had steering
   authority — the bend was impossible, not difficult.
3. Sustained curvature spiralled the track into its own path, so the road
   rendered across itself and walls crossed a road nobody could reach.
4. The lateral axis was mirrored relative to the chase camera: steering right
   moved the car left on screen. Invisible in a screenshot, obvious in motion —
   it is now a tested pure function, `trackToWorld`.
5. Two Next dev servers sharing `apps/web/.next` corrupt each other's chunks.
   `PLAYORA_DIST_DIR` now gives any extra server its own build directory.

### What was and was not seen
The browser pane worked this session for the first time, so **the racing games
have been looked at** — grid, road, rails, skyline, HUD and countdown all
render, on both car and bike. What could *not* be observed is motion: the pane
stays hidden, and `requestAnimationFrame` does not fire in a hidden page, so the
simulation never advances on screen. Movement, steering feel and the sense of
speed are verified by 114 engine tests and the live protocol script, not by eye.

Everything else — result screens, history, leaderboard, achievements, friends,
the UNO table, the chess board — is still unseen. Backlog item 1 stands.

### Known limitation
The `game-ui-design` skill at `~/claude-skills/game-ui-design/` is written and
structurally valid but **untested** — all six evaluation agents died on a
session limit before producing anything.

### Blocked on Uneet (backlog 1–4)
- Look at the UI and report what is wrong.
- Rotate the two secrets pasted into chat.
- Rename the GitHub repo `Playden` → `Playora`.
- Verify the Google sign-in round trip (needs a human at the keyboard).

### Working agreement
Uneet commits and pushes; do not commit on his behalf. Conventional Commits on
`feature/*` off `develop`. Gate must stay green:
`pnpm version:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Do not run `pnpm build` while `pnpm dev` is running — both write
`apps/web/.next`. Set `PLAYORA_DIST_DIR` to give a second server its own output.
