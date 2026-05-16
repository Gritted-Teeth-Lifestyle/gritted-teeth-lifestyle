'use client'
/**
 * ExitGuardDialog — modal asking the user to confirm leaving Attune
 * with N empty workout days.
 *
 * Pure presentational. The interception logic (beforeunload, popstate,
 * RetreatButton click capture) lives at the page level.
 */
export default function ExitGuardDialog({ count, onConfirm, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="exit guard"
      style={{
        position: 'fixed', inset: 0, zIndex: 140,
        background: 'rgba(7,7,8,0.86)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={() => onCancel && onCancel()}
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
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: '#d4181f' }}>
          EXIT · {count} EMPTY DAY{count === 1 ? '' : 'S'}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#d8d2c2' }}>
          You have <strong>{count}</strong> workout day{count === 1 ? '' : 's'} with no exercises attuned. Are you sure you want to leave?
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
            Stay
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
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
