# OurDahanu — Mobile/App Backend Guide

This backend now serves a native app (Expo/React Native) alongside the website.
The same Next.js + Supabase project is the backend; nothing is forked.

## Authentication

The app authenticates **directly with Supabase Auth** (`@supabase/supabase-js`)
and sends the resulting access token to this backend.

- Sign in with Supabase Google OAuth (in-app browser / native Google sign-in),
  store the session in secure storage.
- For every request to `/api/*`, send `Authorization: Bearer <access_token>`.
- Server-side, `src/lib/supabase/server.ts` `createClient()` is **dual-auth**: it
  uses the Bearer token when present (RLS resolves the app user) and falls back
  to cookies for the website. Existing actions/routes work for both.

## Two ways the app talks to the backend

**1. Supabase directly (preferred for reads + simple writes).** RLS is the
contract — use `supabase-js` from the app for: auth, storage uploads, and
listings/jobs/events/news/search reads, profile, favourites, reviews, Q&A, poll
votes, RSVPs. Share `src/lib/database.types.ts` for typed models.

**2. `/api/v1/*` (for server-secret / service-role flows).** Bearer auth, JSON
in/out, CORS enabled.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/me` | Signed-in user + profile |
| POST | `/api/v1/orders` | Finalize a product order after payment (wraps `placeOrder`) |
| POST | `/api/v1/appointments` | Book/finalize an appointment (wraps `bookAppointment`) |
| POST/DELETE | `/api/v1/devices` | Register / unregister a push token |
| POST | `/api/razorpay/create-*-order` | Create a Razorpay order (bearer-aware) |

### Quick-commerce delivery
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/delivery/shops` | Delivery-enabled shops (public) |
| POST | `/api/v1/delivery/quote` | Serviceability + fee for a drop pin `{ listingId, lat, lng, itemsTotalPaise }` |
| POST | `/api/v1/delivery/orders` | Place order (COD or online finalize) |
| GET | `/api/v1/delivery/orders/[id]` | Live tracking (status + rider location) |
| PATCH | `/api/v1/delivery/orders/[id]` | `{ action: 'rate'|'cancel', rating? }` |
| POST | `/api/razorpay/create-delivery-order` | Create Razorpay order for an online delivery cart |

### Rider
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/rider` | Rider profile + current offers/active delivery |
| POST | `/api/v1/rider` | `{ action }`: `apply` / `online` / `ping` / `accept` / `decline` / `picked_up` / `out` / `delivered` |

Store catalogs (products) are read directly from Supabase via RLS — no endpoint needed.

Unauthenticated → `401 {"error":"Unauthorized"}`. Validation → `400`.

## Payment flow (orders & appointments)

1. App `POST /api/razorpay/create-product-order` (or appointment/job) with Bearer
   → `{ orderId, amount, currency, keyId }`.
2. App opens the **Razorpay React Native SDK** checkout with `orderId`.
3. On success, app `POST /api/v1/orders` (or `/appointments`) with the payment
   response + order fields → server verifies the signature, records the captured
   intent, and inserts the row (service-role). Returns `{ orderId }` /
   `{ appointmentId }`.

## Remaining external setup (cannot be done from code)

- **Native OAuth redirect:** in the Supabase dashboard → Auth → URL config, add
  the app deep link (e.g. `ourdahanu://auth-callback`) to *Additional Redirect
  URLs*.
- **Push send:** `device_tokens` + registration endpoint exist; wire an Expo Push
  / FCM / APNs sender from the notification-creation paths (`notifications.ts`)
  using stored tokens. Needs Expo/FCM credentials.
- **Rate limiting at scale:** `src/lib/rate-limit.ts` is in-memory (per instance);
  move to Upstash Redis for global limits once the public API has real traffic.
- **Input validation:** consider zod schemas at the `/api/v1` boundary.

## Regenerating types

Run the Supabase `generate_typescript_types` tool and overwrite
`src/lib/database.types.ts`.
