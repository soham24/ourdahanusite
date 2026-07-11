// Single source of truth for the professions dropdown, public filter, and
// server-side validation. Keep 'Other' last.
export const PROFESSIONS = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Doctor',
  'Tutor/Teacher',
  'Mechanic',
  'Mason',
  'Welder',
  'Tailor',
  'Beautician',
  'Cook/Caterer',
  'Driver',
  'Gardener',
  'Cleaner/Housekeeping',
  'AC/Appliance Repair',
  'Photographer',
  'Priest/Pujari',
  'Other',
] as const

export type Profession = (typeof PROFESSIONS)[number]

export function isValidProfession(p: string): p is Profession {
  return (PROFESSIONS as readonly string[]).includes(p)
}
