# AdSense Thin-Content Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conditional `noindex` (computed live from existing data, no stored flag) to the auto-generated pages that read as thin/doorway content to search engines — category pages with under 3 entries, and Find professional profiles with no note, no ratings, and no linked business — and keep `sitemap.ts` consistent with whatever is marked noindex.

**Architecture:** A single shared module (`src/lib/seo-thresholds.ts`) defines the one threshold number and the one "is this profile indexable" predicate. Three page files (`listings/category/[slug]`, `find/c/[slug]`, `find/p/[id]`) import from it to decide their own `robots` metadata. `sitemap.ts` imports the same two things so it can never list a URL that contradicts what that URL's own page says about itself.

**Tech Stack:** Next.js 16 App Router (`generateMetadata`, `MetadataRoute.Sitemap`), Supabase (public/anon client, no schema changes — this plan is read-only against the database).

## Global Constraints

- No test framework in this project — every task's verification is `npx tsc --noEmit` (whole project, no path scoping), `npx eslint <files>`, and for the sitemap task, `npm run build` plus live/dev-server verification against the real database.
- Zero visual or functional change for site visitors — every affected page must keep rendering exactly as it does today. Only `robots` meta tags and sitemap presence change.
- No auto-generated filler text anywhere in this plan.
- The three places that decide "is this indexable" (both category pages, the profile page) and the one place that must agree with them (`sitemap.ts`) must all import the same constant/predicate from `src/lib/seo-thresholds.ts` — never duplicate the number `3` or the note/rating/business logic inline in more than one file.
- The Supabase project (`slmbqngmxketyxjauxxk`) is LIVE PRODUCTION, but this plan makes no database writes — only additional `select` queries in `sitemap.ts`.

---

### Task 1: Shared threshold + predicate module

**Files:**
- Create: `src/lib/seo-thresholds.ts`

**Interfaces:**
- Produces: `MIN_CATEGORY_SIZE: number` — consumed by Task 2 (both category pages) and Task 3 (`sitemap.ts`).
- Produces: `isProfileIndexable(pro: { note: string | null; rating_count: number; business: unknown | null }): boolean` — consumed by Task 2 (`find/p/[id]/page.tsx`, passing its real `ProfessionalWithStats` object) and Task 3 (`sitemap.ts`, passing a same-shaped stand-in object built from its own raw query columns).

- [ ] **Step 1: Create the file**

```ts
/**
 * Shared rules for whether an auto-generated page has enough real content to
 * be worth indexing. Both category pages, the Find profile page, and
 * sitemap.ts import from here so none of them can silently drift out of sync
 * with each other — a page that says `noindex` on itself must also be
 * missing from the sitemap, and vice versa.
 */

// A category landing page (business category or Find profession) needs at
// least this many entries before it reads as a real category rather than a
// near-empty doorway page.
export const MIN_CATEGORY_SIZE = 3

/**
 * A Find professional profile is "indexable" once it has at least one of:
 * a written note, an approved rating, or a linked (verified) business page.
 * Profiles with none of these are just a name/phone/profession/locality
 * card — real, but not enough unique content to be worth search-indexing.
 */
export function isProfileIndexable(pro: {
  note: string | null
  rating_count: number
  business: unknown | null
}): boolean {
  return Boolean(pro.note?.trim()) || pro.rating_count > 0 || Boolean(pro.business)
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/seo-thresholds.ts`
Expected: no errors (this module isn't consumed by anything yet, so this just confirms the file itself is syntactically valid).

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo-thresholds.ts
git commit -m "feat(seo): add shared thin-content threshold and predicate"
```

---

### Task 2: Apply the threshold/predicate to the three page files

**Files:**
- Modify: `src/app/listings/category/[slug]/page.tsx`
- Modify: `src/app/find/c/[slug]/page.tsx`
- Modify: `src/app/find/p/[id]/page.tsx`

**Interfaces:**
- Consumes: `MIN_CATEGORY_SIZE`, `isProfileIndexable` from `src/lib/seo-thresholds.ts` (Task 1).

- [ ] **Step 1: `src/app/listings/category/[slug]/page.tsx`**

Add the import (alongside the existing `@/lib/listing-category` import):

```ts
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
```

In `generateMetadata`, the current code (after the `!category` early-return branch) is:

```ts
  const directory = await getListingsDirectoryData(category)
  const listingCount = directory.listings.length

  return {
    title: `${category} in Dahanu`,
    description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
    keywords: [
      `${category} in Dahanu`,
      `${category} near Dahanu`,
      `${category} OurDahanu`,
      `Dahanu ${category}`,
    ],
    alternates: {
      canonical: getCategoryPath(category),
    },
    openGraph: {
      title: `${category} in Dahanu`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
      url: getCategoryPath(category),
      type: 'website',
      images: [{ url: 'https://ourdahanu.in/logo.png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category} in Dahanu`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
      images: ['https://ourdahanu.in/logo.png'],
    },
  }
```

Change the closing of the returned object so it ends with the new conditional `robots` field (everything above `alternates` stays exactly as-is — only the object's tail changes):

```ts
    twitter: {
      card: 'summary_large_image',
      title: `${category} in Dahanu`,
      description: `Browse ${listingCount} ${category.toLowerCase()} business${listingCount === 1 ? '' : 'es'} in Dahanu, Bordi, and Gholvad on OurDahanu.`,
      images: ['https://ourdahanu.in/logo.png'],
    },
    ...(listingCount < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
  }
```

- [ ] **Step 2: `src/app/find/c/[slug]/page.tsx`**

Add the import (alongside the existing `@/lib/find/professions` import):

```ts
import { MIN_CATEGORY_SIZE } from '@/lib/seo-thresholds'
```

In `generateMetadata`, change:

```ts
    // Don't index a category page with nobody in it yet.
    ...(count === 0 ? { robots: { index: false, follow: true } } : {}),
```

to:

```ts
    // Don't index a category page that doesn't yet look like a real category.
    ...(count < MIN_CATEGORY_SIZE ? { robots: { index: false, follow: true } } : {}),
```

- [ ] **Step 3: `src/app/find/p/[id]/page.tsx`**

Add the import (alongside the existing `@/lib/text` import):

```ts
import { isProfileIndexable } from '@/lib/seo-thresholds'
```

In `generateMetadata`, the current return statement is:

```ts
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', siteName: 'FindDahanu' },
    twitter: { card: 'summary', title, description },
  }
```

Change it to:

```ts
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', siteName: 'FindDahanu' },
    twitter: { card: 'summary', title, description },
    ...(isProfileIndexable(pro) ? {} : { robots: { index: false, follow: true } }),
  }
```

(`pro` here is the `ProfessionalWithStats` object already fetched earlier in the same function via `getProfessionalById(id)` — it already has `note`, `rating_count`, and `business`, so it can be passed to `isProfileIndexable` directly with no reshaping.)

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint "src/app/listings/category/[slug]/page.tsx" "src/app/find/c/[slug]/page.tsx" "src/app/find/p/[id]/page.tsx" src/lib/seo-thresholds.ts`
Expected: no errors.

- [ ] **Step 5: Verify live against the database**

Query the live database to find one current example of each case (the specific rows may have changed since this plan was written, so re-query rather than assuming the exact IDs below):

```sql
-- one listing category with < 3 approved listings
select category, count(*) from listings where approved = true group by category having count(*) < 3 order by count(*) asc limit 1;

-- one listing category with >= 3 approved listings
select category, count(*) from listings where approved = true group by category having count(*) >= 3 order by count(*) desc limit 1;

-- one Find profession with < 3 approved+active professionals
select prof, count(*) from (select unnest(professions) as prof from find_professionals where status='approved' and is_active=true) t where prof <> 'Other' group by prof having count(*) < 3 order by count(*) asc limit 1;

-- one Find profession with >= 3 approved+active professionals
select prof, count(*) from (select unnest(professions) as prof from find_professionals where status='approved' and is_active=true) t where prof <> 'Other' group by prof having count(*) >= 3 order by count(*) desc limit 1;

-- one "truly bare" Find profile (no note, no approved rating, no linked business)
select id, name from find_professionals
where status='approved' and is_active=true
  and (note is null or length(trim(note)) = 0)
  and business_listing_id is null
  and id not in (select professional_id from find_ratings where status='approved')
limit 1;

-- one Find profile that has a note or a rating (should stay indexable)
select id, name from find_professionals
where status='approved' and is_active=true
  and ((note is not null and length(trim(note)) > 0) or id in (select professional_id from find_ratings where status='approved'))
limit 1;
```

Start the dev server (`npm run dev`) and, for each of the 6 rows above, fetch the corresponding page and check its rendered `<meta name="robots">` tag:

- `/listings/category/<slug-for-the-thin-category>` → expect `noindex, follow`
- `/listings/category/<slug-for-the-3-plus-category>` → expect `index, follow` (or no robots tag at all, which defaults to indexable)
- `/find/c/<slug-for-the-thin-profession>` → expect `noindex, follow`
- `/find/c/<slug-for-the-3-plus-profession>` → expect `index, follow`
- `/find/p/<bare-profile-id>` → expect `noindex, follow`
- `/find/p/<content-profile-id>` → expect `index, follow`

Also spot-check that each page's visible content and layout are unchanged from before this task (a thin category page still shows its normal "No X yet" empty state or its listings, a bare profile still renders its normal contact card and call-to-action) — this task must not alter what a visitor sees.

- [ ] **Step 6: Commit**

```bash
git add "src/app/listings/category/[slug]/page.tsx" "src/app/find/c/[slug]/page.tsx" "src/app/find/p/[id]/page.tsx"
git commit -m "feat(seo): noindex thin category pages and bare Find profiles"
```

---

### Task 3: Keep sitemap.ts consistent with the noindex rules

**Files:**
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `MIN_CATEGORY_SIZE`, `isProfileIndexable` from `src/lib/seo-thresholds.ts` (Task 1).

- [ ] **Step 1: Add the import**

Alongside the existing `@/lib/find/professions` import:

```ts
import { MIN_CATEGORY_SIZE, isProfileIndexable } from '@/lib/seo-thresholds'
```

- [ ] **Step 2: Filter the listing category routes by count**

The current code is:

```ts
    const categoryRoutes: MetadataRoute.Sitemap = [...new Set(sitemapListings.map((listing) => listing.category).filter(Boolean))]
      .sort((a, b) => compareStableText(a as string, b as string))
      .map((category) => ({
        url: getCategoryUrl(category as string),
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))
```

Replace it with:

```ts
    const listingCategoryCounts = new Map<string, number>()
    for (const l of sitemapListings) {
      if (!l.category) continue
      listingCategoryCounts.set(l.category, (listingCategoryCounts.get(l.category) ?? 0) + 1)
    }

    const categoryRoutes: MetadataRoute.Sitemap = [...listingCategoryCounts.entries()]
      .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
      .map(([category]) => category)
      .sort((a, b) => compareStableText(a, b))
      .map((category) => ({
        url: getCategoryUrl(category),
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }))
```

- [ ] **Step 3: Expand the `find_professionals` query and add a ratings-existence query**

The current code is:

```ts
    const { data: professionals } = await supabase
      .from('find_professionals')
      .select('id, updated_at, professions')
      .eq('status', 'approved')
      .eq('is_active', true)

    const findRows = (professionals ?? []) as {
      id: string
      updated_at: string | null
      professions: string[] | null
    }[]
```

Replace it with:

```ts
    const { data: professionals } = await supabase
      .from('find_professionals')
      .select('id, updated_at, professions, note, business_listing_id')
      .eq('status', 'approved')
      .eq('is_active', true)

    const findRows = (professionals ?? []) as {
      id: string
      updated_at: string | null
      professions: string[] | null
      note: string | null
      business_listing_id: string | null
    }[]

    const { data: ratedRows } = await supabase
      .from('find_ratings')
      .select('professional_id')
      .eq('status', 'approved')

    const ratedProfessionalIds = new Set(
      ((ratedRows ?? []) as { professional_id: string }[]).map((r) => r.professional_id),
    )
```

- [ ] **Step 4: Filter the Find category routes by count, and the profile routes by indexability**

The current code is:

```ts
    // One category landing page per profession that actually has professionals.
    const categorySet = new Set<string>()
    for (const row of findRows) {
      for (const prof of row.professions ?? []) {
        if (prof !== 'Other' && isValidProfession(prof)) categorySet.add(prof)
      }
    }

    const findRoutes: MetadataRoute.Sitemap = [
      {
        url: 'https://find.ourdahanu.in/',
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...categorySet].map((prof) => ({
        url: `https://find.ourdahanu.in/c/${professionSlug(prof)}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...findRows.map((p) => ({
        url: `https://find.ourdahanu.in/p/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
```

Replace it with:

```ts
    // One category landing page per profession with enough professionals to
    // not read as thin/doorway content to search engines.
    const professionCounts = new Map<string, number>()
    for (const row of findRows) {
      for (const prof of row.professions ?? []) {
        if (prof !== 'Other' && isValidProfession(prof)) {
          professionCounts.set(prof, (professionCounts.get(prof) ?? 0) + 1)
        }
      }
    }
    const categorySet = new Set(
      [...professionCounts.entries()]
        .filter(([, count]) => count >= MIN_CATEGORY_SIZE)
        .map(([prof]) => prof),
    )

    // Only list profiles that would actually be indexable — mirrors the same
    // rule applied on the profile page itself (src/lib/seo-thresholds.ts).
    const indexableFindRows = findRows.filter((row) =>
      isProfileIndexable({
        note: row.note,
        rating_count: ratedProfessionalIds.has(row.id) ? 1 : 0,
        business: row.business_listing_id,
      }),
    )

    const findRoutes: MetadataRoute.Sitemap = [
      {
        url: 'https://find.ourdahanu.in/',
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily',
        priority: 0.8,
      },
      ...[...categorySet].map((prof) => ({
        url: `https://find.ourdahanu.in/c/${professionSlug(prof)}`,
        lastModified: STATIC_LAST_MODIFIED,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
      ...indexableFindRows.map((p) => ({
        url: `https://find.ourdahanu.in/p/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : STATIC_LAST_MODIFIED,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]
```

- [ ] **Step 5: Type-check, lint, and build**

Run: `npx tsc --noEmit && npx eslint src/app/sitemap.ts`
Expected: no errors.

Run: `rm -rf .next && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Verify live against the database**

Start the dev server (`npm run dev`) and fetch `/sitemap.xml`. Using the same 6 example rows/categories you found in Task 2 Step 5 (re-query if this is a fresh session and they've changed):

- The thin listing category's URL must **not** appear in the sitemap.
- The 3-plus listing category's URL **must** appear.
- The thin Find profession's `/c/<slug>` URL must **not** appear.
- The 3-plus Find profession's `/c/<slug>` URL **must** appear.
- The bare profile's `/p/<id>` URL must **not** appear.
- The content profile's `/p/<id>` URL **must** appear.

- [ ] **Step 7: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): exclude noindexed category/profile pages from sitemap.xml"
```

## Self-Review Notes

- **Spec coverage:** every requirement in the design doc (shared threshold module, both category pages, the profile page, all three sitemap.ts branches, no auto-generated filler, no visual change, live-data verification) maps to a task above.
- **Placeholder scan:** no TBD/TODO; every step shows the actual before/after code, and the verification SQL/steps are complete and runnable as written.
- **Type consistency:** `isProfileIndexable`'s parameter shape (`{ note: string | null; rating_count: number; business: unknown | null }`) is used identically in Task 2 (passing the real `ProfessionalWithStats` object, which has a superset of these fields) and Task 3 (passing a purpose-built stand-in object with the same three field names) — both satisfy the same signature without needing any casting.
