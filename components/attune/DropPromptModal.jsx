'use client'
/**
 * DropPromptModal — confirmation dialog shown after a chip is dropped
 * on a rest day (variant='rest') or a cross-muscle workout day
 * (variant='cross-muscle'). Tap-anywhere outside cancels.
 */
export default function DropPromptModal({ variant, muscle, onConfirm, onCancel }) {
  const title =
    variant === 'rest'         ? 'CONVERT REST DAY?'   :
    variant === 'cross-muscle' ? 'ADD MUSCLE TO DAY?'  :
    'CONFIRM'
  const body =
    variant === 'rest'
      ? `Convert this rest day to a ${(muscle || '?').toUpperCase()} day?`
      : variant === 'cross-muscle'
      ? `Add ${(muscle || '?').toUpperCase()} to this day's training?`
      : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 130,
        background: 'rgba(7,7,8,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => onCancel && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340,
          background: '#1a1a1e',
          border: '2px solid #d4181f',
          padding: '1rem',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: '#d4181f' }}>
          DROP · {title}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#d8d2c2' }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onCancel && onCancel()}
            style={{
              flex: 1,
              background: '#0f0f12',
              border: '1px solid #2a2a30',
              color: '#888',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '0.65rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm && onConfirm()}
            style={{
              flex: 1,
              background: '#d4181f',
              border: '1px solid #ff2a36',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '0.65rem',
              cursor: 'pointer',
              clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
