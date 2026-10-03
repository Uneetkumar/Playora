import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every table with RLS enabled must have policies.
 *
 * Migration 00007 exists because `friendships` shipped with
 * `ENABLE ROW LEVEL SECURITY` and no policies at all — which denies every read
 * and every write, silently. The friends page looked empty rather than broken,
 * so nothing failed loudly enough to notice.
 *
 * This reads the migrations as text rather than querying a database, so it
 * runs in CI with no credentials and catches the mistake before it ships.
 */

const MIGRATIONS_DIR = join(process.cwd(), "..", "..", "supabase", "migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

/** All SQL, concatenated — a policy may live in a later migration than its table. */
function allSql(): string {
  return migrationFiles()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

function tablesWithRlsEnabled(sql: string): string[] {
  const matches = sql.matchAll(
    /ALTER TABLE\s+(?:public\.)?(\w+)\s+ENABLE ROW LEVEL SECURITY/gi,
  );
  return [...new Set([...matches].map((m) => m[1]!.toLowerCase()))];
}

function tablesWithPolicies(sql: string): Set<string> {
  const matches = sql.matchAll(/CREATE POLICY\s+"[^"]+"\s+ON\s+(?:public\.)?(\w+)/gi);
  return new Set([...matches].map((m) => m[1]!.toLowerCase()));
}

describe("migration safety", () => {
  it("finds the migrations", () => {
    expect(migrationFiles().length).toBeGreaterThan(0);
  });

  it("gives every RLS-enabled table at least one policy", () => {
    const sql = allSql();
    const withPolicies = tablesWithPolicies(sql);
    const unprotected = tablesWithRlsEnabled(sql).filter((t) => !withPolicies.has(t));
    // An RLS table with no policy denies everything, and looks like empty data
    // rather than an error — exactly how the `friendships` bug hid.
    expect(unprotected).toEqual([]);
  });

  it("scopes every INSERT policy with a WITH CHECK", () => {
    // Without it a client can insert a row under someone else's user_id.
    const sql = allSql();
    const inserts = [
      ...sql.matchAll(/CREATE POLICY\s+"([^"]+)"\s+ON\s+[^\n]+\s+FOR INSERT([\s\S]*?);/gi),
    ];
    const missing = inserts
      .filter(([, , body]) => !/WITH CHECK/i.test(body ?? ""))
      .map(([, name]) => name);
    expect(missing).toEqual([]);
  });

  it("enables RLS on the tables migration 00010 adds", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "00010_favorites_and_recent.sql"),
      "utf8",
    );
    for (const table of ["favorites", "recently_played", "game_progress"]) {
      expect(sql, table).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });

  it("keeps the new tables private to their owner", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "00010_favorites_and_recent.sql"),
      "utf8",
    );
    // Unlike achievements, which are public so they can appear on a profile,
    // nobody else has any business reading what you favourited.
    expect(sql).not.toMatch(/FOR SELECT USING \(true\)/i);
    // Matched to the statement terminator rather than the first ")", which
    // would stop inside `auth.uid()`.
    const selects = [...sql.matchAll(/FOR SELECT USING \(([\s\S]*?)\);/gi)];
    expect(selects.length).toBeGreaterThan(0);
    for (const [, predicate] of selects) {
      expect(predicate).toMatch(/auth\.uid\(\) = user_id/);
    }
  });

  it("only references columns that exist on the table it protects", () => {
    /*
     * Written after getting this wrong: migration 00011's invite policies
     * referenced `inviter_id`/`invitee_id`, and the columns are actually
     * `sender_id`/`recipient_id`. Nothing caught it — the policy-presence test
     * above only checks that a policy exists, and without a database there is
     * nothing to reject invalid SQL.
     *
     * Narrowed to `*_id` identifiers, which is where this mistake lives.
     */
    const sql = allSql();

    const columnsByTable = new Map<string, Set<string>>();
    for (const [, table, body] of sql.matchAll(
      /CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      const cols = new Set(
        [...body!.matchAll(/^\s{2}(\w+)\s+[A-Z]/gm)].map((m) => m[1]!.toLowerCase()),
      );
      const key = table!.toLowerCase();
      const existing = columnsByTable.get(key);
      if (existing) for (const c of cols) existing.add(c);
      else columnsByTable.set(key, cols);
    }

    const problems: string[] = [];
    for (const [, name, table, body] of sql.matchAll(
      /CREATE POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?(\w+)([\s\S]*?);/gi,
    )) {
      const known = columnsByTable.get(table!.toLowerCase());
      if (!known || known.size === 0) continue;

      /*
       * Only the top-level predicate.
       *
       * An `EXISTS (SELECT ... FROM other_table x WHERE x.foo_id = ...)` legitimately
       * names another table's columns, and three real policies do exactly
       * that. Cutting at the first EXISTS and skipping alias-qualified
       * references keeps this to the case it is for: an unqualified column on
       * the protected table that does not exist.
       */
      const topLevel = body!.split(/\bEXISTS\b/i)[0]!;
      for (const [, ref] of topLevel.matchAll(/(?<![.\w])(\w+_id)\b/g)) {
        if (ref!.startsWith("p_")) continue;
        if (!known.has(ref!.toLowerCase())) {
          problems.push(`${table}."${name}" references ${ref}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("keeps record_play behind the caller's own permissions", () => {
    const sql = readFileSync(
      join(MIGRATIONS_DIR, "00010_favorites_and_recent.sql"),
      "utf8",
    );
    // SECURITY DEFINER here would let any caller write any user's row.
    expect(sql).toMatch(/SECURITY INVOKER/i);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
  });
});
