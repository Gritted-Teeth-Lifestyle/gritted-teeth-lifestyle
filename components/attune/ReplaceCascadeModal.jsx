'use client'
/**
 * ReplaceCascadeModal — three-button scope picker shown after the user
 * picks a replacement exercise via the picker in mode='replace'.
 *
 *   "Just this chip"            → scope: 'chip'
 *   "All [exercise] sets today" → scope: 'day'
 *   "All [exercise] sets cycle" → scope: 'cycle'
 *
 * The actual atomic store mutation lives in lib/attunement.js
 * (replaceExercise) — this component is the choice surface only.
 */
export default function ReplaceCascadeModal({ fromLabel, toLabel, onPick, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="replace scope"
      style={{
        position: 'fixed', inset: 0, zIndex: 120,
        background: 'rgba(7,7,8,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => onClose && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: '#1a1a1e',
          border: '2px solid #d4181f',
          padding: '1rem',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: '#d4181f', marginBottom: '0.25rem' }}>
          REPLACE SCOPE
        </div>
        <div style={{ fontSize: '0.78rem', color: '#d8d2c2', marginBottom: '0.5rem' }}>
          <span style={{ color: '#888' }}>FROM</span> {fromLabel}
          <br />
          <span style={{ color: '#888' }}>TO</span> {toLabel}
        </div>

        <CascadeRow label="Just this chip"            onClick={() => onPick && onPick('chip')} />
        <CascadeRow label={`All ${fromLabel} sets on this day`}  onClick={() => onPick && onPick('day')} />
        <CascadeRow label={`All ${fromLabel} sets in this cycle`} onClick={() => onPick && onPick('cycle')} />

        <button
          type="button"
          onClick={() => onClose && onClose()}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontFamily: 'inherit',
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: '0.5rem',
            cursor: 'pointer',
            marginTop: '0.25rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function CascadeRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#0f0f12',
        border: '1px solid #2a2a30',
        borderLeft: '2px solid #d4181f',
        color: '#f1eee5',
        padding: '0.7rem 0.8rem',
        fontFamily: 'inherit',
        fontSize: '0.78rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textAlign: 'left',
        cursor: 'pointer',
        clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
      }}
    >
      {label}
    </button>
  )
}
