import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Megaphone, ArrowLeft, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { createAlert, resolveAlert } from '@/app/actions/admin'
import { siteConfig } from '@/lib/site'

const SEVERITIES = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700', icon: <Info size={14} /> },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle size={14} /> },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700', icon: <Megaphone size={14} /> },
]

const CATEGORIES = [
  'Weather', 'Traffic', 'Health', 'Water Supply', 'Electricity', 'Safety', 'Environment', 'Civic', 'Other'
]

function severityStyle(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-50 border-red-200 text-red-900'
    case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-900'
    default: return 'bg-blue-50 border-blue-200 text-blue-900'
  }
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default async function AdminEmergencyPage() {
  let alerts: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('emergency_alerts')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
    alerts = data || []
  } catch {
    // DB error
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-brand transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone size={22} className="text-red-500" />
            Emergency Alerts
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}. Alerts are broadcast to all community members.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active alerts */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Active Alerts</h2>

          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
              <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-green-900">No active alerts</p>
              <p className="text-green-700 text-sm mt-1">Everything looks calm in {siteConfig.town}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map(alert => (
                <div key={alert.id as string} className={`border rounded-2xl p-5 ${severityStyle(alert.severity as string)}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {SEVERITIES.find(s => s.value === alert.severity)?.icon}
                      <span className="font-bold">{alert.title as string}</span>
                    </div>
                    <span className="text-xs opacity-70 flex-shrink-0">{timeAgo(alert.created_at as string)}</span>
                  </div>

                  <p className="text-sm mb-3 opacity-80">{alert.description as string}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {alert.severity ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITIES.find(s => s.value === alert.severity)?.color || 'bg-gray-100 text-gray-600'}`}>
                          {String(alert.severity).charAt(0).toUpperCase() + String(alert.severity).slice(1)}
                        </span>
                      ) : null}
                      {alert.category ? (
                        <span className="text-xs text-gray-500">{String(alert.category)}</span>
                      ) : null}
                    </div>

                    <form action={resolveAlert.bind(null, alert.id as string)}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:border-brand hover:text-brand text-gray-600 font-semibold px-3 py-1.5 rounded-xl transition-colors text-xs"
                      >
                        <CheckCircle size={13} />
                        Resolve
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create new alert */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Alert</h2>

          <form action={createAlert} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Alert Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder={`e.g. Heavy Rain Warning for ${siteConfig.town}`}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                placeholder="Provide details about the situation and any instructions for residents..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="severity" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Severity <span className="text-red-500">*</span>
                </label>
                <select
                  id="severity"
                  name="severity"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white"
                >
                  {SEVERITIES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand text-sm bg-white"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs text-red-700">
                <strong>Warning:</strong> This alert will be immediately visible to all community members on the Emergency page. Only publish verified information.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Publish Alert Now
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
