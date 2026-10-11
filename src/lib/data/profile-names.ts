import 'server-only'

/**
 * Any Supabase client — public, cookie-bound or admin. They are typed
 * differently, and this only needs the one RPC.
 */
type ProfileNamesClient = {
  rpc(fn: 'get_profile_names', args: { p_ids: string[] }): PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * Display names for the given user ids, keyed by id. Users without a name are
 * left out, so callers fall back to "Anonymous" as before.
 *
 * Goes through the get_profile_names function rather than reading profiles:
 * anon may not read that table, and the function only answers for ids it is
 * given, so no client can list every user.
 */
export async function fetchProfileNames(
  client: ProfileNamesClient,
  userIds: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set([...userIds].filter((id): id is string => typeof id === 'string' && id.length > 0))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names

  const { data, error } = await client.rpc('get_profile_names', { p_ids: ids })
  if (error || !Array.isArray(data)) return names

  for (const row of data as Array<{ id: string; full_name: string | null }>) {
    if (row.full_name) names.set(row.id, row.full_name)
  }
  return names
}
