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

// Marathi labels shown alongside the English name everywhere a category
// appears. Stored values stay English; this is display-only. Keys must match
// PROFESSIONS exactly.
export const PROFESSION_MR: Record<Profession, string> = {
  Electrician: 'इलेक्ट्रिशियन',
  Plumber: 'प्लंबर',
  Carpenter: 'सुतार',
  Painter: 'रंगारी',
  Doctor: 'डॉक्टर',
  'Tutor/Teacher': 'शिक्षक',
  Mechanic: 'मेकॅनिक',
  Mason: 'गवंडी',
  Welder: 'वेल्डर',
  Tailor: 'शिंपी',
  Beautician: 'ब्यूटीशियन',
  'Cook/Caterer': 'आचारी/केटरर',
  Driver: 'ड्रायव्हर',
  Gardener: 'माळी',
  'Cleaner/Housekeeping': 'सफाई कामगार',
  'AC/Appliance Repair': 'एसी/उपकरण दुरुस्ती',
  Photographer: 'फोटोग्राफर',
  'Priest/Pujari': 'पुजारी',
  Other: 'इतर',
}

/** Marathi label for a stored (English) profession, or null for free-text/unknown. */
export function professionMarathi(en: string): string | null {
  return (PROFESSION_MR as Record<string, string>)[en] ?? null
}
