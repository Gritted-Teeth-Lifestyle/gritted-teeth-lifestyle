'use client'
/*
 * WallBackdrop — the persistent "wall" behind the entry flow (Persona-
 * menu foundation, Jordan 2026-07-23: "the background should be the
 * lines and colors and look identical to the current press start
 * screen").
 *
 * A 200vw canvas fixed UNDER everything, two sections side by side,
 * each an exact static copy of GateScreen's backdrop composition
 * (near-black base + noise grain + red bloom + skewed bands + corner
 * ticks — see components/GateScreen.jsx). Section 0 sits under the
 * gate, section 1 under WHO ARE YOU.
 *
 * The camera is --gtl-wall-x on <html> (see lib/wallCamera.js). It
 * lives in the ROOT LAYOUT so the pan transition survives the route
 * change from / to /fitness — pages riding on top go transparent to
 * reveal it (gate covers it with its own identical backdrop until it
 * unmounts, making the handoff invisible).
 *
 * Pages with opaque backgrounds (hub, active, ...) simply cover it —
 * zero cost besides two static layers.
 */

function WallSection({ left }) {
  return (
    <div className="absolute top-0 bottom-0 overflow-hidden" style={{ left, width: '100vw' }}>
      {/* Red atmosphere bloom */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(212,24,31,0.45) 0%, transparent 65%)' }}
      />
      {/* Band 1 — bright red, widest */}
      <div
        className="absolute"
        style={{
          top: '-25%', bottom: '-25%', left: '-5%', width: '52%',
          background: 'rgba(212,24,31,0.75)',
          transform: 'skewX(-12deg)',
        }}
      />
      {/* Band 3 — right-side accent */}
      <div
        className="absolute"
        style={{
          top: '-25%', bottom: '-25%', right: '-8%', width: '20%',
          background: 'rgba(212,24,31,0.55)',
          transform: 'skewX(-12deg)',
        }}
      />
      {/* Corner accent ticks */}
      <div className="absolute top-0 left-0 bg-gtl-red" style={{ height: 5, width: 168 }} />
      <div className="absolute top-0 left-0 bg-gtl-red" style={{ width: 5, height: 168 }} />
      <div className="absolute bottom-0 right-0 bg-gtl-red" style={{ height: 5, width: 168 }} />
      <div className="absolute bottom-0 right-0 bg-gtl-red" style={{ width: 5, height: 168 }} />
    </div>
  )
}

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
        <WallSection left={0} />
        <WallSection left="100vw" />
      </div>
    </div>
  )
}
