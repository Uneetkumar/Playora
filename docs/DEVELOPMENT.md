# Development Guide

Welcome to the **Game Platform** codebase! This guide covers everything needed to set up, build, test, and run the monorepo locally.

## Prerequisites

- **Node.js**: `v20.x` or `v22+` (v24 supported)
- **pnpm**: `v9.x` or `v10+` (`corepack enable` recommended)

---

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` inside `apps/web/`:
```bash
cp .env.example apps/web/.env.local
```

### 3. Run Development Servers
Start all applications and packages concurrently with Turborepo:
```bash
pnpm dev
```
- Web Application: `http://localhost:8000`
- Realtime Worker: `http://localhost:8787`

---

## Monorepo CLI Commands

| Command | Action |
|---|---|
| `pnpm dev` | Starts development servers in watch mode |
| `pnpm build` | Builds all packages and applications via Turborepo |
| `pnpm typecheck` | Runs TypeScript checks across all workspaces |
| `pnpm test` | Runs unit tests (Vitest) |
| `pnpm test:e2e` | Runs Playwright end-to-end tests |
| `pnpm lint` | Runs ESLint on all projects |
| `pnpm format` | Formats all code with Prettier |
| `pnpm clean` | Cleans build artifacts and caches |

---

## Project Structure

```
playora/
├── apps/
│   ├── web/           # Next.js 15 App Router Frontend (Port 8000)
│   └── realtime/      # Cloudflare Workers + Durable Objects (Port 8787)
├── packages/
│   ├── auth/          # Authentication & Guest Session logic
│   ├── config/        # Centralized TypeScript/ESLint/Prettier configs
│   ├── database/      # Supabase clients & DB schemas
│   ├── game-engine/   # Abstract Game Engine & Registry
│   ├── game-types/    # Shared Domain Models
│   ├── protocol/      # WebSocket protocol & Zod validation
│   └── ui/            # Shared UI components & Design system
├── supabase/
│   ├── migrations/    # Database schema migrations
│   └── seed/          # Initial seed data
└── docs/              # Architectural & Technical documentation
```
