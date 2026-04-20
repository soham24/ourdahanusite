import type { CSSProperties } from 'react'

const stars = [
  { width: 2, height: 2, top: '8%', left: '15%', duration: '2.8s', delay: '0s', min: 0.3 },
  { width: 3, height: 3, top: '12%', left: '30%', duration: '3.5s', delay: '0.5s', min: 0.2 },
  { width: 2, height: 2, top: '6%', left: '50%', duration: '4s', delay: '1s', min: 0.4 },
  { width: 2, height: 2, top: '18%', left: '68%', duration: '2.5s', delay: '0.3s', min: 0.2 },
  { width: 3, height: 3, top: '9%', left: '80%', duration: '3.8s', delay: '0.8s', min: 0.3 },
  { width: 2, height: 2, top: '22%', left: '22%', duration: '3.2s', delay: '1.5s', min: 0.2 },
  { width: 2, height: 2, top: '15%', left: '55%', duration: '4.5s', delay: '0.2s', min: 0.3 },
  { width: 2, height: 2, top: '25%', left: '40%', duration: '3s', delay: '1.8s', min: 0.15 },
  { width: 1, height: 1, top: '5%', left: '90%', duration: '2.2s', delay: '0.7s', min: 0.4 },
  { width: 2, height: 2, top: '30%', left: '75%', duration: '3.6s', delay: '1.2s', min: 0.2 },
] satisfies Array<{
  width: number
  height: number
  top: string
  left: string
  duration: string
  delay: string
  min: number
}>

const birds = [
  {
    top: '18%',
    duration: '9s',
    delay: '0s',
    width: 22,
    height: 8,
    viewBox: '0 0 22 8',
    path: 'M1 4 C4 1, 7 1, 11 4 C15 1, 18 1, 21 4',
    strokeWidth: 1.5,
  },
  {
    top: '24%',
    duration: '11s',
    delay: '3s',
    width: 16,
    height: 6,
    viewBox: '0 0 16 6',
    path: 'M1 3 C3 1, 5 1, 8 3 C11 1, 13 1, 15 3',
    strokeWidth: 1.2,
  },
  {
    top: '14%',
    duration: '13s',
    delay: '5.5s',
    width: 18,
    height: 7,
    viewBox: '0 0 18 7',
    path: 'M1 4 C3.5 1, 6 1, 9 4 C12 1, 14.5 1, 17 4',
    strokeWidth: 1.3,
  },
] satisfies Array<{
  top: string
  duration: string
  delay: string
  width: number
  height: number
  viewBox: string
  path: string
  strokeWidth: number
}>

function starStyle(star: (typeof stars)[number]): CSSProperties {
  return {
    width: `${star.width}px`,
    height: `${star.height}px`,
    top: star.top,
    left: star.left,
    ['--loader-star-duration' as string]: star.duration,
    ['--loader-star-delay' as string]: star.delay,
    ['--loader-star-min' as string]: star.min,
  }
}

function birdStyle(bird: (typeof birds)[number]): CSSProperties {
  return {
    top: bird.top,
    ['--loader-bird-duration' as string]: bird.duration,
    ['--loader-bird-delay' as string]: bird.delay,
  }
}

export default function OurDahanuLoader({
  message,
  fullScreen = false,
}: {
  message?: string
  fullScreen?: boolean
}) {
  const loaderMessage =
    message || 'Wait, we are bringing the OurDahanu experience to you.'

  return (
    <div
      className={`select-none ${fullScreen ? 'our-dahanu-loader-shell our-dahanu-loader-shell--fullscreen' : 'flex justify-center px-4 py-12'}`}
    >
      <div
        className={`our-dahanu-loader relative w-full ${fullScreen ? 'our-dahanu-loader--fullscreen max-w-none' : 'max-w-[380px]'}`}
      >
        <div className="our-dahanu-loader__scene">
          <div className="our-dahanu-loader__sky">
            {stars.map((star, index) => (
              <div
                key={`${star.top}-${star.left}-${index}`}
                className="our-dahanu-loader__star"
                style={starStyle(star)}
              />
            ))}

            <div className="our-dahanu-loader__logo" aria-hidden="true">
              <svg
                className="our-dahanu-loader__logo-svg"
                width="110"
                height="110"
                viewBox="0 0 110 110"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="loaderGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E8B84B" />
                    <stop offset="50%" stopColor="#C8881E" />
                    <stop offset="100%" stopColor="#A06010" />
                  </linearGradient>
                </defs>

                <circle
                  className="our-dahanu-loader__logo-glow"
                  cx="55"
                  cy="55"
                  r="52"
                  fill="rgba(200,136,30,0.06)"
                />

                <g className="our-dahanu-loader__ring-spin">
                  <circle
                    cx="55"
                    cy="55"
                    r="50"
                    stroke="#C8881E"
                    strokeWidth="2.5"
                    strokeDasharray="18 8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>

                <g className="our-dahanu-loader__ring-spin our-dahanu-loader__ring-spin--reverse">
                  <circle
                    cx="55"
                    cy="55"
                    r="44"
                    stroke="#E8B84B"
                    strokeWidth="1.2"
                    strokeDasharray="4 10"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>

                <circle
                  className="our-dahanu-loader__logo-center"
                  cx="55"
                  cy="55"
                  r="40"
                  fill="#1C0800"
                />
                <circle
                  className="our-dahanu-loader__logo-border-outer"
                  cx="55"
                  cy="55"
                  r="40"
                  stroke="url(#loaderGoldGrad)"
                  strokeWidth="1.8"
                  fill="none"
                />
                <circle
                  className="our-dahanu-loader__logo-border-inner"
                  cx="55"
                  cy="55"
                  r="35"
                  stroke="url(#loaderGoldGrad)"
                  strokeWidth="0.8"
                  fill="none"
                />

                <g className="our-dahanu-loader__logo-arc-top">
                  <path id="loaderTopArc" d="M 25,58 A 28,28 0 0,1 85,58" fill="none" />
                  <text
                    fontFamily="'DM Sans', sans-serif"
                    fontSize="6"
                    fontWeight="700"
                    fill="#C8881E"
                    letterSpacing="2.5"
                    textAnchor="middle"
                  >
                    <textPath href="#loaderTopArc" startOffset="50%">
                      OUR DAHANU
                    </textPath>
                  </text>
                </g>

                <text
                  className="our-dahanu-loader__logo-arc-star"
                  x="18"
                  y="58"
                  fontSize="7"
                  fill="#C8881E"
                  textAnchor="middle"
                >
                  ★
                </text>
                <text
                  className="our-dahanu-loader__logo-arc-star"
                  x="92"
                  y="58"
                  fontSize="7"
                  fill="#C8881E"
                  textAnchor="middle"
                >
                  ★
                </text>

                <text
                  className="our-dahanu-loader__logo-mono"
                  x="55"
                  y="62"
                  fontFamily="'Instrument Serif', Georgia, serif"
                  fontSize="26"
                  fontWeight="400"
                  fill="url(#loaderGoldGrad)"
                  textAnchor="middle"
                  letterSpacing="-1"
                >
                  DN
                </text>

                <g className="our-dahanu-loader__logo-arc-bottom">
                  <path id="loaderBotArc" d="M 22,55 A 33,33 0 0,0 88,55" fill="none" />
                  <text
                    fontSize="6.5"
                    fill="#C8881E"
                    letterSpacing="1"
                    textAnchor="middle"
                  >
                    <textPath href="#loaderBotArc" startOffset="50%">
                      आपले डहाणू
                    </textPath>
                  </text>
                </g>
              </svg>
            </div>

            <div className="our-dahanu-loader__logo-text" aria-hidden="true">
              <div className="our-dahanu-loader__logo-text-brand">
                Loading your OurDahanu
                <br />
                experience… hold on ✨
              </div>
            </div>

            {birds.map((bird, index) => (
              <div
                key={`${bird.top}-${index}`}
                className="our-dahanu-loader__bird"
                style={birdStyle(bird)}
                aria-hidden="true"
              >
                <svg
                  width={bird.width}
                  height={bird.height}
                  viewBox={bird.viewBox}
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d={bird.path}
                    stroke="#E8C49A"
                    strokeWidth={bird.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ))}

            <div className="our-dahanu-loader__ocean" aria-hidden="true">
              <div className="our-dahanu-loader__wave our-dahanu-loader__wave--back" />
              <div className="our-dahanu-loader__wave our-dahanu-loader__wave--mid" />
              <div className="our-dahanu-loader__wave our-dahanu-loader__wave--front" />
              <div className="our-dahanu-loader__wave-shimmer our-dahanu-loader__wave-shimmer--one" />
              <div className="our-dahanu-loader__wave-shimmer our-dahanu-loader__wave-shimmer--two" />
            </div>

            <div className="our-dahanu-loader__water-glow" aria-hidden="true" />

            <div className="our-dahanu-loader__sand" aria-hidden="true">
              <svg
                viewBox="0 0 380 130"
                preserveAspectRatio="none"
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8881E" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#A06A18" />
                    <stop offset="100%" stopColor="#7A4E10" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,40 Q60,10 140,30 Q220,50 300,20 Q340,10 380,25 L380,130 L0,130 Z"
                  fill="url(#sandGrad)"
                />
                <path
                  d="M20,60 Q80,55 140,62 Q200,68 260,58 Q310,52 360,62"
                  stroke="#D4952A"
                  strokeWidth="0.5"
                  fill="none"
                  opacity="0.4"
                />
                <path
                  d="M0,80 Q70,75 130,82 Q200,88 270,76 Q320,70 380,80"
                  stroke="#D4952A"
                  strokeWidth="0.5"
                  fill="none"
                  opacity="0.3"
                />
                <circle cx="90" cy="50" r="2" fill="#8B5E3C" opacity="0.6" />
                <circle cx="210" cy="44" r="1.5" fill="#8B5E3C" opacity="0.5" />
                <circle cx="310" cy="38" r="2" fill="#8B5E3C" opacity="0.55" />
                <circle cx="155" cy="58" r="1.5" fill="#6B4020" opacity="0.5" />
                <circle cx="260" cy="52" r="2" fill="#6B4020" opacity="0.4" />
                <path d="M330,48 Q335,44 340,48 Q335,52 330,48Z" fill="#E8C49A" opacity="0.7" />
                <path d="M335,48 L335,44" stroke="#D4A855" strokeWidth="0.8" opacity="0.5" />
              </svg>
            </div>

            <div className="our-dahanu-loader__tree" aria-hidden="true">
              <svg width="110" height="210" viewBox="0 0 110 210" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M52,210 C50,175 48,145 50,110 C51,90 50,70 52,50" stroke="#5A2D0C" strokeWidth="9" strokeLinecap="round" />
                <path d="M49,180 C52,178 54,180 52,182" stroke="#3D1A05" strokeWidth="1.5" opacity="0.6" />
                <path d="M50,155 C53,153 55,155 53,157" stroke="#3D1A05" strokeWidth="1.5" opacity="0.6" />
                <path d="M49,130 C52,128 54,130 52,132" stroke="#3D1A05" strokeWidth="1.5" opacity="0.6" />
                <path d="M52,80 C40,65 20,55 5,48" stroke="#5A2D0C" strokeWidth="5" strokeLinecap="round" />
                <path d="M52,70 C65,52 82,42 100,35" stroke="#5A2D0C" strokeWidth="5" strokeLinecap="round" />
                <path d="M52,95 C38,80 18,75 2,72" stroke="#5A2D0C" strokeWidth="4" strokeLinecap="round" />
                <path d="M52,90 C68,75 88,68 105,62" stroke="#5A2D0C" strokeWidth="4" strokeLinecap="round" />
                <path d="M52,110 C45,95 30,85 14,78" stroke="#5A2D0C" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M52,50 C45,38 38,28 34,15" stroke="#5A2D0C" strokeWidth="4" strokeLinecap="round" />
                <path d="M52,50 C60,36 68,26 74,12" stroke="#5A2D0C" strokeWidth="4" strokeLinecap="round" />
                <ellipse cx="30" cy="12" rx="14" ry="7" fill="#1F4020" transform="rotate(-30 30 12)" />
                <ellipse cx="55" cy="8" rx="12" ry="6" fill="#264D27" transform="rotate(10 55 8)" />
                <ellipse cx="76" cy="10" rx="13" ry="6" fill="#1F4020" transform="rotate(25 76 10)" />
                <ellipse cx="3" cy="44" rx="12" ry="5.5" fill="#264D27" transform="rotate(-15 3 44)" />
                <ellipse cx="102" cy="32" rx="12" ry="5.5" fill="#1F4020" transform="rotate(20 102 32)" />
                <ellipse cx="0" cy="70" rx="11" ry="5" fill="#1A3A1B" transform="rotate(-10 0 70)" />
                <ellipse cx="108" cy="60" rx="11" ry="5" fill="#1A3A1B" transform="rotate(15 108 60)" />
                <ellipse cx="12" cy="76" rx="10" ry="4.5" fill="#264D27" transform="rotate(-5 12 76)" />
                <line x1="22" y1="58" x2="18" y2="70" stroke="#5A2D0C" strokeWidth="1.2" />
                <ellipse cx="18" cy="74" rx="6" ry="7.5" fill="#7A4218" transform="rotate(-10 18 74)" />
                <ellipse cx="16.5" cy="71" rx="2" ry="1.5" fill="rgba(255,255,255,0.15)" />
                <line x1="80" y1="45" x2="84" y2="56" stroke="#5A2D0C" strokeWidth="1.2" />
                <ellipse cx="84" cy="60" rx="6" ry="7.5" fill="#8B5018" transform="rotate(8 84 60)" />
                <ellipse cx="82.5" cy="57" rx="2" ry="1.5" fill="rgba(255,255,255,0.15)" />
                <line x1="38" y1="22" x2="34" y2="32" stroke="#5A2D0C" strokeWidth="1.2" />
                <ellipse cx="33" cy="36" rx="5.5" ry="7" fill="#9A6020" transform="rotate(-8 33 36)" />
                <ellipse cx="31.5" cy="33" rx="1.8" ry="1.3" fill="rgba(255,255,255,0.2)" />
                <line x1="66" y1="18" x2="70" y2="28" stroke="#5A2D0C" strokeWidth="1.2" />
                <ellipse cx="70" cy="32" rx="5" ry="6.5" fill="#7A4218" transform="rotate(12 70 32)" />
              </svg>
            </div>

            <div className="our-dahanu-loader__palm" aria-hidden="true">
              <svg width="80" height="175" viewBox="0 0 80 175" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50,175 C48,150 45,120 42,95 C40,75 38,55 36,40" stroke="#5A3010" strokeWidth="7" strokeLinecap="round" />
                <path d="M36,40 C20,28 5,30 0,24 C8,20 20,22 36,38" fill="#1A4020" opacity="0.9" />
                <path d="M36,40 C50,24 62,22 72,14 C68,22 58,28 36,42" fill="#1F4820" opacity="0.85" />
                <path d="M36,40 C26,22 24,10 20,4 C24,10 28,20 36,42" fill="#1A4020" opacity="0.8" />
                <path d="M36,40 C48,20 56,12 62,6 C58,14 50,22 36,42" fill="#264D27" opacity="0.8" />
                <path d="M36,40 C18,38 8,44 2,44 C10,38 22,36 36,42" fill="#1A4020" opacity="0.7" />
                <path d="M36,40 C56,36 66,40 76,38 C66,36 54,38 36,42" fill="#1F4820" opacity="0.75" />
                <circle cx="34" cy="44" r="5" fill="#5A3010" />
                <circle cx="40" cy="46" r="4.5" fill="#4A2808" />
                <circle cx="28" cy="46" r="4" fill="#5A3010" />
              </svg>
            </div>

            <svg
              className="our-dahanu-loader__warli"
              width="200"
              height="80"
              viewBox="0 0 200 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="90" cy="18" r="6" fill="#E8C49A" opacity="0.5" />
              <line x1="90" y1="24" x2="90" y2="46" stroke="#E8C49A" strokeWidth="1.8" opacity="0.5" />
              <line x1="90" y1="46" x2="78" y2="58" stroke="#E8C49A" strokeWidth="1.8" opacity="0.5" />
              <line x1="90" y1="46" x2="102" y2="58" stroke="#E8C49A" strokeWidth="1.8" opacity="0.5" />
              <line x1="90" y1="34" x2="76" y2="28" stroke="#E8C49A" strokeWidth="1.8" opacity="0.5" />
              <line x1="90" y1="34" x2="104" y2="28" stroke="#E8C49A" strokeWidth="1.8" opacity="0.5" />
              <circle cx="136" cy="22" r="5.5" fill="#E8C49A" opacity="0.4" />
              <line x1="136" y1="28" x2="136" y2="52" stroke="#E8C49A" strokeWidth="1.8" opacity="0.4" />
              <line x1="136" y1="52" x2="128" y2="66" stroke="#E8C49A" strokeWidth="1.8" opacity="0.4" />
              <line x1="136" y1="52" x2="144" y2="66" stroke="#E8C49A" strokeWidth="1.8" opacity="0.4" />
              <line x1="136" y1="36" x2="124" y2="30" stroke="#E8C49A" strokeWidth="1.8" opacity="0.4" />
              <line x1="136" y1="36" x2="148" y2="42" stroke="#E8C49A" strokeWidth="1.8" opacity="0.4" />
              <path d="M150,2 L158,14 L142,14 Z" fill="#C8881E" opacity="0.35" />
              <line x1="154" y1="2" x2="154" y2="14" stroke="#C8881E" strokeWidth="1" opacity="0.35" />
              <line x1="76" y1="28" x2="60" y2="10" stroke="#E8C49A" strokeWidth="1" opacity="0.4" strokeDasharray="1,0" />
              <line x1="60" y1="10" x2="56" y2="30" stroke="#E8C49A" strokeWidth="0.8" opacity="0.3" strokeDasharray="2,2" />
            </svg>

            <div className="our-dahanu-loader__text">
              <div className="our-dahanu-loader__brand">OurDahanu</div>
              <div className="our-dahanu-loader__sub">{loaderMessage}</div>
              <div className="our-dahanu-loader__dots" aria-label={loaderMessage}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="our-dahanu-loader__dot" />
                ))}
              </div>
            </div>
          </div>

          <div className="our-dahanu-loader__border" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

export function OurDahanuLoaderCompact({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center select-none">
      <div className="our-dahanu-loader__dots mb-4" aria-label={message || 'Loading'}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="our-dahanu-loader__dot" />
        ))}
      </div>
      <div className="font-display text-xl text-[var(--color-gold)]">OurDahanu</div>
      {message ? (
        <p className="mt-2 text-sm text-[color:rgba(122,69,32,0.7)]">{message}</p>
      ) : null}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-warli-sand/40 bg-white/60 overflow-hidden">
      <div className="h-40 skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 rounded skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        <div className="space-y-2 pt-1">
          <div className="h-3 w-full rounded skeleton-shimmer" />
          <div className="h-3 w-5/6 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 rounded skeleton-shimmer" />
        <div className="h-3 w-3/5 rounded skeleton-shimmer" />
      </div>
      <div className="h-8 w-16 rounded skeleton-shimmer shrink-0" />
    </div>
  )
}
