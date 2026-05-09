'use client'
/*
 * SetXPCinematic — R18 + R18a per-set cinematic.
 *
 * Sequential reveal of the multiplier stack from the snapshot returned
 * by gtl1's calculateSetXP, mounted at zIndex 9995 with position:fixed
 * inside [muscleId]/page.js after the save handler upserts the snapshot.
 *
 * Lines (each only renders when active):
 *   1. +rawBase EXP                                ← always
 *   2. 🔥 HEAVY LIFT +heavyLiftBonus EXP           ← heavyLiftBonus > 0
 *   3. {TIER_NAME} +consistencyMult×               ← consistencyMult > 1.0
 *   4. {CLASS_LABEL} +classMult×                   ← always (class mandatory)
 *   5. RIBBONS +prestigeMult×                      ← prestigeMult > 0
 *   6. HOLIDAY +holidayMult×                       ← holidayMult > 0
 *   7. = +totalXP TOTAL 🔥                         ← snapshot.totalXP final
 *
 * Per the wave-2 dispatch the running total tracks snapshot.totalXP
 * (R2 sum: stackBase × (classMult + prestigeMult + holidayMult) — the
 * R8a-deferred consistency contribution is shown in the cinematic line
 * but does NOT accumulate into the per-set total). The consistency line
 * is informational; the running number doesn't change when it reveals.
 *
 * Phase machine:
 *   reveal: lines fade in 200ms apart (within the spec's 180-220ms range)
 *   flash:  250ms hold on the final TOTAL line
 *   fly:    700ms terminal xp-fly to the bar (reuses the existing
 *           `xp-fly` keyframe vocabulary in active/page.js:3388-3392)
 *   gone:   onComplete fires, parent unmounts
 *
 * iOS PWA gotchas:
 *   - position:fixed lifts the cinematic out of the panel transform.
 *   - mountTimeRef gates dismissal taps for 150ms after mount so the
 *     iOS leaked-click cascade from the SAVE button doesn't pop us.
 *   - Backdrop tap dismisses (after grace) — fast-forwards to fly+gone.
 *   - zIndex 9995 sits below the level-up overlay (10000) so a tier-up
 *     flourish painted by R7 still wins.
 */
import { useEffect, useRef, useState } from 'react'

const LINE_INTERVAL_MS = 200
const FINAL_FLASH_MS   = 250
const FLY_MS           = 700
const POST_FLY_DISMISS_MS = 250
const MOUNT_TAP_GRACE_MS  = 150

const CLASS_LABEL = {
  king_compound: 'KING',
  compound:      'COMPOUND',
  isolation:     'ISOLATION',
}

function fmt(n) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString()
}

// Multiplier display: 1.18× form. Always positive in this UI.
function mfmt(m) {
  if (!Number.isFinite(m)) return '×0'
  return `+${m.toFixed(2)}×`
}

export default function SetXPCinematic({ snapshot, tierName, onComplete }) {
  const [phase, setPhase] = useState('reveal')   // 'reveal' | 'flash' | 'fly' | 'gone'
  const [shownLines, setShownLines] = useState(0)
  const mountTimeRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now())

  // Build the line list once. Only active multipliers render.
  const rawBase         = Number(snapshot?.rawBase) || 0
  const heavyLiftBonus  = Number(snapshot?.heavyLiftBonus) || 0
  const stackBase       = Number(snapshot?.baseXP) || (rawBase + heavyLiftBonus)
  const consistencyMult = Number(snapshot?.consistencyMult) || 1.0
  const classMult       = Number(snapshot?.classMult) || 1.5
  const prestigeMult    = Number(snapshot?.prestigeMult) || 0
  const holidayMult     = Number(snapshot?.holidayMult) || 0
  const classification  = snapshot?.classification || 'compound'
  const totalXP         = Number(snapshot?.totalXP) || 0

  // Build the visible-lines list with the running total each line resolves to.
  // Consistency line is informational — it carries no accumulator delta.
  const lines = []
  lines.push({ kind: 'base', label: null, value: rawBase, sign: '+', running: rawBase })
  if (heavyLiftBonus > 0) {
    lines.push({ kind: 'heavy', label: '🔥 HEAVY LIFT', value: heavyLiftBonus, sign: '+', running: rawBase + heavyLiftBonus })
  }
  if (consistencyMult > 1.0001) {
    lines.push({ kind: 'consistency', label: tierName || 'TIER', mult: consistencyMult, running: stackBase })
  }
  // Class line — always.
  lines.push({
    kind: 'class',
    label: CLASS_LABEL[classification] || 'COMPOUND',
    mult: classMult,
    running: stackBase + stackBase * classMult,
  })
  if (prestigeMult > 0.0001) {
    lines.push({
      kind: 'prestige',
      label: 'RIBBONS',
      mult: prestigeMult,
      running: stackBase + stackBase * classMult + stackBase * prestigeMult,
    })
  }
  if (holidayMult > 0.0001) {
    lines.push({
      kind: 'holiday',
      label: 'HOLIDAY',
      mult: holidayMult,
      running: stackBase + stackBase * classMult + stackBase * prestigeMult + stackBase * holidayMult,
    })
  }
  // Final TOTAL line — locks to snapshot.totalXP per the wave-2 dispatch.
  lines.push({ kind: 'total', label: '= TOTAL', value: totalXP, sign: '+', running: totalXP })

  // Drive line reveals.
  useEffect(() => {
    if (phase !== 'reveal') return
    if (shownLines >= lines.length) {
      const t = setTimeout(() => setPhase('flash'), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setShownLines((n) => n + 1), LINE_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [phase, shownLines, lines.length])

  // Phase progression: flash → fly → gone.
  useEffect(() => {
    if (phase === 'flash') {
      const t = setTimeout(() => setPhase('fly'), FINAL_FLASH_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'fly') {
      const t = setTimeout(() => setPhase('gone'), FLY_MS + POST_FLY_DISMISS_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'gone') {
      const t = setTimeout(() => onComplete && onComplete(), 0)
      return () => clearTimeout(t)
    }
    return undefined
  }, [phase, onComplete])

  // Backdrop tap fast-forwards to fly. iOS leaked-click grace: ignore taps
  // in the first 150ms after mount so the SAVE button's release event
  // doesn't dismiss the cinematic before the user can read it.
  const handleBackdropTap = () => {
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - mountTimeRef.current
    if (elapsed < MOUNT_TAP_GRACE_MS) return
    if (phase === 'reveal' || phase === 'flash') setPhase('fly')
  }

  if (phase === 'gone') return null

  const totalLineRevealed = shownLines >= lines.length

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
        background: 'rgba(7,7,8,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(1.5rem, env(safe-area-inset-top)) 1.25rem max(1.5rem, env(safe-area-inset-bottom))',
        animation: phase === 'fly' ? 'gtl-cine-backdrop-out 700ms ease-out forwards' : 'gtl-cine-backdrop-in 200ms ease-out both',
      }}
    >
      <style>{`
        @keyframes gtl-cine-backdrop-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gtl-cine-backdrop-out {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes gtl-cine-line-in {
          0%   { transform: translateY(8px); opacity: 0; filter: blur(4px); }
          100% { transform: translateY(0);   opacity: 1; filter: blur(0); }
        }
        @keyframes gtl-cine-final-flash {
          0%   { transform: scale(1);    text-shadow: 4px 4px 0 #8a6612, 0 0 50px rgba(228,176,34,1), 0 0 100px rgba(228,176,34,0.5); }
          50%  { transform: scale(1.06); text-shadow: 4px 4px 0 #8a6612, 0 0 80px rgba(228,176,34,1), 0 0 160px rgba(228,176,34,0.7); }
          100% { transform: scale(1);    text-shadow: 4px 4px 0 #8a6612, 0 0 50px rgba(228,176,34,1), 0 0 100px rgba(228,176,34,0.5); }
        }
        @keyframes gtl-cine-fly {
          0%   { transform: scale(1)    translateY(0);  opacity: 1; }
          25%  { transform: scale(1.18) translateY(0); }
          100% { transform: scale(0.2)  translateY(-50vh); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          maxWidth: '420px',
          width: '100%',
          animation: phase === 'fly' ? 'gtl-cine-fly 700ms cubic-bezier(0.4, 0, 1, 1) forwards' : 'none',
          transformOrigin: 'center',
        }}
      >
        {lines.map((line, i) => {
          if (i >= shownLines) return null
          const isFinal = line.kind === 'total'
          const isFlashing = isFinal && (phase === 'flash' || (phase === 'reveal' && totalLineRevealed))
          const showRunning = !['consistency', 'total'].includes(line.kind)
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                animation: 'gtl-cine-line-in 220ms ease-out both',
              }}
            >
              {/* Multiplier / label line (when present) */}
              {line.label && !isFinal && (
                <div
                  style={{
                    fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    letterSpacing: '0.22em',
                    color: '#d4181f',
                    textTransform: 'uppercase',
                    marginBottom: '2px',
                  }}
                >
                  {line.label} {line.mult ? mfmt(line.mult) : null}
                </div>
              )}

              {/* Running-total / value line in Anton gold — matches the
                  existing xp-fly particle vocabulary at active/page.js:3416-3419 */}
              {showRunning ? (
                <div
                  style={{
                    fontFamily: 'Anton, Impact, sans-serif',
                    fontSize: 'clamp(2.2rem, 7vw, 3.5rem)',
                    color: '#e4b022',
                    textShadow: '2px 2px 0 #8a6612, 0 0 24px rgba(228,176,34,0.9)',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  +{fmt(line.running)} EXP
                </div>
              ) : isFinal ? (
                <div
                  style={{
                    fontFamily: 'Anton, Impact, sans-serif',
                    fontSize: 'clamp(3rem, 11vw, 5rem)',
                    color: '#e4b022',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    textShadow: '4px 4px 0 #8a6612, 0 0 50px rgba(228,176,34,1), 0 0 100px rgba(228,176,34,0.5)',
                    animation: isFlashing ? 'gtl-cine-final-flash 250ms ease-in-out' : 'none',
                  }}
                >
                  = +{fmt(line.value)} EXP TOTAL 🔥
                </div>
              ) : (
                /* Consistency line — informational, no running-total shadow.
                   Already rendered above as label-only. */
                null
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
