# Guides content

Editorial articles for `/guides`. Plain markdown, one file per article, rendered by
`src/lib/guides.ts`.

## Publishing an article

Articles are **unpublished by default**. Set the frontmatter flag only after the
facts have been checked:

```
published: true
```

Anything else — `false`, missing, or malformed — keeps the article off the site
entirely: no page, no index entry, no sitemap URL. The slug 404s. This is
deliberate: publishing an unverified article is worse than publishing nothing,
because wrong local detail (a fare, a timing, a price) is exactly what makes a
reader stop trusting the whole site.

## Frontmatter

```yaml
---
title: "Article title"           # required
slug: article-slug               # required — becomes /guides/article-slug
description: "One-line summary"  # used for meta description and card text
date: 2026-08-03                 # sorts the index, newest first
category: Travel                 # groups related links at the foot of articles
published: false                 # opt in explicitly, see above
---
```

`title` and `slug` are required; without either the file is skipped.

## Author-only sections

Everything from a `## ⚠️ …` or `## SEO` heading to the end of the file is cut
before rendering. That's where fact-check lists and SEO scratch live — write
freely there, it never reaches a reader.

The leading `# H1` is also stripped, because the page renders the title from
frontmatter.

## Writing notes

- Tables get a horizontal scroll wrapper automatically, so wide ones won't push
  the page sideways on a phone.
- Don't pad. These pages exist to be genuinely useful; length added for its own
  sake is the thing Google calls thin content.
- If a fact isn't known, say so in the article and tell the reader where to
  check. That reads as honest and is more useful than a number that might be
  stale.

## Adding a new article

1. Drop a `.md` file in this directory with the frontmatter above
2. Leave `published: false` while drafting
3. Verify the facts
4. Flip to `published: true`

No code changes needed — the route, index, sitemap entry and `Article` schema
are all generated from the file.
