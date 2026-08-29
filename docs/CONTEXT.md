# Project Context — Session Handoff

**Purpose.** Paste-able state of this project so a new chat/tab can resume with
zero loss of context. Read this file first, then `docs/ARCHITECTURE.md`.

**Maintenance rule:** update the *Status Ledger*, *Decision Log*, and *Next Action*
sections at the end of every milestone. Everything else changes rarely.

**Last updated:** 2026-08-29 · **Version:** 0.1.0 · **Phase:** Slice 3 in progress

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
| `pnpm test` | ✅ **73 tests**, 10 files (auth 20, realtime 19, game-types 18, engine 11, protocol 3, db 2) |
| `pnpm build` | ✅ 9 routes |
| `pnpm version:check` | ✅ in sync at 0.1.0 |
| `pnpm lint` | ✅ clean |
| `pnpm test:e2e` | ✅ 2/2 (Playwright, chromium) |

Reproduce with: `pnpm install && pnpm version:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

---

## 6. Critical findings — READ BEFORE WRITING CODE

Phases 0–3 are ~70% complete *in shape*, but the foundation is **not trustworthy**.
Three defects are load-bearing; do not build features on top of them.

### ✅ F1 — Identity is forgeable end-to-end — **FIXED (Slice 2)**
The Durable Object no longer reads `userId` from the query string at all. A
socket carries no identity until an `AUTH` message is verified against Supabase's
signing keys (`SupabaseTokenVerifier` in `@playden/auth`, JWKS-first with legacy
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

### 🟡 F3 — Supabase is dead code — **PARTIALLY FIXED (Slice 1)**
Auth is now wired end to end in code: `@supabase/ssr` browser + server clients,
session-refresh middleware, `/auth/callback` OAuth exchange, Zod-validated public
env, and an auth store backed by real Supabase sessions. The forgeable guest
token system is **deleted** — `guest.ts` and `client.ts` are gone, and guests now
get a genuine Supabase anonymous session.

`supabase/migrations/00002_auth_profile_bootstrap.sql` ties `profiles.id` to
`auth.users(id)`, creates a profile on signup (guests included), and handles the
guest→Google upgrade by refreshing display fields while keeping the same user id
— so ratings, history and achievements survive the link (spec §12).

**Not verified.** No Supabase project exists yet, so neither sign-in path has
been exercised against a live server. It compiles, lints, typechecks and builds;
that is not the same as working. Rooms/results persistence is still Slice 3.

### 🟠 Secondary

### ✅ Resolved this session
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
| 🟡 1 — Real identity | Code complete; **awaiting credentials to verify** end to end | Supabase project |
| ~~2 — Trusted realtime~~ | ✅ **DONE** — AUTH gate, hibernation, storage, alarms, rate limiting, 19 integration tests | — |
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

### Immediate — verify Slice 1 (blocked on credentials)
All the code is in place. Once `docs/ENVIRONMENT_SETUP.md` steps 0–3 are done:

1. `pnpm dev`, open `/login` — the amber "not configured" notice should be gone.
2. **Play as guest** → a Supabase anonymous session; check `profiles` has a row
   with `is_guest = true`.
3. **Continue with Google** → `/auth/callback` → signed in; `profiles` row created.
4. Open a room in two browsers → both should reach `CONNECTED` (this is the real
   proof that Slice 1 and Slice 2 meet correctly).
5. Link Google from a guest account → same `profiles.id`, `is_guest` flips false.

Anything failing here is a Slice 1 bug, not a Slice 3 dependency.

### In progress — Slice 3: rooms + persistence

Done:
- `packages/game-types/src/room-code.ts` — codes drawn from an alphabet with no
  O/0/I/1/L, normalisation for lowercase and separators, 18 tests.
- `apps/web/src/app/api/rooms/route.ts` — `GET` lists public waiting rooms,
  `POST` creates one. Host comes from the session; a `hostId` in the body is
  ignored. Code generated server-side with retry on unique violation.
- `apps/web/src/app/api/rooms/[code]/route.ts` — resolves a code with capacity
  and lifecycle checks *before* a socket opens, so players get a clear message
  instead of a connect-then-close.
- `supabase/migrations/00003_room_access_policies.sql` — the missing INSERT/
  UPDATE/DELETE policies. `game_sessions`/`game_results` stay client-unwritable;
  the Worker writes them with the service-role key.

Remaining:
- Wire `apps/web/src/app/rooms/page.tsx` to the API — it still invents a code
  client-side and renders a hardcoded empty room list.
- Durable Object → Supabase write on `GAME_FINISHED` (hook point is
  `finishGame()` in `handlers/game-handler.ts`). Needs rooms to exist in
  Postgres first, which is why the registry came first.
- Reconcile the DO's room id with the Postgres room UUID.

### Carried-forward limitations
- No integration test covers the browser→Worker auth handshake end to end;
  add one once credentials exist.

### Working agreement
Uneet commits and pushes; do not commit on his behalf. Conventional Commits on
`feature/*` off `develop`. Gate must stay green:
`pnpm version:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
