'use client'
import { useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { duplicateChip, deleteChip } from '../../lib/attunement'

const MOVE_CANCEL_PX = 5

export default function SetChip({ chip, cycleId, dayId, compact = false, onReplace }) {
  const startRef = useRef(null)
  const movedRef = useRef(false)

  const interactive = !!(cycleId && dayId)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chip?.id || 'chip-noop',
    data: { fromDayId: dayId, exerciseId: chip?.exerciseId },
    disabled: !interactive,
  })

  if (!chip) return null
  const label = chip.exerciseId || 'untitled'
  const display = compact && label.length > 14 ? label.slice(0, 13) + '…' : label

  const handlePointerDown = (e) => {
    if (!interactive) return
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
  }
  const handlePointerMove = (e) => {
    if (!interactive || !startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) { movedRef.current = true }
  }
  const handlePointerEnd = () => { startRef.current = null }
  const handleClick = (e) => {
    // Stop propagation so a chip tap doesn't bubble up to the day-cell.
    // No menu opens — inline ⎘ ⇄ ✕ icons handle Copy / Replace / Delete.
    e.stopPropagation()
  }

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? '4px 4px 0 #070708' : 'none',
      }
    : {}

  const stop = (e) => { e.stopPropagation(); e.preventDefault() }

  const copyHandler = (e) => { stop(e); duplicateChip(cycleId, dayId, chip.id) }
  const deleteHandler = (e) => { stop(e); deleteChip(cycleId, dayId, chip.id) }
  const replaceHandler = (e) => { stop(e); if (onReplace) onReplace({ dayId, chipId: chip.id, fromLabel: label }) }

  const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#a8a39a',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '4px 8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 28,
    minHeight: 28,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        data-chip-id={chip.id}
        {...attributes}
        {...listeners}
        onPointerDown={(e) => { listeners?.onPointerDown?.(e); handlePointerDown(e) }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleClick}
        style={{
          background: '#0f0f12',
          border: '1px solid #2a2a30',
          borderLeft: '2px solid #d4181f',
          padding: '5px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.7rem',
          letterSpacing: '0.04em',
          color: '#d8d2c2',
          textTransform: 'uppercase',
          cursor: interactive ? 'pointer' : 'default',
          touchAction: interactive ? 'none' : 'manipulation',
          minWidth: 0,
          ...dragStyle,
        }}
        title={label}
      >
        <span style={{
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
        {interactive && (
          <span style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 5,
            paddingTop: 4,
            borderTop: '1px solid #1f1f24',
          }}>
            <button type="button" aria-label="copy" title="Copy" onPointerDown={stop} onClick={copyHandler} style={iconBtnStyle}>⎘</button>
            <button type="button" aria-label="replace" title="Replace" onPointerDown={stop} onClick={replaceHandler} style={iconBtnStyle}>⇄</button>
            <button type="button" aria-label="delete" title="Delete" onPointerDown={stop} onClick={deleteHandler} style={iconBtnStyle}>✕</button>
          </span>
        )}
      </div>
    </>
  )
}
