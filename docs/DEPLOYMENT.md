# Genuine Homes — Free Deployment Guide

Deploy the whole platform for free: the **frontend on Vercel** and the
**backend (NestJS API + PostgreSQL/PostGIS + Redis) on Render**. Everything
is already configured in the repo — `render.yaml` and `vercel.json` do the
heavy lifting. You just connect each site to the GitHub repo and click deploy.

- **Repository:** https://github.com/Mundesdaniel/Genuine-Homes
- **Time:** ~20 minutes · **Cost:** $0 (free tiers)
- **Heads-up:** Render's free API **sleeps after ~15 min idle**; the first
  request then takes ~50s to wake. This is normal and only affects free plans.

---

## Architecture

```
  Browser ──▶ Vercel (React frontend)
                 │  /api  and  /uploads  are proxied (rewrite in vercel.json)
                 ▼
              Render (NestJS API) ──▶ PostgreSQL + PostGIS
                                  └─▶ Redis
```

The frontend proxies `/api` to the Render API, so the browser only ever talks
to one origin (your Vercel domain). This keeps the login/refresh cookie working
without any CORS or cross-site-cookie setup.

---

## Part A — Backend on Render (do this first)

You need the API's URL before configuring the frontend, so start here.

1. **Create an account** at <https://render.com> → *Get Started* → **Sign in
   with GitHub** and authorize Render.
2. In the dashboard click **New +** → **Blueprint**.
3. Choose the **`Mundesdaniel/Genuine-Homes`** repo (grant access if prompted).
   Render detects `render.yaml` and lists three resources: **genuine-homes-api**,
   **genuine-homes-db**, **genuine-homes-redis**.
4. Click **Apply**. Render provisions the database + Redis and starts the first
   API build. (The build installs the monorepo, builds the shared package,
   generates Prisma, compiles the API, runs the DB migrations, then boots.)
5. Wait for **genuine-homes-api** to go **Live** (first build ~5–8 min). Its URL
   appears at the top of the service page, e.g.
   **`https://genuine-homes-api.onrender.com`**. **Copy it** — you'll need it twice.

> If the name was taken, Render adds a suffix (e.g. `…-api-xyz.onrender.com`).
> Use whatever URL Render shows you wherever this guide says the Render URL.

### Load demo data (optional but recommended)

So the app has properties, users, and charts to show:

1. Open the **genuine-homes-api** service → **Shell** tab.
2. Run: `pnpm db:seed`
3. You can now log in with the demo accounts (password `Password123!` for all):
   `admin@genuinehomes.ug`, `pearl@estates.ug`, `roro@gmail.com`, and others.

---

## Part B — Point the frontend at your API

`vercel.json` ships with a default Render URL. If yours is different (see the
note above), update it:

1. Open **`vercel.json`** in the repo root.
2. Replace both `https://genuine-homes-api.onrender.com` values with your actual
   Render URL.
3. Commit and push (`git commit -am "Point frontend at API" && git push`).

If your Render URL is exactly `https://genuine-homes-api.onrender.com`, skip this
part — it already matches.

---

## Part C — Frontend on Vercel

1. **Create an account** at <https://vercel.com> → **Sign in with GitHub** and
   authorize Vercel.
2. Click **Add New…** → **Project** → import **`Mundesdaniel/Genuine-Homes`**.
3. Vercel reads `vercel.json`, so **leave all build settings at their defaults**
   (build command, output directory, and install command are already defined).
   Do **not** set a Root Directory — leave it as the repo root.
4. Click **Deploy**. First build takes ~2–3 min.
5. When it finishes, Vercel shows your live URL, e.g.
   **`https://genuine-homes.vercel.app`**. **Copy it.**

---

## Part D — Finish the backend config

Now that you have the Vercel URL, give it to the API (needed for password-reset
links and image URLs):

1. Render → **genuine-homes-api** → **Environment**.
2. Set these three to your Vercel URL (e.g. `https://genuine-homes.vercel.app`):
   - `CORS_ORIGINS`
   - `PUBLIC_WEB_URL`
   - `PUBLIC_API_URL`
3. **Save changes** — Render redeploys automatically (~2 min).

---

## Where are my links?

| What | Where to find it |
| --- | --- |
| **Live app (share this)** | Vercel → your project → **Domains** / **Visit** button. Example: `https://genuine-homes.vercel.app` |
| **API base** | Render → **genuine-homes-api** → URL at top. Example: `https://genuine-homes-api.onrender.com/api` |
| **API health check** | `<API base>/api/health` → should return `{"status":"ok"}` |
| **Source code** | https://github.com/Mundesdaniel/Genuine-Homes |

**Open the Vercel URL — that is the app.** Log in with a demo account above.

---

## Verify it works

1. Open the Vercel URL. The home page should list seeded properties.
2. Log in as `roro@gmail.com` / `Password123!` → the dashboard shows charts.
3. If the first load is slow, the Render API was asleep — wait ~50s and retry.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| App loads but no data / login fails | API still waking (wait ~50s) or demo data not seeded (run `pnpm db:seed` in Render Shell). |
| `502`/`503` from `/api` | API build failed or still deploying — check Render → service → **Logs**. |
| Login works but "session expired" quickly | Confirm `vercel.json`'s rewrite points at the correct Render URL (Part B). |
| Property images don't show | Expected on free tier — Render's disk is ephemeral, so uploaded files reset on redeploy. Seeded/external images still work. |
| Live chat doesn't connect | Known limitation of the proxy setup (WebSockets aren't proxied by Vercel). The rest of the app is unaffected. |

---

## Notes & limitations (free tier)

- **API sleeps** after ~15 min idle (first request ~50s). Upgrading the Render
  service to a paid instance removes this.
- **Ephemeral storage** — uploaded images don't persist across redeploys. For
  permanent storage, set `CLOUDINARY_URL` in the Render environment.
- **Payments run in mock mode** (`PAYMENT_GATEWAY=mock`). To take real payments,
  add `FLUTTERWAVE_SECRET_KEY` + `FLUTTERWAVE_WEBHOOK_HASH` and set
  `PAYMENT_GATEWAY=flutterwave`.
- **Live chat** is disabled in this setup (see troubleshooting). It can be
  enabled later by switching the refresh cookie to `SameSite=None` and pointing
  `VITE_API_URL` directly at the Render origin.
