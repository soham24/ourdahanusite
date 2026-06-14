/**
 * Convert a parsed JSON object into FormData, the shape the existing server
 * actions (placeOrder, bookAppointment, …) expect. Lets /api/v1 routes accept
 * clean JSON from the app while reusing action logic unchanged.
 */
export function toFormData(obj: Record<string, unknown>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue
    fd.set(key, String(value))
  }
  return fd
}
