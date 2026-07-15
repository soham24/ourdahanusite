# Google AdSense Integration

**Date:** 2026-07-14
**Status:** Design approved — Phase 1 ready to implement

## Summary

Integrate Google AdSense across the OurDahanu main site using **manual ad units**, with **Google Consent Mode v2** + Google's certified **"Privacy & messaging"** CMP for EEA/UK compliance. Everything is **env-gated and inert** until the publisher ID is set in production, so the code ships now and activates after AdSense approval.

Real account details (confirmed in the AdSense console):
- Publisher / client ID: **`ca-pub-5445414669562535`**
- Site `ourdahanu.in` status: **"Requires review"** — needs the AdSense code live, then Verify → Request review.
- Verification snippet Google shows is the ad loader itself, so the loader doubles as ownership verification.

## Goals

- Get the verification code live on production so Google's review can start (approval is the long pole).
- Serve tasteful manual ad units on content-heavy surfaces once approved.
- Never load ads on dev/preview or before approval; no empty ad boxes.
- EEA/UK visitors get a compliant consent prompt; the local Dahanu audience is unaffected.

## Non-Goals (YAGNI)

- No auto ads (Google-placed) — manual units only, for layout control.
- No hand-built consent banner — the certified banner is Google's Privacy & messaging (console-enabled).
- No ads on the find subdomain, business subdomains, checkout/payments, login/auth, admin, or submit forms.

## Configuration (`src/lib/ads.ts`)

- `ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID` — `ca-pub-…`. Set in **Vercel Production only** (same pattern/rationale as `NEXT_PUBLIC_GA_ID`).
- Per-placement slot IDs, each its own env var (created in AdSense after approval):
  `NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE`, `_SLOT_LISTING`, `_SLOT_LISTINGS_FEED`, `_SLOT_HOME`, `_SLOT_JOBS`, `_SLOT_FORUM`, `_SLOT_CLASSIFIEDS`.
- `adsEnabled()` helper: true only when `ADSENSE_CLIENT_ID` is set **and** running in production (`process.env.VERCEL_ENV === 'production'`, falling back to `NODE_ENV`). Loader, meta tag, and every slot gate on this.
- A slot renders only when `adsEnabled()` **and** its own slot ID is set → no broken/empty units before slots are configured.

## Phase 1 — Verification + loader + consent (ship first)

Unblocks Google's review. Ads won't render yet (no slots configured), but ownership verifies and the review clock starts.

1. **Loader** — the AdSense script in the document `<head>` via the App Router (verify exact mechanism against `node_modules/next/dist/docs/`; use `next/script` `afterInteractive` and/or a raw head tag). Gated on `adsEnabled()`.
2. **Verification meta tag** — `<meta name="google-adsense-account" content="ca-pub-5445414669562535">` in `<head>` via the Next metadata API (`metadata.other`), gated on `adsEnabled()`. Belt-and-suspenders so ownership verification is reliable on Next.
3. **`ads.txt`** — a route at `src/app/ads.txt/route.ts` returning `google.com, pub-5445414669562535, DIRECT, f08c47fec0942fa0` (derived from the client ID). Must be reachable at the ad-serving host root; confirm `proxy.ts` doesn't rewrite `/ads.txt` away on the relevant hosts.
4. **Consent Mode v2 defaults** — an inline `gtag('consent', 'default', …)` set **before** GA and the AdSense loader fire, denying `ad_storage` / `ad_user_data` / `ad_personalization` / `analytics_storage` for EEA/UK regions (region-scoped), granted elsewhere. The certified banner (Google Privacy & messaging, enabled by the user in the AdSense console) updates consent on user choice.

## Phase 2 — Manual ad units (after Phase 1)

**`<AdSlot>` client component** — one reusable unit. Props: `slot` (env-driven slot ID), `format` (`in-article` | `in-feed` | `display`), `className`. Renders `<ins class="adsbygoogle">`, pushes `(window.adsbygoogle = window.adsbygoogle || []).push({})` on mount, re-pushes on client-side navigation, returns `null` when unconfigured, and shows a small muted "Advertisement" label above the unit (policy + honest UX).

**Placements (broad):**
- News/article detail — in-article unit in the body
- Listing detail — one in-body display unit
- `/listings` index — one in-feed unit within the card grid
- Homepage — one unobtrusive display unit in a contained section
- Jobs / Forum / Classifieds — one display unit each

## Error Handling / Safety

- `adsEnabled()` false (dev, preview, or ID unset) → no loader, no meta tag, empty `ads.txt`, all slots render `null`. Zero visual/behavioral change from today.
- `AdSlot` guards against duplicate pushes and missing `adsbygoogle` global.

## Verification / Testing

No test framework — `npx tsc --noEmit` + `npm run build` + live checks:
- **Unset (default dev):** page renders with no AdSense script/meta/slots; `ads.txt` empty; no layout change.
- **Dummy client ID** in a local prod-like build (never the real ID in dev): loader + meta tag present in `<head>`, `ads.txt` emits the line, `<AdSlot>` renders `<ins>` in the right spots.
- The **real** ID (`ca-pub-5445414669562535`) is only ever set in Vercel Production via env — never committed, never used in dev/preview.

## User (owner) steps — cannot be done by the assistant

1. Set `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-5445414669562535` in **Vercel Production**, redeploy.
2. In the AdSense console: **"I've placed the code" → Verify → Request review**.
3. Enable **Privacy & messaging** (GDPR message / Funding Choices) in the AdSense console.
4. After approval: create ad units, then set each `NEXT_PUBLIC_ADSENSE_SLOT_*` env var to its slot ID and redeploy.
