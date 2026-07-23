'use client'
/*
 * DayStarRecap v2 — day-complete star roll call (Jordan's spec).
 *
 * Centerpiece: the EXACT WAR RECORD transmutation circle (shared
 * BodyStarChart component — identical image, live-updating). Sequence:
 *   1. "DAY COMPLETE" title slam.
 *   2. The transmutation circle at its PRE-day state (today's region
 *      EXP + stars subtracted out).
 *   3. Roll call: each exercise slams in as a red nameplate; its stars
 *      pop and fly on CURVED, accelerating arcs with motion trails into
 *      the circle's region badges — impact ring + count tick + region
 *      EXP lands per star (the star polygon literally grows when a
 *      region levels), chart kicks on each hit.
 *   4. Starless exercises appear dim ("TOO LIGHT").
 *   5. Hold on the final state = exactly what WAR RECORD now shows.
 *
 * Landing points are MEASURED from the chart's [data-region-badge]
 * elements (through its 3D tilt), so flights always hit the real image.
 * Tap anywhere skips to the final state. zIndex 9990 (under
 * TierUpFlourish at 10000).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSound } from '../../lib/useSound'
import BodyStarChart from '../stats/BodyStarChart'
import { BODY_REGIONS, MUSCLE_TO_REGION } from '../../lib/exp/regions'
import { computeProfileStats, sumDayRegionXP, getRegionStars } from '../../lib/exp'

const TITLE_MS = 800
const ROW_IN_MS = 300
const STAR_POP_MS = 170     // per-star spawn stagger on the row
const FLIGHT_MS = 760       // row → badge arc
const ROW_SETTLE_MS = 260
const STARLESS_MS = 500
const HOLD_MS = 1600

const CHART_TOP = 84
const ROWS_TOP = 542        // wide gap under the chart so flights read as travel
const ROW_H = 48

const sub5 = (a, b) => a.map((v, i) => Math.max(0, v - (b[i] || 0)))

function starsOf(entry) {
  const out = []
  entry.stars.forEach((n, region) => {
    for (let k = 0; k < n; k++) out.push(region)
  })
  return out
}

// Accelerating ease — slow launch, whip into the target.
const easeInCubic = (t) => t * t * t

export default function DayStarRecap({ entries, cycleId, iso, onDone }) {
  const { play } = useSound()
  const rootRef = useRef(null)

  // ── Pre/post day math (computed once on mount) ───────────────────────
  const world = useMemo(() => {
    const todayStars = [0, 0, 0, 0, 0]
    for (const e of entries) e.stars.forEach((n, i) => { todayStars[i] += n })
    let todayXP = [0, 0, 0, 0, 0]
    let finalXP = [0, 0, 0, 0, 0]
    let finalStars = todayStars
    try {
      todayXP = sumDayRegionXP(cycleId, iso)
      finalXP = computeProfileStats(MUSCLE_TO_REGION).regionXP
      finalStars = getRegionStars()
    } catch (_) {}
    const baseXP = sub5(finalXP, todayXP)
    const baseStars = sub5(finalStars, todayStars)
    const perStarXP = todayXP.map((xp, i) => (todayStars[i] > 0 ? xp / todayStars[i] : 0))
    return { todayStars, baseXP, baseStars, finalXP, finalStars, perStarXP }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [titleIn, setTitleIn] = useState(false)
  const [visibleRows, setVisibleRows] = useState(0)
  const [chartXP, setChartXP] = useState(world.baseXP)
  const [chartStars, setChartStars] = useState(world.baseStars)
  const [chartNew, setChartNew] = useState([0, 0, 0, 0, 0])
  const [kick, setKick] = useState(0)          // chart impact shake retrigger
  const [impacts, setImpacts] = useState([])   // landing rings {id, x, y}
  const [finale, setFinale] = useState(false)

  // ── Flight engine (rAF, quadratic bezier, trails) ────────────────────
  const [flightFrame, setFlightFrame] = useState([]) // [{id, x, y, ghosts:[{x,y}], scale, rot}]
  const flightsRef = useRef([])                      // active flight params
  const rafRef = useRef(0)
  const badgePosRef = useRef(null)                   // region index -> {x, y}
  const timersRef = useRef([])
  const skippedRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id }

  // Measure badge centers (through the 3D tilt) relative to the root.
  const measureBadges = () => {
    const root = rootRef.current
    if (!root) return null
    const rootRect = root.getBoundingClientRect()
    const pos = {}
    BODY_REGIONS.forEach((r, i) => {
      const el = root.querySelector(`[data-region-badge="${r.id}"]`)
      if (!el) return
      const b = el.getBoundingClientRect()
      pos[i] = { x: b.left - rootRect.left + b.width / 2, y: b.top - rootRect.top + b.height / 2 }
    })
    return pos
  }

  const tick = () => {
    const now = performance.now()
    const frame = []
    const landed = []
    for (const f of flightsRef.current) {
      const t = Math.min(1, (now - f.t0) / FLIGHT_MS)
      const e = easeInCubic(t)
      const bez = (p0, c, p1, u) =>
        (1 - u) * (1 - u) * p0 + 2 * (1 - u) * u * c + u * u * p1
      const at = (u) => ({ x: bez(f.p0.x, f.c.x, f.p1.x, u), y: bez(f.p0.y, f.c.y, f.p1.y, u) })
      const pos = at(e)
      const ghosts = [0.10, 0.2]
        .map(d => Math.max(0, e - d))
        .map(u => at(u))
      // Dynamic spin: steady rotation early (linear t) that whips faster
      // as the eased position accelerates into the badge.
      const rot = f.spinDir * 360 * f.spinTurns * (0.35 * t + 0.65 * e)
      frame.push({ id: f.id, x: pos.x, y: pos.y, ghosts, scale: 1.25 - 0.45 * e, rot })
      if (t >= 1) landed.push(f)
    }
    if (landed.length) {
      flightsRef.current = flightsRef.current.filter(f => !landed.includes(f))
      for (const f of landed) {
        play('stamp')
        setChartXP(xp => xp.map((v, i) => (i === f.region ? v + world.perStarXP[i] : v)))
        setChartStars(s => s.map((v, i) => (i === f.region ? v + 1 : v)))
        setChartNew(s => s.map((v, i) => (i === f.region ? v + 1 : v)))
        setKick(k => k + 1)
        const ringId = `${f.id}-ring`
        setImpacts(im => [...im, { id: ringId, x: f.p1.x, y: f.p1.y }])
        later(() => setImpacts(im => im.filter(r => r.id !== ringId)), 500)
      }
    }
    setFlightFrame(frame)
    if (flightsRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = 0
      setFlightFrame([])
    }
  }

  const launchStar = (region, rowIdx, starIdx, starCount) => {
    if (!badgePosRef.current) badgePosRef.current = measureBadges()
    const target = badgePosRef.current?.[region]
    if (!target) return
    const root = rootRef.current
    const w = root ? root.getBoundingClientRect().width : 390
    const cx = w / 2
    const p0 = {
      x: cx - ((starCount - 1) * 34) / 2 + starIdx * 34,
      y: ROWS_TOP + rowIdx * ROW_H + 34,
    }
    // Control point: midpoint pushed sideways — away from center line so
    // left-side badges curve left, right-side curve right.
    const mid = { x: (p0.x + target.x) / 2, y: (p0.y + target.y) / 2 }
    const side = target.x >= cx ? 1 : -1
    const c = { x: mid.x + side * 70, y: mid.y + 20 }
    flightsRef.current.push({
      id: `${rowIdx}-${starIdx}-${region}`,
      region, p0, p1: target, c, t0: performance.now(),
      spinDir: starIdx % 2 === 0 ? 1 : -1,
      spinTurns: 1.5 + Math.random() * 1.5,   // 1.5–3 full turns, varies per star
    })
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick)
  }

  // ── Choreography ─────────────────────────────────────────────────────
  useEffect(() => {
    let t = 80
    later(() => { setTitleIn(true); play('option-select') }, t)
    t += TITLE_MS

    entries.forEach((entry, rowIdx) => {
      const stars = starsOf(entry)
      later(() => { setVisibleRows(rowIdx + 1); play('card-confirm') }, t)
      t += ROW_IN_MS
      if (stars.length === 0) { t += STARLESS_MS; return }
      stars.forEach((region, sIdx) => {
        later(() => launchStar(region, rowIdx, sIdx, stars.length), t + sIdx * STAR_POP_MS)
      })
      t += stars.length * STAR_POP_MS + FLIGHT_MS + ROW_SETTLE_MS
    })

    later(() => setFinale(true), t)
    t += HOLD_MS
    later(() => onDoneRef.current?.(), t)

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSkip = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    flightsRef.current = []
    setFlightFrame([])
    setImpacts([])
    setTitleIn(true)
    setVisibleRows(entries.length)
    setChartXP(world.finalXP)
    setChartStars(world.finalStars)
    setChartNew(world.todayStars)
    setFinale(true)
    later(() => onDoneRef.current?.(), 800)
  }

  const totalStars = world.todayStars.reduce((a, b) => a + b, 0)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9990] overflow-hidden"
      style={{ background: 'rgba(5,4,5,0.97)' }}
      onPointerDown={handleSkip}
    >
      <div className="relative mx-auto h-full" style={{ width: 390, maxWidth: '100%' }}>

        {/* Title slam */}
        <div
          className="absolute left-0 right-0 text-center font-display uppercase"
          style={{
            top: 8,
            fontSize: '1.9rem',
            letterSpacing: '0.12em',
            color: '#f4ede0',
            textShadow: '3px 3px 0 #d4181f',
            transform: titleIn ? 'translateY(0) rotate(-2deg) scale(1)' : 'translateY(-24px) rotate(-2deg) scale(1.6)',
            opacity: titleIn ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.18, 1.2, 0.35, 1), opacity 200ms',
            zIndex: 5,
          }}
        >
          DAY COMPLETE
        </div>

        {/* THE transmutation circle — the exact WAR RECORD image, live */}
        <div
          key={`chartkick-${kick}`}
          className="absolute left-0 right-0"
          style={{
            top: CHART_TOP,
            animation: kick > 0 ? 'gtl-recap-kick 220ms ease-out' : 'none',
          }}
        >
          <BodyStarChart regionXP={chartXP} regionStars={chartStars} regionNewStars={chartNew} />
        </div>

        {/* Roll call nameplates */}
        {entries.map((entry, rowIdx) => {
          const shown = rowIdx < visibleRows
          const starless = starsOf(entry).length === 0
          return (
            <div
              key={entry.name + rowIdx}
              className="absolute left-0 right-0 flex justify-center"
              style={{
                top: ROWS_TOP + rowIdx * ROW_H,
                transform: shown ? 'translateX(0) scale(1)' : 'translateX(-56px) scale(1.15)',
                opacity: shown ? (starless ? 0.6 : 1) : 0,
                transition: 'transform 260ms cubic-bezier(0.18, 1.2, 0.35, 1), opacity 200ms',
                // Starless rows judder like a rejected input as they land
                // — wordless "that wasn't it" (Jordan 2026-07-23,
                // replacing the too-harsh NO STARS tag). Delay clears the
                // 260ms entrance transition first.
                animation: shown && starless
                  ? 'gtl-recap-reject 420ms ease-out 320ms'
                  : 'none',
              }}
            >
              <div
                className="font-display uppercase px-5 py-1.5"
                style={{
                  background: starless ? '#1c1c1f' : '#d4181f',
                  color: starless ? '#8a8a92' : '#f4ede0',
                  clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                  transform: `rotate(${rowIdx % 2 === 0 ? -1.2 : 0.9}deg)`,
                  fontSize: '1rem',
                  letterSpacing: '0.16em',
                  boxShadow: starless ? 'none' : '4px 4px 0 #4a0a0e',
                }}
              >
                {entry.name}
              </div>
            </div>
          )
        })}

        {/* Flying stars + trails */}
        {flightFrame.map(f => (
          <div key={f.id} className="absolute pointer-events-none" style={{ left: 0, top: 0, zIndex: 20 }}>
            {f.ghosts.map((g, gi) => (
              <div
                key={gi}
                className="absolute"
                style={{
                  left: g.x, top: g.y,
                  transform: `translate(-50%, -50%) rotate(${f.rot * (0.85 - gi * 0.1)}deg) scale(${f.scale * (0.7 - gi * 0.2)})`,
                  color: '#e4b022',
                  opacity: 0.35 - gi * 0.15,
                  fontSize: '2.4rem',
                }}
              >★</div>
            ))}
            <div
              className="absolute"
              style={{
                left: f.x, top: f.y,
                transform: `translate(-50%, -50%) rotate(${f.rot}deg) scale(${f.scale})`,
                color: '#e4b022',
                fontSize: '2.4rem',
                textShadow: '0 0 14px rgba(228,176,34,0.9)',
              }}
            >★</div>
          </div>
        ))}

        {/* Impact rings */}
        {impacts.map(r => (
          <div
            key={r.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: r.x - 24, top: r.y - 24, width: 48, height: 48,
              border: '2px solid #e4b022',
              animation: 'gtl-impact-ring 450ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
              zIndex: 19,
            }}
          />
        ))}

        {/* Finale line */}
        <div
          className="absolute left-0 right-0 text-center font-mono uppercase"
          style={{
            bottom: 56,
            fontSize: '0.62rem',
            letterSpacing: '0.34em',
            color: '#d4181f',
            opacity: finale ? 1 : 0,
            transition: 'opacity 350ms',
          }}
        >
          regions fed · {totalStars} stars
        </div>

        <style>{`
          @keyframes gtl-recap-kick {
            0%   { transform: translate(0, 0); }
            30%  { transform: translate(2px, -3px); }
            60%  { transform: translate(-2px, 2px); }
            100% { transform: translate(0, 0); }
          }
          @keyframes gtl-impact-ring {
            0%   { transform: scale(0.3); opacity: 0.9; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes gtl-recap-reject {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-7px) rotate(-0.8deg); }
            40% { transform: translateX(6px) rotate(0.6deg); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(3px); }
          }
        `}</style>
      </div>
    </div>
  )
}
