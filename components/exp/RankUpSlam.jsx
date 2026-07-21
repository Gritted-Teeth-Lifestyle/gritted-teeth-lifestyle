'use client'
/*
 * RankUpSlam — shared LEVEL UP / TIER UP celebration (2026-07-21).
 *
 * Replaces the gold-flood + sparkle cascade era ("no hokey animations"
 * — Jordan). Same P5 language as the Beaten Bigger set cinematic:
 *   1. Black overlay snaps in, kanji watermark at 4%.
 *   2. Diagonal red slash band slams from the left carrying the label
 *      (LEVEL UP / TIER UP). Stamp sound.
 *   3. The value (level number / tier name) slams in — giant gold
 *      Anton, tilted, hard 6px shadow, scale-snap entrance, screen
 *      kick + confirm sound on landing. Three thin red ribbons sweep
 *      in behind it at staggered delays. Hard edges everywhere; no
 *      gradients, no blur, no glow.
 *   4. Hold, then a hard clip-path wipe out. onDone fires.
 *
 * Self-timed (~2.4s total). zIndex 10000 — paints over the set
 * cinematic (9995), matching the old TierUpFlourish contract.
 */
import { useEffect, useRef, useState } from 'react'
import { useSound } from '../../lib/useSound'

const BAND_AT_MS  = 120
const VALUE_AT_MS = 420
const VALUE_LAND_MS = 680
const OUT_AT_MS   = 2050
const OUT_MS      = 360

const RIBBONS = [
  { top: '46%', h: 12, delay: 0,   rot: -6 },
  { top: '58%', h: 8,  delay: 70,  rot: -6 },
  { top: '66%', h: 18, delay: 130, rot: -6 },
]

export default function RankUpSlam({ label, value, onDone }) {
  const { play } = useSound()
  const [stage, setStage] = useState('enter')  // enter | band | value | out
  const [kick, setKick] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const t = []
    t.push(setTimeout(() => { setStage('band'); play('stamp') }, BAND_AT_MS))
    t.push(setTimeout(() => setStage('value'), VALUE_AT_MS))
    t.push(setTimeout(() => { setKick(1); play('card-confirm') }, VALUE_LAND_MS))
    t.push(setTimeout(() => setStage('out'), OUT_AT_MS))
    t.push(setTimeout(() => onDoneRef.current?.(), OUT_AT_MS + OUT_MS))
    return () => t.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showBand  = stage === 'band' || stage === 'value' || stage === 'out'
  const showValue = stage === 'value' || stage === 'out'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none',
        overflow: 'hidden',
        animation: stage === 'out'
          ? `gtl-rankup-wipe ${OUT_MS}ms cubic-bezier(0.6, 0, 1, 0.4) both`
          : 'gtl-rankup-in 130ms ease-out both',
        background: 'rgba(5,4,5,0.94)',
      }}
    >
      <style>{`
        @keyframes gtl-rankup-in   { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes gtl-rankup-wipe { 0% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 100%); } }
        @keyframes gtl-rankup-band {
          0%   { transform: rotate(-6deg) translateX(-115%); }
          100% { transform: rotate(-6deg) translateX(0); }
        }
        @keyframes gtl-rankup-ribbon {
          0%   { transform: rotate(-6deg) translateX(115vw); }
          100% { transform: rotate(-6deg) translateX(0); }
        }
        @keyframes gtl-rankup-value {
          0%   { transform: translateX(-50%) rotate(-2deg) scale(1.9); opacity: 0; }
          55%  { transform: translateX(-50%) rotate(-2deg) scale(0.95); opacity: 1; }
          100% { transform: translateX(-50%) rotate(-2deg) scale(1); opacity: 1; }
        }
        @keyframes gtl-rankup-kick {
          0%   { transform: translate(0, 0); }
          30%  { transform: translate(3px, -4px); }
          65%  { transform: translate(-2px, 3px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>

      {/* Kanji watermark — 昇 (rise) */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '2%', right: '-14%',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '22rem', fontWeight: 900, lineHeight: 1,
          color: '#f4ede0', opacity: 0.04,
          transform: 'rotate(8deg)', userSelect: 'none',
        }}
      >昇</span>

      <div key={`rk-${kick}`} style={{ position: 'absolute', inset: 0, animation: kick ? 'gtl-rankup-kick 220ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none' }}>

        {/* Accent ribbons — behind the value */}
        {showValue && RIBBONS.map((r, i) => (
          <div key={i} style={{
            position: 'absolute', left: '-10%', right: '-10%', top: r.top,
            height: r.h, background: '#d4181f',
            clipPath: 'polygon(0.5% 0%, 100% 0%, 99.5% 100%, 0% 100%)',
            animation: `gtl-rankup-ribbon 300ms cubic-bezier(0.2, 0.9, 0.25, 1) ${r.delay}ms both`,
          }} />
        ))}

        {/* Label band */}
        {showBand && (
          <div style={{
            position: 'absolute', left: '-12%', right: '-12%', top: '26%',
            animation: 'gtl-rankup-band 240ms cubic-bezier(0.2, 0.9, 0.25, 1) both',
          }}>
            <div style={{
              background: '#d4181f',
              clipPath: 'polygon(1.5% 0%, 100% 0%, 98.5% 100%, 0% 100%)',
              padding: '12px 0',
              textAlign: 'center',
              boxShadow: '6px 6px 0 #2a0507',
            }}>
              <span style={{
                fontFamily: 'Anton, Impact, sans-serif',
                fontSize: 'clamp(2rem, 8vw, 3.4rem)',
                color: '#f4ede0',
                letterSpacing: '0.1em',
                lineHeight: 1,
              }}>
                {label}
              </span>
            </div>
          </div>
        )}

        {/* The value — giant, gold, hard shadow. Short values (level
            numbers) render huge; long tier names step down to fit. */}
        {showValue && (
          <div style={{
            position: 'absolute', left: '50%', top: '44%',
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: String(value).length > 4
              ? 'clamp(2.6rem, 13vw, 6rem)'
              : 'clamp(6rem, 30vw, 15rem)',
            color: '#e4b022',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textShadow: '7px 7px 0 #1a1104',
            animation: 'gtl-rankup-value 260ms cubic-bezier(0.18, 1.1, 0.35, 1) both',
            zIndex: 2,
          }}>
            {value}
          </div>
        )}
      </div>
    </div>
  )
}
