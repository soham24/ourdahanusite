import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { marked, Renderer } from 'marked'

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides')

/**
 * These guides lean on tables (fares, costs, comparisons). A bare <table>
 * forces the whole page to scroll sideways on a phone, so each one gets its
 * own horizontally scrollable wrapper — the styling hook is
 * `.od-guide-prose .od-table-scroll` in globals.css.
 */
const renderer = new Renderer()
const renderTable = renderer.table.bind(renderer)
renderer.table = (token) => `<div class="od-table-scroll">${renderTable(token)}</div>`

/**
 * Everything from this heading onward is working notes for the author —
 * open questions, fact-check lists, SEO scratch. It must never reach a
 * reader, so the body is cut here before any rendering happens.
 */
const DRAFT_SECTION_MARKER = /^##\s+(⚠️|SEO\b)/m

export interface Guide {
  slug: string
  title: string
  description: string
  category: string
  date: string
  published: boolean
  /** Markdown body, already stripped of author-only sections. */
  body: string
  /** Rendered HTML of `body`. */
  html: string
  readingMinutes: number
}

type Frontmatter = Record<string, string>

/**
 * Minimal frontmatter reader. The format here is fixed and repo-owned
 * (`key: value`, optionally quoted), so a full YAML parser would be a
 * dependency bought for nothing.
 */
function splitFrontmatter(raw: string): { data: Frontmatter; body: string } {
  const normalised = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  if (!normalised.startsWith('---\n')) return { data: {}, body: normalised }

  const end = normalised.indexOf('\n---', 4)
  if (end === -1) return { data: {}, body: normalised }

  const data: Frontmatter = {}
  for (const line of normalised.slice(4, end).split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    if (!key) continue

    let value = line.slice(colon + 1).trim()

    const quoted = value.match(/^["'](.*)["']\s*$/)
    if (quoted) {
      value = quoted[1]
    } else {
      // Strip a trailing `# comment`. Only for unquoted values, so a '#'
      // inside a quoted title survives. Without this, `published: true # note`
      // would not equal 'true' and the article would silently stay a draft.
      const hash = value.indexOf('#')
      if (hash !== -1) value = value.slice(0, hash).trim()
    }

    data[key] = value
  }

  // `\n---` consumed above, plus the newline that closes the fence.
  const bodyStart = normalised.indexOf('\n', end + 1)
  return { data, body: bodyStart === -1 ? '' : normalised.slice(bodyStart + 1) }
}

/** Drop the H1 — the page renders the title from frontmatter in its own header. */
function stripLeadingH1(body: string): string {
  return body.replace(/^\s*#\s+.*\n/, '')
}

function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

async function parseGuide(filename: string): Promise<Guide | null> {
  const raw = await readFile(path.join(GUIDES_DIR, filename), 'utf8')
  const { data, body } = splitFrontmatter(raw)

  const slug = data.slug?.trim()
  const title = data.title?.trim()
  if (!slug || !title) return null

  const cut = body.search(DRAFT_SECTION_MARKER)
  const publicBody = stripLeadingH1(cut === -1 ? body : body.slice(0, cut)).trim()

  return {
    slug,
    title,
    description: data.description?.trim() ?? '',
    category: data.category?.trim() || 'Guide',
    date: data.date?.trim() ?? '',
    // Opt-in, never opt-out: an article ships only once someone has
    // verified it and said so explicitly. A missing or malformed value
    // keeps it unpublished.
    published: data.published?.trim().toLowerCase() === 'true',
    body: publicBody,
    html: await marked.parse(publicBody, { async: true, renderer }),
    readingMinutes: readingMinutes(publicBody),
  }
}

/** Every published guide, newest first. Drafts are never returned. */
export async function getPublishedGuides(): Promise<Guide[]> {
  let filenames: string[]
  try {
    filenames = await readdir(GUIDES_DIR)
  } catch {
    return []
  }

  const parsed = await Promise.all(
    filenames.filter((f) => f.endsWith('.md')).map((f) => parseGuide(f)),
  )

  return parsed
    .filter((g): g is Guide => g !== null && g.published)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
}

/** A single published guide, or null — drafts resolve to null so they 404. */
export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const guides = await getPublishedGuides()
  return guides.find((g) => g.slug === slug) ?? null
}

/**
 * Up to `limit` other published guides, preferring the same category so the
 * links at the foot of an article are actually related rather than random.
 */
export async function getRelatedGuides(slug: string, limit = 3): Promise<Guide[]> {
  const guides = await getPublishedGuides()
  const current = guides.find((g) => g.slug === slug)
  if (!current) return []

  const others = guides.filter((g) => g.slug !== slug)
  const sameCategory = others.filter((g) => g.category === current.category)
  const rest = others.filter((g) => g.category !== current.category)

  return [...sameCategory, ...rest].slice(0, limit)
}
