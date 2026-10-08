'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { isTextClamped, softenLineBreaks } from '@/lib/catalog/description'

/**
 * An item description that is short by default and opens in place.
 *
 * Catalog cards sit in a grid, so an unbounded description would make one
 * card tower over its neighbours and push everything below it off the screen.
 * Clamping alone is what owners complained about: the text stopped mid-word
 * with an ellipsis and nothing said there was more, let alone offered it.
 *
 * Opening in place rather than linking to the item page is deliberate. A
 * reader part-way down a long catalogue who wants one more sentence should
 * not lose their position in it to get that sentence.
 *
 * The toggle only appears when the text is genuinely cut off — see
 * isTextClamped. Measurement happens after paint and again on resize, because
 * how many lines a description takes depends on the card's width, which
 * changes between phone and desktop and while the window is being dragged.
 */
export default function ExpandableDescription({
  text,
  className = '',
  clampClassName = 'line-clamp-3',
}: {
  text: string
  /** Applied to the paragraph in both states. */
  className?: string
  /** The clamp to use while collapsed. */
  clampClassName?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const paragraphRef = useRef<HTMLParagraphElement>(null)

  const measure = useCallback(() => {
    const el = paragraphRef.current
    if (!el) return
    setClamped(isTextClamped(el.scrollHeight, el.clientHeight))
  }, [])

  useEffect(() => {
    // Only measure while collapsed. Expanded, the paragraph is its own full
    // height by definition, so measuring would decide nothing is hidden and
    // take away the control the reader just used to open it.
    if (expanded) return
    measure()

    // Re-measure once the real face has loaded. The clamp fixes the
    // paragraph's height, so swapping from the fallback font changes how much
    // text overflows without changing the box the ResizeObserver watches --
    // it would never fire, and a description that only overflows in DM Sans
    // would lose its toggle.
    document.fonts?.ready.then(measure).catch(() => {})

    const el = paragraphRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [expanded, measure, text])

  return (
    <div>
      <p
        ref={paragraphRef}
        className={`whitespace-pre-line ${expanded ? '' : clampClassName} ${className}`}
      >
        {softenLineBreaks(text)}
      </p>

      {/* Rendered only once something is actually hidden: a control that
          reveals nothing is worse than no control. Once open it stays, so the
          reader can collapse it again. */}
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="-ml-1 mt-1 inline-flex min-h-10 items-center gap-1 px-1 text-xs font-bold text-[var(--od-brand-strong)] transition-colors hover:text-[var(--od-brand)]"
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown
            size={13}
            aria-hidden
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  )
}
