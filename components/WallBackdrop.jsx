'use client'
/*
 * WallBackdrop — the persistent "wall" behind the entry flow (Persona-
 * menu foundation).
 *
 * ONE CONTINUOUS SURFACE, not a tiled pattern (Jordan 2026-07-23: the
 * lines keep their world positions — panning past the screen edge shows
 * what's naturally beyond them, never a repeat). The 200vw canvas holds
 * a single composition, positioned in canvas-vw so the first 100vw is
 * pixel-identical to GateScreen's own backdrop (seamless unmount
 * handoff):
 *
 *   0–100vw   (gate view):     bloom centered, band 1 left, band 3 at
 *                              the right edge, corner ticks top-left.
 *   100–200vw (profiles view): band 3's tail sweeping off the left,
 *                              bloom falloff, then open dark wall with
 *                              closing corner ticks at the far end.
 *
 * Camera: --gtl-wall-x on <html> (lib/wallCamera.js). Lives in the ROOT
 * LAYOUT so the pan transition survives the / → /fitness route change.
 * Pages with opaque backgrounds simply cover it.
 */

import WallSurface from './WallSurface'

export default function WallBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <div
        className="absolute top-0 bottom-0 left-0"
        style={{
          width: '200vw',
          background: '#070708',
          transform: 'translateX(calc(var(--gtl-wall-x, 0) * -100vw))',
          transition: 'transform var(--gtl-wall-t, 700ms) cubic-bezier(0.65, 0, 0.2, 1)',
          willChange: 'transform',
        }}
      >
        <div className="absolute inset-0 gtl-noise" />

        {/* Section 0 — the SHARED WallSurface (same component GateScreen
            renders at rest), inside a 100vw box so its % geometry means
            the same pixels as the gate view. overflow stays visible so
            band 3's -8% overhang bleeds 8vw into section 1 — the
            continuation the camera sweeps past on the pan. Restyle the
            wall in WallSurface.jsx. */}
        <div className="absolute top-0 bottom-0" style={{ left: 0, width: '100vw' }}>
          <WallSurface />
        </div>

        {/* Section 1 ambience — the SAME red bloom, centered on the
            profiles view. Without it the wall's dark areas read warm
            red-black at the gate but neutral grey-black at WHO ARE YOU
            (measured (50,9,11) vs (22,22,24)) — the scene visibly cooled
            between camera stops (Jordan 2026-07-24). Bands stay unique
            per section; light is ambient and travels with each place. */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: '100vw', width: '100vw',
            background: 'radial-gradient(ellipse at 50% 55%, rgba(212,24,31,0.45) 0%, transparent 65%)',
          }}
        />

        {/* Corner ticks — world objects at the wall's extremes: the pair
            the gate shows top-left, and a closing pair at the far end of
            the wall (profiles view's right edge). The gate's own
            bottom-right pair belongs to GateScreen and leaves with it. */}
        <div className="absolute top-0 bg-gtl-red" style={{ left: 0, height: 5, width: 168 }} />
        <div className="absolute top-0 bg-gtl-red" style={{ left: 0, width: 5, height: 168 }} />
        <div className="absolute bottom-0 bg-gtl-red" style={{ right: 0, height: 5, width: 168 }} />
        <div className="absolute bottom-0 bg-gtl-red" style={{ right: 0, width: 5, height: 168 }} />
      </div>
    </div>
  )
}
