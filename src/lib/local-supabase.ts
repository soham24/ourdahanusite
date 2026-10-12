/**
 * Whether a Supabase URL points at the local stack from `npm run db:start`
 * (or `npm run setup`) rather than a hosted project.
 *
 * The login page offers email sign-in only then: the local stack catches
 * every email in its own inbox, so someone trying the code can sign in
 * without first setting up Google OAuth. A hosted project never gets the
 * form, so production stays Google-only.
 */
export function isLocalSupabaseUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const { hostname, protocol } = new URL(url)
    return protocol === 'http:' && (hostname === '127.0.0.1' || hostname === 'localhost')
  } catch {
    return false
  }
}

/** The local stack's email inbox (Mailpit), where magic links land. */
export const LOCAL_INBOX_URL = 'http://127.0.0.1:54324'
