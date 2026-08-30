#!/usr/bin/env node
/**
 * Seasons: standings, isolation from all-time rating, and closing.
 *
 * The two things that must hold: a player cannot write their own standing, and
 * closing a season cannot rewrite one that has already closed. Everything a
 * season promises a player -- "you finished 4th" -- is worthless if either
 * fails.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const devVars = {};
for (const l of readFileSync("apps/realtime/.dev.vars", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) devVars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = devVars.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };

const asUser = (token, extra = {}) => ({
  apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra,
});
const svc = (extra = {}) => ({
  apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...extra,
});
const rest = (path, init) => fetch(`${BASE}/rest/v1/${path}`, init);

async function guest() {
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
  });
  const b = await r.json();
  if (!b.access_token) throw new Error(`signup failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}

async function main() {
  console.log("\n\x1b[1mSeasons\x1b[0m\n");

  const [player, rival] = await Promise.all([guest(), guest()]);
  const gameRes = await rest("games?select=id,slug&limit=1", { headers: svc() });
  const game = (await gameRes.json())[0];
  if (!game) throw new Error("no games seeded");

  // --- the active season ----------------------------------------------------
  const now = new Date().toISOString();
  const activeRes = await rest(
    `seasons?select=id,slug,starts_at,ends_at,closed_at&starts_at=lte.${now}&ends_at=gt.${now}`,
    { headers: { apikey: ANON } },
  );
  const active = (await activeRes.json())[0];
  active
    ? ok(`there is exactly one active season (${active.slug}), readable without signing in`)
    : bad("no active season — every season read would look like a bug");

  const allSeasons = await (await rest("seasons?select=id,starts_at,ends_at", { headers: svc() })).json();
  const overlapping = allSeasons.filter((a) =>
    allSeasons.some((b) => a.id !== b.id && a.starts_at < b.ends_at && b.starts_at < a.ends_at));
  overlapping.length === 0
    ? ok("no two seasons overlap")
    : bad(`${overlapping.length} seasons overlap — "the current season" is ambiguous`);

  // The exclusion constraint, not a convention someone has to remember.
  const overlap = await rest("seasons", {
    method: "POST", headers: svc(),
    body: JSON.stringify({
      slug: `overlap-probe-${Date.now()}`, name: "Overlap probe",
      starts_at: active.starts_at, ends_at: active.ends_at,
    }),
  });
  overlap.ok
    ? bad("the database accepted an overlapping season")
    : ok(`the database refuses an overlapping season (HTTP ${overlap.status})`);

  const backwards = await rest("seasons", {
    method: "POST", headers: svc(),
    body: JSON.stringify({
      slug: `backwards-probe-${Date.now()}`, name: "Backwards probe",
      starts_at: "2030-01-10T00:00:00Z", ends_at: "2030-01-01T00:00:00Z",
    }),
  });
  backwards.ok
    ? bad("a season may end before it starts")
    : ok(`a season cannot end before it starts (HTTP ${backwards.status})`);

  // --- nobody writes their own standing -------------------------------------
  const selfStanding = await rest("season_ratings", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({ season_id: active.id, user_id: player.id, game_id: game.id, rating: 9999 }),
  });
  selfStanding.ok
    ? bad("a player wrote their own season standing")
    : ok(`a player cannot write their own season standing (HTTP ${selfStanding.status})`);

  const selfPlacement = await rest("season_placements", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({
      season_id: active.id, user_id: player.id, game_id: game.id,
      rank: 1, total_ranked: 1, rating: 9999, games_played: 10, wins: 10, losses: 0, draws: 0,
    }),
  });
  selfPlacement.ok
    ? bad("a player declared themselves champion")
    : ok(`a player cannot write their own placement (HTTP ${selfPlacement.status})`);

  const inventSeason = await rest("seasons", {
    method: "POST", headers: asUser(player.token),
    body: JSON.stringify({
      slug: `player-season-${Date.now()}`, name: "Mine",
      starts_at: "2031-01-01T00:00:00Z", ends_at: "2031-02-01T00:00:00Z",
    }),
  });
  inventSeason.ok
    ? bad("a player created a season")
    : ok(`a player cannot create a season (HTTP ${inventSeason.status})`);

  // --- the server can, and the upsert actually merges ------------------------
  const write = async (userId, rating, games) =>
    rest("season_ratings?on_conflict=season_id,user_id,game_id", {
      method: "POST",
      headers: svc({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({
        season_id: active.id, user_id: userId, game_id: game.id,
        rating, peak_rating: rating, games_played: games,
        wins: games, losses: 0, draws: 0,
      }),
    });

  const first = await write(player.id, 1400, 10);
  first.ok ? ok("the server can write a season standing") : bad(`server write failed: ${await first.text()}`);

  const second = await write(player.id, 1500, 11);
  const merged = second.ok ? (await second.json())[0] : null;
  merged && merged.rating === 1500
    ? ok("a second result updates the same row rather than creating a duplicate")
    : bad(`upsert did not merge (HTTP ${second.status}) — season standings would duplicate per match`);

  const dupes = await (await rest(
    `season_ratings?season_id=eq.${active.id}&user_id=eq.${player.id}&game_id=eq.${game.id}&select=id`,
    { headers: svc() },
  )).json();
  dupes.length === 1
    ? ok("exactly one standing row per player per game per season")
    : bad(`${dupes.length} standing rows for one player`);

  await write(rival.id, 1600, 12);

  // --- standings are public --------------------------------------------------
  const publicBoard = await (await rest(
    `season_ratings?season_id=eq.${active.id}&game_id=eq.${game.id}&select=user_id,rating&order=rating.desc`,
    { headers: { apikey: ANON } },
  )).json();
  publicBoard.length >= 2 && publicBoard[0].rating >= publicBoard[1].rating
    ? ok("the season board is readable signed-out and ordered by rating")
    : bad("the season board did not read back in rating order");

  // --- closing ---------------------------------------------------------------
  const closeActive = await fetch(`${BASE}/rest/v1/rpc/close_season`, {
    method: "POST", headers: svc(), body: JSON.stringify({ p_season_id: active.id }),
  });
  closeActive.ok
    ? bad("a running season was closed and placements frozen early")
    : ok(`a season that has not ended cannot be closed (HTTP ${closeActive.status})`);

  const asPlayer = await fetch(`${BASE}/rest/v1/rpc/close_season`, {
    method: "POST", headers: asUser(player.token), body: JSON.stringify({ p_season_id: active.id }),
  });
  asPlayer.ok
    ? bad("a player closed a season")
    : ok(`a player cannot call close_season (HTTP ${asPlayer.status})`);

  // A finished season, built to be closed for real.
  const past = { slug: `verify-past-${Date.now()}`, name: "Verify past season" };
  const pastRes = await rest("season_ratings", { method: "HEAD", headers: svc() });
  void pastRes;
  const created = await (await rest("seasons", {
    method: "POST", headers: svc({ Prefer: "return=representation" }),
    body: JSON.stringify({
      ...past,
      starts_at: "2020-01-01T00:00:00Z", ends_at: "2020-04-01T00:00:00Z",
    }),
  })).json();
  const pastSeason = created[0];

  // Two qualifying players and one who did not play enough.
  const short = await guest();
  await Promise.all([
    rest("season_ratings", { method: "POST", headers: svc(), body: JSON.stringify({
      season_id: pastSeason.id, user_id: player.id, game_id: game.id,
      rating: 1700, peak_rating: 1700, games_played: 20, wins: 15, losses: 5, draws: 0 }) }),
    rest("season_ratings", { method: "POST", headers: svc(), body: JSON.stringify({
      season_id: pastSeason.id, user_id: rival.id, game_id: game.id,
      rating: 1500, peak_rating: 1500, games_played: 20, wins: 10, losses: 10, draws: 0 }) }),
    rest("season_ratings", { method: "POST", headers: svc(), body: JSON.stringify({
      season_id: pastSeason.id, user_id: short.id, game_id: game.id,
      rating: 2400, peak_rating: 2400, games_played: 3, wins: 3, losses: 0, draws: 0 }) }),
  ]);

  const closed = await fetch(`${BASE}/rest/v1/rpc/close_season`, {
    method: "POST", headers: svc(), body: JSON.stringify({ p_season_id: pastSeason.id }),
  });
  const writtenCount = closed.ok ? await closed.json() : -1;
  writtenCount === 2
    ? ok("closing ranks only players who met the ten-game minimum (2 of 3)")
    : bad(`close_season wrote ${writtenCount} placements, expected 2`);

  const placements = await (await rest(
    `season_placements?season_id=eq.${pastSeason.id}&select=user_id,rank,total_ranked,rating&order=rank`,
    { headers: { apikey: ANON } },
  )).json();
  placements[0]?.user_id === player.id && placements[0]?.rank === 1
    ? ok("the highest-rated qualifying player is ranked first")
    : bad("placements are not in rating order");
  placements.every((p) => p.total_ranked === 2)
    ? ok("total_ranked counts only qualifying players, so percentiles are honest")
    : bad(`total_ranked was ${placements[0]?.total_ranked}, expected 2`);
  placements.some((p) => p.user_id === short.id)
    ? bad("a player with 3 games was placed despite the 10-game minimum")
    : ok("a player below the minimum is not placed at all, however high their rating");

  const again = await fetch(`${BASE}/rest/v1/rpc/close_season`, {
    method: "POST", headers: svc(), body: JSON.stringify({ p_season_id: pastSeason.id }),
  });
  const secondCount = again.ok ? await again.json() : -1;
  secondCount === 0
    ? ok("closing twice is a no-op — a retried job cannot rewrite standings")
    : bad(`a second close wrote ${secondCount} rows`);

  const stamp = await (await rest(`seasons?id=eq.${pastSeason.id}&select=closed_at`, { headers: svc() })).json();
  stamp[0]?.closed_at
    ? ok("closed_at is stamped, so 'ended' and 'placements written' stay distinct facts")
    : bad("closed_at was not set");

  // --- all-time rating is untouched -----------------------------------------
  const allTime = await (await rest(
    `game_ratings?user_id=eq.${player.id}&game_id=eq.${game.id}&select=rating`, { headers: svc() },
  )).json();
  allTime.length === 0
    ? ok("season standings did not create or alter an all-time rating row")
    : bad("writing a season standing touched game_ratings");

  // --- cleanup ---------------------------------------------------------------
  await rest(`seasons?id=eq.${pastSeason.id}`, { method: "DELETE", headers: svc() });
  await rest(`season_ratings?season_id=eq.${active.id}&user_id=in.(${player.id},${rival.id})`, {
    method: "DELETE", headers: svc(),
  });

  const total = failures === 0 ? "\x1b[32mall checks passed\x1b[0m" : `\x1b[31m${failures} failed\x1b[0m`;
  console.log(`\n${total}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
