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
  'Astrologer',
  'Vastu Consultant',
  'Stone Fabricator',
  'Modular Kitchen',
  'EV Sales & Service',
  'Interior Designer',
  'Real Estate Agent',
  'Kirana Wholesale',
  'Event Planner',
  'DJ & Event Sound/Lighting',
  'Bee Rescue Service',
  'Medical Store/Pharmacist',
  'Computer Education',
  'Insurance/LIC Advisor',
  'Income Tax Consultant',
  'Financial Advisor',
  'Dance Teacher',
  'Mobile Repair',
  'Pet Shop',
  'Pest Control',
  'Building Materials',
  'CA / Company Secretary',
  'Car Rental / Travel',
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
  Astrologer: 'ज्योतिषी',
  'Vastu Consultant': 'वास्तु सल्लागार',
  'Stone Fabricator': 'दगड कारागीर',
  'Modular Kitchen': 'मॉड्युलर किचन',
  'EV Sales & Service': 'इलेक्ट्रिक वाहन विक्री व सेवा',
  'Interior Designer': 'इंटिरियर डिझायनर',
  'Real Estate Agent': 'रिअल इस्टेट एजंट',
  'Kirana Wholesale': 'किराणा घाऊक विक्रेता',
  'Event Planner': 'इव्हेंट प्लॅनर',
  'DJ & Event Sound/Lighting': 'डीजे व साउंड-लाइटिंग',
  'Bee Rescue Service': 'मधमाशी बचाव सेवा',
  'Medical Store/Pharmacist': 'मेडिकल स्टोअर / औषध विक्रेता',
  'Computer Education': 'संगणक शिक्षण',
  'Insurance/LIC Advisor': 'विमा (LIC) सल्लागार',
  'Income Tax Consultant': 'आयकर सल्लागार',
  'Financial Advisor': 'आर्थिक सल्लागार',
  'Dance Teacher': 'नृत्य शिक्षक',
  'Mobile Repair': 'मोबाईल दुरुस्ती',
  'Pet Shop': 'पाळीव प्राणी दुकान',
  'Pest Control': 'कीड नियंत्रण',
  'Building Materials': 'बांधकाम साहित्य',
  'CA / Company Secretary': 'सीए / कंपनी सेक्रेटरी',
  'Car Rental / Travel': 'कार भाडे व प्रवास',
  Other: 'इतर',
}

/** Marathi label for a stored (English) profession, or null for free-text/unknown. */
export function professionMarathi(en: string): string | null {
  return (PROFESSION_MR as Record<string, string>)[en] ?? null
}

// URL slug for category landing pages, e.g. 'AC/Appliance Repair' →
// 'ac-appliance-repair', 'CA / Company Secretary' → 'ca-company-secretary'.
export function professionSlug(profession: string): string {
  return profession
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SLUG_TO_PROFESSION = new Map(PROFESSIONS.map((p) => [professionSlug(p), p]))

/** Resolve a URL slug back to its stored profession, or null if unknown. */
export function professionFromSlug(slug: string): Profession | null {
  return SLUG_TO_PROFESSION.get(slug) ?? null
}
