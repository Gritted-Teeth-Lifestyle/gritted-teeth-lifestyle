'use client'
/*
 * DayStarRecap — day-complete star roll call (Jordan's spec 2026-07-18).
 *
 * Plays after BRING ON TOMORROW is stamped, only when the day earned at
 * least one star. Beats:
 *   1. "DAY COMPLETE" title slam over a black overlay.
 *   2. Faint five-point region star (same CORE/ARMS/LEGS/FRONT/BACK
 *      arrangement as the WAR RECORD transmutation circle) with a label
 *      + counter badge at each vertex.
 *   3. Roll call: each exercise's name slides in as a row; its stars pop
 *      on the row, then FLY to their region vertices — vertex flares,
 *      counter ticks. Starless exercises appear dim ("— TOO LIGHT —").
 *   4. Hold on the final counts, then onDone().
 *
 * Stars are the INDICATOR of region EXP gain — region EXP only flows
 * from starred sets (see sumDayRegionXP), so what this animation shows
 * is literally where the day's region EXP went.
 *
 * Tap anywhere → skip: jump to final counts, brief hold, onDone().
 * zIndex 9990 — below TierUpFlourish (10000) so a tier-up still wins.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSound } from '../../lib/useSound'

const REGION_LABELS = ['CORE', 'ARMS', 'LEGS', 'FRONT', 'BACK']

// Design-width coordinates (390px column, matches GTL mobile-only layout).
const DESIGN_W = 390
const STAR_CX = 195
const STAR_CY = 190
const STAR_R = 118
// Vertex order + angles mirror the stats-page circle: CORE top, then
// ARMS / LEGS / FRONT / BACK clockwise at 72° steps.
const VERTEX = REGION_LABELS.map((_, i) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
  return { x: STAR_CX + STAR_R * Math.cos(a), y: STAR_CY + STAR_R * Math.sin(a) }
})

const ROWS_TOP = 386          // first roll-call row y
const ROW_H = 46
const TITLE_MS = 850          // title slam beat
const ROW_IN_MS = 260         // row slide-in
const STAR_POP_MS = 160       // per-star pop on the row
const FLIGHT_MS = 560         // row → vertex flight
const FLIGHT_STAGGER_MS = 130
const ROW_SETTLE_MS = 240     // pause after an exercise finishes
const STARLESS_MS = 520       // dim row beat
const HOLD_MS = 1300          // final hold on totals

// Per-exercise star list: one flying star per point, carrying its region.
function starsOf(entry) {
  const out = []
  entry.stars.forEach((n, region) => {
    for (let k = 0; k < n; k++) out.push(region)
  })
  return out
}

export default function DayStarRecap({ entries, onDone }) {
  const { play } = useSound()
  const [titleIn, setTitleIn] = useState(false)
  const [visibleRows, setVisibleRows] = useState(0)   // rows revealed so far
  const [flights, setFlights] = useState([])          // {id, region, x0, y0, launched}
  const [counts, setCounts] = useState([0, 0, 0, 0, 0])
  const [flare, setFlare] = useState([0, 0, 0, 0, 0]) // increment to retrigger pulse
  const [finale, setFinale] = useState(false)
  const skippedRef = useRef(false)
  const timersRef = useRef([])
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const totals = useMemo(() => {
    const t = [0, 0, 0, 0, 0]
    for (const e of entries) e.stars.forEach((n, i) => { t[i] += n })
    return t
  }, [entries])

  // Timer helper — everything registered here dies on unmount/skip.
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }

  // ── Choreography ──────────────────────────────────────────────────────
  useEffect(() => {
    let t = 60
    later(() => { setTitleIn(true); play('option-select') }, t)
    t += TITLE_MS

    entries.forEach((entry, rowIdx) => {
      const stars = starsOf(entry)
      later(() => { setVisibleRows(rowIdx + 1); play('card-confirm') }, t)
      t += ROW_IN_MS

      if (stars.length === 0) {
        t += STARLESS_MS
        return
      }
      // Spawn the row's stars, then launch each toward its vertex.
      stars.forEach((region, sIdx) => {
        const id = `${rowIdx}-${sIdx}`
        const x0 = STAR_CX - ((stars.length - 1) * 30) / 2 + sIdx * 30
        const y0 = ROWS_TOP + rowIdx * ROW_H + 30
        later(() => {
          setFlights(f => [...f, { id, region, x0, y0, launched: false }])
          // Launch on the next frame so the transition animates.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            setFlights(f => f.map(fl => fl.id === id ? { ...fl, launched: true } : fl))
          }))
        }, t + sIdx * STAR_POP_MS)
        // Landing: tick the counter, flare the vertex, remove the star.
        later(() => {
          play('stamp')
          setCounts(c => c.map((v, i) => i === region ? v + 1 : v))
          setFlare(fl => fl.map((v, i) => i === region ? v + 1 : v))
          setFlights(f => f.filter(x => x.id !== id))
        }, t + sIdx * STAR_POP_MS + STAR_POP_MS + FLIGHT_MS)
      })
      t += stars.length * STAR_POP_MS + FLIGHT_MS + FLIGHT_STAGGER_MS + ROW_SETTLE_MS
    })

    later(() => setFinale(true), t)
    t += HOLD_MS
    later(() => onDoneRef.current?.(), t)

    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tap to skip: kill timers, jump to totals, brief hold, done ────────
  const handleSkip = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setTitleIn(true)
    setVisibleRows(entries.length)
    setFlights([])
    setCounts(totals)
    setFinale(true)
    later(() => onDoneRef.current?.(), 700)
  }

  return (
    <div
      className="fixed inset-0 z-[9990]"
      style={{ background: 'rgba(6,4,5,0.96)' }}
      onPointerDown={handleSkip}
    >
      <div className="relative mx-auto h-full" style={{ width: DESIGN_W, maxWidth: '100%' }}>

        {/* Title slam */}
        <div
          className="absolute left-0 right-0 text-center font-display uppercase"
          style={{
            top: 26,
            fontSize: '2.1rem',
            letterSpacing: '0.12em',
            color: '#f4ede0',
            textShadow: '3px 3px 0 #d4181f',
            transform: titleIn ? 'translateY(0) rotate(-2deg) scale(1)' : 'translateY(-30px) rotate(-2deg) scale(1.6)',
            opacity: titleIn ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.18, 1.2, 0.35, 1), opacity 200ms',
          }}
        >
          DAY COMPLETE
        </div>

        {/* Region star — faint pentagram + vertex badges */}
        <svg
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
          width={DESIGN_W}
          height={330}
          viewBox={`0 0 ${DESIGN_W} 330`}
          aria-hidden="true"
        >
          <path
            d={`M ${VERTEX.map(v => `${v.x},${v.y}`).join(' L ')} Z`}
            fill="none"
            stroke="rgba(212,24,31,0.35)"
            strokeWidth="1.5"
          />
          {/* pentagram inner lines: connect every second vertex */}
          <path
            d={`M ${[0, 2, 4, 1, 3, 0].map(i => `${VERTEX[i].x},${VERTEX[i].y}`).join(' L ')}`}
            fill="none"
            stroke="rgba(212,24,31,0.18)"
            strokeWidth="1"
          />
        </svg>
        {REGION_LABELS.map((label, i) => (
          <div
            key={label}
            className="absolute text-center pointer-events-none"
            style={{
              left: VERTEX[i].x,
              top: VERTEX[i].y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              key={`pulse-${flare[i]}`}
              className="font-display px-2 py-0.5"
              style={{
                background: '#161618',
                border: '1px solid rgba(212,24,31,0.6)',
                clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                color: '#f4ede0',
                fontSize: '0.72rem',
                letterSpacing: '0.14em',
                animation: flare[i] > 0 ? 'gtl-vertex-flare 300ms ease-out' : 'none',
              }}
            >
              {label}
              <span style={{ color: '#e4b022', marginLeft: 6 }}>
                ★{counts[i]}
              </span>
            </div>
          </div>
        ))}

        {/* Roll call rows */}
        {entries.map((entry, rowIdx) => {
          const shown = rowIdx < visibleRows
          const starless = starsOf(entry).length === 0
          return (
            <div
              key={entry.name + rowIdx}
              className="absolute left-0 right-0 text-center"
              style={{
                top: ROWS_TOP + rowIdx * ROW_H,
                transform: shown ? 'translateX(0)' : 'translateX(-40px)',
                opacity: shown ? (starless ? 0.35 : 1) : 0,
                transition: 'transform 240ms cubic-bezier(0.2, 0.8, 0.3, 1), opacity 200ms',
              }}
            >
              <span
                className="font-display uppercase"
                style={{
                  fontSize: '1.05rem',
                  letterSpacing: '0.18em',
                  color: starless ? '#8a8a92' : '#f4ede0',
                }}
              >
                {entry.name}
              </span>
              {starless && shown && (
                <span
                  className="font-mono uppercase"
                  style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: '#6a6a72', marginLeft: 10 }}
                >
                  — too light —
                </span>
              )}
            </div>
          )
        })}

        {/* Flying stars */}
        {flights.map(f => (
          <div
            key={f.id}
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              transform: f.launched
                ? `translate(${VERTEX[f.region].x - 10}px, ${VERTEX[f.region].y - 12}px) rotate(360deg) scale(0.65)`
                : `translate(${f.x0 - 10}px, ${f.y0 - 12}px) rotate(0deg) scale(1)`,
              transition: f.launched
                ? `transform ${FLIGHT_MS}ms cubic-bezier(0.3, 0.1, 0.3, 1)`
                : 'none',
              color: '#e4b022',
              fontSize: '1.4rem',
              textShadow: '0 0 8px rgba(228,176,34,0.8)',
            }}
          >
            ★
          </div>
        ))}

        {/* Finale line */}
        <div
          className="absolute left-0 right-0 text-center font-mono uppercase"
          style={{
            bottom: 74,
            fontSize: '0.62rem',
            letterSpacing: '0.34em',
            color: '#d4181f',
            opacity: finale ? 1 : 0,
            transition: 'opacity 350ms',
          }}
        >
          regions fed · {totals.reduce((a, b) => a + b, 0)} stars
        </div>

        <style>{`
          @keyframes gtl-vertex-flare {
            0%   { transform: scale(1);    box-shadow: 0 0 0 rgba(228,176,34,0); }
            35%  { transform: scale(1.22); box-shadow: 0 0 18px rgba(228,176,34,0.55); }
            100% { transform: scale(1);    box-shadow: 0 0 0 rgba(228,176,34,0); }
          }
        `}</style>
      </div>
    </div>
  )
}
