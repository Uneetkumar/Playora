#!/usr/bin/env node
/**
 * Does progression actually accumulate across matches?
 *
 * Written after finding that it did not. Every rating upsert was posted without
 * an `on_conflict` target, so PostgREST resolved it against the surrogate
 * primary key, no row ever matched, and the composite unique constraint
 * rejected every write after a player's first — silently, because the response
 * was discarded. Live data agreed: fifteen rating rows, none past one game.
 *
 * Every existing check played exactly one match per account, so all of them
 * passed. This one plays the same two accounts three times, which is the only
 * shape of test that could have caught it.
 *
 * Needs the Worker on :8787.
 */
import { readFileSync } from "node:fs";

const WORKER = process.env.WORKER_URL ?? "ws://localhost:8787";

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
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(label) { this.label = label; this.messages = []; this.waiters = []; }

  async signIn() {
    const r = await fetch(`${BASE}/auth/v1/signup`, {
      method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: "{}",
    });
    const b = await r.json();
    if (!b.access_token) throw new Error(`sign-in failed: ${JSON.stringify(b)}`);
    this.token = b.access_token;
    this.userId = b.user.id;
    return this;
  }

  connect(room) {
    this.messages = [];
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WORKER}/rooms/${room}/ws?gameId=chess&spectator=false`);
      this.ws.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data);
        this.messages.push(msg);
        const i = this.waiters.findIndex((w) => w.match(msg));
        if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
      });
      this.ws.addEventListener("open", () => resolve(this));
      this.ws.addEventListener("error", reject);
    });
  }

  send(m) { this.ws.send(JSON.stringify(m)); }

  waitWhere(match, timeoutMs = 8000, label = "predicate") {
    const existing = this.messages.find(match);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(
        `${this.label} timed out waiting for ${label}. Saw: ${this.messages.map((m) => m.type).join(", ")}`)), timeoutMs);
      this.waiters.push({ match, resolve: (m) => { clearTimeout(timer); resolve(m); } });
    });
  }

  waitFor(type, timeoutMs = 8000) {
    return this.waitWhere((m) => m.type === type, timeoutMs, type);
  }

  async authenticate() {
    this.send({ type: "AUTH", token: this.token, isGuest: true });
    return this.waitFor("CONNECTED");
  }

  close() { try { this.ws?.close(); } catch { /* already closed */ } }
}

/**
 * Creates the room row the Worker expects to find.
 *
 * The Worker refuses to persist a result for a room it cannot look up
 * ("room not persisted; result skipped"), which is correct — a room that was
 * never created is not a place a rated match happened. The web app inserts this
 * row before anyone connects; a script has to do the same.
 */
async function createRoom(code, hostId, gameId) {
  const res = await fetch(`${BASE}/rest/v1/rooms`, {
    method: "POST",
    headers: { ...svc, Prefer: "return=minimal" },
    body: JSON.stringify({
      code, name: "Accrual probe", host_id: hostId, game_id: gameId,
      status: "waiting", is_private: true, max_players: 2, settings: {},
    }),
  });
  if (!res.ok) throw new Error(`room create failed: ${res.status} ${await res.text()}`);
}

/** One full match: connect, ready, start, the loser resigns. */
async function playMatch(a, b, room) {
  await a.connect(room); await a.authenticate(); await a.waitFor("ROOM_STATE");
  await b.connect(room); await b.authenticate(); await b.waitFor("ROOM_STATE");

  a.send({ type: "READY", roomId: room });
  b.send({ type: "READY", roomId: room });
  await a.waitWhere((m) => m.type === "PLAYER_READY" && m.playerId === b.userId);

  a.send({ type: "START_GAME", roomId: room });
  const started = await a.waitFor("GAME_STARTED");
  await b.waitFor("GAME_STARTED");

  // b resigns, so a wins every time and the rating must move in one direction.
  b.send({ type: "GAME_ACTION", roomId: room, sessionId: started.sessionId, actionType: "RESIGN", payload: {} });
  await a.waitFor("GAME_FINISHED");

  // The progression write happens after the result is broadcast.
  await wait(2500);
  a.close(); b.close();
  return started.sessionId;
}

const read = async (path) => (await (await fetch(`${BASE}/rest/v1/${path}`, { headers: svc })).json());

async function main() {
  console.log("\n\x1b[1mProgression accrual across matches\x1b[0m\n");

  const [a, b] = await Promise.all([new Client("winner").signIn(), new Client("loser").signIn()]);
  const game = (await read("games?select=id,slug&slug=eq.chess&limit=1"))[0];
  const now = new Date().toISOString();
  const season = (await read(`seasons?select=id&starts_at=lte.${now}&ends_at=gt.${now}&limit=1`))[0];

  const snapshots = [];
  for (let i = 1; i <= 3; i++) {
    const room = `ACC${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await createRoom(room, a.userId, game.id);
    await playMatch(a, b, room);

    const [rating] = await read(`game_ratings?user_id=eq.${a.userId}&game_id=eq.${game.id}&select=rating,games_played,wins`);
    const [profile] = await read(`profiles?id=eq.${a.userId}&select=xp,level,total_games_played,current_streak`);
    const [seasonRow] = await read(`season_ratings?user_id=eq.${a.userId}&season_id=eq.${season.id}&select=rating,games_played`);
    snapshots.push({ match: i, rating, profile, seasonRow });
    console.log(`  match ${i}: rating=${rating?.rating} played=${rating?.games_played} xp=${profile?.xp} season=${seasonRow?.rating}@${seasonRow?.games_played}`);
  }

  const [s1, s2, s3] = snapshots;

  // --- the regression itself -------------------------------------------------
  s3.rating?.games_played === 3
    ? ok("games_played reached 3 — every match was counted, not just the first")
    : bad(`games_played was ${s3.rating?.games_played}, expected 3 (the upsert bug is back)`);

  s1.rating.rating < s2.rating.rating && s2.rating.rating < s3.rating.rating
    ? ok(`rating rose every match (${s1.rating.rating} → ${s2.rating.rating} → ${s3.rating.rating})`)
    : bad(`rating did not advance: ${s1.rating.rating} → ${s2.rating.rating} → ${s3.rating.rating}`);

  s3.rating.wins === 3 ? ok("all three wins recorded") : bad(`wins was ${s3.rating.wins}, expected 3`);

  // --- rating history agrees with the rating --------------------------------
  const history = await read(`rating_history?user_id=eq.${a.userId}&game_id=eq.${game.id}&select=rating_after&order=created_at.asc`);
  history.length === 3
    ? ok("three rating_history rows, one per match")
    : bad(`${history.length} history rows, expected 3`);
  history.at(-1)?.rating_after === s3.rating.rating
    ? ok("the rating chart's last point matches the stored rating — the two agree")
    : bad(`history says ${history.at(-1)?.rating_after}, game_ratings says ${s3.rating.rating}`);

  // --- season ladder accrues in parallel ------------------------------------
  s3.seasonRow?.games_played === 3
    ? ok("the season standing counted all three matches too")
    : bad(`season games_played was ${s3.seasonRow?.games_played}, expected 3`);
  // For a brand-new player the two ladders *should* read the same: all-time
  // starts at 1200 and a soft reset of 1200 is 1200. The property worth testing
  // is that they diverge for someone who arrives with a history, which is
  // checked separately below with a seeded account.
  s3.seasonRow.rating === s3.rating.rating
    ? ok("a new player's two ladders agree, as a soft reset of 1200 must")
    : bad(`a new player's ladders diverged (${s3.seasonRow.rating} vs ${s3.rating.rating}) — the seed is wrong`);

  // --- XP and streaks --------------------------------------------------------
  s1.profile.xp < s2.profile.xp && s2.profile.xp < s3.profile.xp
    ? ok(`XP accumulated (${s1.profile.xp} → ${s2.profile.xp} → ${s3.profile.xp})`)
    : bad(`XP did not accumulate: ${s1.profile.xp} → ${s2.profile.xp} → ${s3.profile.xp}`);
  s3.profile.total_games_played === 3
    ? ok("platform total_games_played reached 3")
    : bad(`total_games_played was ${s3.profile.total_games_played}`);
  s3.profile.current_streak === 3
    ? ok("a three-win streak was tracked")
    : bad(`current_streak was ${s3.profile.current_streak}, expected 3`);

  // --- the loser's side ------------------------------------------------------
  const [loserRating] = await read(`game_ratings?user_id=eq.${b.userId}&game_id=eq.${game.id}&select=rating,losses,games_played`);
  loserRating?.losses === 3 && loserRating?.games_played === 3
    ? ok("the loser's three losses were recorded too")
    : bad(`loser had ${loserRating?.losses} losses over ${loserRating?.games_played} games`);
  loserRating.rating < 1200
    ? ok(`the loser's rating fell below the starting 1200 (${loserRating.rating})`)
    : bad(`loser's rating was ${loserRating.rating}, expected below 1200`);

  // --- an established player is soft reset into the season -------------------
  // The real question a season answers: someone who is already 2000 all-time
  // must not simply carry that number onto the season ladder.
  const veteran = await new Client("veteran").signIn();
  const foil = await new Client("foil").signIn();
  await fetch(`${BASE}/rest/v1/game_ratings?on_conflict=user_id,game_id`, {
    method: "POST",
    headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: veteran.userId, game_id: game.id,
      rating: 2000, peak_rating: 2000, games_played: 40, wins: 30, losses: 10, draws: 0,
    }),
  });

  const vRoom = `VET${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await createRoom(vRoom, veteran.userId, game.id);
  await playMatch(veteran, foil, vRoom);

  const [vAll] = await read(`game_ratings?user_id=eq.${veteran.userId}&game_id=eq.${game.id}&select=rating`);
  const [vSeason] = await read(`season_ratings?user_id=eq.${veteran.userId}&season_id=eq.${season.id}&select=rating`);

  // seasonStartRating(2000) = 1200 + 800*0.6 = 1680, then one win on top.
  vSeason && vSeason.rating > 1650 && vSeason.rating < 1760
    ? ok(`a 2000-rated player enters the season near 1680, not 2000 (got ${vSeason.rating})`)
    : bad(`season seed was ${vSeason?.rating}; expected a soft reset of 2000 toward 1680`);

  vSeason && vAll && Math.abs(vAll.rating - vSeason.rating) > 200
    ? ok(`the ladders are genuinely separate for an established player (all-time ${vAll.rating}, season ${vSeason.rating})`)
    : bad(`ladders did not diverge: all-time ${vAll?.rating}, season ${vSeason?.rating}`);

  // Not "it went up": a 2000 beating a 1200 has an expected score of ~0.99, so
  // at K=24 the delta rounds to zero. That is correct Elo, and asserting a rise
  // here would be asserting a bug. What must hold is that the all-time rating
  // stayed at its own level rather than being dragged to the season's.
  const [vAllRow] = await read(`game_ratings?user_id=eq.${veteran.userId}&game_id=eq.${game.id}&select=rating,games_played`);
  vAllRow.rating >= 1990 && vAllRow.games_played === 41
    ? ok(`the all-time rating held at ${vAllRow.rating} over ${vAllRow.games_played} games — the season reset did not leak into it`)
    : bad(`all-time became ${vAllRow.rating} over ${vAllRow.games_played} games; the season reset leaked in`);

  const total = failures === 0 ? "\x1b[32mall checks passed\x1b[0m" : `\x1b[31m${failures} failed\x1b[0m`;
  console.log(`\n${total}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
