import { ImageResponse } from 'next/og'

export const alt = 'Chikoo Catcher — A Dahanu Mini-Game on OurDahanu'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Coastal sunset palette, matching the site's hero and FindDahanu's OG image
// (globals.css / find/p/[id]/opengraph-image.tsx).
const BARK = '#2E1205'
const TERRA = '#C0582E'
const TERRA_DEEP = '#8A3618'
const GOLD = '#C8881E'
const GOLD_LIGHT = '#F0C87A'
const CREAM = '#FBF0DC'
const LEAF = '#6B8E4E'

async function loadFont(weight: 400 | 700) {
  const family = weight === 700 ? 'DM+Sans:wght@700' : 'DM+Sans:wght@400'
  const text = 'Chikoo Catcher A Dahanu Mini-Game OurDahanu Arcade Catch dodge climb the leaderboard ourdahanu.in/play'
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)
  ).text()
  const match = css.match(/src: url\(([^)]+)\)/)
  if (!match) throw new Error('font css had no src url')
  const res = await fetch(match[1])
  return res.arrayBuffer()
}

function chikooSvg(rotate: number): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="transform:rotate(${rotate}deg)">
      <ellipse cx="50" cy="56" rx="34" ry="30" fill="${GOLD_LIGHT}"/>
      <ellipse cx="50" cy="56" rx="34" ry="30" fill="${TERRA}" fill-opacity="0.18"/>
      <path d="M50 26c4-8 14-10 18-6-4 6-12 8-18 6z" fill="${LEAF}"/>
    </svg>`,
  )}`
}

export default async function Image() {
  const [dmBold, dmRegular] = await Promise.all([loadFont(700), loadFont(400)])

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
            background: 'radial-gradient(circle, rgba(240,200,122,0.5) 0%, rgba(232,168,85,0.2) 45%, transparent 72%)',
            display: 'flex',
          }}
        />

        {/* falling chikoos, decorative */}
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires plain <img> */}
        <img
          src={chikooSvg(-8)}
          width={92}
          height={92}
          alt=""
          style={{ position: 'absolute', top: 90, right: 160 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires plain <img> */}
        <img
          src={chikooSvg(14)}
          width={64}
          height={64}
          alt=""
          style={{ position: 'absolute', top: 220, right: 60 }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires plain <img> */}
        <img
          src={chikooSvg(6)}
          width={56}
          height={56}
          alt=""
          style={{ position: 'absolute', bottom: 160, right: 240 }}
        />

        {/* top row: brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              fontSize: 44,
            }}
          >
            🧺
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
              marginLeft: 16,
            }}
          >
            OurDahanu Arcade
          </div>
        </div>

        {/* middle: title + tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              color: CREAM,
              fontSize: 84,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            Chikoo Catcher
          </div>
          <div
            style={{
              display: 'flex',
              color: GOLD_LIGHT,
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            A Dahanu Mini-Game
          </div>
          <div
            style={{
              display: 'flex',
              color: 'rgba(251,240,220,0.85)',
              fontSize: 26,
              fontWeight: 400,
              maxWidth: 760,
            }}
          >
            Catch, dodge, climb the leaderboard
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
            ourdahanu.in/play
          </div>
          <div style={{ display: 'flex', color: 'rgba(251,240,220,0.65)', fontSize: 22, fontWeight: 400 }}>
            Weekly &amp; all-time leaderboard
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
