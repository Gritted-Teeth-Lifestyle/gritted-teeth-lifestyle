'use client'
/**
 * ChipActionMenu — floating action sheet anchored to a chip.
 *
 * Three actions: Copy (duplicate in place), Delete (remove this chip),
 * Replace (open picker in replace mode → cascade scope modal).
 *
 * Centered bottom-sheet style for mobile thumb reach. Backdrop tap
 * dismisses without acting.
 */
export default function ChipActionMenu({ chipLabel, onCopy, onDelete, onReplace, onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`actions for ${chipLabel || 'chip'}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(7,7,8,0.78)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={() => onClose && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360,
          background: '#1a1a1e',
          borderTop: '2px solid #d4181f',
          padding: '1rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.62rem', letterSpacing: '0.3em', color: '#d4181f', marginBottom: '0.25rem' }}>
          CHIP · {chipLabel || ''}
        </div>
        <ActionRow label="Copy"    onClick={() => { onCopy && onCopy(); onClose && onClose() }} />
        <ActionRow label="Delete"  onClick={() => { onDelete && onDelete(); onClose && onClose() }} variant="danger" />
        <ActionRow label="Replace" onClick={() => { onReplace && onReplace(); onClose && onClose() }} />
      </div>
    </div>
  )
}

function ActionRow({ label, onClick, variant }) {
  const isDanger = variant === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: isDanger ? '#3a0a0e' : '#0f0f12',
        border: `1px solid ${isDanger ? '#d4181f' : '#2a2a30'}`,
        borderLeft: `2px solid ${isDanger ? '#ff2a36' : '#d4181f'}`,
        color: isDanger ? '#ff7a82' : '#f1eee5',
        padding: '0.7rem 0.9rem',
        fontFamily: 'inherit',
        fontSize: '0.85rem',
        letterSpacing: '0.18em',
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
