# MAIL MISSION — Setup Guide

## What you need (takes ~15 minutes)

1. **Node.js** installed → https://nodejs.org (download LTS)
2. **A Google Cloud account** (free) → to get Gmail API access
3. **An Anthropic API key** → for the AI brain

---

## Step 1 — Get your Google API credentials

1. Go to https://console.cloud.google.com
2. Click **"New Project"** → name it anything (e.g. "Mail Mission")
3. In the left menu → **APIs & Services** → **Library**
4. Search **"Gmail API"** → click it → click **Enable**
5. Go to **APIs & Services** → **OAuth consent screen**
   - Choose **External** → Fill in app name ("Mail Mission"), your email, save
   - Under **Scopes** → add: `gmail.readonly`, `userinfo.email`, `userinfo.profile`
   - Under **Test users** → add your Gmail address
6. Go to **APIs & Services** → **Credentials**
   - Click **+ Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: add `http://localhost:3000/auth/callback`
   - Click **Create** → copy the **Client ID** and **Client Secret**

---

## Step 2 — Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to **API Keys** → click **Create Key**
4. Copy it (you only see it once)

---

## Step 3 — Configure the app

1. In the project folder, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in:
   ```
   GOOGLE_CLIENT_ID=paste_your_client_id
   GOOGLE_CLIENT_SECRET=paste_your_client_secret
   REDIRECT_URI=http://localhost:3000/auth/callback
   ANTHROPIC_API_KEY=paste_your_anthropic_key
   SESSION_SECRET=any_long_random_string
   ```

---

## Step 4 — Install and run

```bash
npm install
npm start
```

Open your browser: **http://localhost:3000**

---

## Deploying online (so anyone can use it)

### Option A — Railway (easiest, free tier)
1. Go to https://railway.app → sign up with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Add environment variables (same as your `.env`) in Railway dashboard
4. Change `REDIRECT_URI` to your Railway URL, e.g.:
   `https://mail-mission-production.up.railway.app/auth/callback`
5. Add that same URL to Google Cloud → Credentials → Authorized redirect URIs

### Option B — Render (also free)
1. Go to https://render.com → New Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in Render dashboard

---

## Transferring ownership to someone else

Give them:
1. This project folder (zip it)
2. Tell them to follow this SETUP.md — they create their OWN Google credentials and Anthropic key
3. That's it — they own it completely, nothing is tied to your account

**Estimated monthly cost for buyer:** ~$5–10/month on Anthropic API for regular use. Google API is free.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `S` | Scan inbox |
| `ESC` | Close modal |
