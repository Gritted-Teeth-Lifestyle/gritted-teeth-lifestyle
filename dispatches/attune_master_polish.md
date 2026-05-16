# Attune master polish — 7 fixes in one dispatch

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/DayCell.jsx`, `components/attune/CycleCalendar.jsx`, `components/attune/SetChip.jsx`, `components/attune/PickerSheet.jsx`.

**Supersedes:** `dispatches/attune_polish_chip_layout.md` (do not also do that one — its changes are subsumed and refined here).

**IMPORTANT:** if you don't understand any item below, **STOP and ASK** before guessing. Do not commit speculative interpretations of these changes — Jordan is tired of round-tripping. Better to clarify than to ship the wrong thing.

## The 7 fixes

### 1. Today's day-number renders red (instead of chalk-white)

In `components/attune/CycleCalendar.jsx`, after computing `bucketByWeekday(cycle)`, also compute today's local-tz ISO and pass it down so each `DayCell` knows whether it represents today. Add this near the top:

```js
function localTodayIso() {
  const d = new Date()
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
```

In the component body, compute `const todayIso = localTodayIso()`. Pass `isToday={iso === todayIso}` into `<CarvedBlock>` (and through to `DayCell`).

In `components/attune/DayCell.jsx`, accept `isToday` as a prop (default `false`). In the cell header, change the day-number `<span>`'s color to:

```js
color: isRestDay ? '#5a5a5e' : (isToday ? '#d4181f' : '#f1eee5'),
```

Only the day-number is red when `isToday`. Kanji and English label colors are unchanged.

### 2. Wider columns

In `components/attune/CycleCalendar.jsx`, change the grid:

```js
gridTemplateColumns: 'repeat(7, 110px)',
```

to:

```js
gridTemplateColumns: 'repeat(7, 160px)',
```

Total grid width becomes `7 × 160 + 6 × 6 (gap) = 1156px`. Wider than the viewport — user pans horizontally to see all columns, or pinch-zooms out to see them all at once.

In the `TransformWrapper` props (replacing what's currently there), use:

```jsx
<TransformWrapper
  ref={wrapperRef}
  initialScale={1}
  initialPositionX={0}
  initialPositionY={0}
  minScale={0.4}
  maxScale={3}
  centerOnInit={false}
  centerZoomedOut={false}
  limitToBounds={false}
  wheel={{ step: 0.15 }}
  pinch={{ step: 5 }}
  doubleClick={{ disabled: true }}
  panning={{ disabled: isChipDragging, velocityDisabled: false, lockAxisX: false, lockAxisY: false }}
  onTransformed={(_, state) => setScale(state.scale)}
>
```

Page lands at scale 1 (full readable column width) with the SUN/MON columns at the left edge of the viewport. User pans right to see the rest, or pinches out (down to 0.4) to see all 7 columns at once.

### 3. Picker list shows the first ~5 exercises, then scrolls

In `components/attune/PickerSheet.jsx`, find the exercise list container (`<div>` wrapping the `exercises.map(...)`). Currently:

```jsx
<div style={{
  flex: 1,
  overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 4,
  minHeight: 80, maxHeight: '38vh',
}}>
```

Replace `maxHeight: '38vh'` with a fixed height computed for ~5 rows. Each list-item is ~40px (with current padding + font). Replace with:

```jsx
<div style={{
  flex: '0 0 auto',
  overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 4,
  minHeight: 80,
  maxHeight: 220,
}}>
```

`maxHeight: 220` fits 5 rows comfortably plus a couple px of breathing room. Drop `flex: 1` so the list does NOT eat all available space — it stays at its 220px cap regardless of how tall the sheet is. Remaining sheet space below sits empty (or gets used by the confirm button).

### 4. Remove the M/B/D/etc. equipment-glyph indicator

In `components/attune/PickerSheet.jsx`:

- Delete the `EQUIPMENT_GLYPH` constant (the object mapping `barbell → 'B'`, etc., near line 37).
- Inside the exercise-list `.map((ex) => ...)`, delete the line `const glyph = EQUIPMENT_GLYPH[ex.equipment] || '·'` and the entire `<span aria-hidden="true" title={ex.equipment || ''} style={...}>{glyph}</span>` block.
- Also remove the `justifyContent: 'space-between'` from the button's flex style — without the trailing glyph, just left-align the label.

The list rows now show exercise labels only. No tag, no badge, no glyph.

### 5. Bigger Copy / Replace / Delete icons on each chip

In `components/attune/SetChip.jsx`, the chip's three inline action buttons (`⎘ ⇄ ✕`) need to render bigger and as a separate row **below** the label (full-width label, full-width icon row). Restructure:

(a) The chip's outer `<div>` style — change from row to column layout:

```jsx
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
```

(b) The label `<span>` — full width, multi-line, word-boundary wrap:

```jsx
<span style={{
  whiteSpace: 'normal',
  wordBreak: 'normal',
  overflowWrap: 'break-word',
  lineHeight: 1.2,
}}>
  {label}
</span>
```

(c) The action-icon `<span>` — its own row beneath the label, right-aligned, with a thin divider line:

```jsx
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
```

(d) The `iconBtnStyle` constant — significantly bigger glyphs and tap targets:

```js
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
```

The icons are now ~16px glyphs in 28×28px tap targets — comfortably finger-size on mobile.

### 6. Multi-select in the picker (place multiple exercises per confirm)

In `components/attune/PickerSheet.jsx`, change the selection state from single to multi:

(a) Replace the existing `useState` for the selected exercise:

```js
const [selectedExerciseId, setSelectedExerciseId] = useState(null)
```

with:

```js
const [selectedExerciseIds, setSelectedExerciseIds] = useState([])
const toggleExercise = (id) => {
  setSelectedExerciseIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  )
}
```

(b) The list-item `<button>` — change `onClick` to toggle, and base `selected` on inclusion in the array:

```jsx
const selected = selectedExerciseIds.includes(ex.id)
return (
  <button
    key={ex.id}
    type="button"
    onClick={() => toggleExercise(ex.id)}
    style={{ /* ... existing styles, keyed off `selected` ... */ }}
  >
    {ex.label}
  </button>
)
```

(c) The confirm handler — iterate over `selectedExerciseIds` and call `onConfirm` once per selected exercise. The simplest contract: keep `onConfirm(exerciseId)` accepting one ID, and the picker calls it in a loop:

```js
const handleConfirm = () => {
  if (selectedExerciseIds.length === 0) { onClose(); return }
  for (const id of selectedExerciseIds) {
    onConfirm(id)
  }
  setSelectedExerciseIds([])
  // onConfirm will close via parent state (selectedDayIds clears), but if
  // mode='replace' there's no calendar selection; in that case we close here.
}
```

Verify against the parent in `app/attune/page.js`'s `handleAttuneConfirm` — it places the exercise on every selected day. Calling it N times places N exercises × M days = N×M chips in total, which is exactly what multi-select-picker × multi-day-target should produce.

(d) The Confirm button's label — update so it reflects the count: e.g., `CONFIRM (3 EXERCISES × 2 DAYS)` if 3 exercises and 2 days are selected. Compute `selectedExerciseIds.length` and `selectedDayIds.length` for display. If either is 0, disable the button.

### 7. Remove the ★ source-day marker

In `components/attune/DayCell.jsx`, find the inline source-star rendering inside the cell header (the `<span style={{ color: '#d4181f', fontFamily: 'inherit', fontSize: '0.75rem' }}>` that shows `★` when `isSource` is true).

Delete that entire `<span>` block. Source-day no longer gets a star — it's already visually distinguishable from non-selected days because of the red border (selected days share the same red border per earlier spec).

The `isSource` prop can stay on `DayCell` (it's harmless if unused) or be removed if you want to clean up the prop chain — your call.

## DO NOT

- Touch `lib/attunement.js`, `lib/exerciseLibrary.js`, `lib/storage.js`, `app/attune/page.js`, `AutoAttuneButton.jsx`, `ChipActionMenu.jsx`, `DropPromptModal.jsx`, `ReplaceCascadeModal.jsx`, `ExitGuardDialog.jsx`, `FirstTimeInstructionPopup.jsx`.
- Add today-highlight to anything other than the day-number color (no border ring, no glow, no badge).
- Change the cycle data model or storage keys.
- Modify the schedule page (`app/fitness/new/branded/page.js`). The cycles-glutes bug is a separate dispatch.
- Don't reintroduce `whiteSpace: nowrap` or `text-overflow: ellipsis` on chip labels — wrap to multiple lines, never truncate.

## Verify visually

After all 7 fixes land, with a populated cycle in localStorage at 390×844 viewport:

1. Today's date renders **red** (`#d4181f`) in its day-cell's header. All other day-numbers are chalk (`#f1eee5`).
2. Calendar columns are visibly wider — only ~2 full columns fit the viewport at scale 1; user pans right to reach the others, or pinches out (down to 0.4) to see all 7.
3. Tap a workout day → picker opens. List shows the first ~5 exercises with the rest reachable by scrolling within the list.
4. No `M B D K C R` or `b · ·` letters/symbols anywhere in the picker.
5. Each chip shows the full exercise label wrapping at word boundaries (no mid-letter splits) on top, then a thin divider line, then a row of three larger `⎘ ⇄ ✕` icons spaced apart.
6. In the picker, tap multiple exercises — each selected exercise highlights red. Tap CONFIRM — every selected exercise lands as a chip on every selected day. Picker closes.
7. The `★` star is gone from all day cells, including the first-tapped (source) day. Selected days are distinguished only by their red border.

Run a playwright eval at 390×844 with a multi-week cycle and today carved as one of the days. Take screenshots showing:
- (a) `/attune` cold load — wider cols visible, today's date red, no ★
- (b) After tapping a day → picker open with ~5 exercises visible (and only ~5)
- (c) After tapping 2 exercises in picker → both highlighted red
- (d) After confirm + auto-attune → chips show full-width labels with the bigger icon row below

## Commit and push

Either one comprehensive commit:

```
Attune polish (7 fixes): today red day-num, wider 160px cols, picker shows 5 + scroll, drop equipment glyphs, bigger chip icons in below-label row, multi-select picker, drop source ★
```

Or split into a couple of logical commits if cleaner. Push to `origin/dev`.

## Report

- Commit hash(es).
- Four screenshots (a–d above).
- One-line confirmation per fix:
  - `[1] today red`
  - `[2] cols 160px`
  - `[3] picker capped at 5 rows`
  - `[4] equipment glyphs gone`
  - `[5] bigger chip icons in below-label row`
  - `[6] multi-select picker live`
  - `[7] source ★ removed`

If anything is unclear: **ASK before committing.** Do not guess. Jordan would rather wait an extra minute than re-dispatch.
