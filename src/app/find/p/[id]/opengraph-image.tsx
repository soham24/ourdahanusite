import { ImageResponse } from 'next/og'
import { getProfessionalById } from '@/lib/data/find'
import { professionLabels } from '../../find-ui'

export const alt = 'Professional profile on FindDahanu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Coastal sunset palette, matching the main site's hero (globals.css).
const BARK = '#2E1205'
const TERRA = '#C0582E'
const TERRA_DEEP = '#8A3618'
const GOLD = '#C8881E'
const GOLD_LIGHT = '#F0C87A'
const CREAM = '#FBF0DC'

async function loadFont(weight: 400 | 700, text: string) {
  const family = weight === 700 ? 'DM+Sans:wght@700' : 'DM+Sans:wght@400'
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)
  ).text()
  const match = css.match(/src: url\(([^)]+)\)/)
  if (!match) throw new Error('font css had no src url')
  const res = await fetch(match[1])
  return res.arrayBuffer()
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pro = await getProfessionalById(id)

  const name = pro?.name ?? 'FindDahanu'
  const professions = pro ? professionLabels(pro).map((l) => l.label).join(' · ') : 'Trusted local professionals'
  const ratingText = pro && pro.rating_count > 0 ? `${pro.avg_rating.toFixed(1)} · ${pro.rating_count} rating${pro.rating_count === 1 ? '' : 's'}` : null
  // Only plain-Latin text goes through the webfont — DM Sans's hosted subset
  // has no glyph for a star symbol, so the rating star is a drawn SVG below.
  const glyphText = `${name} ${professions} ${ratingText ?? ''} FindDahanu Dahanu Vouched by neighbours`
  const starSvg = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${GOLD_LIGHT}"><path d="M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.27l-6.18 3.24L7 13.63l-5-4.87 6.91-1z"/></svg>`,
  )}`

  const [dmBold, dmRegular] = await Promise.all([loadFont(700, glyphText), loadFont(400, glyphText)])

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
          fontFamily: 'DM Sans',
        }}
      >
        {/* subtle sun glow, top right */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -100,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(240,200,122,0.5) 0%, rgba(232,168,85,0.2) 45%, transparent 72%)`,
            display: 'flex',
          }}
        />

        {/* top row: monogram + brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 108,
              height: 108,
              borderRadius: '50%',
              background: BARK,
              border: `3px solid ${GOLD_LIGHT}`,
              color: GOLD_LIGHT,
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            {initials(name)}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(251,240,220,0.8)',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            FindDahanu
          </div>
        </div>

        {/* middle: name + professions + rating */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              color: CREAM,
              fontSize: 66,
              fontWeight: 700,
              letterSpacing: -1.5,
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: 'flex',
              color: GOLD_LIGHT,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {professions}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'rgba(251,240,220,0.85)',
              fontSize: 26,
              fontWeight: 400,
            }}
          >
            {ratingText ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires plain <img> */}
                <img src={starSvg} width={26} height={26} alt="" />
                <span style={{ display: 'flex' }}>{ratingText}</span>
              </>
            ) : (
              <span style={{ display: 'flex' }}>Vouched by neighbours</span>
            )}
          </div>
        </div>

        {/* bottom: footer strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: '2px solid rgba(251,240,220,0.18)',
          }}
        >
          <div style={{ display: 'flex', color: 'rgba(251,240,220,0.65)', fontSize: 22, fontWeight: 400 }}>
            find.ourdahanu.in
          </div>
          <div style={{ display: 'flex', color: 'rgba(251,240,220,0.65)', fontSize: 22, fontWeight: 400 }}>
            Every rating checked by a moderator
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'DM Sans', data: dmBold, weight: 700, style: 'normal' },
        { name: 'DM Sans', data: dmRegular, weight: 400, style: 'normal' },
      ],
    },
  )
}
