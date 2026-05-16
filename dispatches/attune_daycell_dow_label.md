# Attune DayCell — show DAY-OF-WEEK, DAY NUMBER, and ENGLISH MUSCLE LABEL

**Target:** GTL 1 worker (`/c/Users/Jordan/gtl-1/`). Branch: `dev`. File: `components/attune/DayCell.jsx`.

## DIAGNOSIS

On `/attune` the carved-day cells currently render only the muscle kanji (e.g. `胸 / 肩 / 腿`). There is no day-of-week label, no day number, and no English pairing for the kanji — so a user looking at the calendar cannot tell which day is which, or what muscle the kanji means without prior memorization. The page reads as "virtually nothing."

Fix: pair every kanji with its English muscle name and put a header row at the top of every cell with the day-of-week + day number.

## REPLACE: add an English label map

Near the top of `components/attune/DayCell.jsx`, just below the existing `MUSCLE_KANJI` constant (around line 20-24), add:

```js
const MUSCLE_LABEL = {
  chest: 'CHEST', shoulders: 'SHOULDERS', back: 'BACK', forearms: 'FOREARMS',
  quads: 'QUADS', hamstrings: 'HAMSTRINGS', calves: 'CALVES',
  biceps: 'BICEPS', triceps: 'TRICEPS', glutes: 'GLUTES', abs: 'ABS',
}

function muscleLabel(muscleId) {
  return MUSCLE_LABEL[muscleId] || ''
}
```

## REPLACE: compute day-of-week + day number from `dayId`

Inside `DayCell`, just after the existing line `const kanjiStack = ...` (around line 53), add:

```js
// dayId is an ISO date string like "2026-05-04". Build a local-tz Date so
// getDay() / getDate() match the user's calendar day, not UTC.
const _d = (() => {
  if (!dayId || typeof dayId !== 'string') return null
  const [y, m, d] = dayId.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
})()
const dowLabel = _d ? ['SUN','MON','TUE','WED','THU','FRI','SAT'][_d.getDay()] : ''
const dayNum = _d ? _d.getDate() : ''
const labels = muscles.map(muscleLabel).filter(Boolean)
const labelText = labels.length > 0 ? labels.join(' · ') : (isRestDay ? 'REST' : '')
```

## REPLACE: render a header row + English label inside the cell

The cell currently looks like:

```
[absolute ★ if source]
[absolute chip-count badge top-right at far tier]
<div>{kanjiStack}</div>           ← centered kanji
[mid / near tier chip stack]
[empty placeholder]
[absolute lock badge bottom-right]
```

Restructure the cell content so every tier renders:

1. A top header row with `DOW` (left, mono) and `dayNum` (right, display font).
2. The existing kanji line, slightly smaller at far tier so the cell fits the new header + label.
3. An English-label line directly under the kanji (mono, small, uppercase, faint chalk).
4. Existing chip-count badge moves from `top-right` to `bottom-left` so the day number can own the top-right corner. Lock badge stays bottom-right.
5. Source star ★ stays as an absolute overlay but moves to **just outside** the header — render it inline at the start of the DOW text (e.g., `★ MON`) instead of an `absolute` overlay so it doesn't collide with the new header row.

Concretely, replace the current JSX inside the `<button>` (everything between the opening `<button ...>` and closing `</button>`) with this layout:

```jsx
{/* Header row: DOW left, day number right */}
<div
  style={{
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
    fontSize: '0.62rem', letterSpacing: '0.18em',
    color: isRestDay ? '#5a5a5e' : '#a8a39a',
    lineHeight: 1,
  }}
>
  <span>
    {isSource && <span style={{ color: '#d4181f', marginRight: 4 }}>★</span>}
    {dowLabel}
  </span>
  <span
    style={{
      fontFamily: 'var(--font-display, Anton, sans-serif)',
      fontSize: tier === 'far' ? '1rem' : '0.9rem',
      letterSpacing: 0,
      color: isRestDay ? '#5a5a5e' : '#f1eee5',
    }}
  >
    {dayNum}
  </span>
</div>

{/* Kanji — slightly smaller at far tier than before to make room for header + label */}
<div
  style={{
    fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
    fontSize: tier === 'far' ? '1.5rem' : '1.4rem',
    color: isRestDay ? '#5a5a5e' : '#d4181f',
    lineHeight: 1,
    textAlign: tier === 'far' ? 'center' : 'left',
    marginTop: tier === 'far' ? '0.1rem' : 0,
  }}
  aria-hidden="true"
>
  {kanjiStack}
</div>

{/* English label paired with kanji */}
{labelText && (
  <div
    style={{
      fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
      fontSize: tier === 'far' ? '0.55rem' : '0.62rem',
      letterSpacing: '0.18em',
      color: isRestDay ? '#5a5a5e' : '#a8a39a',
      textAlign: tier === 'far' ? 'center' : 'left',
      lineHeight: 1.1,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}
  >
    {labelText}
  </div>
)}

{/* Chip count badge — moved from top-right to bottom-left at far tier */}
{tier === 'far' && chips.length > 0 && (
  <div
    style={{
      position: 'absolute', bottom: 6, left: 6,
      fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
      fontSize: '0.65rem',
      color: '#f1eee5',
      background: '#d4181f',
      borderRadius: 2,
      padding: '1px 5px',
      letterSpacing: '0.05em',
    }}
  >
    {chips.length}
  </div>
)}

{tier === 'mid' && chips.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: isLocked ? 'none' : 'auto' }}>
    {chips.slice(0, 2).map(chip => (
      <SetChip
        key={chip.id}
        chip={chip}
        cycleId={isLocked ? null : cycleId}
        dayId={isLocked ? null : dayId}
        onReplace={onChipReplace}
        compact
      />
    ))}
    {chips.length > 2 && (
      <div style={{ fontSize: '0.65rem', color: '#888', letterSpacing: '0.08em' }}>
        +{chips.length - 2} more
      </div>
    )}
  </div>
)}

{tier === 'near' && chips.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: isLocked ? 'none' : 'auto' }}>
    {chips.map(chip => (
      <SetChip
        key={chip.id}
        chip={chip}
        cycleId={isLocked ? null : cycleId}
        dayId={isLocked ? null : dayId}
        onReplace={onChipReplace}
      />
    ))}
  </div>
)}

{chips.length === 0 && tier !== 'far' && !isRestDay && (
  <div style={{ fontSize: '0.6rem', color: '#666', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
    empty
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
```

The old `absolute` source-star block at the top of the JSX (the one with `position: 'absolute', top: 4, left: 6` rendering `★`) should be **removed** — the star now lives inline inside the header row's `<span>`.

Bump `minHeight` for the `far` tier from `84` to `100` (in the `<button>`'s style block) so the new header + kanji + label fit comfortably without crowding. Keep `mid` at `132` and `near` at `200`.

## DO NOT

- Do not touch `CycleCalendar.jsx`, `app/attune/page.js`, `AutoAttuneButton.jsx`, `PickerSheet.jsx`, or anything else.
- Do not change the kanji glyphs themselves or the `MUSCLE_KANJI` map.
- Do not add a `JSDOM`-style date library — use the inline `Date` construction shown above.
- Do not localize the day-of-week (English-only is intentional, matches GTL's all-caps mono labels elsewhere).
- Do not add `useMemo` or `useEffect` — the date math is cheap and stable per render.
- Do not change `MUSCLE_KANJI` to render English instead of kanji — the goal is *pairing*, not replacing. Both must show.

## Verify visually

After the change, with a populated cycle loaded:

1. Each cell shows a thin top header: e.g., `MON      4` (DOW left, big day number right).
2. Cells with a muscle assigned show the kanji centered, with the English label directly below — e.g., `胸` over `CHEST`, `腿` over `QUADS`.
3. Source day shows `★ MON` (star inline before DOW, in red).
4. Chip count badge sits at bottom-left in a small red pill (was top-right).
5. Lock icon stays bottom-right.
6. Rest days show a faint `休` over `REST` in muted grey.
7. No layout breakage at any pinch-zoom tier (far / mid / near).

A quick playwright eval that seeds a 7-day cycle into `localStorage` (keys: `gtl-active-profile=KING`, `gtl-KING-active-cycle-id=<id>`, `gtl-KING-cycles=[{id, name, days, dailyPlan}]`) and screenshots `/attune` is sufficient.

## Commit and push

Commit message:

```
Attune DayCell: pair kanji with English label, add DOW + day number header

Carved-day cells previously rendered only the muscle kanji. Users could
not tell which day of the cycle they were looking at or what muscle a
kanji represented without prior memorization. This adds a top header
(DOW + day number) and an English muscle label paired with the kanji,
plus moves the chip-count badge to bottom-left so the day number owns
the top-right corner.
```

Push to `origin/dev`.

## Report

- Commit hash.
- One screenshot: `/attune` with a populated 7-day cycle, showing the new header + label pairing on each cell.
- Confirmation that all 11 muscles map correctly to their English labels.
