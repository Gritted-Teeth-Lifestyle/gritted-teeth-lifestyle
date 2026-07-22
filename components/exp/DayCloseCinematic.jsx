'use client'
/*
 * DayCloseCinematic — the day-close reckoning beat (Jordan 2026-07-22:
 * "if exp is added at day close, present it at day close by bringing up
 * today's exp and doing the ribbon it should have during that time,
 * even if it is just the one ribbon").
 *
 * Plays on BRING ON TOMORROW when the day earned a consistency credit
 * (R8a — completion ≥50%). Same Beaten Bigger vocabulary as
 * SetXPCinematic, one beat shorter:
 *   1. TODAY'S EXP counter slams in at the day's set total (stamp).
 *   2. The tier chip — the one that strikes without a number on every
 *      set — flies in and finally pays: +credit rolls the counter to
 *      the day's true total (kick + confirm).
 *   3. Hold, hard wipe out, onDone fires.
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

  const showCounter = stage !== 'enter'
  const chipFlying = stage === 'strike' && !landed
  const showChip = chipFlying || landed

  return (
    <div
      onPointerDown={skip}
      style={{
        position: 'fixed', inset: 0, zIndex: 9995,
        overflow: 'hidden',
        background: 'rgba(5,4,5,0.94)',
        animation: stage === 'out'
          ? `gtl-dayclose-wipe ${OUT_MS}ms cubic-bezier(0.6, 0, 1, 0.4) both`
          : 'gtl-dayclose-in 130ms ease-out both',
      }}
    >
      <style>{`
        @keyframes gtl-dayclose-in   { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes gtl-dayclose-wipe { 0% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 100%); } }
        @keyframes gtl-dayclose-slam {
          0%   { transform: translateX(-50%) rotate(-2deg) scale(1.9); opacity: 0; }
          55%  { transform: translateX(-50%) rotate(-2deg) scale(0.95); opacity: 1; }
          100% { transform: translateX(-50%) rotate(-2deg) scale(1); opacity: 1; }
        }
        @keyframes gtl-dayclose-chip {
          0%   { transform: translateX(-90vw) rotate(-2deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(0) rotate(-2deg); opacity: 1; }
        }
        @keyframes gtl-dayclose-kick {
          0%   { transform: translate(0, 0); }
          30%  { transform: translate(3px, -4px); }
          65%  { transform: translate(-2px, 3px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>

      {/* Kanji watermark — 締 (close it out) */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '4%', right: '-12%',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '20rem', fontWeight: 900, lineHeight: 1,
          color: '#f4ede0', opacity: 0.04,
          transform: 'rotate(6deg)', userSelect: 'none',
        }}
      >締</span>

      <div key={`dc-${kick}`} style={{ position: 'absolute', inset: 0, animation: kick ? 'gtl-dayclose-kick 220ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none' }}>

        {/* Eyebrow */}
        {showCounter && (
          <div style={{
            position: 'absolute', left: '50%', top: '30%', transform: 'translateX(-50%)',
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.35em', textTransform: 'uppercase', color: '#d4181f',
            whiteSpace: 'nowrap',
          }}>
            TODAY&apos;S EXP
          </div>
        )}

        {/* Counter */}
        {showCounter && (
          <div style={{
            position: 'absolute', left: '50%', top: '36%',
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: 'clamp(4.6rem, 24vw, 11rem)',
            color: '#e8e8f0',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textShadow: '7px 7px 0 #101012',
            animation: 'gtl-dayclose-slam 240ms cubic-bezier(0.18, 1.1, 0.35, 1) both',
          }}>
            {fmt(display)}
          </div>
        )}

        {/* The one ribbon — tier chip finally paying its number */}
        {showChip && (
          <div style={{
            position: 'absolute', left: '50%', top: '58%',
            transform: 'translateX(-50%)',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 12,
              background: '#d4181f', color: '#f4ede0',
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              padding: '8px 24px 8px 18px',
              boxShadow: '5px 5px 0 #2a0507',
              animation: chipFlying
                ? `gtl-dayclose-chip ${CHIP_FLIGHT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) both`
                : 'none',
              transform: chipFlying ? undefined : 'rotate(-2deg)',
            }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                {tierName || 'TIER'}
              </span>
              <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: '1.3rem', letterSpacing: '0.04em' }}>
                +{fmt(credit)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
