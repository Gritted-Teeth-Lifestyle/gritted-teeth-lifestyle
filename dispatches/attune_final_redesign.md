# Attune Movements page — FINAL redesign (per-weekday columns + always-visible chips + inline action icons)

**Target:** GTL 1 worker (`/c/Users/Jordan/gtl-1/`). Branch: `dev`. Files: `components/attune/CycleCalendar.jsx`, `components/attune/DayCell.jsx`, `components/attune/SetChip.jsx`, `components/attune/AutoAttuneButton.jsx`, `app/attune/page.js`.

This spec **supersedes** every earlier Attune dispatch. Specifically supersedes:
- `dispatches/attune_calendar_height_fix.md`
- `dispatches/attune_daycell_dow_label.md`
- `dispatches/attune_comprehensive_redesign.md` (the earlier 7-col-row-aligned version with placeholders)

The original feature plan is `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md`. Re-read it for context. The 10 decisions below resolve everything that was open after Jordan's review.

## The 10 locked decisions

1. **Per-weekday vertical columns.** 7 fixed columns, one per weekday (Sun → Sat). Each column is a chronological top-to-bottom stack of every carved day matching that weekday. **No row alignment between columns.** The Mon column might have 4 entries while the Tue column has 0 — Tue stays empty top-to-bottom. Inside a column, skipped weeks **collapse** — no placeholder gaps. e.g., if Mon-week-1 and Mon-week-3 are carved but Mon-week-2 isn't, the Mon column shows two day-blocks back-to-back with no gap.

2. **Pinch-zoom kept.** Chip text is small at default scale; user pinches to read.

3. **Vertical scroll + pinch-zoom both.** 1-finger drag = vertical scroll (handled by `react-zoom-pan-pinch`'s panning at scale 1). 2-finger pinch = zoom in/out. After zooming, 2-finger pan moves around inside the zoomed view. The DOW header at the top stays sticky and does **not** scale with zoom (sits outside `TransformWrapper`).

4. **No special highlight for today.** Today's date renders like any other carved day.

5. **Empty columns stay empty.** No placeholder cells for skipped weeks within a column.

6. **All selected days share the same red border.** Source day still gets the inline `★` marker. Other-selected and source share identical border treatment — user reads "selected vs not selected" not "source vs others."

7. **Drag-and-drop kept.** Chip body draggable with 8px activation. Drop on rest day → "Convert this rest day to [muscle] day?" prompt. Drop on cross-muscle day → "Add [muscle] to this day's training?" prompt. Drop on same-muscle day → silent move. Already wired in `app/attune/page.js`'s `handleDragEnd` — leave that logic alone.

8. **AutoAttuneButton always visible.** No more `hasAnyChip → return null` dismiss. Each tap populates **only** days that currently have 0 chips — never overwrites existing chips. Filter the dayMuscleMap at the button level to only include days where `state[iso]?.chips.length === 0` before calling `autoAttuneAll`.

9. **Carved-but-unmuscled days = rest days.** Render `休` / `REST`. Tap = no-op (already returns early on `muscles.length === 0` in `handleDayTap`). Drag a chip onto one → `variant: 'rest'` prompt. Already in spec, already wired.

10. **First-time onboarding popup unchanged.** Verbatim copy: *"attune your movements to specific days. copy, move, and replace movements at will."* One-shot global flag, persisted, never repeats.

## File-by-file changes

### CHANGE 1 — `app/attune/page.js`

In the wrapper around the calendar (around line 306), add `display: flex; flexDirection: column` so `CycleCalendar`'s outer flex:1 actually claims height. Find:

```jsx
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <CycleCalendar ... />
            <AutoAttuneButton cycle={cycle} />
          </div>
```

Replace the wrapper opening tag with:

```jsx
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
```

Leave the children alone.

### CHANGE 2 — `components/attune/CycleCalendar.jsx` (FULL REPLACEMENT)

```jsx
'use client'
import { useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import DayCell from './DayCell'
import { useChipsForDay, isDayLocked, useIsChipDragging } from '../../lib/attunement'

const DOW_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function isoToLocalDate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * Bucket carved days by weekday (0=Sun .. 6=Sat). Each bucket is sorted
 * chronologically. Skipped weeks within a column collapse — no placeholders.
 */
function bucketByWeekday(cycle) {
  const buckets = [[], [], [], [], [], [], []]
  if (!cycle || !Array.isArray(cycle.days)) return buckets
  for (const iso of cycle.days) {
    const d = isoToLocalDate(iso)
    if (!d) continue
    buckets[d.getDay()].push({ iso, dayNum: d.getDate(), date: d })
  }
  for (const b of buckets) b.sort((a, c) => a.date - c.date)
  return buckets
}

export default function CycleCalendar({ cycle, onDayTap, onChipReplace, selectedDayIds = [], sourceDayId = null }) {
  const isChipDragging = useIsChipDragging()
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(1)

  if (!cycle || !Array.isArray(cycle.days) || cycle.days.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#666', fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem',
      }}>
        no carved days · attune nothing
      </div>
    )
  }

  const buckets = bucketByWeekday(cycle)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky DOW header — sits outside the TransformWrapper so it doesn't scale with zoom. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          padding: '0.5rem 0.75rem 0.4rem 0.75rem',
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.6rem',
          letterSpacing: '0.18em',
          color: '#a8a39a',
          textAlign: 'center',
          textTransform: 'uppercase',
          flexShrink: 0,
          borderBottom: '1px solid #1f1f24',
          background: '#0a0a0c',
          zIndex: 5,
        }}
      >
        {DOW_HEADERS.map(d => <span key={d}>{d}</span>)}
      </div>

      {/* Pan-zoom surface. At scale 1 panning still works as 1-finger vertical scroll. */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <TransformWrapper
          ref={wrapperRef}
          initialScale={1}
          minScale={1}
          maxScale={3}
          centerOnInit={false}
          centerZoomedOut={false}
          limitToBounds
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
          panning={{ disabled: isChipDragging, velocityDisabled: false }}
          onTransformed={(_, state) => setScale(state.scale)}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', padding: '0.5rem 0.75rem 7rem 0.75rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
                width: '100%',
                alignItems: 'start',
              }}
            >
              {buckets.map((bucket, dow) => (
                <div
                  key={dow}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    minHeight: 60,
                  }}
                >
                  {bucket.map(({ iso, dayNum }) => (
                    <CarvedBlock
                      key={iso}
                      cycleId={cycle.id}
                      dayId={iso}
                      dayNum={dayNum}
                      muscles={cycle.dailyPlan?.[iso] || []}
                      onTap={onDayTap}
                      onChipReplace={onChipReplace}
                      isSelected={selectedDayIds.includes(iso)}
                      isSource={iso === sourceDayId}
                    />
                  ))}
                </div>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <div style={{
        position: 'absolute', top: 8, right: 12, zIndex: 10,
        fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        fontSize: '0.55rem', letterSpacing: '0.18em', color: '#5a5a5e',
        textTransform: 'uppercase', pointerEvents: 'none',
      }}>
        {scale.toFixed(2)}×
      </div>
    </div>
  )
}

function CarvedBlock({ cycleId, dayId, dayNum, muscles, onTap, onChipReplace, isSelected, isSource }) {
  const chips = useChipsForDay(cycleId, dayId)
  const locked = isDayLocked(cycleId, dayId)
  const isRest = !muscles || muscles.length === 0
  return (
    <DayCell
      cycleId={cycleId}
      dayId={dayId}
      dayNum={dayNum}
      muscles={muscles}
      chips={chips}
      isLocked={locked}
      isRestDay={isRest}
      isSelected={isSelected}
      isSource={isSource}
      onTap={onTap}
      onChipReplace={onChipReplace}
    />
  )
}
```

Notes:
- Column header (`SUN MON TUE…`) is **outside** the `TransformWrapper` so it stays anchored when content pans/zooms.
- Each column is a flex-column of `DayCell`s — chronologically sorted, zero placeholders for skipped weeks.
- `minScale={1}` means user can't zoom out beyond fit; only in. This keeps the columns at full width by default.
- `padding-bottom: 7rem` in `contentStyle` reserves space for the floating `AutoAttuneButton`.

### CHANGE 3 — `components/attune/DayCell.jsx` (FULL REPLACEMENT)

```jsx
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

  const kanjiStack = muscles.length > 0 ? muscles.map(muscleKanji).join('') : (isRestDay ? '休' : '·')
  const labelStack = muscles.length > 0
    ? muscles.map(muscleLabel).filter(Boolean).join(' · ')
    : (isRestDay ? 'REST' : '')

  // Same red border for source AND multi-target — uniform "selected" treatment.
  let border = `1px solid ${isLocked ? '#3a3a42' : '#2a2a30'}`
  if (isSelected) border = '2px solid #d4181f'
  if (isOver)      border = isLocked ? '2px solid #ff2a36' : '2px solid #f1eee5'

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-attune-day={dayId}
      data-attune-selected={isSelected ? '1' : '0'}
      data-attune-source={isSource ? '1' : '0'}
      onClick={handleClick}
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
      {/* Header: day number (right), source-star inline (left) */}
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          fontSize: '0.95rem',
          lineHeight: 1,
          color: isRestDay ? '#5a5a5e' : '#f1eee5',
          minHeight: '0.95rem',
        }}
      >
        <span style={{ color: '#d4181f', fontFamily: 'inherit', fontSize: '0.75rem' }}>
          {isSource ? '★' : ''}
        </span>
        <span>{dayNum}</span>
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
              fontSize: '0.45rem',
              letterSpacing: '0.14em',
              color: isRestDay ? '#5a5a5e' : '#a8a39a',
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
    </button>
  )
}
```

Notes:
- DOW removed from per-cell header (column already shows it). Just day-number + source-star.
- All-uniform red border for `isSelected` (source and multi-target both get it).
- Chip stack always renders, no tier branching.

### CHANGE 4 — `components/attune/SetChip.jsx` (FULL REPLACEMENT)

```jsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import ChipActionMenu from './ChipActionMenu'
import { duplicateChip, deleteChip } from '../../lib/attunement'

const LONG_PRESS_MS = 550
const MOVE_CANCEL_PX = 5

export default function SetChip({ chip, cycleId, dayId, compact = false, onReplace }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const movedRef = useRef(false)
  const longPressedRef = useRef(false)

  const interactive = !!(cycleId && dayId)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chip?.id || 'chip-noop',
    data: { fromDayId: dayId, exerciseId: chip?.exerciseId },
    disabled: !interactive || menuOpen,
  })

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }
  useEffect(() => () => clearTimer(), [])
  useEffect(() => { if (isDragging) clearTimer() }, [isDragging])

  if (!chip) return null
  const label = chip.exerciseId || 'untitled'
  const display = compact && label.length > 14 ? label.slice(0, 13) + '…' : label

  const handlePointerDown = (e) => {
    if (!interactive) return
    longPressedRef.current = false
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      setMenuOpen(true)
    }, LONG_PRESS_MS)
  }
  const handlePointerMove = (e) => {
    if (!interactive || !startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) { movedRef.current = true; clearTimer() }
  }
  const handlePointerEnd = () => { clearTimer(); startRef.current = null }
  const handleClick = (e) => {
    e.stopPropagation()
    if (longPressedRef.current) {
      e.preventDefault()
      longPressedRef.current = false
      return
    }
    if (movedRef.current || isDragging) return
    if (!interactive) return
    setMenuOpen(true)
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
    fontSize: '0.6rem',
    lineHeight: 1,
    padding: '1px 2px',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
          padding: '3px 3px 3px 5px',
          display: 'flex', alignItems: 'center', gap: 2,
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.5rem',
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
          flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {display}
        </span>
        {interactive && (
          <span style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            <button type="button" aria-label="copy" title="Copy" onPointerDown={stop} onClick={copyHandler} style={iconBtnStyle}>⎘</button>
            <button type="button" aria-label="replace" title="Replace" onPointerDown={stop} onClick={replaceHandler} style={iconBtnStyle}>⇄</button>
            <button type="button" aria-label="delete" title="Delete" onPointerDown={stop} onClick={deleteHandler} style={iconBtnStyle}>✕</button>
          </span>
        )}
      </div>
      {menuOpen && interactive && (
        <ChipActionMenu
          chipLabel={label}
          onCopy={() => duplicateChip(cycleId, dayId, chip.id)}
          onDelete={() => deleteChip(cycleId, dayId, chip.id)}
          onReplace={() => { if (onReplace) onReplace({ dayId, chipId: chip.id, fromLabel: label }) }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  )
}
```

Notes:
- Inline `⎘ ⇄ ✕` icon buttons always visible. `onPointerDown={stop}` keeps each icon's tap from leaking to the chip drag.
- Chip body tap (not on icon) opens the full action menu.
- Long-press still opens the action menu (unchanged fallback).
- Drag activation = 8px move, kept.
- Font shrunk to 0.5rem so chips fit narrow weekday columns. Pinch-zoom is the read-affordance.

### CHANGE 5 — `components/attune/AutoAttuneButton.jsx` (FULL REPLACEMENT)

```jsx
'use client'
import { autoAttuneAll, useAttunement } from '../../lib/attunement'
import { canonicalExerciseFor } from '../../lib/exerciseLibrary'

/**
 * AutoAttuneButton — always visible. Each tap fills only days that are
 * currently empty (zero chips). Existing chips are never overwritten.
 */
export default function AutoAttuneButton({ cycle }) {
  const state = useAttunement(cycle?.id)
  if (!cycle || !Array.isArray(cycle.days)) return null

  const workoutDays = cycle.days.filter(iso => (cycle.dailyPlan?.[iso] || []).length > 0)
  if (workoutDays.length === 0) return null

  const handleClick = () => {
    const dayMuscleMap = {}
    for (const iso of workoutDays) {
      const existing = state?.[iso]?.chips?.length || 0
      if (existing > 0) continue  // skip already-attuned days, fill only the gaps
      const muscles = cycle.dailyPlan?.[iso] || []
      dayMuscleMap[iso] = muscles[0]
    }
    if (Object.keys(dayMuscleMap).length === 0) return
    autoAttuneAll(cycle.id, dayMuscleMap, canonicalExerciseFor)
  }

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      display: 'flex', justifyContent: 'center', zIndex: 20,
      pointerEvents: 'none',
    }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          pointerEvents: 'auto',
          background: '#d4181f',
          border: '2px solid #ff2a36',
          color: '#fff',
          padding: '0.85rem 1.5rem',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          fontSize: '0.9rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 900,
          cursor: 'pointer',
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          boxShadow: '4px 4px 0 #070708',
        }}
      >
        Auto-attune all
      </button>
    </div>
  )
}
```

Notes:
- Removed the `hasAnyChip → return null` early dismiss.
- Filter out workoutDays that already have chips before calling `autoAttuneAll`.
- Button text and styling unchanged.

## DO NOT

- Do **not** alter `lib/attunement.js`, `ChipActionMenu.jsx`, `DropPromptModal.jsx`, `ReplaceCascadeModal.jsx`, `PickerSheet.jsx`, `ExitGuardDialog.jsx`, `FirstTimeInstructionPopup.jsx`, or `app/fitness/new/branded/page.js`.
- Do **not** change `MUSCLE_KANJI` glyphs or the picker logic.
- Do **not** delete the `ChipActionMenu` long-press code path — keep it as fallback.
- Do **not** add a today-highlight, today-glow, or any per-day visual state beyond what's specified.
- Do **not** add row-alignment between columns. Each column is its own chronological stack — Mon col might have 4 entries, Tue might have 0, Tue stays empty.
- Do **not** add placeholder cells for skipped weeks within a column. Carved days simply stack with no gaps.
- Do **not** reintroduce the `zoomTier` import — it's no longer used. (Leave the file `lib/zoomTier.js` itself in place.)

## Verify visually

After the change, with a populated cycle loaded (use `localStorage` keys: `gtl-active-profile=KING`, `gtl-KING-active-cycle-id=<id>`, `gtl-KING-cycles=[{id, name, days, dailyPlan}]`):

1. Top header row shows `SUN MON TUE WED THU FRI SAT` across 7 equal columns. Stays anchored when content scrolls or zooms.
2. Each weekday column stacks its carved days chronologically. A weekday with no carved days shows an empty column under its header.
3. Each carved day-block shows: day-number (right) + source-star (left, only if source), kanji centered, English label below kanji, chip stack below.
4. Each chip shows the exercise name + three inline icons `⎘ ⇄ ✕`. Tap an icon → action fires. Tap chip body → full action menu opens.
5. Selected days (source + multi-target) all show the same red border.
6. AutoAttuneButton always visible at bottom. Tap on a cycle with all days empty → fills every day. Tap again with some days populated → fills only the empty ones, leaves existing chips alone.
7. Pinch-zoom in → chip text grows readable. Pinch-zoom out → returns to scale 1.
8. 1-finger drag scrolls the calendar vertically (when content is taller than viewport). DOW header stays at top.
9. Drag a chip from Mon week 1 onto a different day in Wed col → cross-muscle prompt fires (unless same muscle, then silent move).
10. Carved-but-unmuscled day shows `休` / `REST`. Tap = no-op. Drop chip on it → rest-day conversion prompt.

Run a playwright eval at 390×844 with a multi-week cycle seeded into localStorage. Take three screenshots:
- (a) Cold load — weekday columns visible, chips populated on multiple days.
- (b) After tapping AUTO-ATTUNE ALL on a partially-filled cycle — verifies only empty days got filled.
- (c) After pinch-zooming in — chip text readable.

## Commit and push

Use **two** commits:

1. `Attune calendar: per-weekday vertical columns (Sun→Sat), no row alignment, no placeholders`
2. `Attune cells: always-visible chip stack with inline copy/replace/delete icons + dayNum + kanji + English label; AutoAttuneButton always visible, fills only empties`

Push to `origin/dev`.

## Report

- Both commit hashes.
- Three screenshots from the playwright eval.
- One-line confirmation: `per-weekday columns live, chip actions inline, auto-attune persistent.`
