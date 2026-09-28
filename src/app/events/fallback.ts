import { siteConfig } from '@/lib/site'

export type FallbackEvent = {
  id: string
  title: string
  date: string
  time: string
  location: string
  category: string
  image: string
  attendees: number
  description: string
  organizer: string
  free: boolean
  price?: number
}

export const FALLBACK_EVENTS: FallbackEvent[] = [
  {
    id: 'fallback-1',
    title: `${siteConfig.town} Chikoo Festival 2024`,
    date: 'Dec 15, 2024',
    time: '9:00 AM - 8:00 PM',
    location: `${siteConfig.town} Beach`,
    category: 'Festival',
    image: '🍂',
    attendees: 1200,
    description: `Annual celebration of ${siteConfig.town}'s famous Chikoo (Sapota) harvest. Enjoy fresh chikoo, products, music, dance, and cultural programs.`,
    organizer: `${siteConfig.town} Farmers Association`,
    free: true,
  },
  {
    id: 'fallback-2',
    title: 'Warli Art Workshop',
    date: 'Dec 20, 2024',
    time: '10:00 AM - 1:00 PM',
    location: `Tribal Cultural Centre, ${siteConfig.town}`,
    category: 'Workshop',
    image: '🎨',
    attendees: 50,
    description: `Learn the ancient tribal Warli art form from master artists of the ${siteConfig.town} tribal community. Materials provided.`,
    organizer: 'Tribal Art Foundation',
    free: false,
    price: 300,
  },
  {
    id: 'fallback-3',
    title: 'Community Mela - Vavsed',
    date: 'Jan 5, 2025',
    time: '4:00 PM - 10:00 PM',
    location: 'Vavsed Ground, Vavsed',
    category: 'Mela',
    image: '🎡',
    attendees: 3000,
    description: 'Annual community fair at Vavsed with food stalls, local products, entertainment, and cultural programs for the whole family.',
    organizer: 'Vavsed Gram Panchayat',
    free: true,
  },
  {
    id: 'fallback-4',
    title: 'Beach Cleanup Drive',
    date: 'Jan 12, 2025',
    time: '7:00 AM - 10:00 AM',
    location: `${siteConfig.town} Beach`,
    category: 'Community',
    image: '🌊',
    attendees: 200,
    description: `Join us to keep ${siteConfig.town} beach clean and beautiful. Refreshments provided for all volunteers.`,
    organizer: `Green ${siteConfig.town} Initiative`,
    free: true,
  },
  {
    id: 'fallback-5',
    title: "Farmer's Market",
    date: 'Every Sunday',
    time: '7:00 AM - 12:00 PM',
    location: `${siteConfig.town} Market Area`,
    category: 'Market',
    image: '🌾',
    attendees: 500,
    description: "Weekly farmers' market with fresh produce, organic vegetables, fruits, and local products directly from farms.",
    organizer: `${siteConfig.town} Krishi Sangh`,
    free: true,
  },
  {
    id: 'fallback-6',
    title: `${siteConfig.town} Heritage Walk`,
    date: 'Jan 26, 2025',
    time: '8:00 AM - 11:00 AM',
    location: `Starting from ${siteConfig.town} Fort`,
    category: 'Heritage',
    image: '🏛️',
    attendees: 80,
    description: `Guided heritage walk through ${siteConfig.town}'s historical sites — the old fort, temples, and colonial-era buildings.`,
    organizer: `${siteConfig.town} Heritage Society`,
    free: false,
    price: 100,
  },
]
