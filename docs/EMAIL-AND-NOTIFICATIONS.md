# Email and notifications

Everything the site tells people — "your listing is live", "new order",
"appointment tomorrow" — goes through one engine in `src/lib/notifications/`.
This page explains what it sends, through which providers, and how to set
each provider up.

You can skip all of it at first. With no providers configured, notifications
still appear **in the app** (the bell icon); the other channels simply stay
quiet.

---

## How it works

One call — `sendNotification(userId, type, payload)` — renders the message
from `templates.ts` and delivers it on every channel that person has switched
on:

| Channel | Provider | Needs setup | Reaches |
|---|---|---|---|
| In-app | Supabase Realtime | Nothing | The bell icon, live, while the person is on the site |
| Email | [Resend](https://resend.com) | API key + a verified domain | The address they sign in with |
| Telegram | Your own Telegram bot | Bot token + webhook | People who linked Telegram on `/account/notifications` |
| WhatsApp | Meta WhatsApp Cloud API | Meta app + an approved template | The phone number on their profile |

### Who chooses the channels

Each person, on **`/account/notifications`**. They can turn each channel on or
off and mute individual kinds of message. Until they change anything:

- **In-app:** on
- **Email:** on
- **WhatsApp:** on (but only a few messages have a WhatsApp version — see below)
- **Telegram:** off until they link their account

### What gets sent, and to whom

| Event | Who hears about it |
|---|---|
| A listing is approved, rejected, or about to expire | The business owner |
| A new review | The business owner |
| The owner replies to a review | The reviewer, and admins |
| An order is placed | The buyer, the business owner, and admins |
| An order is fulfilled or cancelled | The buyer |
| An appointment is booked, cancelled, or coming up (daily 09:00 IST reminder) | The customer and the business owner |
| A job post is approved, rejected, or about to expire | The person who posted it |
| A business's online selling is paused or resumed | The business owner |
| Something new needs review (listing, job, professional…) | Admins |

"Admins" means every account whose profile `role` is `admin` — the first one
is whoever signs in with `ADMIN_EMAIL`.

Delivery never blocks or breaks the action that caused it: if a provider is
down or misconfigured, the error is logged on the server and the order, booking
or approval goes through anyway.

---

## Email — Resend

Email is sent through Resend's API. Besides notifications it carries three
other messages: the "your listing is live" email an admin sends on approval,
the newsletter welcome email, and newsletters an admin sends from the admin
panel.

### Set it up

1. Create an account at [resend.com](https://resend.com). The free plan is
   enough for a small town — check Resend's pricing page for the current
   daily and monthly limits.
2. **Verify your domain** (Resend → Domains → Add domain). Resend shows a few
   DNS records (SPF, DKIM, and optionally DMARC); add them where your domain's
   DNS is managed — on Vercel if you followed SETUP step 6. Verification
   usually takes minutes, sometimes longer.
3. Create an API key (Resend → API Keys, "Sending access" is enough) and set
   it as `RESEND_API_KEY` in `.env.local` and in Vercel.

Mail is sent **from `hello@<your domain>`**, built from `siteConfig.domain`.
That address does not need a mailbox, but its domain **must be verified in
Resend**.

### When email does not arrive

- **Domain not verified** is the usual cause. The site does not surface
  Resend's error to anyone — the email is simply not sent — so check
  Resend → **Logs**, which shows every attempt and why it failed.
- On Resend's free plan without a verified domain you can only send to your
  own account's address. That is useful for a first test, not for real users.
- Check the person has email switched on at `/account/notifications`.

---

## Telegram

Good for business owners who want instant alerts on their phone. Each person
links their own Telegram account; nothing is sent to anyone who has not.

### Set it up

1. In Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`,
   and follow the prompts. You get a **token**.
2. Set `TELEGRAM_BOT_TOKEN` to the token and `TELEGRAM_BOT_USERNAME` to the
   bot's username (without the `@`).
3. Set `TELEGRAM_WEBHOOK_SECRET` to a long random string and register the
   webhook — the exact commands are in [SETUP.md](../SETUP.md#telegram-notifications-optional).
   The webhook is how the bot learns who is linking: without it, "Connect
   Telegram" opens the bot but the link never completes.

### How a person links

On `/account/notifications` they press **Connect Telegram**, which opens your
bot with a one-time code. They press **Start**; the bot receives the code
through the webhook and stores their chat id. From then on, everything they
have switched on also arrives in Telegram.

Leave `TELEGRAM_USER_BOT_TOKEN` empty. It is an older name for the same
token, read only when `TELEGRAM_BOT_TOKEN` is unset; linking and delivery
always use one bot, so the chat a person linked is the chat that gets messages.

---

## WhatsApp — Meta Cloud API

WhatsApp only delivers **pre-approved message templates** to people who have
not messaged you first, so it is used sparingly. Today **one** message has a
WhatsApp version: **"your listing is approved"**, sent to the business owner.
Everything else goes by the other channels.

It is also the most work to set up, and Meta charges per template message
(see Meta's WhatsApp pricing for your country). Skip it unless your town's
businesses really live on WhatsApp.

### Set it up

1. At [developers.facebook.com](https://developers.facebook.com) create an app
   (type **Business**) and add the **WhatsApp** product.
2. In WhatsApp → API Setup, note the **Phone Number ID** → set
   `WHATSAPP_PHONE_NUMBER_ID`.
3. Create a **permanent token**: Meta Business Settings → System Users → add a
   user → Generate token with the `whatsapp_business_messaging` permission →
   set `WHATSAPP_ACCESS_TOKEN`. (The token on the API Setup page expires in a
   day.)
4. Create the message template in WhatsApp Manager → Message templates:
   - **Name:** `listing_approved_notice` (exactly)
   - **Category:** Utility · **Language:** English
   - **Body**, with two variables — the listing name and its link:

     ```
     🎉 Great news! Your listing *{{1}}* is now live on <your site name>!

     Customers can now find you at:
     {{2}}

     Share this link with your customers!
     ```

   Wait for Meta to approve it before testing.

Messages go to the phone number on the owner's profile. Numbers are read as
Indian: ten digits get `91` added, and a number that does not look Indian is
skipped. If your town is in another country, change `formatWhatsAppPhone` in
`src/lib/whatsapp.ts`.

> `src/lib/whatsapp.ts` also describes two expiry templates
> (`listing_expiry_reminder`, `listing_expired_notice`). Nothing sends them
> today — expiry reminders go by email, in-app and Telegram — so you do not
> need to create them.

---

## In-app notifications

No setup. They are rows in the `notifications` table, and the bell updates
live through Supabase Realtime (the baseline migration adds the table to the
`supabase_realtime` publication). If the bell never updates without a page
reload, check in Supabase → Database → Publications that `notifications` is
in `supabase_realtime`.

---

## Checking it all works

Sign in as your admin and create a listing, then approve it from the admin
panel. The owner (you) should get the approval:

- in the bell — immediately;
- by email — if Resend is set up (otherwise see Resend → Logs);
- in Telegram — if you linked it;
- on WhatsApp — if the template is approved and your profile has a phone
  number.

`npm run doctor` also checks each provider's configuration from your
`.env.local` — see [SETUP.md](../SETUP.md).
