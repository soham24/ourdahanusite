/**
 * Facts about one town that the pages display: who to call in an
 * emergency, where the flood zones are, how to reach the people running the
 * site.
 *
 * site-config.ts holds names; this holds facts, which no config can
 * translate. A fork replaces every value here with its own town's, checked
 * against an official source. The emergency numbers matter most: a wrong
 * one is the worst bug this site can have. `npm run doctor` fails on a fork
 * while they are still Dahanu's.
 *
 * The page layout and styling stay in the pages
 * (src/app/emergency/page.tsx, src/app/contact/page.tsx); this file is
 * data only.
 */

export const emergency = {
  /** Country-wide helplines, shown as one-tap call buttons. India's numbers. */
  national: [
    { name: 'Police Control Room', number: '100', icon: '👮' },
    { name: 'Fire Brigade', number: '101', icon: '🚒' },
    { name: 'Ambulance', number: '108', icon: '🚑' },
    { name: 'Disaster Management', number: '1077', icon: '🆘' },
    { name: 'Women Helpline', number: '1091', icon: '👩' },
    { name: 'Child Helpline', number: '1098', icon: '👶' },
  ],

  /** The town's own police station, hospital, fire station and utilities. */
  local: [
    { name: 'Dahanu Police Station', number: '02528-222033', address: 'Main Road, Dahanu' },
    { name: 'Dahanu Sub-District Hospital', number: '02528-222037', address: 'Hospital Road, Dahanu' },
    { name: 'Dahanu Fire Station', number: '02528-222101', address: 'Station Road, Dahanu' },
    { name: 'Palghar Collector Office', number: '02525-252552', address: 'Palghar' },
    { name: 'MSEB Dahanu (Power Outage)', number: '02528-222200', address: 'MSEB Office, Dahanu Road' },
  ],

  /** Flood evacuation: the area covered, where the shelters are, and the risk zones. */
  evacuation: {
    area: 'Dahanu Taluka',
    summary:
      'During floods, coastal and low-lying areas near the creek are at highest risk. Community shelters are located at Dahanu Municipal School, Vavsed Community Hall, and Gholvad Gram Panchayat building.',
    zones: [
      { zone: 'Zone A — High Risk', desc: 'Creek-side areas, Kosbad Hill foothills', risk: 'high' },
      { zone: 'Zone B — Moderate Risk', desc: 'Low-lying agricultural land, coastal belt', risk: 'moderate' },
      { zone: 'Zone C — Safe', desc: 'Elevated areas, main town, railway station', risk: 'safe' },
    ],
  },
} as const

/** How to reach the people running the site, shown on the contact page. */
export const contact = {
  /** Country calling code, without the +. */
  whatsappCountryCode: '91',
  /** WhatsApp number without the country code. Messages only. */
  whatsapp: '8149314106',
  /** Instagram handle, without the @. */
  instagram: 'ourdahanu',
} as const

/**
 * The people running the site, shown on the home page and /about. The first
 * entry is the founder. `photo` is optional: a square image path under
 * public/ (e.g. '/team/soham.jpg'); without one, initials are shown.
 */
export const team: ReadonlyArray<{ name: string; role: string; detail: string; photo?: string }> = [
  { name: 'Soham Railkar', role: 'Founder', detail: 'Started OurDahanu as a local Facebook, Instagram and WhatsApp community.' },
  { name: 'Ankit Thakkar', role: 'Core group', detail: 'Helps manage community conversations and local coordination.' },
  { name: 'Khushboo Kapadia', role: 'Core group', detail: 'Part of the team shaping useful community spaces for Dahanu.' },
  { name: 'Ajay Bari', role: 'Core group', detail: 'Supports group management and day-to-day community operations.' },
  { name: 'Nupur Mestry', role: 'Core group', detail: 'Helps keep OurDahanu active, helpful and locally relevant.' },
  { name: 'Khushbu Bari', role: 'Content & media', detail: 'Supports the community with content, media and storytelling.' },
]

/** People who advise the team, shown on /about. */
export const advisors: ReadonlyArray<{ name: string; focus: string; photo?: string }> = [
  { name: 'Mayur Vayeda', focus: 'Community guidance' },
  { name: 'Mayuresh Patil', focus: 'Local network' },
  { name: 'Ketan Patil', focus: 'Strategic support' },
  { name: 'Tanvi Nayak', focus: 'Community perspective' },
]
