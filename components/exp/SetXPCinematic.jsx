'use client'
/*
 * SetXPCinematic v2 — "Beaten Bigger" (Jordan's pick, 2026-07-19).
 *
 * One giant Anton counter, slightly off-center and tilted, that gets
 * physically beaten larger. Beats:
 *   1. Counter SLAMS in at rawBase (scale snap, stamp sound).
 *   2. Each multiplier is an angled red chip that flies in from an
 *      alternating side, STRIKES — counter kicks, digits roll up
 *      odometer-style (rAF tween), chip settles into a spent stack
 *      below. Consistency chip strikes but doesn't accumulate (R8a
 *      deferral) — kick without a roll.
 *   3. Finale: diagonal red slash band cuts across — "+TOTAL EXP /
 *      SEIZED" — counter locks to snapshot.totalXP.
 *   4. Fly: everything rockets up to the XP bar (existing xp-fly
 *      vocabulary), onComplete fires.
 *
 * P5 rules honored vs v1: hard shadows only (no glow bloom), angled
 * clip-path chips instead of bare text, rotation/counter-rotation,
 * kanji watermark at 4%, verb copy (SEIZED), no emoji, snap enters.
 *
 * Kept from v1: props API {snapshot, tierName, onComplete}, zIndex
 * 9995 (under TierUpFlourish 10000), iOS leaked-click 150ms tap grace,
 * tap-to-skip (jumps to slash → fly).
 */
import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../lib/useSound'

const SLAM_AT_MS   = 120    // counter slam after mount
const CHIPS_FROM_MS = 640   // first chip launch
const CHIP_EVERY_MS = 560   // launch interval
const CHIP_FLIGHT_MS = 330  // side → slot
const ROLL_MS      = 280    // odometer roll after a strike
const SLASH_HOLD_MS = 750   // hold on the slash band
const FLY_MS       = 700
const POST_FLY_DISMISS_MS = 250
const MOUNT_TAP_GRACE_MS  = 150

const CLASS_LABEL = {
  king_compound: 'POWER LIFT',
  compound:      'COMPOUND',
  isolation:     'ISOLATION',
}

function fmt(n) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString()
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function SetXPCinematic({ snapshot, tierName, onComplete }) {
  const { play } = useSound()
  // 'enter' | 'slam' | 'hits' | 'slash' | 'fly' | 'gone'
  const [phase, setPhase] = useState('enter')
  const [display, setDisplay] = useState(0)      // rolled counter value
  const [flyingIdx, setFlyingIdx] = useState(-1) // chip currently in flight
  const [landedCount, setLandedCount] = useState(0)
  const [kick, setKick] = useState(0)            // counter jolt retrigger
  const mountTimeRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now())
  const timersRef = useRef([])
  const rollRef = useRef(0)
  const displayRef = useRef(0)
  const skippedRef = useRef(false)

  // ── Build the chip list from the snapshot (same math as v1) ─────────
  const rawBase         = Number(snapshot?.rawBase) || 0
  const heavyLiftBonus  = Number(snapshot?.heavyLiftBonus) || 0
  const stackBase       = Number(snapshot?.baseXP) || (rawBase + heavyLiftBonus)
  const consistencyMult = Number(snapshot?.consistencyMult) || 1.0
  const classMult       = Number(snapshot?.classMult) || 1.5
  const prestigeMult    = Number(snapshot?.prestigeMult) || 0
  const holidayMult     = Number(snapshot?.holidayMult) || 0
  const classification  = snapshot?.classification || 'compound'
  const totalXP         = Number(snapshot?.totalXP) || 0

  const chips = []
  if (heavyLiftBonus > 0) {
    chips.push({ label: 'HEAVY LIFT', running: rawBase + heavyLiftBonus })
  }
  if (consistencyMult > 1.0001) {
    // Informational — strikes, no accumulate (running unchanged).
    chips.push({ label: tierName || 'TIER', running: stackBase })
  }
  // Running totals follow the R2 formula: stackBase × (classMult +
  // prestigeMult + holidayMult) — the base is NOT added on top, or the
  // counter overshoots the true total and visibly rolls back down at
  // the slash.
  chips.push({
    label: CLASS_LABEL[classification] || 'COMPOUND',
    running: stackBase * classMult,
  })
  if (prestigeMult > 0.0001) {
    chips.push({ label: 'RIBBONS', running: stackBase * (classMult + prestigeMult) })
  }
  if (holidayMult > 0.0001) {
    chips.push({ label: 'HOLIDAY', running: stackBase * (classMult + prestigeMult + holidayMult) })
  }
  // STATUS QUO honesty layer (hidden-tax form, Jordan 2026-07-20):
  // a taxed set shows NO chip and no label — every displayed number is
  // quietly scaled by the multiplier (hiddenScale, applied to the slam
  // value and all chip runnings below) so the counter still only climbs
  // and the final number is the truth. The bonus shows as a normal red
  // chip named OVERLOAD (progressive overload — training at your edge).
  const statusQuoMult = Number(snapshot?.statusQuoMult) || 1.0
  const statusQuoKind = snapshot?.statusQuoKind || 'none'
  const hiddenScale = statusQuoKind === 'tax' ? statusQuoMult : 1.0
  if (statusQuoKind === 'climb' || statusQuoKind === 'fresh') {
    chips.push({
      label: statusQuoKind === 'fresh' ? 'NEW CYCLE' : 'OVERLOAD',
      running: stackBase * (classMult + prestigeMult + holidayMult) * statusQuoMult,
    })
  }
  for (const c of chips) c.running *= hiddenScale

  // Whole numbers only (Jordan 2026-07-22): each chip shows the EXP it
  // added to the counter — the delta between its landing value and the
  // previous one — never a multiplier. Deltas come from the scaled
  // runnings so a taxed set's chips stay consistent with the counter.
  // The tier chip is informational (R8a defers its credit to day close)
  // so its delta is 0 and it carries no number at all.
  let prevRunning = rawBase * hiddenScale
  for (const c of chips) {
    const delta = Math.round(c.running - prevRunning)
    c.detail = delta > 0 ? `+${delta.toLocaleString()}` : null
    prevRunning = c.running
  }

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id }

  // Odometer roll — rAF tween from current display to target.
  const rollTo = (target) => {
    if (rollRef.current) cancelAnimationFrame(rollRef.current)
    const from = displayRef.current
    if (from === target) return
    const t0 = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ROLL_MS)
      const v = from + (target - from) * easeOutCubic(t)
      displayRef.current = v
      setDisplay(v)
      if (t < 1) rollRef.current = requestAnimationFrame(step)
      else rollRef.current = 0
    }
    rollRef.current = requestAnimationFrame(step)
  }

  // ── Choreography ────────────────────────────────────────────────────
  useEffect(() => {
    later(() => {
      setPhase('slam')
      // hiddenScale keeps a taxed set's whole displayed path consistent
      // (slam through chips through slash) with no visible down-roll.
      displayRef.current = rawBase * hiddenScale
      setDisplay(rawBase * hiddenScale)
      play('stamp')
    }, SLAM_AT_MS)

    chips.forEach((chip, i) => {
      const launch = CHIPS_FROM_MS + i * CHIP_EVERY_MS
      later(() => { setPhase('hits'); setFlyingIdx(i) }, launch)
      later(() => {
        setFlyingIdx(-1)
        setLandedCount(i + 1)
        setKick(k => k + 1)
        play('card-confirm')
        rollTo(chip.running)
      }, launch + CHIP_FLIGHT_MS)
    })

    const slashAt = CHIPS_FROM_MS + chips.length * CHIP_EVERY_MS + 260
    later(() => {
      setPhase('slash')
      setKick(k => k + 1)
      play('stamp')
      rollTo(totalXP)
    }, slashAt)
    later(() => setPhase('fly'), slashAt + SLASH_HOLD_MS)
    later(() => { setPhase('gone') }, slashAt + SLASH_HOLD_MS + FLY_MS + POST_FLY_DISMISS_MS)

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (rollRef.current) cancelAnimationFrame(rollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // onComplete on gone.
  useEffect(() => {
    if (phase === 'gone') onComplete && onComplete()
  }, [phase, onComplete])

  // Tap skip — grace-gated. First tap jumps to the slash; a tap during
  // the slash launches the fly immediately.
  const handleBackdropTap = () => {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountTimeRef.current
    if (elapsed < MOUNT_TAP_GRACE_MS) return
    if (phase === 'slash') { setPhase('fly'); later(() => setPhase('gone'), FLY_MS + POST_FLY_DISMISS_MS); return }
    if (phase === 'fly' || phase === 'gone') return
    if (skippedRef.current) return
    skippedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (rollRef.current) { cancelAnimationFrame(rollRef.current); rollRef.current = 0 }
    setFlyingIdx(-1)
    setLandedCount(chips.length)
    displayRef.current = totalXP
    setDisplay(totalXP)
    setPhase('slash')
    later(() => setPhase('fly'), 450)
    later(() => setPhase('gone'), 450 + FLY_MS + POST_FLY_DISMISS_MS)
  }

  if (phase === 'gone') return null

  const counterIn = phase !== 'enter'
  const showSlash = phase === 'slash' || phase === 'fly'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="set xp cinematic"
      onClick={handleBackdropTap}
      onTouchEnd={handleBackdropTap}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9995,
        background: 'rgba(7,7,8,0.85)',
        overflow: 'hidden',
        animation: phase === 'fly' ? 'gtl-cine-backdrop-out 700ms ease-out forwards' : 'gtl-cine-backdrop-in 150ms ease-out both',
      }}
    >
      <style>{`
        @keyframes gtl-cine-backdrop-in  { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes gtl-cine-backdrop-out { 0% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes gtl-cine-slam {
          0%   { transform: rotate(-2deg) scale(1.7); opacity: 0; }
          60%  { transform: rotate(-2deg) scale(0.94); opacity: 1; }
          100% { transform: rotate(-2deg) scale(1); opacity: 1; }
        }
        @keyframes gtl-cine-kick {
          0%   { transform: rotate(-2deg) translate(0, 0) scale(1.07); }
          35%  { transform: rotate(-1.2deg) translate(3px, -4px) scale(1.03); }
          70%  { transform: rotate(-2.4deg) translate(-2px, 2px) scale(1); }
          100% { transform: rotate(-2deg) translate(0, 0) scale(1); }
        }
        @keyframes gtl-chip-strike-left {
          0%   { transform: translateX(-90vw) rotate(-16deg); }
          100% { transform: translateX(0) rotate(-2deg); }
        }
        @keyframes gtl-chip-strike-right {
          0%   { transform: translateX(90vw) rotate(16deg); }
          100% { transform: translateX(0) rotate(1.5deg); }
        }
        @keyframes gtl-cine-slash-in {
          0%   { transform: rotate(-6deg) translateX(-115%); }
          100% { transform: rotate(-6deg) translateX(0); }
        }
        @keyframes gtl-cine-fly {
          0%   { transform: scale(1)    translateY(0);  opacity: 1; }
          25%  { transform: scale(1.18) translateY(0); }
          100% { transform: scale(0.2)  translateY(-50vh); opacity: 0; }
        }
      `}</style>

      {/* Kanji watermark — 4%, oversized, off-center */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '8%',
          right: '-12%',
          fontSize: '19rem',
          fontWeight: 700,
          color: '#f4ede0',
          opacity: 0.04,
          userSelect: 'none',
          pointerEvents: 'none',
          transform: 'rotate(6deg)',
          lineHeight: 1,
        }}
      >力</span>

      <div
        style={{
          position: 'relative',
          margin: '0 auto',
          height: '100%',
          width: 390,
          maxWidth: '100%',
          animation: phase === 'fly' ? 'gtl-cine-fly 700ms cubic-bezier(0.4, 0, 1, 1) forwards' : 'none',
          transformOrigin: 'center',
        }}
      >
        {/* The counter — slightly left of center, tilted, hard shadow */}
        <div
          key={`kick-${kick}`}
          style={{
            position: 'absolute',
            top: '34%',
            left: 10,
            right: 34,
            textAlign: 'center',
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: 'clamp(3.4rem, 15vw, 5rem)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            color: '#e4b022',
            textShadow: '4px 4px 0 #1a1104',
            opacity: counterIn ? 1 : 0,
            animation: !counterIn ? 'none'
              : kick > 0 ? 'gtl-cine-kick 240ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              : 'gtl-cine-slam 260ms cubic-bezier(0.18, 1.2, 0.35, 1) both',
            transform: 'rotate(-2deg)',
          }}
        >
          +{fmt(display)}
          <span style={{ fontSize: '0.36em', marginLeft: 8, letterSpacing: '0.06em' }}>EXP</span>
        </div>

        {/* Spent-chip stack — settles below the counter, offset right */}
        <div
          style={{
            position: 'absolute',
            top: 'calc(34% + clamp(4rem, 17vw, 5.6rem))',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingLeft: 46,
          }}
        >
          {chips.map((chip, i) => {
            const flying = i === flyingIdx
            const landed = i < landedCount
            if (!flying && !landed) return null
            const fromLeft = i % 2 === 0
            return (
              <div
                key={chip.label + i}
                style={{
                  marginTop: i === 0 ? 0 : -3,
                  zIndex: 10 + i,
                  animation: flying
                    ? `${fromLeft ? 'gtl-chip-strike-left' : 'gtl-chip-strike-right'} ${CHIP_FLIGHT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) both`
                    : 'none',
                  transform: flying ? undefined : `rotate(${fromLeft ? -2 : 1.5}deg)`,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 10,
                    background: '#d4181f',
                    color: '#f4ede0',
                    clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
                    padding: '5px 18px 5px 14px',
                    boxShadow: '4px 4px 0 #2a0507',
                  }}
                >
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                    {chip.label}
                  </span>
                  {chip.detail && (
                    <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: '1.05rem', letterSpacing: '0.04em' }}>
                      {chip.detail}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Finale slash band */}
        {showSlash && (
          <div
            style={{
              position: 'absolute',
              top: '20%',
              left: '-12%',
              right: '-12%',
              animation: 'gtl-cine-slash-in 240ms cubic-bezier(0.2, 0.9, 0.25, 1) both',
              zIndex: 30,
            }}
          >
            <div
              style={{
                background: '#d4181f',
                clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
                padding: '10px 0',
                textAlign: 'center',
                boxShadow: '6px 6px 0 #2a0507',
              }}
            >
              <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: '1.6rem', color: '#f4ede0', letterSpacing: '0.04em' }}>
                +{fmt(totalXP)} EXP
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.34em', color: '#f4ede0', marginLeft: 16, verticalAlign: 'middle' }}>
                ╱ SEIZED
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
