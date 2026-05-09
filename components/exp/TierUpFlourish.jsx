'use client'
/*
 * TierUpFlourish — R7 rank-up cascade fired when the user enters a new
 * tier. gtl1's handleStamp writes pk('tier-cross-pending') with the new
 * tier name; we read it on mount, fire the cascade, then clear the flag.
 *
 * Choreography mirrors the level-up sub-cascade at active/page.js:3486-3640
 * (shatter → flood → sparkle → fade ~1.9s envelope). Label = tier name
 * instead of "LEVEL UP / N". Per blocker resolution this is the minimal
 * mirror — no per-tier kanji or color treatment in this iteration.
 *
 * Mounts at zIndex 10000 to paint over the SetXPCinematic (9995) and
 * the existing XP overlay (9999) so a tier-up dominates whatever's
 * currently in flight.
 */
import { useEffect, useState } from 'react'
import { pk } from '../../lib/storage'

const KEY_PENDING = 'tier-cross-pending'

const SHATTER_MS  = 750
const FLOOD_MS    = 550
const SPARKLE_MS  = 700
const HOLD_MS     = 400
const FADE_MS     = 1200

// Twelve sparkle positions across the viewport — matches the level-up
// cascade's decorative-star approach without re-randomizing per render.
const SPARKLES = [
  { x: 12, y: 18, size: 36, rot: -8,  delay: 0,    color: '#fff' },
  { x: 78, y: 22, size: 44, rot: 12,  delay: 80,   color: '#e4b022' },
  { x: 24, y: 64, size: 32, rot: -22, delay: 130,  color: '#e4b022' },
  { x: 88, y: 56, size: 50, rot: 6,   delay: 60,   color: '#fff' },
  { x: 50, y: 14, size: 28, rot: 18,  delay: 200,  color: '#e4b022' },
  { x: 8,  y: 80, size: 40, rot: -14, delay: 110,  color: '#fff' },
  { x: 68, y: 78, size: 36, rot: 24,  delay: 170,  color: '#e4b022' },
  { x: 36, y: 30, size: 26, rot: -6,  delay: 240,  color: '#e4b022' },
  { x: 92, y: 38, size: 32, rot: 8,   delay: 90,   color: '#fff' },
  { x: 18, y: 44, size: 30, rot: 16,  delay: 150,  color: '#e4b022' },
  { x: 60, y: 52, size: 38, rot: -18, delay: 220,  color: '#fff' },
  { x: 44, y: 84, size: 34, rot: 4,   delay: 50,   color: '#e4b022' },
]

export default function TierUpFlourish() {
  const [tierName, setTierName] = useState(null)
  const [phase, setPhase] = useState('idle')   // idle | shatter | flood | sparkle | fade | gone

  // On mount: pick up any pending tier-cross flag.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let pending = ''
    try { pending = localStorage.getItem(pk(KEY_PENDING)) || '' } catch (_) {}
    if (!pending) return
    setTierName(pending)
    setPhase('shatter')
    // Clear the flag immediately — preventing a re-fire if the route
    // re-mounts mid-cascade.
    try { localStorage.setItem(pk(KEY_PENDING), '') } catch (_) {}
  }, [])

  // Phase progression.
  useEffect(() => {
    if (phase === 'idle' || phase === 'gone') return undefined
    const next = phase === 'shatter' ? 'flood'
      : phase === 'flood' ? 'sparkle'
      : phase === 'sparkle' ? 'fade'
      : 'gone'
    const dur = phase === 'shatter' ? SHATTER_MS
      : phase === 'flood' ? FLOOD_MS
      : phase === 'sparkle' ? (SPARKLE_MS + HOLD_MS)
      : FADE_MS
    const t = setTimeout(() => setPhase(next), dur)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'idle' || phase === 'gone' || !tierName) return null

  const isFlood   = phase === 'flood' || phase === 'sparkle' || phase === 'fade'
  const isSparkle = phase === 'sparkle' || phase === 'fade'
  const isFade    = phase === 'fade'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      <style>{`
        @keyframes gtl-tier-cone-in {
          0%   { transform: scaleX(0); opacity: 0.9; }
          8%   { transform: scaleX(1); opacity: 0.85; }
          85%  { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes gtl-tier-flood-in {
          0%   { clip-path: polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%); }
          100% { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
        }
        @keyframes gtl-tier-flood-out {
          0%   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); opacity: 1; }
          100% { clip-path: polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%); opacity: 0; }
        }
        @keyframes gtl-tier-sparkle-in {
          0%   { transform: translate(-50%, -50%) rotate(var(--sr)) scale(0); opacity: 0; }
          40%  { opacity: 1; transform: translate(-50%, -50%) rotate(var(--sr)) scale(1.2); }
          100% { transform: translate(-50%, -50%) rotate(var(--sr)) scale(1); opacity: 0.9; }
        }
        @keyframes gtl-tier-sparkle-out {
          0%   { opacity: 0.9; transform: translate(-50%, -50%) rotate(var(--sr)) scale(1); }
          100% { opacity: 0;   transform: translate(-50%, -50%) rotate(var(--sr)) scale(0.2); }
        }
        @keyframes gtl-tier-label {
          0%   { transform: translate(-50%, -50%) rotate(-3deg) scale(3); opacity: 0; filter: blur(12px); }
          50%  { transform: translate(-50%, -50%) rotate(-3deg) scale(0.95); opacity: 1; filter: blur(0); }
          65%  { transform: translate(-50%, -50%) rotate(-3deg) scale(1.05); }
          100% { transform: translate(-50%, -50%) rotate(-3deg) scale(1); opacity: 1; }
        }
        @keyframes gtl-tier-name {
          0%   { transform: translate(-50%, -50%) rotate(2deg) scale(4); opacity: 0; filter: blur(16px); }
          55%  { transform: translate(-50%, -50%) rotate(2deg) scale(0.92); opacity: 1; filter: blur(0); }
          70%  { transform: translate(-50%, -50%) rotate(2deg) scale(1.08); }
          100% { transform: translate(-50%, -50%) rotate(2deg) scale(1); opacity: 1; }
        }
      `}</style>

      {/* Cone — fires from off-screen right toward center for the same
          firehose visual the level-up cascade uses. */}
      {phase === 'shatter' && (
        <div style={{
          position: 'fixed',
          left: '100%', top: '40%',
          width: '120vw', height: 160,
          transformOrigin: 'left center',
          background: 'linear-gradient(90deg, rgba(255,248,180,0.95) 0%, rgba(228,176,34,0.75) 20%, rgba(228,176,34,0.3) 60%, transparent 100%)',
          clipPath: 'polygon(0 48%, 100% 0%, 100% 100%, 0 52%)',
          transform: 'translateX(-100%)',
          animation: 'gtl-tier-cone-in 750ms ease-out both',
          boxShadow: '0 0 40px rgba(228,176,34,0.6)',
        }} />
      )}

      {/* Gold flood */}
      {isFlood && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'linear-gradient(135deg, #b8860b 0%, #e4b022 35%, #f5d060 60%, #e4b022 100%)',
          animation: isFade
            ? 'gtl-tier-flood-out 1400ms cubic-bezier(0.4, 0, 1, 1) both'
            : 'gtl-tier-flood-in 550ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
        }} />
      )}

      {/* Sparkles */}
      {isSparkle && SPARKLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            left: `${s.x}vw`,
            top:  `${s.y}vh`,
            width: s.size,
            height: s.size,
            background: s.color,
            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            '--sr': `${s.rot}deg`,
            animation: isFade
              ? `gtl-tier-sparkle-out 1200ms ease-in ${s.delay * 0.3}ms both`
              : `gtl-tier-sparkle-in 600ms cubic-bezier(0.2, 0.9, 0.3, 1.3) ${s.delay}ms both`,
            filter: s.color === '#fff' ? 'drop-shadow(0 0 6px #fff)' : 'drop-shadow(0 0 8px #e4b022)',
          }}
        />
      ))}

      {/* TIER UP label + tier name */}
      {isSparkle && !isFade && (
        <>
          <div style={{
            position: 'fixed',
            left: '50%', top: '38%',
            fontFamily: 'var(--font-display, Anton, sans-serif)',
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            color: '#070708',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            animation: 'gtl-tier-label 700ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 200ms both',
          }}>
            TIER UP
          </div>
          <div style={{
            position: 'fixed',
            left: '50%', top: '58%',
            fontFamily: 'var(--font-display, Anton, sans-serif)',
            fontSize: 'clamp(4rem, 14vw, 12rem)',
            color: '#070708',
            lineHeight: 1,
            opacity: 0.92,
            textShadow: '6px 6px 0 rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
            animation: 'gtl-tier-name 800ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 500ms both',
          }}>
            {tierName}
          </div>
        </>
      )}
    </div>
  )
}
