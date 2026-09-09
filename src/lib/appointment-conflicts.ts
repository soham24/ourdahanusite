import type { AppointmentDayWindow } from '@/lib/listing-content'

export type ConflictCandidate = {
  id: string
  slot_start: string
  status: string
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map((part) => Number.parseInt(part, 10))
  return hours * 60 + minutes
}

/**
 * Which confirmed bookings a proposed date override would strand.
 *
 * The owner is shown these before the override saves and must decide what
 * happens to them. Nothing here resolves the conflict — either choice
 * (cancel the customers, or keep them and close only free slots) is wrong
 * some of the time, so a human makes it.
 */
export function findOverrideConflicts(
  appointments: ConflictCandidate[],
  override: { closed: boolean; windows: AppointmentDayWindow[] | null },
): string[] {
  const live = appointments.filter((appointment) => appointment.status === 'confirmed')
  if (override.closed) return live.map((appointment) => appointment.id)

  const windows = override.windows ?? []

  return live
    .filter((appointment) => {
      const startMinutes = toMinutes(appointment.slot_start)
      return !windows.some(
        (window) => startMinutes >= toMinutes(window.start) && startMinutes < toMinutes(window.end),
      )
    })
    .map((appointment) => appointment.id)
}
