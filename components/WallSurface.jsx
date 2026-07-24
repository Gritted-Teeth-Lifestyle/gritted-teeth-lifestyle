'use client'
/*
 * WallSurface — THE single source of truth for the wall's "lines and
 * colors" (red bloom + the two skewed bands). Rendered by BOTH:
 *
 *   - GateScreen (resting backdrop, with the cold-load entrance cascade)
 *   - WallBackdrop (section 0 of the persistent world, static)
 *
 * That shared render is what keeps the ride handoff invisible: the gate's
 * resting pixels and the wall's section-0 pixels can never drift apart.
 * TO RESTYLE THE WALL, EDIT THIS FILE — both consumers update together.
 *
 * Geometry is % of a 100vw-wide, full-height box (in the gate that's the
 * button; in the wall it's a 100vw section wrapper), so the same numbers
 * mean the same pixels in both. Band 3 deliberately overhangs the right
 * edge (right:-8%): the gate clips it (overflow:hidden), the wall lets it
 * bleed 8vw into section 1 — the continuation the camera sweeps past.
 *
 * NOT included here: base color + noise (trivial, owned per consumer) and
 * the corner ticks (the gate owns both pairs; the wall places its pairs
 * at the canvas extremes — see each consumer).
 *
 * `entrance` (gate only): { skipLoading, active, instant } — drives the
 * cold-load cascade. Omit for the static world copy.
 */

export default function WallSurface({ entrance = null }) {
  const skipLoading = entrance?.skipLoading ?? true
  const active = entrance ? entrance.active : true
  const instant = entrance?.instant ?? false
  const transOf = (s) => (instant ? 'none' : s)

  return (
    <>
      <style>{`
        @keyframes gtl-band-1-in {
          from { transform: skewX(-12deg) translateX(-120%); }
          to   { transform: skewX(-12deg) translateX(0); }
        }
        @keyframes gtl-band-3-in {
          from { transform: skewX(-12deg) translateX(120%); }
          to   { transform: skewX(-12deg) translateX(0); }
        }
      `}</style>

      {/* Red atmosphere bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 55%, rgba(212,24,31,0.45) 0%, transparent 65%)',
          opacity: active ? 1 : 0,
          transition: entrance ? transOf('opacity 1400ms ease 300ms') : 'none',
        }}
      />
      {/* Band 1 — bright red, widest */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-25%', bottom: '-25%', left: '-5%', width: '52%',
          background: 'rgba(212,24,31,0.75)',
          transform: 'skewX(-12deg) translateX(0)',
          animation: skipLoading ? 'none' : 'gtl-band-1-in 1100ms cubic-bezier(0.15, 0, 0.1, 1) 150ms both',
        }}
      />
      {/* Band 3 — bright red, right-side accent (overhangs right edge) */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-25%', bottom: '-25%', right: '-8%', width: '20%',
          background: 'rgba(212,24,31,0.55)',
          transform: 'skewX(-12deg) translateX(0)',
          animation: skipLoading ? 'none' : 'gtl-band-3-in 1100ms cubic-bezier(0.15, 0, 0.1, 1) 225ms both',
        }}
      />
    </>
  )
}
