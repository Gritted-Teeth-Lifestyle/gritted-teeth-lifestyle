'use client'
/**
 * FirstTimeInstructionPopup — one-shot global onboarding shown on the
 * user's first ever entry to the Attune Movements page. Persistence
 * flag `gtl-attune-onboarding-seen` (NOT pk()-scoped — global per
 * device, not per profile, mirroring the spec's "globally one-shot,
 * not per-cycle, not per-profile" wording).
 *
 * Copy is verbatim and lowercase per the brainstorm doc.
 */
import { useEffect, useState } from 'react'

const FLAG_KEY = 'gtl-attune-onboarding-seen'

export default function FirstTimeInstructionPopup() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(FLAG_KEY) !== '1') setOpen(true)
    } catch (_) {}
  }, [])

  if (!open) return null

  const dismiss = () => {
    try { localStorage.setItem(FLAG_KEY, '1') } catch (_) {}
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="attune movements onboarding"
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(7,7,8,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: '#1a1a1e',
          border: '2px solid #d4181f',
          padding: '1.25rem 1rem',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: '#d4181f' }}>
          ATTUNE · FIRST ATTUNEMENT
        </div>
        <div style={{
          fontSize: '0.95rem',
          color: '#d8d2c2',
          lineHeight: 1.5,
          letterSpacing: '0.04em',
          textTransform: 'lowercase',
        }}>
          attune your movements to specific days. copy, move, and replace movements at will.
        </div>
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: '#d4181f',
            border: '1px solid #ff2a36',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            padding: '0.7rem 1rem',
            cursor: 'pointer',
            clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          }}
        >
          Begin
        </button>
      </div>
    </div>
  )
}
