/**
 * Where an uploaded image is stored in the `uploads` bucket.
 *
 * Three components used to build this string themselves, near-identically,
 * as `public/<timestamp>-<file.name>.jpg`. That had two problems.
 *
 * **Nothing tied an object to who uploaded it.** The bucket's insert policy
 * can only check what it can see in the path, so with a flat namespace the
 * best it could do was check the bucket name — meaning any signed-in account
 * could write anywhere in it. Putting the uploader's id in the path is what
 * lets the policy say "your own folder only":
 *
 *     (storage.foldername(name))[2] = auth.uid()::text
 *
 * That policy is deliberately *not* applied yet. It has to come after this
 * code is deployed, or uploads break for every owner whose client is still
 * writing flat paths. Existing images are unaffected either way: their URLs
 * are stored in the database and the read policy is unchanged.
 *
 * One thing this does disclose: a public image URL now contains the
 * uploader's account id. That id is already the public key for a row in
 * `profiles`, which is readable only by its owner, so it reveals nothing on
 * its own -- but it is in the page source where it was not before.
 *
 * **The file's own name went into the path unsanitised.** A name carrying a
 * slash or a traversal segment would move the object somewhere else in the
 * bucket. It is now reduced to a short, boring slug.
 */

/** Characters that survive into the stored name. */
function slugify(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '') // drop the extension; everything is re-encoded to jpeg
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image'
  )
}

/**
 * `public/<uploader id>/<time>-<random>-<name><suffix>.jpg`.
 *
 * The random segment matters: two uploads in the same millisecond used to
 * collide. Every upload passes `upsert: true`, but the bucket has no UPDATE
 * policy, so the overwrite is refused rather than applied -- the second
 * upload failed in front of the user instead of quietly replacing the first.
 * Either way it should not happen.
 *
 * @param userId  the uploader, from the session — not a listing or business id
 * @param originalName  the file's own name, used only to keep the object
 *                      recognisable in the storage browser
 * @param suffix  e.g. `-thumb` for the small copy beside the full one
 */
export function storageObjectPath(userId: string, originalName: string, suffix = ''): string {
  if (!userId) throw new Error('storageObjectPath needs the uploader id')
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `public/${userId}/${unique}-${slugify(originalName)}${suffix}.jpg`
}
