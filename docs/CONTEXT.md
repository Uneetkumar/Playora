# Project Context — Session Handoff

**Purpose.** Paste-able state of this project so a new chat/tab can resume with
zero loss of context. Read this file first, then `docs/ARCHITECTURE.md`.

**Maintenance rule:** update the *Status Ledger*, *Decision Log*, and *Next Action*
sections at the end of every milestone. Everything else changes rarely.

**Last updated:** 2026-08-29 · **Version:** 0.1.0 · **Phase:** 0 complete → Phase 1

---

## 1. How to resume in a new tab

Paste this into the new session:

> Read `docs/CONTEXT.md`, `docs/ENVIRONMENT_SETUP.md`, and `docs/ARCHITECTURE.md`
> in this repo, then continue from the "Next Action" section of CONTEXT.md.
> Follow the master spec's non-negotiable engineering rules (§104).

---

## 2. What this project is

A production-quality browser-based multiplayer gaming platform — **one platform,
many games**, not five game sites. Platform owns identity, social, matchmaking,
rooms, progression, history, moderation. Games own only rules, state, actions,
AI, rendering, audio events.

Games, in build order: **Chess → UNO → UNO No Mercy → Car Race → Bike Race.**

Governed by a two-part master specification supplied by the user (108 sections).
Key non-negotiables: server is authoritative; never trust client game state; game
rules never in React; high-frequency state never in Postgres; bots never bypass
`GameEngine` validation; strict TypeScript, no `any`.

**Name: Playden.** Package scope is `@playden/*`; the Cloudflare Worker is
`playden-realtime`. Rename from `@game-platform/*` was completed in Slice 0
across 51 files before the first commit.

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

## 5. Verification baseline (measured 2026-08-29)

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ 14/14 |
| `pnpm test` | ✅ 20 tests, 4 files |
| `pnpm build` | ✅ 9 routes |
| `pnpm version:check` | ✅ in sync at 0.1.0 |
| `pnpm lint` | ✅ clean |
| `pnpm test:e2e` | ✅ 2/2 (Playwright, chromium) |

Reproduce with: `pnpm install && pnpm version:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

---

## 6. Critical findings — READ BEFORE WRITING CODE

Phases 0–3 are ~70% complete *in shape*, but the foundation is **not trustworthy**.
Three defects are load-bearing; do not build features on top of them.

### 🔴 F1 — Identity is forgeable end-to-end
`apps/realtime/src/durable-objects/RoomDurableObject.ts:55` reads identity
straight from the URL query string:
```ts
const userId = url.searchParams.get("userId") || `guest_${connectionId.slice(0,6)}`;
```
Any client can be any user: impersonate the host, start games, play the
opponent's turn, resign for them. The protocol defines an `AUTH` message; the DO
never handles it. Violates spec §63, §83, §104.1.

Underneath: `packages/auth/src/session.ts` `verifyGuestToken()` only *string-parses*
`guest_token_{id}_{ts}` — no signature, no secret. And
`apps/web/src/app/login/page.tsx:46` — the "Sign in with Google" button calls
`signInAsGuest({ preferredUsername: "Google_Player" })`. **There is no Supabase
Auth and no OAuth anywhere in the repo.**

### 🔴 F2 — The Durable Object persists nothing
Zero uses of `state.storage`, `blockConcurrencyWhile`, `setAlarm`, or the
WebSocket Hibernation API. All room + game state lives in instance fields. DO
eviction is routine on idle and silently destroys the room and any in-progress
match. The 60s reconnect grace is a `setTimeout` that also dies on eviction.
This defeats §61 rather than implementing it.

### 🔴 F3 — Supabase is dead code
`@playden/database` has zero importers in either app; there are **no API
routes at all**. Consequence: no profiles, no `game_sessions`, no results, no
history, no rating, no XP. `GAME_FINISHED` broadcasts to sockets and vanishes.
Rooms are client-side fiction — `apps/web/src/app/rooms/page.tsx:70` generates a
code and navigates; the room list is a hardcoded empty array. Join-by-code works
only incidentally because the worker does `idFromName(roomCode)`; no privacy or
capacity enforcement.

### 🟠 Secondary
- No chat/reaction rate limiting (§24, §83)
- `maxPlayers: 2` hardcoded — `RoomDurableObject.ts:645` (§27 violation)
- Stale host role: `conn.meta.role` snapshotted at connect, so after host transfer
  the old host still passes the `START_GAME` check (`RoomDurableObject.ts:285`)

### ✅ Resolved this session
- **Slice 0 complete.** Scope renamed to `@playden/*`; git repo initialised with
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
| **1 — Real identity** (§12) | Supabase Auth: Google OAuth + `signInAnonymously()` guests; delete forgeable token; verify JWTs via JWKS + `jose`; `@supabase/ssr` middleware; `/auth/callback`; profile bootstrap trigger; guest→Google linking preserving history | **Supabase credentials** |
| **2 — Trusted realtime** (§63, §61) | `AUTH` as mandatory first message, identity from verified claims only; WebSocket Hibernation API; persist to `state.storage` + `blockConcurrencyWhile` restore; `setAlarm()` grace period; token-bucket rate limiting; re-read host role at check time. Tested with `@cloudflare/vitest-pool-workers` | nothing (JWT verify testable with locally-signed tokens) |
| **3 — Rooms + persistence** (§6, §69) | Real room create/list/join with privacy + capacity enforcement; DO writes `game_sessions` / `game_results` to Supabase via Worker secret | Slices 1–2 |
| **4 — Close the §92 loop** | Result screen, Elo rating, XP, history, stats, Play Again; multiplayer simulation harness (2/4/8 clients, concurrent rooms) per §86 | Slice 3 |

Then §93 Quick Play → §94 AI → §8 social → UNO → racing → voice.

---

## 8. Open decisions

| # | Decision | Status |
|---|---|---|
| D1 | ~~Repo / product name~~ | ✅ **Playden** (2026-08-29) |
| D2 | Supabase JWT signing: asymmetric (ES256/RS256 via JWKS, preferred) vs legacy HS256 shared secret | ⏳ depends on what the dashboard offers |
| D3 | Cloudflare plan — Durable Objects may require Workers Paid (~$5/mo); verify current terms | ⏳ not blocking local dev |

---

## 9. Decision log

- **2026-08-29** — Product named **Playden** (play + den: a place you go to play
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

## 12. Next Action

**Slice 0 is complete.** Two tracks now run in parallel:

### Track A — Slice 2: Trusted realtime  ← *start here, no credentials needed*
The highest-severity finding (F1) with no external dependency. In
`apps/realtime/src/durable-objects/RoomDurableObject.ts`:

1. Handle the `AUTH` message; refuse every other message until a valid JWT
   arrives. Identity from verified claims only — delete the `userId` query-param
   read at line ~55.
2. Migrate to the WebSocket Hibernation API (`state.acceptWebSocket` +
   `serializeAttachment`) so connections survive eviction.
3. Persist room + game state to `state.storage`; restore in the constructor via
   `blockConcurrencyWhile`.
4. Replace the `setTimeout` disconnect grace with `state.setAlarm()`.
5. Token-bucket rate limiting on `CHAT_SEND` / `REACTION_SEND`.
6. Re-read host role from `this.players` at check time (fixes the stale-role bug).
7. Remove the hardcoded `maxPlayers: 2`.

Test with `@cloudflare/vitest-pool-workers`: impersonation rejected, state
survives eviction, reconnect resyncs correctly.

### Track B — Slice 1: Real identity  ← *blocked on user*
Needs Supabase provisioned. See `docs/ENVIRONMENT_SETUP.md`:
- [ ] Step 0 — rotate/recreate the leaked Supabase project
- [ ] Steps 1–2 — anonymous sign-ins enabled, Google provider configured
- [ ] Step 3 — `apps/web/.env.local` + `apps/realtime/.dev.vars` filled

### Working agreement
Commit with Conventional Commits on `feature/*` branches off `develop`
(§90). The full gate must stay green: `pnpm version:check && pnpm lint &&
pnpm typecheck && pnpm test && pnpm build`.
