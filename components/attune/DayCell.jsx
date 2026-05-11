'use client'
import { useDroppable } from '@dnd-kit/core'
import SetChip from './SetChip'

const MUSCLE_KANJI = {
  chest: '胸', shoulders: '肩', back: '背', forearms: '腕',
  quads: '腿', hamstrings: '裏', calves: '脛',
  biceps: '二', triceps: '三', glutes: '尻', abs: '腹',
}
const MUSCLE_LABEL = {
  chest: 'CHEST', shoulders: 'SHOULDERS', back: 'BACK', forearms: 'FOREARMS',
  quads: 'QUADS', hamstrings: 'HAMSTRINGS', calves: 'CALVES',
  biceps: 'BICEPS', triceps: 'TRICEPS', glutes: 'GLUTES', abs: 'ABS',
}

function muscleKanji(id) { return MUSCLE_KANJI[id] || '·' }
function muscleLabel(id) { return MUSCLE_LABEL[id] || '' }

// Minimums for the collapsed group titles. A day qualifies for UPPER if
// chest+back+shoulders are all present (regardless of extras); LOWER if
// quads+hamstrings+glutes are all present; FULL BODY if both minimums
// are satisfied simultaneously.
const UPPER_MIN = ['chest', 'back', 'shoulders']
const LOWER_MIN = ['quads', 'hamstrings', 'glutes']

function containsAll(muscles, required) {
  const s = new Set(muscles)
  return required.every((x) => s.has(x))
}

function muscleGroupLabel(muscles) {
  if (!muscles || muscles.length < 2) return null
  const upper = containsAll(muscles, UPPER_MIN)
  const lower = containsAll(muscles, LOWER_MIN)
  if (upper && lower) return { kanji: '全', label: 'FULL BODY' }
  if (upper)          return { kanji: '上', label: 'UPPER' }
  if (lower)          return { kanji: '下', label: 'LOWER' }
  return null
}

export default function DayCell({
  cycleId,
  dayId,
  dayNum,
  muscles = [],
  chips = [],
  isLocked = false,
  isRestDay = false,
  isSelected = false,
  isSource = false,
  isToday = false,
  onTap,
  onChipReplace,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${dayId}`,
    data: { dayId, muscles, isLocked, isRestDay },
  })

  const handleClick = () => {
    if (isLocked) return
    if (onTap) onTap(dayId)
  }

  const group = muscleGroupLabel(muscles)
  const kanjiStack = group
    ? group.kanji
    : (muscles.length > 0 ? muscles.map(muscleKanji).join('') : (isRestDay ? '休' : '·'))
  const labelStack = group
    ? group.label
    : (muscles.length > 0
        ? muscles.map(muscleLabel).filter(Boolean).join(' · ')
        : (isRestDay ? 'REST' : ''))

  // Same red border for source AND multi-target — uniform "selected" treatment.
  let border = `1px solid ${isLocked ? '#3a3a42' : '#2a2a30'}`
  if (isSelected) border = '2px solid #d4181f'
  if (isOver)      border = isLocked ? '2px solid #ff2a36' : '2px solid #f1eee5'

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      data-attune-day={dayId}
      data-attune-selected={isSelected ? '1' : '0'}
      data-attune-source={isSource ? '1' : '0'}
      onClick={handleClick}
      onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick() } }}
      style={{
        position: 'relative',
        background: isRestDay ? '#0f0f12' : '#1a1a1e',
        border,
        borderRadius: 4,
        padding: '0.4rem 0.35rem 0.45rem 0.35rem',
        textAlign: 'left',
        color: '#f1eee5',
        fontFamily: 'inherit',
        cursor: isLocked ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
        opacity: isLocked ? 0.42 : 1,
        boxShadow: isSelected ? '0 0 0 1px rgba(212,24,31,0.55)' : 'none',
        minWidth: 0,
      }}
    >
      {/* Header: day number on the right. Today's day-number renders red
          (#d4181f) so users can spot today at a glance without a separate
          highlight ring. Source-day star removed — selected days are
          distinguished by their red border. */}
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          fontSize: '1.4rem',
          fontWeight: 900,
          lineHeight: 1,
          minHeight: '1.4rem',
        }}
      >
        <span style={{
          color: isRestDay ? '#5a5a5e' : (isToday ? '#d4181f' : '#f1eee5'),
        }}>
          {dayNum}
        </span>
      </div>

      {/* Kanji + English label paired, centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span
          style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '1.3rem',
            color: isRestDay ? '#5a5a5e' : '#d4181f',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {kanjiStack}
        </span>
        {labelStack && (
          <span
            style={{
              fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: isRestDay ? '#5a5a5e' : '#f1eee5',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              textAlign: 'center',
            }}
          >
            {labelStack}
          </span>
        )}
      </div>

      {/* Chip stack — ALWAYS visible (no tier gating). */}
      {chips.length > 0 && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            pointerEvents: isLocked ? 'none' : 'auto',
            marginTop: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {chips.map(chip => (
            <SetChip
              key={chip.id}
              chip={chip}
              cycleId={isLocked ? null : cycleId}
              dayId={isLocked ? null : dayId}
              onReplace={onChipReplace}
              compact
            />
          ))}
        </div>
      )}

      {chips.length === 0 && !isRestDay && !isLocked && (
        <div style={{
          fontSize: '0.45rem',
          color: '#666',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginTop: 2,
        }}>
          tap to attune
        </div>
      )}

      {isLocked && (
        <div
          style={{
            position: 'absolute', bottom: 4, right: 6,
            fontSize: '0.7rem', color: '#888',
          }}
          aria-label="day completed"
          title="day completed"
        >
          🔒
        </div>
      )}
    </div>
  )
}
