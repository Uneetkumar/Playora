# Development

## One command

```bash
pnpm dev
```

Starts everything at once via Turborepo:

| Process | Port | What it does |
|---|---|---|
| `@playora/web` | 8000 | Next.js app |
| `@playora/realtime` | 8787 | Cloudflare Worker + Durable Objects |
| every `packages/*` | — | `tsc --watch`, rebuilding on change |

Leave it running. Edits reload on their own — see below for why that needed
fixing.

## Playing while someone is editing the code

`pnpm dev` hot-reloads on every file change, which reloads the page under you.
That is correct behaviour for development and very annoying if you are trying to
play a game while the code is being edited.

```bash
```

It builds to `.next-stable` rather than `.next`, so neither `pnpm dev` nor
`pnpm build` can disturb it. It only changes when you re-run `pnpm play`.

Note: online modes still need the realtime Worker on :8787 (`pnpm dev`, or
`pnpm --filter @playora/realtime dev`). Offline modes need nothing else.

## Why changes used to need a restart

Three separate causes, all now addressed:

1. **Workspace packages had no watcher.** They compile to `dist/`, and the web
   app imports the built output — so editing `packages/game-engine/src/...` did
   nothing until someone ran a build by hand. Every package now has a
   `dev: tsc --watch` script, and `turbo dev` runs them in parallel.

2. **`transpilePackages` was incomplete.** `@playora/progression` and
   `@playora/bot-engine` were added later and never listed, so Next silently
   ignored their changes. All eight packages are listed now.

3. **The dev servers were being stopped after every verification run.** Nothing
   was running to hot-reload into.

## What still needs a restart

Fast Refresh cannot pick these up — restart `pnpm dev` after changing:

- `apps/web/.env.local` or `apps/realtime/.dev.vars` (env is read at boot)
- `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `wrangler.toml` (bindings and migrations)
- adding a **new** workspace package (Turborepo has to pick it up)

Adding a file inside an existing package is fine — no restart needed.

## Ports are fixed on purpose

8000 and 8787 are not arbitrary. Both are baked into external configuration:

- Google OAuth "Authorized JavaScript origins" → `http://localhost:8000`
- Supabase redirect URL → `http://localhost:8000/auth/callback`
- `NEXT_PUBLIC_REALTIME_WS_URL` → `ws://localhost:8787`

`.claude/launch.json` pins both with `autoPort: false`. If a port is occupied by
a stale process:

```bash
lsof -ti:8000 -ti:8787 | xargs kill -9
```

## Checks

```bash
pnpm lint            # ESLint, strict
pnpm typecheck       # tsc --noEmit across the monorepo
pnpm test            # Vitest: unit + Durable Object integration
pnpm test:e2e        # Playwright
pnpm build           # production build
pnpm version:check   # workspace versions in sync
```

Run all of them before committing; CI runs the same set.

**Stop `pnpm dev` before running `pnpm build`.** Both write to `apps/web/.next`,
and running them together makes the dev server serve 500s until it recovers.

**Note:** Vitest transpiles without typechecking, so a green `pnpm test` does
not imply a green `pnpm typecheck`. Run both.

## Live verification against real services

These need `pnpm dev` running and Supabase configured
(`pnpm env:check` to confirm):

```bash
pnpm sim                  # two-client match: auth, moves, chat, reconnect
pnpm verify:matchmaking   # Quick Match pairs two real players
pnpm verify:persistence    # a finished match reaches Postgres
pnpm verify:progression    # rating, XP and streaks are applied
```

They use real Supabase sessions and a real Worker — no mocks.

## Environment

```bash
pnpm env:init    # create .env.local and .dev.vars from templates
pnpm env:check   # report what is set, and where to get what is missing
```

Full walkthrough: `docs/ENVIRONMENT_SETUP.md`.
