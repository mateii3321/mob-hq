# MOB HQ — Live Setup Guide

Your command center, hosted for real: a **Railway** backend (private login + a database that
holds your data) and a **Netlify** frontend (the dashboard). Once set up, you log in from any
device — laptop, phone, tablet — and see the exact same live data.

```
  Your browser (any device)
          │  login + sync over HTTPS
          ▼
  Netlify  ──►  the dashboard (web/index.html)
  Railway  ──►  the backend (server/) + Postgres database  ◄── your data lives here
```

You'll do this once. Total time ~15 minutes. You never write code — you create two free
accounts and paste a few values.

---

## What's in this folder

- `server/` — the backend that runs on Railway (login + your saved data).
- `web/` — the dashboard that runs on Netlify. `web/index.html` is the whole app.

---

## Part 1 — Put this project on GitHub (so updates deploy automatically)

1. Create a free account at **github.com** if you don't have one.
2. Make a new **private** repository called `mob-hq`.
3. Upload this entire folder to it (GitHub's web uploader works — drag the `server` and `web`
   folders in), or use GitHub Desktop.

> Why GitHub: Railway and Netlify watch your repo, so any future change I make redeploys live
> automatically. This is the "updates live" part you asked about.

---

## Part 2 — Backend on Railway

1. Go to **railway.app** and sign in with GitHub.
2. **New Project → Deploy from GitHub repo →** pick `mob-hq`.
3. Open the created service → **Settings → Root Directory →** set it to `server` → save.
4. Add the database: in the project, **New → Database → Add PostgreSQL**. Railway creates it and
   provides `DATABASE_URL` automatically.
5. Open your **service → Variables** and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  *(references the database you just added)*
   - `JWT_SECRET` = a long random string (mash your keyboard for 40+ characters — this signs your login)
   - `FRONTEND_ORIGIN` = `*`  *(we'll tighten this in Part 4)*
6. **Settings → Networking → Generate Domain.** Copy the URL it gives you, e.g.
   `https://mob-hq-production.up.railway.app`. **This is your Backend URL** — you'll need it.
7. Test it: open `<your-backend-url>/api/health` in a browser. You should see
   `{"ok":true,"service":"mob-hq"}`.

---

## Part 3 — Frontend on Netlify

**Fastest way (no GitHub needed for this part):**
1. Go to **app.netlify.com/drop**.
2. Drag the **`web` folder** onto the page. Netlify gives you a live URL in ~30 seconds, e.g.
   `https://mob-hq.netlify.app`.

**Or, for auto-updates:** in Netlify, **Add new site → Import from GitHub →** pick `mob-hq`,
and set **Publish directory** to `web`.

---

## Part 4 — First login

1. Open your Netlify site.
2. In **Backend URL**, paste your Railway URL from Part 2, step 6.
3. Because it's brand new, a **"Create owner account"** button appears. Enter your email + a
   password (8+ characters) and click it. **This first account is the only one allowed** —
   registration locks afterward, so nobody else can sign up on your backend.
4. You're in. Connect an agent, add a business — everything now saves to the cloud.

**Recommended (tighten security):** back in Railway → service → Variables, change
`FRONTEND_ORIGIN` from `*` to your Netlify URL, then redeploy. This limits the backend to only
answer your own dashboard.

---

## Using it day to day

- **Any device:** open your Netlify site, it remembers your login. Log in once on your phone with
  the same Backend URL + email/password and you'll see the same data.
- **Sign out:** the "Log out" link in the sidebar, or Settings.
- **Reset to Day 0:** Settings → Reset workspace (clears your cloud data back to zero).
- The sidebar shows **"✓ Synced to cloud"** after each change so you know it saved.

---

## Costs

- **Netlify:** free tier is plenty for this.
- **Railway:** starts on a small monthly usage credit (~$5). A tiny backend + database like this
  sits at the low end. You only scale up later when the always-on agent workers run here.

---

## What's next (not built yet)

This is the cockpit and its cloud memory. The agents' **Connect** buttons currently flip status in
the dashboard — the real lead-finding / demo-building / outreach engines are the next build, and
those always-on workers are what Railway is really for. When we build them, they'll write their
results straight into this same database, and the dashboard's zeros turn into real numbers.
