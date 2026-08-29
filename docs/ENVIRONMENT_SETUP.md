# Environment Setup

Everything you need to obtain, where to click to get it, and which file it goes in.

Work top to bottom. **Step 0 is urgent.** Steps 1–3 unblock development.
Step 6 is deferred — skip it for now.

---

## Where each value actually lives

The most common mistake is putting a value in the wrong file. There are four
distinct destinations and they are not interchangeable:

| Destination | What goes there | Committed? |
|---|---|---|
| `.env.example` | Placeholders only, as documentation | ✅ yes |
| `apps/web/.env.local` | Next.js public + server vars | ❌ never |
| `apps/realtime/.dev.vars` | Worker secrets, **local dev only** | ❌ never |
| `wrangler secret put NAME` | Worker secrets, **production** | ❌ never (encrypted at Cloudflare) |

The realtime Worker does **not** read `.env.local`. Cloudflare Workers have no
`process.env` from dotenv — secrets arrive through the `Env` binding, which is
populated by `.dev.vars` locally and by `wrangler secret put` in production.

---

## Step 0 — Rotate the leaked Supabase key 🔴

Your live `service_role` key was committed in `.env.example`. It bypasses Row
Level Security entirely — anyone holding it has full read/write on your whole
database. It has been removed from that file, but treat it as compromised.

Affected project ref: `wlnzuxjbebkdnioliozd`

**Option A — rotate the key (keeps the project):**

1. Go to https://supabase.com/dashboard → select the project
2. **Project Settings** (gear, bottom-left) → **API**
3. Find **Project API keys** → next to `service_role`, click **Reveal** then look
   for the rotate/regenerate control
4. If your dashboard has no rotate button for legacy keys, go to
   **Project Settings → API → JWT Settings → Generate a new secret**.
   ⚠️ This invalidates the anon key and all existing user sessions too — you will
   need to re-copy both keys afterward.

**Option B — delete and recreate the project (cleanest, ~3 min):**

Since there is no real data yet, this is the option I recommend.
**Project Settings → General → Delete project**, then follow Step 1 fresh.

Also confirm the key never reached a remote:

```bash
git log --all -p -- .env.example 2>/dev/null | grep -c "service_role"
```

This repo is not yet a git repo, so the answer should be `0` — meaning the key
was never pushed anywhere. That is the good case. Rotate anyway.

---

## Step 1 — Supabase (required)

Gives you: Postgres, Auth, Google OAuth handling, anonymous guest sessions.

### 1a. Create the project

1. https://supabase.com/dashboard → **New project**
2. Fill in:
   - **Name**: your project name
   - **Database Password**: click Generate, then **save it in your password
     manager** — it is shown only once and is needed for CLI migrations
   - **Region**: pick the one closest to your players. For India, choose
     **South Asia (Mumbai)** — region directly determines latency
   - **Plan**: Free is fine
3. Wait ~2 minutes for provisioning

### 1b. Copy the API values

**Project Settings → API**

| Dashboard label | Copy into | Class |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | **SERVER ONLY** |
| Reference ID (Settings → General) | `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | PUBLIC |

> Newer Supabase dashboards label these **Publishable key** (`sb_publishable_…`)
> and **Secret key** (`sb_secret_…`). Same roles, same destinations.

The `service_role` key goes in `apps/web/.env.local` and in the Worker's secret
store. It must never appear in a `NEXT_PUBLIC_` variable, in client code, or in
any committed file.

### 1c. Enable guest play (spec §12)

**Authentication → Providers → Anonymous sign-ins → Enable**

Without this, "Play as Guest" cannot issue a real session and we are back to
forgeable local tokens. This toggle is required, not optional.

### 1d. Set the redirect URLs

**Authentication → URL Configuration**

- **Site URL**: `http://localhost:8000`
- **Redirect URLs** — add both:
  - `http://localhost:8000/auth/callback`
  - `https://your-production-domain.com/auth/callback` (add when you deploy)

### 1e. Note your JWKS endpoint

The realtime Worker verifies access tokens against this URL. No copying needed —
it is derived from the project ref:

```
https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/.well-known/jwks.json
```

Open it in a browser to confirm it returns keys. If it returns an empty `keys`
array, your project is still on legacy HS256 symmetric signing. In that case go
to **Project Settings → JWT Keys** and migrate to asymmetric signing keys
(ES256/RS256) if the option is offered — it lets the Worker verify tokens using
only public keys, so no shared secret ever ships to the edge. If migration is not
available, tell me and I will implement the HS256 fallback instead.

---

## Step 2 — Google OAuth (required for "Continue with Google")

Google credentials are entered **into the Supabase dashboard**, never into this
application. Our code never sees them. That is why `.env.example` has no
`GOOGLE_CLIENT_SECRET`.

### 2a. Create a Google Cloud project

1. https://console.cloud.google.com
2. Project dropdown (top bar) → **New Project** → name it → **Create**

### 2b. Configure the consent screen

**APIs & Services → OAuth consent screen**

1. User Type: **External** → Create
2. App name, User support email, Developer contact email → Save and Continue
3. Scopes: **Add or Remove Scopes** → tick `.../auth/userinfo.email`,
   `.../auth/userinfo.profile`, `openid` → Update → Save and Continue
4. Test users: while the app is in **Testing** mode only these accounts can log
   in. **Add your own Google account here** or your local login will fail.
   Publishing to Production requires Google verification — stay in Testing for now.

### 2c. Create the OAuth client

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

- Application type: **Web application**
- **Authorized JavaScript origins**:
  - `http://localhost:8000`
- **Authorized redirect URIs** — this one matters most:
  ```
  https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
  ```
  It points at **Supabase**, not at localhost. Getting this wrong produces
  `redirect_uri_mismatch`, which is the single most common failure here.

Click Create. Copy the **Client ID** and **Client secret**.

### 2d. Paste them into Supabase

**Supabase → Authentication → Providers → Google**

- Toggle **Enable Sign in with Google**
- Paste Client ID and Client Secret → **Save**

Nothing goes into `.env.local` from this step.

---

## Step 3 — Local files

```bash
cp .env.example apps/web/.env.local
```

Then edit `apps/web/.env.local` and fill in the four Supabase values from 1b.
Leave the LiveKit / Sentry / PostHog placeholders untouched.

For the realtime Worker, create `apps/realtime/.dev.vars` (already gitignored via
the `.env*` and `.wrangler` rules — I will verify this explicitly before the
first commit):

```ini
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_REF=YOUR-PROJECT-REF
```

---

## Step 4 — Cloudflare (required only to deploy)

`wrangler dev` runs Durable Objects locally with **no account and no login**, so
you can complete Slices 0–2 without touching Cloudflare at all. Do this step when
you are ready to deploy.

1. https://dash.cloudflare.com → sign up
2. **Account ID**: Workers & Pages → right-hand sidebar → copy → `CLOUDFLARE_ACCOUNT_ID`
3. **API token**: My Profile → API Tokens → **Create Token** →
   use the **Edit Cloudflare Workers** template → Continue → Create →
   copy once → `CLOUDFLARE_API_TOKEN`
4. Push production secrets (these do **not** live in any file):
   ```bash
   cd apps/realtime
   pnpm wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   pnpm wrangler secret put SUPABASE_URL
   ```

⚠️ **Check the Durable Objects plan requirement before you rely on deploying.**
Durable Objects have historically required the Workers **Paid** plan (~$5/month),
though SQLite-backed Durable Objects later became available on the free tier.
Confirm the current terms at https://developers.cloudflare.com/durable-objects/
Local `wrangler dev` is unaffected either way.

---

## Step 5 — Verify

```bash
pnpm install && pnpm typecheck && pnpm test && pnpm build
```

Once the auth slice lands, the real check is: Google login and Guest login both
produce a session whose JWT the realtime Worker independently verifies.

---

## Step 6 — Deferred (do not set up yet)

Placeholders exist so nothing crashes; wire them at the phase noted.

| Service | Needed at | Get it from |
|---|---|---|
| **LiveKit** voice | Phase 14 (§26) | https://cloud.livekit.io → project → Settings → Keys |
| **Sentry** errors | when deploying (§24) | https://sentry.io → Project → Settings → Client Keys (DSN) |
| **PostHog** analytics | Phase 5+ (§77) | https://posthog.com → Project Settings → Project API Key |

---

## Quick reference — what I need from you to proceed

To unblock **Slice 1 (real identity)**, paste me these four, or just fill in
`apps/web/.env.local` yourself and tell me it is done:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PROJECT_REF=
SUPABASE_SERVICE_ROLE_KEY=      <- send privately, or set it yourself
```

Plus confirmation of two toggles:

- [ ] Anonymous sign-ins **enabled** (Step 1c)
- [ ] Google provider **enabled** with Client ID + Secret saved (Step 2d)

**Slices 0 and 2 need none of this** — I can build and test them now.
