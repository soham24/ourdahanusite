#!/usr/bin/env node
/**
 * Backfill image_thumb_url and cover_image_thumb_url for existing listings,
 * and image_thumb_url for existing listing products.
 *
 * For every listing/product where the thumb column is null but the source URL
 * exists, this script:
 *   1. Downloads the source from Supabase storage.
 *   2. Generates a JPEG thumb (240px max edge for logos, 640w for covers).
 *   3. Uploads the thumb to the same bucket with a `-thumb-<n>` suffix.
 *   4. Updates the row with the new public URL.
 *
 * Usage:
 *   node scripts/backfill-listing-thumbs.mjs [--dry-run] [--id <listingId>]
 *
 * Env required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Requires `sharp` (already added as a devDependency).
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── Load .env.local manually (no dotenv dep) ──────────────────────────────
function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      const [, key, raw] = m
      if (process.env[key]) continue
      const val = raw.replace(/^['"]|['"]$/g, '')
      process.env[key] = val
    }
  } catch {
    /* env file optional */
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const idArgIndex = args.indexOf('--id')
const ONLY_ID = idArgIndex >= 0 ? args[idArgIndex + 1] : null

const LOGO_MAX_EDGE = 240
const PRODUCT_MAX_EDGE = 400
const COVER_MAX_WIDTH = 640
const JPEG_QUALITY = 78

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * From a public URL like
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * extract `bucket` and `path`. Returns null for URLs we don't recognise.
 */
function parseStorageUrl(url) {
  try {
    const u = new URL(url)
    const m = u.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (!m) return null
    return { bucket: m[1], path: decodeURIComponent(m[2]) }
  } catch {
    return null
  }
}

async function downloadBytes(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`download ${bucket}/${path}: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function uploadThumb(bucket, path, buffer) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw new Error(`upload ${bucket}/${path}: ${error.message}`)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

function buildThumbPath(originalPath, suffix) {
  // public/1234-foo.jpg → public/1234-foo-thumb-240.jpg
  const dot = originalPath.lastIndexOf('.')
  const base = dot >= 0 ? originalPath.slice(0, dot) : originalPath
  return `${base}-${suffix}.jpg`
}

async function generateThumb(sourceUrl, kind /* 'logo' | 'cover' | 'product' */) {
  const parsed = parseStorageUrl(sourceUrl)
  if (!parsed) {
    return { skipped: true, reason: 'not a Supabase public storage URL' }
  }

  const sourceBuffer = await downloadBytes(parsed.bucket, parsed.path)
  const sharpInst = sharp(sourceBuffer).rotate() // honour EXIF orientation
  const meta = await sharpInst.metadata()
  if (!meta.width || !meta.height) {
    return { skipped: true, reason: 'unreadable source image' }
  }

  let resizeOpts
  let suffix
  if (kind === 'logo') {
    resizeOpts = { width: LOGO_MAX_EDGE, height: LOGO_MAX_EDGE, fit: 'inside' }
    suffix = `thumb-${LOGO_MAX_EDGE}`
  } else if (kind === 'product') {
    resizeOpts = { width: PRODUCT_MAX_EDGE, height: PRODUCT_MAX_EDGE, fit: 'inside' }
    suffix = `thumb-${PRODUCT_MAX_EDGE}`
  } else {
    resizeOpts = { width: COVER_MAX_WIDTH, fit: 'inside' }
    suffix = `thumb-${COVER_MAX_WIDTH}`
  }

  const thumbBuffer = await sharpInst
    .resize(resizeOpts)
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const thumbPath = buildThumbPath(parsed.path, suffix)

  if (DRY_RUN) {
    return {
      skipped: false,
      dryRun: true,
      thumbBucket: parsed.bucket,
      thumbPath,
      thumbBytes: thumbBuffer.length,
    }
  }

  const thumbUrl = await uploadThumb(parsed.bucket, thumbPath, thumbBuffer)
  return { skipped: false, thumbUrl, thumbBytes: thumbBuffer.length }
}

async function processListing(listing) {
  const updates = {}
  const logs = []

  if (listing.image_url && !listing.image_thumb_url) {
    try {
      const r = await generateThumb(listing.image_url, 'logo')
      if (r.skipped) {
        logs.push(`  • image: skipped (${r.reason})`)
      } else if (r.dryRun) {
        logs.push(`  • image: DRY → ${r.thumbBucket}/${r.thumbPath} (${r.thumbBytes} bytes)`)
      } else {
        updates.image_thumb_url = r.thumbUrl
        logs.push(`  • image_thumb_url ← ${r.thumbUrl} (${r.thumbBytes} bytes)`)
      }
    } catch (err) {
      logs.push(`  • image: ERROR ${err.message}`)
    }
  }

  if (listing.cover_image && !listing.cover_image_thumb_url) {
    try {
      const r = await generateThumb(listing.cover_image, 'cover')
      if (r.skipped) {
        logs.push(`  • cover: skipped (${r.reason})`)
      } else if (r.dryRun) {
        logs.push(`  • cover: DRY → ${r.thumbBucket}/${r.thumbPath} (${r.thumbBytes} bytes)`)
      } else {
        updates.cover_image_thumb_url = r.thumbUrl
        logs.push(`  • cover_image_thumb_url ← ${r.thumbUrl} (${r.thumbBytes} bytes)`)
      }
    } catch (err) {
      logs.push(`  • cover: ERROR ${err.message}`)
    }
  }

  if (!Object.keys(updates).length && !logs.length) {
    return { changed: false, logs: ['  • nothing to do'] }
  }

  if (Object.keys(updates).length && !DRY_RUN) {
    const { error } = await supabase.from('listings').update(updates).eq('id', listing.id)
    if (error) {
      logs.push(`  • DB update ERROR ${error.message}`)
      return { changed: false, logs }
    }
  }

  return { changed: Object.keys(updates).length > 0, logs }
}

async function processProduct(product) {
  const logs = []

  if (!product.image_url || product.image_thumb_url) {
    return { changed: false, logs: ['  â€¢ nothing to do'] }
  }

  try {
    const r = await generateThumb(product.image_url, 'product')
    if (r.skipped) {
      logs.push(`  â€¢ product image: skipped (${r.reason})`)
      return { changed: false, logs }
    }
    if (r.dryRun) {
      logs.push(`  â€¢ product image: DRY â†’ ${r.thumbBucket}/${r.thumbPath} (${r.thumbBytes} bytes)`)
      return { changed: false, logs }
    }

    const { error } = await supabase
      .from('listing_products')
      .update({ image_thumb_url: r.thumbUrl })
      .eq('id', product.id)
    if (error) {
      logs.push(`  â€¢ DB update ERROR ${error.message}`)
      return { changed: false, logs }
    }

    logs.push(`  â€¢ image_thumb_url â† ${r.thumbUrl} (${r.thumbBytes} bytes)`)
    return { changed: true, logs }
  } catch (err) {
    logs.push(`  â€¢ product image: ERROR ${err.message}`)
    return { changed: false, logs }
  }
}

async function main() {
  console.log(`Backfill listing/product thumbs ${DRY_RUN ? '(DRY RUN)' : ''}${ONLY_ID ? ` [id=${ONLY_ID}]` : ''}`)

  let query = supabase
    .from('listings')
    .select('id, name, image_url, image_thumb_url, cover_image, cover_image_thumb_url')
    .order('created_at', { ascending: true })

  if (ONLY_ID) {
    query = query.eq('id', ONLY_ID)
  }

  const { data: listings, error } = await query
  if (error) {
    console.error('Failed to fetch listings:', error.message)
    process.exit(1)
  }

  console.log(`Found ${listings.length} listing(s).`)

  let changed = 0
  for (const listing of listings) {
    const needsImage = listing.image_url && !listing.image_thumb_url
    const needsCover = listing.cover_image && !listing.cover_image_thumb_url
    if (!needsImage && !needsCover) continue

    console.log(`\n[${listing.id}] ${listing.name}`)
    const { changed: didChange, logs } = await processListing(listing)
    for (const line of logs) console.log(line)
    if (didChange) changed += 1
  }

  const { data: products, error: productError } = await supabase
    .from('listing_products')
    .select('id, name, image_url, image_thumb_url')
    .not('image_url', 'is', null)
    .is('image_thumb_url', null)
    .order('created_at', { ascending: true })

  if (productError) {
    console.error('Failed to fetch products:', productError.message)
    process.exit(1)
  }

  let productsChanged = 0
  console.log(`\nFound ${products.length} product(s) needing thumbs.`)
  for (const product of products) {
    console.log(`\n[product:${product.id}] ${product.name}`)
    const { changed: didChange, logs } = await processProduct(product)
    for (const line of logs) console.log(line)
    if (didChange) productsChanged += 1
  }

  console.log(`\nDone. ${changed} listing(s), ${productsChanged} product(s) updated.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
