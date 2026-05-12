export function hasSupabaseSessionCookie(): boolean {
  if (typeof document === 'undefined') return false

  return /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie)
}
