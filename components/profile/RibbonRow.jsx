'use client'
/*
 * RibbonRow — R20 Galaxy-Spiral ribbon icons for prestige ribbons (R9).
 *
 * Minimal-viable per blocker resolution: 🌀 emoji per earned ribbon
 * with a gold tint via CSS filter. Entire row hides when count is 0
 * (per R20 "unearned slots hidden until first ribbon claimed").
 *
 * `size` is the icon font-size in rem; defaults to 1.4 for the
 * profile-page identity row, can be bumped for the larger ribbon
 * history strip on the stats page.
 */

export default function RibbonRow({ count = 0, size = 1.4 }) {
  if (!Number.isFinite(count) || count <= 0) return null
  return (
    <div
      className="flex items-center justify-center"
      style={{ gap: `${Math.max(0.25, size * 0.18)}rem`, marginTop: '0.6rem' }}
      aria-label={`${count} ribbon${count === 1 ? '' : 's'}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            fontSize: `${size}rem`,
            lineHeight: 1,
            // Gold tint mirroring RegionBadge / xp-fly particle vocabulary.
            filter: 'sepia(1) saturate(4) hue-rotate(-25deg) brightness(1.05) drop-shadow(0 0 4px rgba(228,176,34,0.8))',
          }}
        >
          🌀
        </span>
      ))}
    </div>
  )
}
