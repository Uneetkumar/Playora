# Playora — Migration Plan

Phased upgrade from the audit in [PLAYORA_ARCHITECTURE.md](PLAYORA_ARCHITECTURE.md).
The site stays functional at every step; no phase requires a big-bang cutover.

**Status key:** ⬜ not started · 🟨 in progress · ✅ done · 🔴 blocked

---

## Ordering principle

Phases are ordered by *leverage*, not by the brief's numbering. The runtime and
the SDK come first because every later phase — mobile, performance, analytics,
anti-cheat — is cheaper once games share one loop and one platform API. Adding
the 16th game should be much easier than building the first; that is the test.

| # | Phase | Fixes | Status |
|---|---|---|---|
| 1 | Audit | — | ✅ |
| 2 | Game runtime: fixed-timestep loop + input abstraction | F1, F3 | ✅ |
| 3 | `@playora/game-sdk` | F2 | ⬜ |
| 4 | Migrate arcade games onto the runtime | F1, F3 | ✅ 9 of 10 |
| 5 | Catalog into the database | F4 | ⬜ |
| 6 | SEO: metadata, sitemap, OG, structured data | F5 | ✅ |
| 7 | Favourites, recently played, progress | F6 | 🟨 code done, migration unapplied |
| 8 | Fullscreen, orientation, safe areas | F7 | ⬜ |
| 9 | Adaptive quality tiers | F9 | ⬜ |
| 10 | Asset pipeline to storage/CDN | F9 | ⬜ |
| 11 | Admin game management on the DB catalog | F4 | ⬜ |
| 12 | PWA shell | F9 | ⬜ |
| 13 | Performance budget + measurement on real devices | — | ⬜ |
| 14 | Cross-browser / device testing | — | ⬜ |

Dependency cleanup (F8) is folded into Phase 2, where the Phaser decision
actually gets made rather than deferred.

---

## Phase 2 — Game runtime ✅

The keystone. Eleven arcade games currently each own a `setInterval` and drive
gameplay through `useState`.

**Delivered** as `@playora/game-runtime` (21 tests):

- `GameLoop` — accumulator, fixed `dt`, capped catch-up, rAF presentation,
  pause that does not replay the pause, and an injectable clock.
- `InputManager` — keyboard, pointer (mouse/touch/pen through one path) and
  gamepad mapped onto named actions, with edge-triggered `justPressed`
  consumed once per step and a blur handler that releases everything.
- `useGameRuntime` in the web app — simulation in a ref, one snapshot published
  per frame, and a `mutate()` for event handlers. Writing to the published
  snapshot is a silent no-op, so `mutate` exists specifically to make that
  mistake impossible to make quietly.

**Proving it, given the environment.** The Browser pane fires zero `rAF`
callbacks and reports `document.hidden` permanently, so an rAF-driven loop
cannot be verified by looking at it here. That is why the loop takes an
injectable clock and why the first migrated game's simulation was extracted to
`target-rush.ts`: both are verified deterministically instead. The test that
matters most runs the same five seconds at 33 ms and 7 ms frames and asserts
the clocks agree within 50 ms — the property `setInterval` could never offer.

**Phaser (F8) — decided.** Removed. The rationale: The brief prefers Phaser for 2D. The arcade games here are
DOM/SVG scenes with a handful of entities, and racing already uses Three.js.
Pulling in a 34 MB engine to render eight moving elements would be the
"unnecessary heavy technology" §5 and §63 both warn against. The dependency is gone and DOM/Canvas stays behind the runtime's
renderer boundary. The boundary is what matters — a game that outgrows DOM can adopt
Canvas or Phaser without the platform noticing. Revisit when a game genuinely
needs sprite batching.

---

## Phase 3 — `@playora/game-sdk`

One versioned surface for games:

```text
playora.game.{start,pause,resume,over}
playora.scores.submit          playora.leaderboard.get
playora.progress.{save,load}   playora.achievements.unlock
playora.analytics.track        playora.user.getCurrentUser
playora.platform.{requestFullscreen,exitFullscreen}
```

Every method binds to a system that already exists — progression, PostHog,
Supabase, the achievement rules. Nothing is stubbed: where a backend is absent
the method will not exist rather than silently resolve, per §67.

---

## Phase 5 — Catalog into the database

`catalog.ts` becomes a seed, not a source. Adds `categories`, `tags`,
`game_tags`; the `games` table gains the display fields the UI needs. The admin
panel then edits real rows, and search/filter/sort query the database instead of
a literal.

---

## Phases blocked on you

| Item | Needs |
|---|---|
| Asset CDN (Phase 10) | A storage bucket + CDN decision; Supabase Storage is the low-friction default |
| Real device performance (Phase 13) | A low-end Android and an iPhone to measure on; the Browser pane is `document.hidden` and cannot measure FPS |
| Cross-browser (Phase 14) | Safari and Firefox are not available in this environment |

These have the architecture built around them and a documented integration
point, per §66 — they are not faked.


---

## Phase 4 — Arcade migration (1 of 11)

**Target Rush** is migrated and is the reference for the rest.

What the migration changed beyond the loop:

- Two competing `setInterval`s (a 1s countdown and a difficulty-scaled spawner)
  became one 60 Hz simulation. They previously drifted apart and were throttled
  by different amounts in a background tab, so no two runs were the same length.
- The countdown no longer needs the "decide from a ref" workaround that existed
  because `setTimeLeft(fn)` queues the updater — the comment and the bug are
  both gone.
- **Targets now expire.** They used to persist until clicked, so the board
  saturated at six standing targets and the "rush" became a stationary click
  test you could walk away from. A 2.6 s lifetime is what makes the spawn rate
  mean anything, and a timed-out bullseye breaks the chain.
- `onClick` became `onPointerDown`: a tap only produces `click` after the
  browser rules out a double-tap, which in a timed game reads as the game
  ignoring you.

### All nine migrated

Every arcade game with a clock now runs on the fixed-timestep runtime, with its
simulation extracted to a pure module and tested against a controlled clock.
**Pin Puzzle is deliberately not migrated**: it is turn-based and owns no timer
at all, so giving it a game loop would be exactly the unnecessary machinery §63
warns against. Its logic was already extracted and tested in an earlier pass.

`grep` for `setInterval(` across the arcade views now returns nothing. Ant
Attack keeps `requestAnimationFrame` because it draws to a canvas, which is
what rAF is for.

**Bugs the extraction surfaced, none of which were the loop itself:**

| Game | Found |
|---|---|
| Target Rush | Targets never expired, so the board saturated at six standing targets and the "rush" became a stationary click test |
| Colour Rush | Spawn hardcoded at 1100 ms and fall speed constant — the wave badge advertised an escalation the game never performed |
| Bomb Pass | Fuse reset to a hardcoded 7.0 every round; bots rolled a flat 35% pass chance blind to how much fuse was left |
| Ice Breaker | Bot comment said "nudge towards center or player"; the code was a pure random walk, so bots fell off by accident rather than playing |
| Falling Floor | Collapse delay a flat 800 ms, so the floor never got harder; per-tile `setTimeout` could outlive a restart |
| Rope Rescue | `level` was cosmetic — a button incremented it, `restart()` never reset it, nothing read it |
| Ant Attack | Spawn hardcoded at 550 ms; the whiff timer was only cancelled by *another whiff*, so killing a bug right after a near-miss did not save the streak |
| Hot Potato | Three overlapping mechanisms (interval, ref mirror, per-bot `setTimeout`) around a state-updater bug |
| Bridge Builder | Truck moved 3 units per 40 ms tick, so a throttled tab took a different amount of real time to cross |

Each is fixed in its module and covered by tests: 116 new tests across the nine
simulations, plus the 21 in `@playora/game-runtime`.


---

## Phase 6 — SEO ✅

The cheapest large win in the plan, and the one the audit found completely
absent: zero `generateMetadata`, no sitemap, no `robots.txt`, no Open Graph, no
canonicals, no structured data. Every game page was invisible to search and
shared as a bare link with no title or image — on a platform whose distribution
model is people finding and sharing games.

**Delivered** (20 tests in `lib/__tests__/seo.test.ts`):

- `lib/seo.ts` — one place for titles, descriptions, canonicals, OG/Twitter
  cards and JSON-LD, all derived from the same catalog the UI renders, so a
  game cannot be on the site and missing from the sitemap.
- `/games/[slug]` split into a server shell plus `game-detail-client.tsx`. A
  client component cannot export `generateMetadata`, which is why none of this
  existed. The page is now **SSG** via `generateStaticParams`, so a crawler
  sees the metadata without running any JavaScript.
- `sitemap.ts` (19 URLs) and `robots.ts`.
- Structured data: `VideoGame` with `gamePlatform`, `playMode`,
  `numberOfPlayers` and an explicit free `Offer`; `BreadcrumbList` so a result
  reads `Playora › Games › Chess`; site-level `WebSite` with a `SearchAction`.
- Route layouts giving every public page a real title, and `noindex` on the
  nine per-person routes — `robots.txt` stops them being crawled, but a URL
  someone shares can still be indexed without its content, so both.

**Two things it forced into the open.**

The root description read *"Scalable realtime multiplayer gaming platform
powered by Next.js, Cloudflare Durable Objects, and Supabase"* — a description
written for engineers, shown to someone searching for a game to play. It now
says what you can play and that it is free with no download.

The build failed the first time with *"Attempted to call artFor() from the
server"*: cover art lives in a `"use client"` module because it exports React
components, so the server could not read the image paths. Those paths are data,
not client code — they moved to `game-images.ts`, imported by both sides.

**Verified against the served HTML**, not just the build: `/games/chess`
returns its own `<title>`, description, canonical, `og:image` at 1200×630,
`twitter:card`, and nine JSON-LD nodes. `/settings`, `/profile` and `/history`
return `noindex, nofollow, nocache`.

**Needs you:** `NEXT_PUBLIC_APP_URL` must be set in production. Every canonical
and OG image is absolute and currently resolves to `localhost:8000`, which is
correct for development and wrong the moment it deploys.


---

## Phase 7 — Favourites and recently played 🟨

Code complete; **the migration has not been applied** — see below.

**Schema** (`00010_favorites_and_recent.sql`): `favorites`, `recently_played`
and `game_progress`, all keyed `(user_id, game_slug)` rather than arrays on
`profiles` — an array is one row every write contends on, cannot be indexed,
and grows without bound on the hottest row in the database. All three are
private to their owner, unlike achievements, which are public so they can
appear on a profile.

`record_play()` is one statement rather than read-add-one-write, which loses
plays when two tabs start a game at once. It is `SECURITY INVOKER`, so it runs
behind the same RLS policies as a direct write.

`play_count` is client-writable and documented as untrustworthy: nothing that
awards anything may read it. Rating, achievements and progression all count
from `game_results`, which only the Worker can write.

**Working now, with no database:** recently-played for signed-out visitors,
backed by localStorage in the same shape as the table (12 tests). Most visitors
to a casual games site never make an account, and "sign in to see what you
played" is a worse answer than remembering it locally. The **Jump back in**
shelf renders from either source, and renders nothing on a first visit rather
than an empty shelf with a heading.

**Favourites deliberately have no signed-out fallback.** A favourite is a claim
about a library you own; remembering one locally and losing it on the next
device is worse than saying it needs an account. The control is hidden — not
disabled-looking-clickable — whenever it cannot work.

### What this phase found: two tables with RLS and no policies

A test that reads the migrations as text and asserts every RLS-enabled table
has a policy immediately flagged **`game_sessions` and `game_invites`**. Both
have had `ENABLE ROW LEVEL SECURITY` since migration 00001 and no policies at
all, which denies every read to every client — silently, because an empty
result reads as "no data yet" rather than "permission denied".

This is the same bug migration 00007 fixed on `friendships`, still live on two
more tables since the first migration.

Observed impact: the admin dashboard counts sessions with
`supabase.from("game_sessions").select("id", { count: "exact", head: true })`,
so that number has always been zero for every viewer including admins.
`game_invites` has no browser reader yet, so its damage was latent. The Worker
was unaffected throughout — it holds the service-role key, which bypasses RLS,
which is also why every write path kept working and nothing failed loudly.

Fixed in `00011_session_and_invite_policies.sql`.

### Blocked on you

**Applying migrations 00010 and 00011.** The Supabase MCP tools are not
permitted in this session — both `apply_migration` and even read-only
`list_tables` were denied. The SQL is written and reviewed; it needs someone
with database access to run it. Until then the app degrades honestly rather
than pretending: the hooks detect Postgres error `42P01` (relation does not
exist), fall back to local storage, and hide the favourite control.

Note that the tests around these migrations verify *structure*, not validity —
they cannot execute SQL. That gap is real and it bit during this phase: the
first draft of 00011 referenced `inviter_id`/`invitee_id` when the columns are
`sender_id`/`recipient_id`, and the policy-presence test passed anyway. A
second test now checks that policy predicates only name columns the table
actually has, and it was verified by mutation — reintroducing the wrong column
name fails it.
