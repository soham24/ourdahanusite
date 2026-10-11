import Link from 'next/link'
import {
  Phone,
  AlertTriangle,
  ShieldAlert,
  Flame,
  Heart,
  MapPin,
  Info,
  CheckCircle,
  ChevronRight,
  Zap,
  Droplets,
  Wind,
} from 'lucide-react'
import { siteConfig } from '@/lib/site'

const emergencyContacts = [
  { name: 'Police Control Room', number: '100', icon: '👮', color: 'bg-blue-50 border-blue-200', badge: 'bg-blue-600' },
  { name: 'Fire Brigade', number: '101', icon: '🚒', color: 'bg-red-50 border-red-200', badge: 'bg-red-600' },
  { name: 'Ambulance', number: '108', icon: '🚑', color: 'bg-green-50 border-green-200', badge: 'bg-green-600' },
  { name: 'Disaster Management', number: '1077', icon: '🆘', color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-600' },
  { name: 'Women Helpline', number: '1091', icon: '👩', color: 'bg-pink-50 border-pink-200', badge: 'bg-pink-600' },
  { name: 'Child Helpline', number: '1098', icon: '👶', color: 'bg-purple-50 border-purple-200', badge: 'bg-purple-600' },
]

const localContacts = [
  { name: 'Dahanu Police Station', number: '02528-222033', address: 'Main Road, Dahanu' },
  { name: 'Dahanu Sub-District Hospital', number: '02528-222037', address: 'Hospital Road, Dahanu' },
  { name: 'Dahanu Fire Station', number: '02528-222101', address: 'Station Road, Dahanu' },
  { name: 'Palghar Collector Office', number: '02525-252552', address: 'Palghar' },
  { name: 'MSEB Dahanu (Power Outage)', number: '02528-222200', address: 'MSEB Office, Dahanu Road' },
  { name: 'Tahsildar Office Dahanu', number: '02528-222XXX', address: 'Civil Lines, Dahanu' },
]

const preparednessGuides = [
  {
    icon: <Droplets size={20} className="text-blue-600" />,
    bg: 'bg-blue-50',
    title: 'Flood Preparedness',
    steps: [
      'Know your evacuation routes (marked on the map below)',
      'Keep important documents in a waterproof bag',
      'Stock 3 days of drinking water, food, and medicines',
      'Do not cross flooded roads or bridges',
      'Move to higher ground immediately if alerted',
    ],
  },
  {
    icon: <Flame size={20} className="text-red-600" />,
    bg: 'bg-red-50',
    title: 'Fire Safety',
    steps: [
      'Call 101 immediately — do not delay',
      'Alert all occupants and evacuate the building',
      'Do not use lifts during a fire',
      'Close doors to slow the spread of smoke',
      'Meet at your pre-decided family assembly point',
    ],
  },
  {
    icon: <Wind size={20} className="text-gray-600" />,
    bg: 'bg-gray-50',
    title: 'Cyclone & Storm',
    steps: [
      'Listen to IMD weather alerts on AIR / DD News',
      'Secure loose objects around your home',
      'Stay indoors — keep away from windows',
      'Disconnect electrical appliances if safe to do so',
      'Move to a community shelter if instructed',
    ],
  },
  {
    icon: <Zap size={20} className="text-yellow-600" />,
    bg: 'bg-yellow-50',
    title: 'Power Outage',
    steps: [
      'Call MSEB helpline: 02528-222200',
      'Switch off major appliances to prevent surge damage',
      'Use torches — avoid candles near flammable items',
      'Check on elderly and vulnerable neighbours',
      'Report downed power lines to MSEB immediately',
    ],
  },
]

const firstAidBasics = [
  { title: 'Snake Bite', action: 'Immobilise limb, keep below heart level, do NOT cut or suck. Rush to hospital immediately.' },
  { title: 'Drowning / Unconscious', action: 'Clear airway, start CPR if trained. Call 108 immediately.' },
  { title: 'Burns', action: 'Cool under running water for 10 minutes. Do NOT apply oil or toothpaste. Cover loosely.' },
  { title: 'Choking (Adult)', action: 'Give 5 back blows between shoulder blades. Then 5 abdominal thrusts (Heimlich manoeuvre).' },
  { title: 'Heavy Bleeding', action: 'Apply firm direct pressure with a clean cloth. Keep pressure on and call 108.' },
  { title: 'Heat Stroke', action: 'Move to shade, cool with wet cloth, give water if conscious. Call 108 for high fever or confusion.' },
]

export default function EmergencyPage() {
  return (
    <div>
      {/* ---- TOP ALERT BANNER ---- */}
      <div className="bg-brand text-bg px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2">
        <CheckCircle size={15} />
        <span>No active emergency alerts for Dahanu right now. All clear.</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={28} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Emergency & Safety</h1>
            <p className="text-gray-500 mt-1">
              Critical contacts, preparedness guides, and safety information for Dahanu residents
            </p>
          </div>
        </div>

        {/* Quick-dial national helplines */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone size={18} className="text-red-500" />
            National Emergency Numbers — Call Instantly
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {emergencyContacts.map((c) => (
              <a
                key={c.number}
                href={`tel:${c.number}`}
                className={`group flex flex-col items-center text-center rounded-2xl border p-4 transition-all hover:shadow-md ${c.color}`}
              >
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className={`text-white text-lg font-black px-3 py-0.5 rounded-lg mb-1.5 ${c.badge}`}>
                  {c.number}
                </div>
                <div className="text-xs font-medium text-gray-600 leading-tight">{c.name}</div>
              </a>
            ))}
          </div>
        </section>

        {/* Local Dahanu contacts */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-brand" />
            Local Dahanu Emergency Contacts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localContacts.map((c) => (
              <div
                key={c.name}
                className="bg-white border border-gray-100 hover:border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4 group hover:shadow-sm transition-all"
              >
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-red-700 transition-colors">
                    {c.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />
                    {c.address}
                  </div>
                </div>
                <a
                  href={`tel:${c.number}`}
                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Phone size={13} />
                  {c.number}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Evacuation map placeholder */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            Dahanu Flood Evacuation Zones
          </h2>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="text-6xl">🗺️</div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-2">Evacuation Map — Dahanu Taluka</h3>
              <p className="text-gray-600 text-sm mb-4">
                During floods, coastal and low-lying areas near the creek are at highest risk. Community shelters are located at Dahanu Municipal School, Vavsed Community Hall, and Gholvad Gram Panchayat building.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { zone: 'Zone A — High Risk', desc: 'Creek-side areas, Kosbad Hill foothills', color: 'border-red-300 bg-red-50' },
                  { zone: 'Zone B — Moderate Risk', desc: 'Low-lying agricultural land, coastal belt', color: 'border-orange-300 bg-orange-50' },
                  { zone: 'Zone C — Safe', desc: 'Elevated areas, main town, railway station', color: 'border-green-300 bg-green-50' },
                ].map((z) => (
                  <div key={z.zone} className={`border rounded-xl p-3 ${z.color}`}>
                    <div className="font-semibold text-xs text-gray-800">{z.zone}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{z.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Preparedness guides */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Info size={18} className="text-blue-600" />
            Emergency Preparedness Guides
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {preparednessGuides.map((guide) => (
              <div key={guide.title} className={`${guide.bg} border border-gray-100 rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  {guide.icon}
                  <h3 className="font-bold text-gray-900">{guide.title}</h3>
                </div>
                <ul className="space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-500 mt-0.5 shadow-sm">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* First Aid Basics */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Heart size={18} className="text-red-500" />
            First Aid Quick Reference
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {firstAidBasics.map((item) => (
              <div key={item.title} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 transition-all">
                <div className="font-bold text-gray-900 text-sm mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                  {item.title}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{item.action}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            First aid is not a substitute for professional medical care. Always call 108 for serious injuries.
          </p>
        </section>

        {/* Neighbourhood Watch */}
        <section className="mb-10">
          <div className="bg-gradient-to-r from-[#2E1205] to-[#7A4520] rounded-2xl p-6 md:p-8 text-white">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-5xl">👀</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Dahanu Neighbourhood Watch</h2>
                <p className="text-[#F8E9D5]/75 text-sm leading-relaxed mb-4">
                  Be the eyes and ears of your community. If you notice suspicious activity, do not confront anyone — report it. Our network coordinates with the Dahanu Police to keep our streets safe.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 bg-[#F0C87A] text-[#2E1205] font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-white transition-colors"
                  >
                    Join the Watch Network
                    <ChevronRight size={14} />
                  </Link>
                  <a
                    href="tel:100"
                    className="inline-flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/30 transition-colors border border-white/30"
                  >
                    <Phone size={14} />
                    Report Now (100)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <div className="text-center text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
          Bookmark this page so it is one tap away in an emergency:{' '}
          <span className="font-semibold text-gray-600">{siteConfig.domain}/emergency</span>
        </div>
      </div>
    </div>
  )
}
