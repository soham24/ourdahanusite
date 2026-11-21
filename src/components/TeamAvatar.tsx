// A team member's photo, or their initials on one of a few warm tones so a
// row of initials doesn't read as one block. Used on the home page and /about.

const TONES = [
  'from-[#C0582E] to-[#8A3618]',
  'from-[#D9944A] to-[#A8601F]',
  'from-[#7A8F5A] to-[#4F6436]',
  'from-[#B5654A] to-[#7E3A26]',
  'from-[#C8881E] to-[#8C5A0E]',
  'from-[#6F7FA0] to-[#45526E]',
]

const SIZES = {
  xl: 'h-36 w-36 rounded-[40px] text-5xl md:h-44 md:w-44',
  lg: 'h-16 w-16 rounded-[20px] text-xl',
  md: 'h-12 w-12 rounded-2xl text-base',
  sm: 'h-11 w-11 rounded-[14px] text-sm',
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export default function TeamAvatar({
  name,
  photo,
  index,
  size,
}: {
  name: string
  photo?: string
  /** Position in the list, to pick a tone; stable across pages. */
  index: number
  size: keyof typeof SIZES
}) {
  if (photo) {
    return <img src={photo} alt={name} loading="lazy" decoding="async" className={`${SIZES[size]} shrink-0 object-cover`} />
  }
  return (
    <span
      aria-hidden
      className={`${SIZES[size]} flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold tracking-wide text-white ${TONES[index % TONES.length]}`}
    >
      {initials(name)}
    </span>
  )
}
