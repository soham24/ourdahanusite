import type { Metadata } from 'next'

import DirectoryList from './DirectoryList'
import { getAppointmentDirectory } from '@/lib/data/appointment-directory'
import { buildStandaloneUrl } from '@/lib/standalone-hosts'
import { siteConfig } from '@/lib/site'

export const metadata: Metadata = {
  title: `Book an Appointment in ${siteConfig.town}`,
  description:
    `Book appointments with clinics, dentists, salons and tutors in ${siteConfig.town}. See the next free slot and book online.`,
  alternates: { canonical: buildStandaloneUrl('appointments') },
}

export default async function AppointmentsDirectoryPage() {
  const entries = await getAppointmentDirectory()

  return (
    <div>
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-[var(--od-border)] bg-[var(--color-surface-2)] px-4 pb-7 pt-9 sm:pb-9 sm:pt-11">
        <div className="warli-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <p className="od-eyebrow">{siteConfig.town} appointments</p>
          <h1 className="mt-2 text-balance font-display text-4xl leading-[1.08] sm:text-5xl">
            Book a slot, <em className="text-[var(--od-brand)]">skip the queue</em>.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-[var(--od-muted)] sm:text-[15px]">
            Clinics, dentists, salons and tutors in {siteConfig.town} — pick a time that works and book it
            online.
          </p>
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-[var(--od-border)] px-4 py-10 text-center text-sm text-[var(--od-muted)]">
          No businesses are taking online bookings yet. Check back soon.
        </p>
      ) : (
        <DirectoryList entries={entries} />
      )}
    </div>
  )
}
