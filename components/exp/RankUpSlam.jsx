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
// Sticker variant pacing: how long the OLD title stands alone before the
// new one slams over it (Jordan 2026-07-22 — 380ms read as no change at
// all), sticker flight time, and how long the settled sticker holds.
const PREV_HOLD_MS    = 1100
const STICKER_FLY_MS  = 240
const STICKER_HOLD_MS = 1430

const RIBBONS = [
  { top: '46%', h: 12, delay: 0,   rot: -6 },
  { top: '58%', h: 8,  delay: 70,  rot: -6 },
  { top: '66%', h: 18, delay: 130, rot: -6 },
]

// Sticker-slap variant (prevValue set — tier crossings): the OLD title
// appears first as the standing record, then the NEW title slams on top
// as a red nameplate sticker and knocks the old one tumbling off-screen.
export default function RankUpSlam({ label, value, prevValue, onDone }) {
  const { play } = useSound()
  const hasPrev = prevValue != null && prevValue !== ''
  // enter | band | value (number form) | prev | sticker | out
  const [stage, setStage] = useState('enter')
  const [kick, setKick] = useState(0)
  const [slapped, setSlapped] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const t = []
    t.push(setTimeout(() => { setStage('band'); play('stamp') }, BAND_AT_MS))
    if (hasPrev) {
      const stickerAt = VALUE_AT_MS + PREV_HOLD_MS
      const slapAt = stickerAt + STICKER_FLY_MS
      const outAt = slapAt + STICKER_HOLD_MS
      t.push(setTimeout(() => setStage('prev'), VALUE_AT_MS))
      t.push(setTimeout(() => setStage('sticker'), stickerAt))
      t.push(setTimeout(() => { setSlapped(true); setKick(1); play('card-confirm') }, slapAt))
      t.push(setTimeout(() => setStage('out'), outAt))
      t.push(setTimeout(() => onDoneRef.current?.(), outAt + OUT_MS))
    } else {
      t.push(setTimeout(() => setStage('value'), VALUE_AT_MS))
      t.push(setTimeout(() => { setKick(1); play('card-confirm') }, VALUE_LAND_MS))
      t.push(setTimeout(() => setStage('out'), OUT_AT_MS))
      t.push(setTimeout(() => onDoneRef.current?.(), OUT_AT_MS + OUT_MS))
    }
    return () => t.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showBand    = stage !== 'enter'
  const showValue   = !hasPrev && (stage === 'value' || stage === 'out')
  const showPrev    = hasPrev && (stage === 'prev' || stage === 'sticker' || stage === 'out')
  const showSticker = hasPrev && (stage === 'sticker' || stage === 'out')

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
        @keyframes gtl-rankup-ribbon-burst {
          0%   { transform: rotate(-6deg) scaleX(0); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: rotate(-6deg) scaleX(1); opacity: 1; }
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
        @keyframes gtl-rankup-prev-in {
          0%   { transform: translateX(-50%) rotate(-1deg) translateY(10px); opacity: 0; }
          100% { transform: translateX(-50%) rotate(-1deg) translateY(0); opacity: 1; }
        }
        @keyframes gtl-rankup-tumble {
          0%   { transform: translateX(-50%) rotate(-1deg); opacity: 1; }
          100% { transform: translate(calc(-50% + 70vw), 70vh) rotate(65deg); opacity: 0; }
        }
        @keyframes gtl-rankup-sticker {
          0%   { transform: translateX(-50%) rotate(-3deg) scale(2.1); opacity: 0; }
          55%  { transform: translateX(-50%) rotate(-3deg) scale(0.94); opacity: 1; }
          100% { transform: translateX(-50%) rotate(-3deg) scale(1); opacity: 1; }
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

        {/* Old tier title — the standing record, about to be dethroned */}
        {showPrev && (
          <div style={{
            position: 'absolute', left: '50%', top: '46%',
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: 'clamp(2.4rem, 12vw, 5.4rem)',
            color: '#8a8a92',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            textShadow: '4px 4px 0 #101012',
            animation: slapped
              ? 'gtl-rankup-tumble 560ms cubic-bezier(0.5, 0, 1, 0.5) both'
              : 'gtl-rankup-prev-in 200ms ease-out both',
            zIndex: 2,
          }}>
            {prevValue}
          </div>
        )}

        {/* New tier title — red nameplate sticker slamming over the old */}
        {showSticker && (
          <div style={{
            position: 'absolute', left: '50%', top: '43%',
            animation: 'gtl-rankup-sticker 240ms cubic-bezier(0.18, 1.1, 0.35, 1) both',
            zIndex: 3,
          }}>
            <div style={{
              background: '#d4181f',
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              padding: '10px 28px 12px 24px',
              boxShadow: '7px 7px 0 #2a0507',
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                fontFamily: 'Anton, Impact, sans-serif',
                fontSize: 'clamp(2.4rem, 12vw, 5.4rem)',
                color: '#f4ede0',
                lineHeight: 1,
              }}>
                {value}
              </span>
            </div>
          </div>
        )}

        {/* Accent ribbons — behind the value. Plain variant: sweep in
            from the right. Sticker variant: they BURST outward from the
            slap impact (gated on `slapped`), so they read as debris of
            the hit instead of appearing from nowhere (Jordan
            2026-07-23). */}
        {(showValue || (showSticker && slapped)) && RIBBONS.map((r, i) => (
          <div key={i} style={{
            position: 'absolute', left: '-10%', right: '-10%', top: r.top,
            height: r.h, background: '#d4181f',
            clipPath: 'polygon(0.5% 0%, 100% 0%, 99.5% 100%, 0% 100%)',
            transformOrigin: 'center',
            animation: hasPrev
              ? `gtl-rankup-ribbon-burst 280ms cubic-bezier(0.2, 0.9, 0.25, 1) ${r.delay}ms both`
              : `gtl-rankup-ribbon 300ms cubic-bezier(0.2, 0.9, 0.25, 1) ${r.delay}ms both`,
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
