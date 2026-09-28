# OurDahanu — Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com and create a free account
2. Click "New Project" → name it `ourdahanu`
3. Save your **Database Password**

## Step 2: Set Up Database

1. In Supabase Dashboard → go to **SQL Editor**
2. Copy the contents of `supabase/schema.sql` and run it
3. This creates all tables (profiles, products, events, listings, orders, reviews)

## Step 3: Enable Google Login

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google**
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Create a new project → APIs & Services → Credentials → OAuth 2.0 Client ID
5. Application type: **Web application**
6. Add Authorized redirect URI:
   - `https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret** back to Supabase

## Step 4: Set Environment Variables

Edit `.env.local` with your real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

Find these in: Supabase Dashboard → **Settings** → **API**

## Step 5: Deploy to Vercel

1. Push this project to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Add the 3 environment variables above in Vercel's settings
4. Deploy!

## Step 6: Update Supabase Auth URL

After deploying, in Supabase:
- **Authentication** → **URL Configuration**
- Set **Site URL** to your Vercel URL (e.g., `https://ourdahanu.vercel.app`)
- Add to **Redirect URLs**: `https://ourdahanu.vercel.app/auth/callback`

## Telegram notifications (optional)

Skip this entirely if you are not using Telegram — nothing else depends on it.

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy the token
   into `TELEGRAM_BOT_TOKEN`. Put the bot's @name in `TELEGRAM_BOT_USERNAME`.
2. Generate a secret and set it as `TELEGRAM_WEBHOOK_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```

   **This is required, not optional.** The webhook refuses every request when
   it is unset — it fails closed on purpose, so that a deployment which forgets
   it gets a loud 500 rather than a quietly open endpoint.

3. Register the webhook once, with the secret in the URL:

   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook"      -d "url=https://<your-domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>"
   ```

4. Confirm it is reachable and that the secret matches — this should return
   `{"ok":true,...}`, and a 401 without the query param:

   ```bash
   curl "https://<your-domain>/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>"
   ```

If you ever rotate the secret, set the new value **and** re-run `setWebhook`
with it. Changing only one of the two leaves Telegram posting to a URL the app
now rejects, and account linking stops working with no error visible to users.

## Local Development

```bash
npm run dev
```

Open http://localhost:3000

---

## Site Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page with all sections |
| Shop | `/shop` | Local products marketplace |
| Events | `/events` | Dahanu events listing |
| Listings | `/listings` | Business directory with paid plans |
| About | `/about` | Info, tourism, transport, emergency contacts |
| Login | `/login` | Google sign-in |
| Dashboard | `/dashboard` | User account (protected) |

## Listing Plans (Monetization)

- **Basic** — ₹499/month
- **Featured** — ₹999/month (homepage placement)
- **Premium** — ₹1999/month (full features)
