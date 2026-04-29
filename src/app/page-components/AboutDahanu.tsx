import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import Card from '@/components/ui/Card'

export default function AboutDahanu() {
  const features = [
    {
      title: '🌳 Chikoo Capital',
      desc: "Dahanu's sapodilla orchards are part of everyday life and the local economy — celebrated nationally for their quality.",
    },
    {
      title: '🎨 Warli Heritage',
      desc: "The region's tribal visual culture — geometric Warli art — gives our platform a distinctive and authentic local character.",
    },
    {
      title: '🤝 Built for Locals',
      desc: 'Designed to help residents find trusted services and support their neighbours. Community first, always.',
    },
  ]

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand)] mb-1.5">
              Our Story
            </p>
            <h2 className="font-display text-[30px] md:text-[34px] leading-[1.15] text-[var(--color-bark)] tracking-[-0.01em]">
              A community page growing into a local marketplace
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-[620px] leading-[1.7]">
              OurDahanu began as a social and WhatsApp community for Dahanu people. Now it is
              growing into a marketplace where locals can discover businesses, services, jobs and
              trusted recommendations.
            </p>
          </div>
          <Link
            href="/about"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--color-bark)] shadow-[0_10px_24px_rgba(46,18,5,0.06)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            Read our story
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {features.map((c) => (
            <Card
              key={c.title}
              className="border-[var(--color-border)] p-6"
            >
              <div className="font-bold text-[var(--color-bark)] flex items-center gap-2 mb-2">
                {c.title}
              </div>
              <p className="text-[13px] text-[var(--color-text-muted)] leading-[1.65]">{c.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
