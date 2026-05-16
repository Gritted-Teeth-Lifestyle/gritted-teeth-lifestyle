# Attune Movements page — comprehensive redesign (week-aligned grid, always-visible chips, tap-to-action)

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/CycleCalendar.jsx`, `components/attune/DayCell.jsx`, `components/attune/SetChip.jsx`, `app/attune/page.js`.

This spec **supersedes** the partial fixes in `dispatches/attune_calendar_height_fix.md` and `dispatches/attune_daycell_dow_label.md`. The original feature plan is `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md`. Re-read it before starting; the implementation diverged from it on three counts that this spec corrects.

## DIAGNOSIS — what's wrong on `/attune` right now

1. **The calendar packs carved days into N columns from the left**, ignoring real-world weekday. If the user carves Mon / Wed / Fri, the page shows three cells in cols 1-2-3, not in the Mon/Wed/Fri slots of a Sun→Sat week. A week-aligned grid was always the intent (CARVE / branded schedule both render Sun→Sat).
2. **Day cells hide chip text at the default zoom** ("far" tier). Users see only a kanji + a numeric badge. The exercises themselves never appear on the card unless the user pinch-zooms in — but the calendar collapses to one row at far tier and most users never zoom in. Net effect: the exercises are invisible.
3. **Copy / Delete / Replace are gated behind a 550ms long-press** on a chip. There is no visual affordance — first-time users have no way to know the actions exist. Jordan asked for the action buttons to be **on the exercise card itself**, accessible via tap.
4. **The calendar collapses to a 132px strip** because the parent wrapper in `app/attune/page.js` is missing `display: flex; flexDirection: column` (so `CycleCalendar`'s `flex: 1` is a no-op). The calendar should fill the viewport.
5. **No day-of-week label, no day number, and the muscle kanji has no English pairing** — even users who know the kanji glyphs can't tell which day of the cycle they're looking at.

This dispatch fixes all five at once.

## CHANGE 1 — Calendar parent must be flex column (height claim)

In `app/fitness/.../app/attune/page.js`, around line 306, find:

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

(Same one-line fix as the superseded `attune_calendar_height_fix.md`. If a previous commit already landed this, leave it alone and move on.)

## CHANGE 2 — `CycleCalendar.jsx` becomes a Sun→Sat 7-column week grid

Replace the body of `CycleCalendar` so the grid is **always** 7 columns (Sun column 1, Sat column 7), with one row per spanned week. Render every day in the spanned range, distinguishing carved days (with assigned muscle) from non-carved days (placeholder slots). Drop the zoom-tier abstraction — every cell now renders the same content (full chip stack with action buttons), just visually scaled by the pan-zoom transform.

### File: `components/attune/CycleCalendar.jsx`

Full replacement:

```jsx
'use client'
import { useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import DayCell from './DayCell'
import { useChipsForDay, isDayLocked, useIsChipDragging } from '../../lib/attunement'

const DOW_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/**
 * Build the full Sun→Sat week-aligned calendar span that contains every
 * carved day in the cycle. For a cycle that spans 9 days from a Wed to
 * a Thu, the grid covers from the prior Sun through the trailing Sat
 * (so 14 cells / 2 rows). Carved days fill their actual weekday slot;
 * non-carved days render as placeholder slots in the same grid row.
 */
function buildGridSpan(cycle) {
  if (!cycle || !Array.isArray(cycle.days) || cycle.days.length === 0) return []
  const isoToLocalDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const dates = cycle.days.map(isoToLocalDate).filter(d => !isNaN(d))
  if (dates.length === 0) return []
  dates.sort((a, b) => a - b)
  const first = dates[0]
  const last = dates[dates.length - 1]
  // Snap span to nearest Sun (back) and Sat (forward).
  const start = new Date(first); start.setDate(start.getDate() - first.getDay())
  const end = new Date(last); end.setDate(end.getDate() + (6 - last.getDay()))
  const carvedSet = new Set(cycle.days)
  const cells = []
  const cur = new Date(start)
  while (cur <= end) {
    const y = cur.getFullYear(), m = cur.getMonth() + 1, d = cur.getDate()
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      iso,
      dow: cur.getDay(),
      dayNum: d,
      isCarved: carvedSet.has(iso),
    })
    cur.setDate(cur.getDate() + 1)
  }
  return cells
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

  const cells = buildGridSpan(cycle)
  const rowCount = Math.max(1, Math.ceil(cells.length / 7))

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky weekday header — never scaled by the pan-zoom surface */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          padding: '0.5rem 1rem 0.4rem 1rem',
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.6rem',
          letterSpacing: '0.18em',
          color: '#a8a39a',
          textAlign: 'center',
          textTransform: 'uppercase',
          flexShrink: 0,
          background: 'transparent',
          zIndex: 5,
        }}
      >
        {DOW_HEADERS.map(d => <span key={d}>{d}</span>)}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <TransformWrapper
          ref={wrapperRef}
          initialScale={1}
          minScale={0.6}
          maxScale={2.4}
          centerOnInit
          centerZoomedOut
          limitToBounds
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
          panning={{ disabled: isChipDragging, velocityDisabled: false }}
          onTransformed={(_, state) => setScale(state.scale)}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ padding: '0.25rem 1rem 1rem 1rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(48px, 1fr))',
                gridAutoRows: 'minmax(140px, auto)',
                gap: 6,
                width: 'calc(100vw - 2rem)',
              }}
            >
              {cells.map(cell => cell.isCarved ? (
                <CarvedCell
                  key={cell.iso}
                  cycleId={cycle.id}
                  dayId={cell.iso}
                  dow={cell.dow}
                  dayNum={cell.dayNum}
                  muscles={cycle.dailyPlan?.[cell.iso] || []}
                  onTap={onDayTap}
                  onChipReplace={onChipReplace}
                  isSelected={selectedDayIds.includes(cell.iso)}
                  isSource={cell.iso === sourceDayId}
                />
              ) : (
                <PlaceholderCell key={cell.iso} dow={cell.dow} dayNum={cell.dayNum} />
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

function CarvedCell({ cycleId, dayId, dow, dayNum, muscles, onTap, onChipReplace, isSelected, isSource }) {
  const chips = useChipsForDay(cycleId, dayId)
  const locked = isDayLocked(cycleId, dayId)
  const isRest = !muscles || muscles.length === 0
  return (
    <DayCell
      cycleId={cycleId}
      dayId={dayId}
      dow={dow}
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

function PlaceholderCell({ dow, dayNum }) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: '#070708',
        border: '1px dashed #1f1f24',
        borderRadius: 4,
        opacity: 0.42,
        minHeight: 140,
        padding: '0.4rem 0.45rem',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        fontSize: '0.55rem',
        letterSpacing: '0.16em',
        color: '#3a3a40',
      }}
    >
      <div>{dayNum}</div>
    </div>
  )
}
```

Notes:
- The 7-column grid spans the full row even for cycles shorter than a week — empty weekdays render as faint dashed placeholders so the spatial pattern of the cycle reads correctly.
- The DOW header row sits **outside** the `TransformWrapper` so it stays anchored and crisp regardless of pan-zoom.
- `gridAutoRows: minmax(140px, auto)` lets cells grow to fit their chip stacks.
- The width calc `calc(100vw - 2rem)` keeps the 7 columns sized to the available viewport at scale 1.

## CHANGE 3 — `DayCell.jsx` always shows DOW + day-number header, kanji + English label, and the full chip stack with inline action buttons

Replace the entire body of `DayCell.jsx` so the cell renders consistently at every zoom level. No more tier branching.

### File: `components/attune/DayCell.jsx`

Full replacement:

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

const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function muscleKanji(id) { return MUSCLE_KANJI[id] || '·' }
function muscleLabel(id) { return MUSCLE_LABEL[id] || '' }

export default function DayCell({
  cycleId,
  dayId,
  dow,
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
  const labelStack = muscles.length > 0 ? muscles.map(muscleLabel).filter(Boolean).join(' · ') : (isRestDay ? 'REST' : '')

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
        padding: '0.45rem 0.45rem 0.55rem 0.45rem',
        textAlign: 'left',
        color: '#f1eee5',
        fontFamily: 'inherit',
        cursor: isLocked ? 'default' : 'pointer',
        minHeight: 140,
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
        boxShadow: isSelected ? '0 0 0 1px rgba(212,24,31,0.55)' : 'none',
        opacity: isLocked ? 0.42 : 1,
      }}
    >
      {/* Header: DOW left (with star inline if source), day number right */}
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.55rem', letterSpacing: '0.16em', lineHeight: 1,
          color: isRestDay ? '#5a5a5e' : '#a8a39a',
        }}
      >
        <span>
          {isSource && <span style={{ color: '#d4181f', marginRight: 3 }}>★</span>}
          {DOW_SHORT[dow] || ''}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display, Anton, sans-serif)',
            fontSize: '0.95rem',
            letterSpacing: 0,
            color: isRestDay ? '#5a5a5e' : '#f1eee5',
          }}
        >
          {dayNum}
        </span>
      </div>

      {/* Kanji + English label paired */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span
          style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '1.4rem',
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
              fontSize: '0.5rem',
              letterSpacing: '0.16em',
              color: isRestDay ? '#5a5a5e' : '#a8a39a',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {labelStack}
          </span>
        )}
      </div>

      {/* Chip stack — ALWAYS visible (no tier gating). One chip per row. */}
      {chips.length > 0 && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 3,
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
          fontSize: '0.55rem',
          color: '#666',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginTop: 'auto',
          paddingTop: 4,
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
- The chip stack's `onClick={(e) => e.stopPropagation()}` keeps a tap on a chip from also opening the day-picker.
- `tap to attune` placeholder in empty cells gives users a clear affordance.

## CHANGE 4 — `SetChip.jsx` exposes Copy / Delete / Replace via tap (not just long-press), with inline icons

Make the action menu **one-tap** accessible: a tap on the chip opens `ChipActionMenu` directly. Long-press still works (preserves muscle memory) but is no longer required. Drag remains gated by 8px activation distance so a stationary tap still registers as a tap, not a drag.

### File: `components/attune/SetChip.jsx`

Replace the body of `SetChip` so a click that did NOT trigger a drag opens the menu, and add three small inline icon buttons that appear on the chip itself (always visible — Copy ⎘ / Delete ✕ / Replace ⇄). The icon buttons stop propagation and call the same handlers as the menu. The big-tap area still opens the full menu for users who don't notice the tiny icons.

Replace the file with:

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
  const display = compact && label.length > 16 ? label.slice(0, 15) + '…' : label

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
    fontSize: '0.7rem',
    lineHeight: 1,
    padding: '2px 3px',
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
          padding: '4px 5px 4px 7px',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: compact ? '0.6rem' : '0.7rem',
          letterSpacing: '0.06em',
          color: '#d8d2c2',
          textTransform: 'uppercase',
          cursor: interactive ? 'pointer' : 'default',
          touchAction: interactive ? 'none' : 'manipulation',
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
- Inline icon buttons `⎘ ⇄ ✕` are always visible on every chip — that's "the copy delete replace buttons on the exercise card."
- Tap anywhere else on the chip opens the full `ChipActionMenu` (kept for parity with long-press).
- `onPointerDown={stop}` on each icon button prevents the drag listener from absorbing the tap.
- The icon buttons share the chip's footprint; on a 48px-wide column at scale 1 they may look tight — that's OK because user pinch-zooms in to interact and pinch-zooms out to scan.

## DO NOT

- Do **not** alter `lib/attunement.js`, `ChipActionMenu.jsx`, `DropPromptModal.jsx`, `ReplaceCascadeModal.jsx`, `PickerSheet.jsx`, `AutoAttuneButton.jsx`, `ExitGuardDialog.jsx`, `FirstTimeInstructionPopup.jsx`, or `app/fitness/new/branded/page.js`.
- Do **not** change `MUSCLE_KANJI` glyphs, the dropdown / picker logic, or `addChip` / `replaceExercise` / `moveChip` semantics.
- Do **not** delete the existing `ChipActionMenu` long-press path — keep it as the secondary access pattern. (Inline icons are primary; long-press is a fallback.)
- Do **not** remove `react-zoom-pan-pinch`. Pan-zoom remains; only the per-tier rendering branches go away.
- Do **not** add a "today" highlight, weekday hover, or week-start preference setting. Sun→Sat is fixed.
- Do **not** reintroduce the `zoomTier` import in `CycleCalendar.jsx` or `DayCell.jsx` — it is no longer used. (Leave the file `lib/zoomTier.js` itself in place; other code may still import it.)

## Verify visually

After the change, with a populated cycle loaded (use `localStorage` keys: `gtl-active-profile=KING`, `gtl-KING-active-cycle-id=<id>`, `gtl-KING-cycles=[{id, name, days, dailyPlan}]`):

1. The calendar header row shows `SUN MON TUE WED THU FRI SAT` across the top, never moving with pan-zoom.
2. Carved days appear in their actual weekday columns. A cycle that carves Mon/Wed/Fri renders three filled cells in cols 2/4/6 of one row, with cols 1/3/5/7 (Sun/Tue/Thu/Sat) as faint dashed placeholder slots.
3. Each carved cell shows: top header (DOW left + day-number right, with ★ inline before DOW for source day), the muscle kanji centered, the English muscle label below the kanji, and the chip stack (one chip per row, full exercise name, three inline icon buttons `⎘ ⇄ ✕` on each chip).
4. Tapping a chip's `⎘` duplicates it. Tapping `⇄` opens the replace picker. Tapping `✕` deletes it. Tapping the chip body opens the full action menu.
5. Tapping anywhere else on a carved cell opens the picker as before.
6. The calendar fills the available viewport height; no dead black void below.
7. Pinch-zoom still works — content scales, headers stay anchored.
8. Multi-day-attune flow (selecting multiple days, picker opens, confirming places one chip per day) still works — chips appear in each selected day's cell.
9. Drag-and-drop chip from one day to another still works — the rest-day prompt and cross-muscle prompt fire correctly.

Run a playwright eval at 390×844 with the cycle seeded into localStorage. Take three screenshots: (a) cold load, (b) after picker confirms 3 chips on the source day, (c) after dragging one of those chips to a different carved day.

## Commit and push

Use **two** commits so the progression is reviewable:

1. `Attune calendar: week-aligned 7-column Sun→Sat grid with empty-day placeholders`
2. `Attune cells: always-visible chip stack with inline copy/replace/delete icons + DOW + day-number + English label header`

Push to `origin/dev`.

## Report

- Both commit hashes.
- Three screenshots from the playwright eval.
- One-line confirmation: `tier-gated rendering removed, week-aligned grid live, chip actions inline.`
