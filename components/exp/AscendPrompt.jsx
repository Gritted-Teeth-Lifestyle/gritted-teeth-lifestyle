'use client'
/*
 * AscendPrompt — R9 prestige choice surface.
 *
 * Mounts when pk('prestige-unlocked') === '1'. Two CTAs:
 *   - ASCEND → calls awardRibbon() (gtl1's tierStore), which awards
 *              one Galaxy-Spiral ribbon, resets tier-count to 0, and
 *              clears the prestige-unlocked flag.
 *   - HOLD   → dismisses without acting; the flag stays set so the
 *              prompt re-mounts on the next route visit (per R9
 *              "the user controls the loop pace").
 *
 * `surface` prop controls the presentation:
 *   - 'profile' (default) — full-screen blocking modal with backdrop.
 *   - 'hub'                — small chip linking to /fitness/profile,
 *                            "less aggressive" per the wave-2 dispatch.
 *
 * Mount/unmount timings: 250ms in / 200ms out per the dispatch's
 * locked-timings table.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { awardRibbon } from '../../lib/exp'

export default function AscendPrompt({ surface = 'profile', onResolved }) {
  const [closing, setClosing] = useState(false)

  // 200ms exit before unmount.
  const dismiss = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => onResolved && onResolved(), 200)
  }

  const handleAscend = () => {
    if (closing) return
    try { awardRibbon() } catch (_) {}
    dismiss()
  }

  const handleHold = () => {
    dismiss()
  }

  // Hub surface — small chip linking to profile. Doesn't dismiss the
  // flag (only ASCEND clears it via awardRibbon, or the user lands on
  // profile and chooses there).
  if (surface === 'hub') {
    return (
      <Link
        href="/fitness/profile"
        className="group inline-flex items-center gap-2 px-4 py-2 bg-gtl-surface border border-gtl-red [@media(hover:hover)]:hover:border-gtl-red-bright transition-colors duration-200"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          opacity: closing ? 0 : 1,
          transition: 'opacity 200ms ease-out',
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontSize: '1.1rem', filter: 'sepia(1) saturate(4) hue-rotate(-25deg) brightness(1.05) drop-shadow(0 0 4px rgba(228,176,34,0.8))' }}
        >
          🌀
        </span>
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase font-bold text-gtl-red">
          PRESTIGE READY
        </span>
      </Link>
    )
  }

  // Profile surface — blocking modal.
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ascend"
      style={{
        position: 'fixed', inset: 0, zIndex: 9990,
        background: 'rgba(7,7,8,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        animation: closing
          ? 'gtl-ascend-backdrop-out 200ms ease-out forwards'
          : 'gtl-ascend-backdrop-in 250ms ease-out both',
      }}
    >
      <style>{`
        @keyframes gtl-ascend-backdrop-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gtl-ascend-backdrop-out {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes gtl-ascend-card-in {
          0%   { transform: translateY(12px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          width: '100%', maxWidth: 380,
          background: '#1a1a1e',
          border: '2px solid #d4181f',
          padding: '1.5rem 1.25rem',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '1.1rem',
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          animation: closing ? 'none' : 'gtl-ascend-card-in 250ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        }}
      >
        <div style={{
          fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.3em',
          color: '#d4181f',
          fontWeight: 900,
        }}>
          PRESTIGE / ASCEND
        </div>
        <div style={{
          fontFamily: 'Anton, Impact, sans-serif',
          fontSize: '2.1rem',
          color: '#e4b022',
          letterSpacing: '0.04em',
          lineHeight: 1,
          textShadow: '2px 2px 0 #8a6612',
        }}>
          PRESTIGE READY
        </div>
        <div style={{
          fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
          fontSize: '0.78rem',
          letterSpacing: '0.08em',
          color: '#d8d2c2',
          lineHeight: 1.5,
          textTransform: 'uppercase',
        }}>
          Reset to RELAXED. Earn one ribbon. +0.10× forever.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={handleAscend}
            style={{
              flex: 1,
              background: '#d4181f',
              border: '1px solid #ff2a36',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              fontWeight: 900,
              textTransform: 'uppercase',
              padding: '0.75rem 0.9rem',
              cursor: 'pointer',
              clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
            }}
          >
            ASCEND
          </button>
          <button
            type="button"
            onClick={handleHold}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #3a3a42',
              color: '#d8d2c2',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              fontWeight: 900,
              textTransform: 'uppercase',
              padding: '0.75rem 0.9rem',
              cursor: 'pointer',
              clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
            }}
          >
            HOLD
          </button>
        </div>
      </div>
    </div>
  )
}
