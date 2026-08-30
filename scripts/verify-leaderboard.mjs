#!/usr/bin/env node
/**
 * Leaderboard queries against the live database.
 *
 * The interesting one is the viewer's own standing: rank comes from a count of
 * players rated above them, not from scanning the board, so it has to agree
 * with the board for someone who *is* on it.
 */
import { readFileSync } from "node:fs";

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); failures++; };

const SELECT =
  "user_id,rating,peak_rating,games_played,wins,losses,draws,profiles!inner(username,display_name,avatar_url)";

async function get(path, extraHeaders = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, ...extraHeaders },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`);
  return { body: text ? JSON.parse(text) : null, headers: res.headers };
}

async function main() {
  console.log("\n\x1b[1mLeaderboard\x1b[0m\n");

  const { body: games } = await get("games?slug=eq.chess&select=id");
  const gameId = games[0]?.id;
  gameId ? ok("resolved the chess game row") : bad("chess missing from the catalog");

  // The board itself.
  const { body: board } = await get(
    `game_ratings?select=${SELECT}&game_id=eq.${gameId}&games_played=gt.0&order=rating.desc&limit=50`,
  );
  Array.isArray(board) ? ok(`board returned ${board.length} ranked players`) : bad("board query failed");

  if (board.length > 1) {
    const sorted = board.every((r, i) => i === 0 || board[i - 1].rating >= r.rating);
    sorted ? ok("the board is ordered by rating, highest first") : bad("board ordering wrong");
  }

  const unplayed = board.filter((r) => r.games_played === 0);
  unplayed.length === 0
    ? ok("nobody appears on a default 1200 without having played")
    : bad(`${unplayed.length} unplayed rows leaked onto the board`);

  const joined = board.every((r) => r.profiles && r.profiles.username);
  board.length === 0 || joined
    ? ok("every row carries its player's profile")
    : bad("the profiles join dropped rows");

  // The count-based rank must agree with the board for someone already on it.
  if (board.length > 0) {
    const target = board[Math.min(board.length - 1, 2)];
    const boardRank = board.indexOf(target) + 1;

    const { headers } = await get(
      `game_ratings?select=user_id&game_id=eq.${gameId}&games_played=gt.0&rating=gt.${target.rating}`,
      { Prefer: "count=exact", Range: "0-0" },
    );
    const range = headers.get("content-range") ?? "";
    const above = Number(range.split("/")[1]);
    const countedRank = above + 1;

    // Ties share a rating, so the counted rank is the first seat of the tie.
    const tiedAbove = board.filter((r) => r.rating === target.rating);
    const firstOfTie = board.indexOf(tiedAbove[0]) + 1;

    countedRank === firstOfTie
      ? ok(`counted rank ${countedRank} agrees with the board (row ${boardRank}${tiedAbove.length > 1 ? `, tie of ${tiedAbove.length}` : ""})`)
      : bad(`counted rank ${countedRank} but board says ${firstOfTie}`);
  } else {
    ok("no ranked players yet, so there is no standing to reconcile");
  }

  // A game with no ratings must come back empty rather than erroring.
  const { body: unoGames } = await get("games?slug=eq.uno&select=id");
  if (unoGames[0]?.id) {
    const { body: unoBoard } = await get(
      `game_ratings?select=${SELECT}&game_id=eq.${unoGames[0].id}&games_played=gt.0&order=rating.desc&limit=50`,
    );
    Array.isArray(unoBoard)
      ? ok(`a game with ${unoBoard.length} ranked players still answers cleanly`)
      : bad("uno board query failed");
  }

  console.log(failures === 0
    ? "\n\x1b[32mLeaderboard queries work.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(`\n\x1b[31mAborted:\x1b[0m ${e.message}\n`); process.exit(1); });
