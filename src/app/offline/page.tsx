import Link from 'next/link'
import { WifiOff, ShieldAlert, Phone } from 'lucide-react'

const EMERGENCY_NUMBERS = [
  { name: 'Police', number: '100', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Ambulance', number: '108', color: 'bg-red-50 text-red-700 border-red-200' },
  { name: 'Fire Brigade', number: '101', color: 'bg-orange-50 text-orange-700 border-orange-200' },
]

export default function OfflinePage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
      {/* Offline indicator */}
      <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <WifiOff size={36} className="text-gray-400" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">You&rsquo;re offline</h1>
      <p className="text-gray-500 mb-8 leading-relaxed">
        No internet connection detected — but emergency contacts are still available below.
      </p>

      {/* Emergency numbers */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-8 text-left shadow-sm">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ShieldAlert size={18} className="text-red-600" />
          Dahanu Emergency Numbers
        </h2>
        <div className="space-y-3">
          {EMERGENCY_NUMBERS.map((item) => (
            <a
              key={item.name}
              href={`tel:${item.number}`}
              className={`flex items-center justify-between border rounded-xl px-4 py-3 transition-opacity hover:opacity-80 ${item.color}`}
            >
              <span className="font-semibold">{item.name}</span>
              <span className="flex items-center gap-1.5 font-bold text-lg">
                <Phone size={16} />
                {item.number}
              </span>
            </a>
          ))}
        </div>
      </div>

      <Link
        href="/emergency"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-strong text-bg font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        <ShieldAlert size={16} />
        View Full Emergency Page
      </Link>

      <p className="text-xs text-gray-400 mt-8">
        OurDahanu · Dahanu, Palghar, Maharashtra
      </p>
    </div>
  )
}
