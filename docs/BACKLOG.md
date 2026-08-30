# Playora — Backlog

One ordered list. Work happens top-down, one item at a time.
Add items anywhere; renumbering is fine.

**Status key:** ⬜ not started · 🟨 in progress · ✅ done · 🔴 blocked on Uneet

---

| # | Item | Status | Size |
|---|---|---|---|
| 1 | **Look at the current UI and report what's wrong** — home shell, UNO board, sidebar. None of it has been visually confirmed; the browser pane failed all session. | 🔴 | — |
| 2 | **Rotate the two leaked secrets** — Supabase secret key and Google client secret were pasted into chat. | 🔴 | XS |
| 3 | **Rename the GitHub repo** `Playden` → `Playora`. | 🔴 | XS |
| 4 | **Verify Google sign-in end to end** — provider is enabled, flow never walked. Needs your password. | 🔴 | XS |
| 4b | **Branded 404, error boundary and route loader** — Next's built-in 404 rendered outside the stylesheet, so a missing route looked like the whole site had broken. | ✅ | S |
| 4c | **Settings page** — was linked from the sidebar before it existed, which is how a 404 was reachable from the main nav. Theme switcher and reduce-motion are wired; the rest is listed as not-built rather than shown as dead controls. | ✅ | M |
| 4d | **Shared loader** — `Spinner`, `LoadingState`, `Skeleton` in the UI package, screen-reader labelled. | ✅ | S |
| 5 | ✅ **Chess piece set** — replace the current pieces with proper artwork, and add a piece-set switcher (classic / modern / minimal). | ✅ | M |
| 6 | ✅ **Chess board themes** — selectable board colourways (wood, green, blue, dark), persisted per player. | ✅ | S |
| 7 | ✅ **Chess board restyle** — bring the board up to the quality of the rebuilt UNO table: coordinates, last-move highlight, check state, capture tray. | ✅ | M |
| 8 | **Verify online UNO through a real room** — only local pass-and-play has been exercised. | ✅ | S |
| 9 | **UnoBot** — UNO and No Mercy have no AI; the play hub correctly shows "coming soon" until one exists. | ✅ | M |
| 10 | **Match result screens** — Victory / Defeat / Draw with rating change, XP, stats, streak, Play Again (pack 27–29). | ✅ | M |
| 11 | **Rematch flow** — both players accept, new game starts without returning to a menu (spec §47). | ✅ | S |
| 12 | **Match history page + match detail** (pack 30, 33). Data and indexes already exist. | ✅ | M |
| 13 | **Leaderboard** — global / friends, per game, current player always findable (pack 35–36). Regional split out to #34. | ✅ | M |
| 14 | **Audio system** — `packages/audio` with master/music/SFX/UI/voice buses, 21 procedurally synthesised sounds (no licensed assets in the repo), persistence, settings UI, wired into chess, UNO and the result screen. **Music bus exists but there are no music tracks** — see #35. | ✅ | L |
| 15 | **Settings page** — account, appearance, accessibility, audio and gameplay are built and every control does something. Notifications and privacy still wait on the friends system (#18). | ✅ | M |
| 16 | **Game detail page** at `/games/[slug]` — rules, your rating/rank/record, every way to play, recent matches. Hero is typographic; there is still no game artwork (#24). | ✅ | S |
| 17 | **Achievements** — 25 achievements as pure rules in `@playora/progression`, awarded server-side after a match, `/achievements` page with locked/unlocked/points, and unlock moments on the result screen. | ✅ | M |
| 18 | **Friends** — add by username, incoming/outgoing requests, accept/decline/remove, all enforced by RLS. **`friendships` had RLS enabled and no policies at all**, so every read returned nothing and every write was denied; fixed in migration 00007. Presence and notifications split out to #36. | ✅ | M |
| 19 | **Car Race** — Phaser, server tick loop, snapshots, client prediction, reconciliation. Larger than the three existing games combined. | ⬜ | XL |
| 20 | **Bike Race** — reuses Car Race's netcode and scene work; mostly physics and art. | ⬜ | M |
| 21 | **Light theme pass** — tokens exist but the light palette has never been looked at. | ⬜ | S |
| 22 | **ESLint rule for React effect deps** — `eslint-plugin-react-hooks` was never installed; `rules-of-hooks` and `exhaustive-deps` are now errors for `apps/web` and `packages/ui`. It found exactly one violation, in the hook that caused all three reconnect bugs, and fixing it properly meant reading the session from the store instead of closing over it. | ✅ | S |
| 23 | **Chess clock enforcement** — currently display-only; flag-fall must be decided server-side via alarms. | ⬜ | M |
| 24 | **Real game artwork** — tiles are placeholder gradients and emoji. | ⬜ | M |
| 25 | **End-to-end auth handshake test** — browser → Worker, currently only covered by unit and integration tests separately. | ⬜ | S |
| 26 | **Deploy** — Cloudflare Worker + web hosting, `wrangler secret put`, production Supabase redirect URLs. | ⬜ | M |
| 27 | **Sentry + PostHog** wiring (spec §24, §77). | ⬜ | S |
| 28 | **Finish the `game-ui-design` skill** — written and structurally valid, but all six evaluation agents died on a session limit, so it is untested. | ⬜ | M |
| 29 | **Same-wifi play via QR** — WebRTC with QR signalling. Deferred by decision D4 to be built last. | ⬜ | L |
| 30 | **Seasons / ranked** (spec §15). | ⬜ | L |
| 31 | **Voice via LiveKit** (spec §26). | ⬜ | L |
| 32 | **Admin panel** — dashboard, users, rooms, matches, reports, moderation (pack 43–49). | ⬜ | XL |
| 33 | **Remove deprecated `profiles.rating`** once nothing reads it. | ⬜ | XS |
| 36 | **Presence and notifications** — a friend's online/in-game status, and an alert when a request or invite arrives. Needs a presence channel; nothing tracks it today, and the friends page says so rather than showing everyone as offline. | ⬜ | M |
| 35 | **Background music** — the music bus is built and mixed but plays nothing. Needs licensed or commissioned loops per game; procedural synthesis is fine for a 40ms card flip and not fine for two minutes of menu music. | ⬜ | M |
| 34 | **Regional leaderboard** — needs a region on `profiles`, which nothing collects today. Add the field (signup or settings, opt-in), backfill nothing, then add the scope. Split out of #13 rather than faked. | ⬜ | S |

---

## Done so far

Chess, UNO and UNO No Mercy playable · Supabase auth (guest verified end to end) ·
rooms persisted · results persisted · per-game Elo, XP, levels, rank tiers ·
Quick Match matchmaking · server-side AI for chess, UNO and No Mercy ·
mobile bottom nav · design tokens + Playora rebrand · hover-expanding sidebar ·
match result screens with rating/XP · rematch handshake · match history ·
per-game leaderboards · game detail pages · achievements · friends ·
procedural audio system · 254 tests, full gate green.
