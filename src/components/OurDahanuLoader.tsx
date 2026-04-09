/**
 * OurDahanu branded loading animation
 * Warli art-inspired motifs: rotating tribal triangles, pulsing sun, orbiting dots
 */
export default function OurDahanuLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-warli-fade-in select-none">
      {/* Warli motif container */}
      <div className="relative w-32 h-32 mb-8">
        {/* Outer ring — rotating Warli triangles */}
        <svg
          className="absolute inset-0 w-full h-full animate-warli-spin"
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
        >
          {/* 8 triangles around the circle — Warli dancing figures simplified */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <g key={angle} transform={`rotate(${angle} 64 64)`}>
              <polygon
                points="64,8 58,20 70,20"
                fill={i % 2 === 0 ? '#C4663A' : '#D4952A'}
                opacity={0.7 + (i % 2) * 0.3}
              />
            </g>
          ))}
          {/* Outer dotted circle */}
          <circle
            cx="64"
            cy="64"
            r="52"
            stroke="#C4663A"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            fill="none"
            opacity="0.4"
          />
        </svg>

        {/* Inner ring — reverse rotating dots and lines */}
        <svg
          className="absolute inset-0 w-full h-full animate-warli-spin-reverse"
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
        >
          {/* 6 small circles forming inner ring */}
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 64 64)`}>
              <circle cx="64" cy="28" r="2.5" fill="#D4784A" opacity="0.6" />
            </g>
          ))}
          {/* Inner connecting circle */}
          <circle
            cx="64"
            cy="64"
            r="36"
            stroke="#E8C99A"
            strokeWidth="1"
            fill="none"
            opacity="0.3"
          />
        </svg>

        {/* Center — pulsing Warli sun motif */}
        <svg
          className="absolute inset-0 w-full h-full animate-warli-pulse"
          viewBox="0 0 128 128"
          fill="none"
          aria-hidden="true"
        >
          {/* Sun circle */}
          <circle cx="64" cy="64" r="14" fill="#C4663A" opacity="0.15" />
          <circle cx="64" cy="64" r="10" fill="#C4663A" opacity="0.25" />
          <circle cx="64" cy="64" r="6" fill="#C4663A" />
          {/* Sun rays */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 64 64)`}>
              <line
                x1="64"
                y1="46"
                x2="64"
                y2="50"
                stroke="#C4663A"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>
          ))}
        </svg>

        {/* Orbiting dots — 3 particles at different phases */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-0 h-0">
            <div className="absolute animate-warli-orbit">
              <div className="w-2 h-2 rounded-full bg-chikoo-gold opacity-80" />
            </div>
            <div className="absolute animate-warli-orbit-delayed">
              <div className="w-1.5 h-1.5 rounded-full bg-warli-terra opacity-60" />
            </div>
            <div className="absolute animate-warli-orbit-delayed-2">
              <div className="w-1.5 h-1.5 rounded-full bg-warli-clay opacity-70" />
            </div>
          </div>
        </div>
      </div>

      {/* Brand text with shimmer */}
      <h2 className="text-2xl font-bold tracking-tight animate-warli-shimmer mb-2">
        OurDahanu
      </h2>

      {/* Loading message */}
      <p className="text-sm text-chikoo-brown/60 tracking-wide">
        {message || 'Discovering Dahanu\u2026'}
      </p>

      {/* Warli decorative dots below */}
      <div className="flex items-center gap-2 mt-5" aria-hidden="true">
        <span className="w-1 h-1 rounded-full bg-warli-terra/30" />
        <span className="w-1.5 h-1.5 rounded-full bg-warli-terra/50" />
        <span className="w-1 h-1 rounded-full bg-chikoo-gold/40" />
        <svg width="20" height="12" viewBox="0 0 20 12" className="opacity-40">
          <polygon points="10,0 16,10 4,10" fill="#C4663A" />
        </svg>
        <span className="w-1 h-1 rounded-full bg-chikoo-gold/40" />
        <span className="w-1.5 h-1.5 rounded-full bg-warli-terra/50" />
        <span className="w-1 h-1 rounded-full bg-warli-terra/30" />
      </div>
    </div>
  )
}

/**
 * Compact loader — for smaller sections / inline loading
 */
export function OurDahanuLoaderCompact({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-warli-fade-in select-none">
      <div className="relative w-16 h-16 mb-4">
        {/* Spinning ring */}
        <svg
          className="absolute inset-0 w-full h-full animate-warli-spin"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          {[0, 60, 120, 180, 240, 300].map((angle, i) => (
            <g key={angle} transform={`rotate(${angle} 32 32)`}>
              <polygon
                points="32,4 29,11 35,11"
                fill={i % 2 === 0 ? '#C4663A' : '#D4952A'}
                opacity={0.6 + (i % 3) * 0.2}
              />
            </g>
          ))}
          <circle cx="32" cy="32" r="24" stroke="#C4663A" strokeWidth="1" strokeDasharray="3 5" fill="none" opacity="0.3" />
        </svg>
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-warli-terra animate-warli-pulse" />
        </div>
      </div>
      {message && (
        <p className="text-xs text-chikoo-brown/50 tracking-wide">{message}</p>
      )}
    </div>
  )
}

/**
 * Skeleton card — placeholder for listing/content cards while loading
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-warli-sand/40 bg-white/60 overflow-hidden">
      {/* Image placeholder */}
      <div className="h-40 skeleton-shimmer" />
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-5 w-3/4 rounded skeleton-shimmer" />
        {/* Subtitle */}
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        {/* Description lines */}
        <div className="space-y-2 pt-1">
          <div className="h-3 w-full rounded skeleton-shimmer" />
          <div className="h-3 w-5/6 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton row — for list/table row placeholders
 */
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
