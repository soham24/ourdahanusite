import { BadgeCheck, LogIn, PencilLine, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SubmitProfessionalForm from './SubmitProfessionalForm'
import { findLoginHref } from '../find-server'

const STEPS = [
  { icon: PencilLine, label: 'You suggest someone' },
  { icon: ShieldCheck, label: 'A moderator checks it' },
  { icon: BadgeCheck, label: 'It goes live' },
]

export default async function SubmitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const loginHref = user ? null : await findLoginHref('/submit')

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-balance font-display text-3xl sm:text-4xl">Add a professional</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--od-muted)]">
        Know a good electrician, tutor, or mechanic? Put them on the map for your neighbours.
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-2">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <li
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--od-border)] bg-[var(--color-surface-2)] px-2 py-3 text-center"
          >
            <Icon size={16} className="text-[var(--od-brand)]" aria-hidden />
            <span className="text-[11px] font-bold leading-tight text-[var(--od-ink-2)]">
              <span className="sr-only">Step {i + 1}: </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {user ? (
          <SubmitProfessionalForm />
        ) : (
          <div className="od-card flex flex-col items-center px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-surface-soft)] text-[var(--od-brand)]">
              <LogIn size={22} aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-xl">Log in to continue</h2>
            <p className="mt-1 max-w-sm text-sm text-[var(--od-muted)]">
              We ask for a login so every suggestion can be traced to a real neighbour.
            </p>
            <a href={loginHref!} className="od-button-primary mt-4 px-5 py-2 text-sm">
              Log in with Google
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
