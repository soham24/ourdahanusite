// Single source of truth for job categories: the post form, board filters,
// category pages and server-side validation. Stored values stay English;
// Marathi is display-only. Keep 'Other' last.
export const JOB_CATEGORIES = [
  'Shop & Sales',
  'Hotel, Restaurant & Catering',
  'Farm & Orchard',
  'Fishing & Seafood',
  'Driver & Delivery',
  'Teaching & Tuition',
  'Healthcare & Clinic',
  'Office, Accounts & Computer',
  'Factory & Industrial',
  'Construction & Labour',
  'Electrician, Plumber & Technician',
  'Domestic Help & Care',
  'Security Guard',
  'Beauty & Salon',
  'Other',
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

// Proofread by the site owner before launch (spec, rollout step 4).
export const JOB_CATEGORY_MR: Record<JobCategory, string> = {
  'Shop & Sales': 'दुकान व विक्री',
  'Hotel, Restaurant & Catering': 'हॉटेल, रेस्टॉरंट व केटरिंग',
  'Farm & Orchard': 'शेती व बागायत',
  'Fishing & Seafood': 'मासेमारी व मत्स्य व्यवसाय',
  'Driver & Delivery': 'ड्रायव्हर व डिलिव्हरी',
  'Teaching & Tuition': 'शिक्षण व शिकवणी',
  'Healthcare & Clinic': 'आरोग्य सेवा व दवाखाना',
  'Office, Accounts & Computer': 'ऑफिस, हिशोब व संगणक',
  'Factory & Industrial': 'कारखाना व औद्योगिक',
  'Construction & Labour': 'बांधकाम व मजुरी',
  'Electrician, Plumber & Technician': 'इलेक्ट्रिशियन, प्लंबर व तंत्रज्ञ',
  'Domestic Help & Care': 'घरकाम व देखभाल',
  'Security Guard': 'सुरक्षा रक्षक',
  'Beauty & Salon': 'ब्युटी पार्लर व सलून',
  Other: 'इतर',
}

export function isValidJobCategory(value: string): value is JobCategory {
  return (JOB_CATEGORIES as readonly string[]).includes(value)
}

export function jobCategoryMarathi(value: string): string | null {
  return isValidJobCategory(value) ? JOB_CATEGORY_MR[value] : null
}

/** URL slug: "Hotel, Restaurant & Catering" → "hotel-restaurant-catering". */
export function jobCategorySlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function jobCategoryFromSlug(slug: string): JobCategory | null {
  return JOB_CATEGORIES.find((category) => jobCategorySlug(category) === slug) ?? null
}
