# Explore Categories — Bento Redesign

**Status:** approved, ready for implementation planning
**Date:** 2026-09-07

## Goal

Make the homepage's "Explore Categories" section feel alive instead of dull,
without inflating what the directory actually contains.

## Why this is needed

The section is not under-styled. It already has gradient tiles, hover glow,
lift animation and emoji badges. The dullness is in what it says, and it
shows up in three ways.

**1. It is the only content section on the homepage with no images.**
Measured on the live page:

| Section | Images |
|---|---|
| Hero | 0 (professional chips) |
| A Local Standout | 1 |
| **Explore Categories** | **0** |
| Recently Listed | 6 |
| Popular Around Dahanu | 5 |
| What People Are Saying | 0 |

It is a flat band of emoji and numbers sitting directly between two
photo-rich sections, so it reads as dull by comparison as much as on its own.

**2. Every tile says nearly the same small number.** The ten tiles currently
render 5, 4, 4, 4, 4, 4, 3, 3, 3, 3. Ten near-identical cards, each
advertising a low count. The section's cumulative message to a first-time
visitor is that the directory is nearly empty.

**3. The subhead promises a shape the grid does not deliver.** "One clear
place to jump into food, shops, services, health and more" implies a handful
of broad doors. The grid shows ten of the twenty-eight granular live
categories — Arts & Crafts, Freelancers & Digital, Financial Services.

## The key insight

`LISTING_CATEGORY_GROUPS` in `src/lib/listing-category.ts` **already exists**:
twelve hand-tuned groups, each with a label and an icon, currently used only
to build `<optgroup>` elements in form dropdowns. All 64 approved listings map
into it cleanly.

Rolling the live counts up through those existing groups changes what the
section can say, using nothing but grouping — no inflation:

| | Tiles rendered |
|---|---|
| Today | 5, 4, 4, 4, 4, 4, 3, 3, 3, 3 |
| Grouped | 17, 8, 6, 6, 5, 5 |

"Food & Dining — 17 places" is a materially more inviting tile than
"Restaurants — 4 businesses", and it is what the existing subhead already
promises.

## Verified production data

Counts and photo coverage per group, at time of writing:

| Group | Listings | With photo |
|---|---|---|
| 🍽️ Food & Dining | 17 | 16 |
| 🛒 Shopping & Retail | 8 | 7 |
| 🏥 Health & Wellness | 6 | 6 |
| 💻 Digital & Creative | 6 | 6 |
| 🎨 Arts & Crafts | 5 | 5 |
| 🛠️ Home Services | 5 | 5 |
| 🎉 Events & Entertainment | 5 | 5 |
| 📚 Education & Sports | 4 | — |
| 💰 Money & Community | 4 | — |
| 🚕 Transport & Connectivity | 2 | — |
| 🏪 Other | 2 | — |
| 🏨 Hospitality & Stay | **0** | — |

Photo coverage was measured only for the groups eligible to display; a dash
means not measured, not zero.

Overall: 61 of 64 approved listings carry an image. Every group eligible for
display has at least five photo-bearing listings, so the photo mosaic cannot
render empty.

## Design

### Layout — a bento, not a uniform grid

Six tiles with deliberate size variation, replacing ten identical squares.
Food & Dining takes the wide tile because it genuinely holds 17 of 64
listings; today a group of 5 looks identical to a group of 3, which throws
away the one signal worth showing.

Desktop (4 columns):

```
┌─────────────────────┬──────────┬───────────┐
│  🍽️ Food & Dining   │ 💻 Digital│ 🏥 Health │
│     17 places       │ 6 places │ 6 places  │
│  [●][●][●] +14      │ [●][●]   │ [●][●]    │
├──────────┬──────────┼──────────┴───────────┤
│ 🛒 Shop   │ 🎨 Arts  │ 🎉 Events            │
│  8 places │ 5 places │ 5 places             │
├───────────┴──────────┴──────────────────────┤
│  Browse all 28 categories →                 │
└─────────────────────────────────────────────┘
```

Six group tiles, plus a full-width link out. Applying the count sort and the
label tiebreak below, the six that render today are:

| Slot | Group | Count |
|---|---|---|
| 1 | 🍽️ Food & Dining | 17 |
| 2 | 🛒 Shopping & Retail | 8 |
| 3 | 💻 Digital & Creative | 6 |
| 4 | 🏥 Health & Wellness | 6 |
| 5 | 🎨 Arts & Crafts | 5 |
| 6 | 🎉 Events & Entertainment | 5 |

Home Services (5) is the first group cut — it loses the three-way tie at 5 on
label order. This list is data-driven and will change as listings are added;
it is recorded here so the implementer can check their output against it.

Mobile: two columns, Food & Dining spanning both.

### Tile contents

- The group icon from `LISTING_CATEGORY_GROUPS`
- The group label
- A count phrased **"17 places"**, not "17 businesses" — shorter and warmer
- Two or three overlapping circular business thumbnails, plus a `+N` when the
  group holds more. This is the change that finally puts photographs in the
  one section that has none.

A mosaic of small circular thumbnails is deliberately **not** a card rail.
"Recently Listed" and "Popular Around Dahanu" directly below are already
business-card rails; a third would make the page repetitive rather than
alive.

### Which groups appear

The top six by live listing count, **excluding any group with zero
listings**. Hospitality & Stay currently has none — rendering a "0 places"
tile would worsen the exact problem this work exists to fix.

Two ties occur in the current data. Health & Wellness and Digital & Creative
are both on 6, and three groups sit on 5 (Arts & Crafts, Events &
Entertainment, Home Services) competing for two remaining slots. Ties break by
group label ascending, so the section does not reshuffle between renders for
no reason.

### Which businesses supply the thumbnails

Up to three per group: listings in that group that have an image, ordered by
rating descending, then review count descending, then id ascending. Highest
rated first puts the best face forward; the id tiebreak keeps the choice
stable across renders.

A listing with no image is never selected. If a group somehow has fewer than
two photo-bearing listings, the tile renders its icon alone rather than a
lopsided mosaic — no broken image, no empty circle.

### Data

Extend `getHomeStats` in `src/lib/data/home.ts`. It already computes category
counts inside the cached homepage query, so group rollups and thumbnails come
from the same cached call — no new fetch on page render, and the existing
homepage cache tag continues to govern freshness.

### Click destination — expand in place

Clicking a group tile expands it to reveal that group's live member
categories as chips (for Food & Dining: Restaurants 4, Homemade Food 4,
Bakers & Sweets 4, Farms & Organic 3, Cafe 2), each linking to the category
page that already exists. Empty member categories are not shown.

This is chosen over a `/listings/group/[slug]` route deliberately. The
unresolved half of the site's AdSense "low value content" diagnosis was thin
auto-generated pages. A group route would add twelve more listing pages
duplicating content already on the category pages, including near-empty ones
(Transport & Connectivity 2, Hospitality & Stay 0) — the precise pattern that
was flagged. Expanding in place adds **zero new URLs and zero duplicate
content**.

The section keeps a single "Browse all 28 →" link to `/listings`.

## Out of scope

- A `/listings/group/[slug]` route, and pre-filtering `/listings` by group.
  Reconsider only if analytics show the two-step expand is costing clicks.
- Changing `LISTING_CATEGORY_GROUPS` membership or adding categories.
- The other homepage sections.
- The existing per-category pages, and the wider thin-page problem. This work
  is careful not to add to it, but does not fix it.

## Testing

- **Pure functions** — the group rollup and the top-six-with-tiebreak
  selection are pure and get `node:test` coverage via `tsx --test`, added to
  the explicit list in `package.json` (the runner does not glob). Cases: a
  zero-count group is excluded; ties break by label; a group with one
  photo-bearing listing yields no mosaic; counts sum correctly.
- **Rendering** — verified in the browser against production data: six tiles,
  Food & Dining wide and reading "17 places", every tile showing at least two
  thumbnails, no broken images, expand revealing correct member categories,
  and mobile at 375px showing Food & Dining full-width.
- No migrations. This work reads existing data only.
