# Attune polish round 2 — 5 fixes

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/SetChip.jsx`, `components/attune/PickerSheet.jsx`, `components/attune/DayCell.jsx`.

**IMPORTANT:** if anything is unclear, **ASK before committing**. Jordan would rather wait than re-dispatch.

## The 5 fixes

### 1. Remove the chip-tap action menu pop-up (the inline icons already cover Copy/Delete/Replace)

In `components/attune/SetChip.jsx`, the chip body's `onClick` currently opens `ChipActionMenu` after a tap-without-drag. Since each chip already exposes `⎘ ⇄ ✕` as inline icon buttons (per the master polish), the pop-up is redundant.

Find:

```jsx
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
```

Replace with:

```jsx
  const handleClick = (e) => {
    // Stop propagation so a chip tap doesn't bubble up to the day-cell.
    // No menu opens — inline ⎘ ⇄ ✕ icons handle Copy / Replace / Delete.
    e.stopPropagation()
  }
```

Also delete the long-press menu-open path so long-press is a no-op too:

Find:

```jsx
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      setMenuOpen(true)
    }, LONG_PRESS_MS)
```

Replace with:

```jsx
    // Long-press no longer opens a menu — inline icons handle all actions.
    // Timer kept dormant in case future drag-disambiguation needs it.
    timerRef.current = null
```

(Or simply remove the entire `timerRef.current = setTimeout(...)` block and any related cleanup. Use your judgment — the goal is: no `setMenuOpen(true)` anywhere in this file.)

You can also delete the `ChipActionMenu` JSX render at the bottom of the file (the `{menuOpen && interactive && <ChipActionMenu ... />}` block) and the `[menuOpen, setMenuOpen]` `useState` since nothing opens the menu anymore. Don't delete the `ChipActionMenu` component file itself — just stop using it from `SetChip`.

### 2. Picker list shows just 3 exercises (was 5)

In `components/attune/PickerSheet.jsx`, find the exercise list container's `maxHeight: 220` (set by the previous polish to fit ~5 rows). Change to fit ~3 rows:

```jsx
maxHeight: 220,
```

becomes:

```jsx
maxHeight: 132,
```

(`132 ≈ 3 × 44px` per row.)

### 3. Strip the picker header down to just the muscle name

Find the picker header section. Currently it shows:

- Top bar: `PICKER · ATTUNE · LOCKED: CHEST · 1 DAY` (or similar) plus a close `×`
- Subtext: `TAP DAYS ON THE CALENDAR TO ADD OR REMOVE TARGETS`

Remove both. Replace the entire header block with a single line that shows just the muscle target name (e.g., `CHEST`) and the close `×`. Match the existing visual treatment (mono caps, red accent if appropriate). Search for the existing header div and replace it with something like:

```jsx
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.6rem 0.75rem',
  fontFamily: 'var(--font-display, Anton, sans-serif)',
  fontSize: '1rem',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#d4181f',
  borderBottom: '1px solid #2a2a30',
}}>
  <span>{(sourceMuscle || '').toUpperCase()}</span>
  <button
    type="button"
    aria-label="close"
    onClick={onClose}
    style={{
      background: 'transparent',
      border: 'none',
      color: '#a8a39a',
      fontSize: '1.2rem',
      lineHeight: 1,
      padding: '0 0.4rem',
      cursor: 'pointer',
      fontFamily: 'inherit',
    }}
  >
    ×
  </button>
</div>
```

(Variable names for the source muscle may differ in the file — if the existing variable is called something other than `sourceMuscle`, use the actual name.)

Don't keep the `TAP DAYS ON THE CALENDAR...` subtext — drop it entirely.

### 4. Bigger day-number in each cell header

In `components/attune/DayCell.jsx`, find the day-number `<span>` (inside the cell header):

```jsx
<span style={{
  fontFamily: 'var(--font-display, Anton, sans-serif)',
  fontSize: '0.95rem',
  ...
```

Bump font size:

```jsx
<span style={{
  fontFamily: 'var(--font-display, Anton, sans-serif)',
  fontSize: '1.4rem',
  fontWeight: 900,
  ...
```

Keep the rest of the styles (color logic for today vs not, etc.) unchanged.

### 5. Bigger and bolder English muscle label

In `components/attune/DayCell.jsx`, find the English-label `<span>` rendering `{labelStack}`:

```jsx
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
```

Bump size, weight, and contrast:

```jsx
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
```

Color goes from `#a8a39a` (faint) to `#f1eee5` (chalk — same as day-number) so the English label reads with confidence.

## DO NOT

- Don't touch `lib/`, `app/attune/page.js`, `AutoAttuneButton.jsx`, `CycleCalendar.jsx`, `ChipActionMenu.jsx`, `DropPromptModal.jsx`, `ReplaceCascadeModal.jsx`, `ExitGuardDialog.jsx`, `FirstTimeInstructionPopup.jsx`.
- Don't delete the `ChipActionMenu.jsx` file — just stop importing/using it from `SetChip.jsx`.
- Don't change column widths, calendar layout, or pan/zoom config.
- Don't reintroduce the `★` source-day star.

## Verify visually

After all 5 fixes land:

1. Tap a chip body → nothing happens. Tap a chip's `⎘ ⇄ ✕` icon → the action fires (copy duplicates, replace opens picker, delete removes). No pop-up menu appears.
2. Open the picker → only ~3 exercise rows visible, the rest reachable by scrolling within the list.
3. Picker header shows only the muscle name (e.g., `CHEST`) on the left and an `×` close on the right. No `PICKER · ATTUNE · LOCKED:` prefix. No `TAP DAYS ON THE CALENDAR...` subtext.
4. Each day-cell's day-number renders noticeably bigger and bolder than before (1.4rem display, weight 900). Today's day-number stays red as before.
5. Each day-cell's English muscle label (`CHEST` / `BACK` / `QUADS` etc.) is bigger (0.7rem mono), bolder (700), and chalk-white (`#f1eee5`) instead of faint grey.

Run a playwright eval at 390×844 with a multi-week cycle (Mon/Wed/Fri carved). Take screenshots:
- (a) `/attune` cold load — bigger day-numbers, bolder English labels
- (b) Tap a day → picker open with only 3 rows visible and stripped header
- (c) Tap a chip's icon → action fires, no menu pop-up

## Commit and push

Single commit:

```
Attune polish R2: drop chip-tap pop-up, picker shows 3 rows + muscle-only header, bigger bolder day-num + English label
```

Push to `origin/dev`.

## Report

Commit hash, 3 screenshots, one-line confirmation per fix.
