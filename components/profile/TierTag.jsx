'use client'
/*
 * TierTag — R20 identity surface chip rendered on the profile page
 * directly under the warrior name.
 *
 * Minimal-viable: mirrors RegionBadge's parallelogram aesthetic
 * verbatim (gold #e4b022, italic Anton, clipPath polygon) with the
 * tier name as the label and the geometric multiplier below in mono
 * red. No per-tier kanji or color treatment in this iteration —
 * those are tracked in dispatches/blockers/gtl3_tier_visuals_and_copy.md
 * for a future polish pass.
 */

export default function TierTag({ tier, multiplier }) {
  if (!tier) return null
  const multLabel = Number.isFinite(multiplier) ? `×${multiplier.toFixed(2)}` : null
  return (
    <div className="text-center">
      <div
        className="inline-flex items-baseline gap-0.5 px-3 py-1"
        style={{ background: '#e4b022', clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }}
      >
        <span
          className="font-display leading-none text-gtl-ink"
          style={{ fontStyle: 'italic', fontSize: '1.25rem', letterSpacing: '0.04em' }}
        >
          {tier}
        </span>
      </div>
      {multLabel && (
        <div className="block mt-0.5">
          <span
            className="font-mono whitespace-nowrap"
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              color: '#c41e1e',
              fontWeight: 700,
              display: 'inline-block',
              transform: 'rotate(-6deg)',
              textShadow: '0 0 6px rgba(196,30,30,0.7)',
            }}
          >
            {multLabel}
          </span>
        </div>
      )}
    </div>
  )
}
