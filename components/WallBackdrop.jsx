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

        {/* Red atmosphere bloom — ONE light source over the gate view.
            Box is exactly 100vw so the gradient string stays byte-
            identical to GateScreen's (seamless handoff); it fully fades
            before the section edge, so the camera naturally leaves it
            behind. */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: 0, width: '100vw',
            background: 'radial-gradient(ellipse at 50% 55%, rgba(212,24,31,0.45) 0%, transparent 65%)',
          }}
        />

        {/* Band 1 — matches GateScreen: left -5% width 52% of the gate view. */}
        <div
          className="absolute"
          style={{
            top: '-25%', bottom: '-25%', left: '-5vw', width: '52vw',
            background: 'rgba(212,24,31,0.75)',
            transform: 'skewX(-12deg)',
          }}
        />
        {/* Band 3 — the gate view's right-edge accent (88vw → 108vw): its
            tail is the first thing the camera sweeps past on the pan, and
            it naturally bleeds 8vw into the profiles view's left edge. */}
        <div
          className="absolute"
          style={{
            top: '-25%', bottom: '-25%', left: '88vw', width: '20vw',
            background: 'rgba(212,24,31,0.55)',
            transform: 'skewX(-12deg)',
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
