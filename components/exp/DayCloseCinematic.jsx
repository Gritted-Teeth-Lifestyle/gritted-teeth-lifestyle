'use client'
/*
 * DayCloseCinematic — the day-close reckoning beat (Jordan 2026-07-22:
 * "if exp is added at day close, present it at day close by bringing up
 * today's exp and doing the ribbon it should have during that time,
 * even if it is just the one ribbon").
 *
 * Plays on BRING ON TOMORROW when the day earned a consistency credit
 * (R8a — completion ≥50%). Deliberately IDENTICAL vocabulary to
 * SetXPCinematic — same gold Anton counter ("+N EXP"), same backdrop,
 * same red chip striking in from the left — so it reads as the same
 * system paying out, one screen later:
 *   1. TODAY'S EXP counter slams in at the day's set total (stamp).
 *   2. The tier chip — the one that strikes without a number on every
 *      set — flies in and finally pays: +credit rolls the counter to
 *      the day's true total (kick + confirm).
 *   3. Hold, wipe out, onDone fires.
 *
 * Tap-to-skip after the mount grace jumps straight to the final total
 * and a fast out. zIndex 9995 (under TierUpFlourish 10000) — a tier-up
 * sticker slap still paints over this if the stamp crossed a tier.
 *
 * Props:
 *   dayXP    — today's set EXP (display scale), WITHOUT the credit
 *   credit   — consistency credit added at close (display scale)
 *   tierName — tier whose multiplier priced the credit (pre-tick tier)
 *   onDone
 */
import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../lib/useSound'

const SLAM_AT_MS   = 120
const CHIP_AT_MS   = 700
const CHIP_FLIGHT_MS = 330
const ROLL_MS      = 280
const HOLD_MS      = 950
const OUT_MS       = 320
const MOUNT_TAP_GRACE_MS = 150

function fmt(n) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString()
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export default function DayCloseCinematic({ dayXP, credit, tierName, onDone }) {
  const { play } = useSound()
  // enter | slam | strike | out
  const [stage, setStage] = useState('enter')
  const [display, setDisplay] = useState(0)
  const [landed, setLanded] = useState(false)
  const [kick, setKick] = useState(0)
  const mountRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now())
  const timersRef = useRef([])
  const rollRef = useRef(0)
  const displayRef = useRef(0)
  const skippedRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const total = (Number(dayXP) || 0) + (Number(credit) || 0)
  // Same floor as the set chips: a real credit never reads as +0.
  const creditShown = Math.max(1, Math.round(Number(credit) || 0))

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); return id }

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

  useEffect(() => {
    later(() => {
      setStage('slam')
      displayRef.current = dayXP
      setDisplay(dayXP)
      play('stamp')
    }, SLAM_AT_MS)
    later(() => {
      setStage('strike')
    }, CHIP_AT_MS)
    later(() => {
      setLanded(true)
      setKick(1)
      play('card-confirm')
      rollTo(total)
    }, CHIP_AT_MS + CHIP_FLIGHT_MS)
    later(() => setStage('out'), CHIP_AT_MS + CHIP_FLIGHT_MS + ROLL_MS + HOLD_MS)
    later(() => onDoneRef.current?.(), CHIP_AT_MS + CHIP_FLIGHT_MS + ROLL_MS + HOLD_MS + OUT_MS)
    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (rollRef.current) cancelAnimationFrame(rollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => {
    if (skippedRef.current) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - mountRef.current < MOUNT_TAP_GRACE_MS) return
    skippedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    if (rollRef.current) cancelAnimationFrame(rollRef.current)
    displayRef.current = total
    setDisplay(total)
    setLanded(true)
    setStage('out')
    setTimeout(() => onDoneRef.current?.(), OUT_MS)
  }

  const counterIn = stage !== 'enter'
  const chipFlying = stage === 'strike' && !landed
  const showChip = chipFlying || landed

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="day close reckoning"
      onPointerDown={skip}
      style={{
        position: 'fixed', inset: 0, zIndex: 9995,
        background: 'rgba(7,7,8,0.85)',
        overflow: 'hidden',
        animation: stage === 'out'
          ? `gtl-dayclose-wipe ${OUT_MS}ms cubic-bezier(0.6, 0, 1, 0.4) both`
          : 'gtl-dayclose-in 150ms ease-out both',
      }}
    >
      <style>{`
        @keyframes gtl-dayclose-in   { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes gtl-dayclose-wipe { 0% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 100%); } }
        @keyframes gtl-dayclose-slam {
          0%   { transform: rotate(-2deg) scale(1.7); opacity: 0; }
          60%  { transform: rotate(-2deg) scale(0.94); opacity: 1; }
          100% { transform: rotate(-2deg) scale(1); opacity: 1; }
        }
        @keyframes gtl-dayclose-kick {
          0%   { transform: rotate(-2deg) translate(0, 0) scale(1.07); }
          35%  { transform: rotate(-1.2deg) translate(3px, -4px) scale(1.03); }
          70%  { transform: rotate(-2.4deg) translate(-2px, 2px) scale(1); }
          100% { transform: rotate(-2deg) translate(0, 0) scale(1); }
        }
        @keyframes gtl-dayclose-chip-strike {
          0%   { transform: translateX(-90vw) rotate(-16deg); }
          100% { transform: translateX(0) rotate(-2deg); }
        }
      `}</style>

      {/* Kanji watermark — 締 (close it out), same 4% treatment */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '8%', right: '-12%',
          fontSize: '19rem', fontWeight: 700, lineHeight: 1,
          color: '#f4ede0', opacity: 0.04,
          transform: 'rotate(6deg)', userSelect: 'none', pointerEvents: 'none',
        }}
      >締</span>

      <div style={{ position: 'relative', margin: '0 auto', height: '100%', width: 390, maxWidth: '100%' }}>

        {/* Eyebrow */}
        {counterIn && (
          <div style={{
            position: 'absolute', left: 0, right: 24, top: '28%', textAlign: 'center',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.35em', textTransform: 'uppercase', color: '#d4181f',
          }}>
            TODAY&apos;S EXP
          </div>
        )}

        {/* The counter — same gold Anton as the set cinematic */}
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
              : kick > 0 ? 'gtl-dayclose-kick 240ms cubic-bezier(0.2, 0.9, 0.3, 1)'
              : 'gtl-dayclose-slam 260ms cubic-bezier(0.18, 1.2, 0.35, 1) both',
            transform: 'rotate(-2deg)',
          }}
        >
          +{fmt(display)}
          <span style={{ fontSize: '0.36em', marginLeft: 8, letterSpacing: '0.06em' }}>EXP</span>
        </div>

        {/* The one ribbon — tier chip finally paying its number. Same
            chip geometry + strike as the set cinematic's stack. */}
        {showChip && (
          <div
            className="absolute left-0 right-0 flex justify-center"
            style={{
              top: '52%',
              animation: chipFlying
                ? `gtl-dayclose-chip-strike ${CHIP_FLIGHT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) both`
                : 'none',
              transform: chipFlying ? undefined : 'rotate(-2deg)',
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
                {tierName || 'TIER'}
              </span>
              <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: '1.05rem', letterSpacing: '0.04em' }}>
                +{fmt(creditShown)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
