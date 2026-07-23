'use client'
import Link from 'next/link'
import { useSound } from '../lib/useSound'

/**
 * Canonical RetreatButton — same look on every page.
 * Default href is `/fitness/hub` (the most common back-target);
 * pages that need a different back-target pass `href` explicitly.
 *
 * `onNavigate` (optional): the page owns the navigation — the Link's
 * default nav is prevented and the callback fires instead. Used by
 * screens that exit via the wall camera pan (profiles → gate).
 */
export default function RetreatButton({ href = '/fitness/hub', onNavigate }) {
  const { play } = useSound()

  return (
    <Link
      href={href}
      onClick={(e) => {
        play('menu-close')
        if (onNavigate) {
          e.preventDefault()
          onNavigate()
        }
      }}
      aria-label="Retreat"
      // data-retreat lets page-level skip listeners (window pointerdown/
      // touchstart that route forward to the in-flight transition's destination)
      // opt out — taps on retreat should navigate back, not fast-forward.
      data-retreat="true"
      className="group fixed left-0 z-40 inline-flex items-center px-3 py-3 scale-95 origin-left"
      style={{ top: 'env(safe-area-inset-top, 0px)', touchAction: 'manipulation' }}
    >
      {/* Three red chevrons. Decreasing opacity at idle gives directional read
          (left = back); on hover they brighten + shift left in stagger so it
          feels like the retreat is "pulling" you out. */}
      <span className="flex items-center gap-0.5 leading-none font-display text-2xl select-none">
        <span
          aria-hidden="true"
          className="text-gtl-red opacity-40 transition-all duration-200 ease-out [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright [@media(hover:hover)]:group-hover:-translate-x-1.5"
        >◀︎</span>
        <span
          aria-hidden="true"
          className="text-gtl-red opacity-70 transition-all duration-200 ease-out delay-[40ms] [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright [@media(hover:hover)]:group-hover:-translate-x-1"
        >◀︎</span>
        <span
          aria-hidden="true"
          className="text-gtl-red transition-all duration-200 ease-out delay-[80ms] [@media(hover:hover)]:group-hover:text-gtl-red-bright [@media(hover:hover)]:group-hover:-translate-x-0.5"
        >◀︎</span>
      </span>
    </Link>
  )
}
