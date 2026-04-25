import Link from 'next/link'
import { Phone, MapPin, Train, Bus, Info, ExternalLink } from 'lucide-react'

const emergencyContacts = [
  { name: 'Dahanu Police Station', number: '02528-222033', icon: '👮', category: 'Emergency' },
  { name: 'Police Helpline', number: '100', icon: '🚔', category: 'Emergency' },
  { name: 'Fire Brigade', number: '101', icon: '🚒', category: 'Emergency' },
  { name: 'Ambulance', number: '108', icon: '🚑', category: 'Emergency' },
  { name: 'Women Helpline', number: '1091', icon: '👩', category: 'Emergency' },
  { name: 'Child Helpline', number: '1098', icon: '👶', category: 'Emergency' },
  { name: 'Dahanu Sub-District Hospital', number: '02528-222037', icon: '🏥', category: 'Hospital' },
  { name: 'Palghar District Hospital', number: '02525-252552', icon: '🏨', category: 'Hospital' },
]

const touristPlaces = [
  { name: 'Dahanu Beach', desc: 'Pristine beach with chikoo orchards. Best for morning walks and sunset views.', icon: '🏖️' },
  { name: 'Bordi Beach', desc: '20km from Dahanu, known for its long stretch of sandy beach and palm trees.', icon: '🌴' },
  { name: 'Gholvad', desc: 'Famous for the best Alphonso mangoes and strawberries in Maharashtra.', icon: '🥭' },
  { name: 'Warli Villages', desc: 'Experience the authentic tribal Warli culture and art in nearby tribal hamlets.', icon: '🎨' },
  { name: 'Dahanu Fort (Ruins)', desc: 'Historical Portuguese fort ruins offering panoramic views of the Arabian Sea.', icon: '🏰' },
  { name: 'Tarapur Beach', desc: 'Quiet beach nearby known for fishing activity and scenic beauty.', icon: '⚓' },
]

const govtServices = [
  { name: 'Dahanu Gram Panchayat', contact: '02528-222XXX', service: 'Birth/Death certificates, local permits' },
  { name: 'Tehsil Office Dahanu', contact: '02528-222XXX', service: 'Land records, income certificate, domicile' },
  { name: 'Palghar Collectorate', contact: '02525-252XXX', service: 'Senior citizen, SC/ST, caste certificates' },
  { name: 'Ration Office', contact: '02528-222XXX', service: 'Ration card, PDS services' },
  { name: 'MSEB Office Dahanu', contact: '02528-222XXX', service: 'Electricity connection, billing, complaints' },
  { name: 'Post Office Dahanu', contact: '02528-222XXX', service: 'Postal services, Aadhaar, savings schemes' },
]

const trainSchedule = [
  { from: 'Dahanu Road', to: 'Mumbai (CST)', via: 'Virar, Borivali', duration: '2.5-3 hrs', type: 'Slow/Fast Local' },
  { from: 'Dahanu Road', to: 'Surat', via: 'Vapi, Surat', duration: '1.5 hrs', type: 'Express' },
  { from: 'Dahanu Road', to: 'Pune', via: 'Mumbai', duration: '5-6 hrs', type: 'Express' },
]

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="bg-gradient-to-br from-ink to-brand rounded-3xl p-8 md:p-12 text-white mb-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">About Dahanu</h1>
          <p className="text-green-100 text-lg leading-relaxed">
            Dahanu is a coastal town in Palghar district, Maharashtra — famously known as the <strong className="text-yellow-300">Chikoo (Sapota) capital of India</strong>.
            Located on the Konkan coast, 120km north of Mumbai, Dahanu is home to beautiful beaches, tribal communities, mango orchards, and a rich cultural heritage.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { label: 'District', value: 'Palghar' },
              { label: 'From Mumbai', value: '120 km' },
              { label: 'Population', value: '~1.5 lakh' },
              { label: 'Famous for', value: 'Chikoo & Mango' },
            ].map(item => (
              <div key={item.label} className="bg-white/10 rounded-xl p-3 text-center">
                <div className="font-bold text-lg text-yellow-300">{item.value}</div>
                <div className="text-xs text-green-200">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: 'Tourism', anchor: '#tourism', icon: '🏖️' },
          { label: 'Transport', anchor: '#transport', icon: '🚆' },
          { label: 'Emergency', anchor: '#emergency', icon: '🚨' },
          { label: 'Govt Services', anchor: '#govt', icon: '🏛️' },
        ].map(item => (
          <a key={item.label} href={item.anchor}
            className="bg-white border border-gray-100 hover:border-border rounded-xl p-4 text-center hover:shadow-md transition-all group">
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="font-semibold text-gray-700 group-hover:text-brand text-sm">{item.label}</div>
          </a>
        ))}
      </div>

      {/* Tourism Section */}
      <section id="tourism" className="mb-16 scroll-mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Tourism in Dahanu</h2>
        <p className="text-gray-500 mb-6">Explore the natural beauty, beaches, and cultural heritage of Dahanu</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {touristPlaces.map(place => (
            <div key={place.name} className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-5 transition-all">
              <div className="text-4xl mb-3">{place.icon}</div>
              <h3 className="font-bold text-gray-900 mb-2">{place.name}</h3>
              <p className="text-sm text-gray-500">{place.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Transport Section */}
      <section id="transport" className="mb-16 scroll-mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">How to Reach Dahanu</h2>
        <p className="text-gray-500 mb-6">Trains, buses and road routes to and from Dahanu</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Train size={20} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">By Train</h3>
            </div>
            <p className="text-sm text-gray-600">Dahanu Road Railway Station is on the Western Railway line. Mumbai to Dahanu takes 2.5-3 hours by local or express train.</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bus size={20} className="text-orange-600" />
              <h3 className="font-bold text-gray-900">By Bus (ST)</h3>
            </div>
            <p className="text-sm text-gray-600">MSRTC buses connect Dahanu to Mumbai, Nashik, Pune, and Palghar. ST Bus Stand is near Dahanu Road station.</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={20} className="text-brand" />
              <h3 className="font-bold text-gray-900">By Road</h3>
            </div>
            <p className="text-sm text-gray-600">NH 48 (Mumbai-Ahmedabad highway) passes through Dahanu. Drive from Mumbai is about 2-2.5 hours (120km).</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-900">Key Train Routes from Dahanu Road</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {trainSchedule.map(train => (
              <div key={train.to} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{train.from} → {train.to}</div>
                  <div className="text-sm text-gray-500">via {train.via}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{train.type}</span>
                  <span className="text-gray-600 font-medium">{train.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Emergency Contacts */}
      <section id="emergency" className="mb-16 scroll-mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Emergency Contacts</h2>
        <p className="text-gray-500 mb-6">Important helpline numbers for Dahanu residents</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {emergencyContacts.map(contact => (
            <a key={contact.name} href={`tel:${contact.number}`}
              className="bg-white border border-gray-100 hover:border-red-200 hover:shadow-md rounded-2xl p-4 transition-all group">
              <div className="text-3xl mb-2">{contact.icon}</div>
              <h3 className="font-semibold text-gray-900 text-sm group-hover:text-red-600 transition-colors">{contact.name}</h3>
              <div className="flex items-center gap-1 mt-1.5">
                <Phone size={12} className="text-red-500" />
                <span className="text-red-600 font-bold text-sm">{contact.number}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Government Services */}
      <section id="govt" className="mb-16 scroll-mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Government Services</h2>
        <p className="text-gray-500 mb-6">Find the right office for your government documents and services</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {govtServices.map(service => (
            <div key={service.name} className="bg-white border border-gray-100 hover:border-border hover:shadow-md rounded-2xl p-5 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{service.service}</p>
                </div>
                <a href={`tel:${service.contact}`}
                  className="flex items-center gap-1 text-brand text-sm font-medium whitespace-nowrap hover:text-brand-strong">
                  <Phone size={13} />
                  {service.contact}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fun Facts */}
      <section className="bg-yellow-50 border border-yellow-100 rounded-3xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Info size={22} className="text-yellow-600" />
          Did You Know? — Dahanu Facts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            'Dahanu produces over 70% of India\'s Chikoo (Sapota) supply.',
            'The Warli tribe of Dahanu has been practicing Warli painting for over 2,500 years.',
            'Dahanu was historically a Portuguese settlement, evidenced by old fort ruins.',
            'Gholvad, near Dahanu, grows some of the finest Alphonso mangoes (Hapus) in Maharashtra.',
            'Dahanu beach is a nesting ground for Olive Ridley sea turtles.',
            'The Dahanu thermal power station is one of the largest in Maharashtra.',
          ].map(fact => (
            <div key={fact} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-yellow-500 font-bold mt-0.5">✦</span>
              {fact}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
