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
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand)] mb-1.5">
            Our Town
          </p>
          <h2 className="font-display text-[30px] md:text-[34px] leading-[1.15] text-[var(--color-bark)] tracking-[-0.01em]">
            A coastal town with strong local identity
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-[600px] leading-[1.7]">
            Dahanu is known for its chikoo orchards, beaches, Warli art, and a deep sense of
            community. OurDahanu is built to help that community discover, support, and recommend
            local businesses.
          </p>
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
