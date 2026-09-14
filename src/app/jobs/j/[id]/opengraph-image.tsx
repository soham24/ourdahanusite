import { ImageResponse } from 'next/og'

import { getLiveJobPostById } from '@/lib/data/jobs'

export const alt = 'A post on OurDahanu Jobs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Coastal sunset palette, matching FindDahanu's share image.
const BARK = '#2E1205'
const TERRA = '#C0582E'
const TERRA_DEEP = '#8A3618'
const GOLD = '#C8881E'
const GOLD_LIGHT = '#F0C87A'
const CREAM = '#FBF0DC'

// Uses next/og's bundled default font, which covers Latin text only — so the
// image carries no rupee sign and no Marathi, and pay is left out.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getLiveJobPostById(id)

  const eyebrow = post ? (post.kind === 'hiring' ? 'Hiring' : 'Looking for work') : 'OurDahanu Jobs'
  const heading = post?.title ?? 'Local jobs in Dahanu'
  const subheading = post
    ? `${(post.kind === 'hiring' ? post.employer_name : post.display_name) ?? ''} · ${post.area}`
    : 'Free to post · Shops, farms, clinics and homes hiring'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: `linear-gradient(160deg, ${BARK} 0%, ${TERRA_DEEP} 45%, ${TERRA} 78%, ${GOLD} 130%)`,
        }}
      >
        <div style={{ display: 'flex', color: GOLD_LIGHT, fontSize: 30, fontWeight: 700 }}>{eyebrow}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', color: CREAM, fontSize: 72, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
            {heading}
          </div>
          <div style={{ display: 'flex', color: 'rgba(251,240,220,0.85)', fontSize: 34 }}>{subheading}</div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: '2px solid rgba(251,240,220,0.18)',
            color: 'rgba(251,240,220,0.65)',
            fontSize: 24,
          }}
        >
          <div style={{ display: 'flex' }}>jobs.ourdahanu.in</div>
          <div style={{ display: 'flex' }}>Never pay anyone to get a job</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
