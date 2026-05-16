# Attune polish — icons below label, default view shows SUN/MON, lower initial scale

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/SetChip.jsx`, `components/attune/CycleCalendar.jsx`.

## DIAGNOSIS

After the per-weekday-columns redesign and word-boundary wrap fix, two visual problems remain:

1. **Long names still break mid-character.** Chips render `1-ARM HALF-KNEELIN/G LAT/PULLDOW/N` because the inline `⎘ ⇄ ✕` icons eat ~42px of the ~95px chip width, leaving ~50px for the label. Words longer than 50px (KNEELING, PULLDOWN) must break at any character to fit. `overflow-wrap: break-word` is doing its job — the constraint is the available label width.
2. **Default view is centered on TUE/WED/THU.** With `centerOnInit` true and a 806px-wide grid in a 390px viewport, the page lands showing the middle of the week with empty TUE/THU columns and SUN/MON cut off at the left edge. Page reads as half-empty on first glance.

## CHANGE 1 — `components/attune/SetChip.jsx`

Restructure the chip so the action icons render as a row **below** the label instead of a column to the right. Label gets the full chip width.

Find the JSX inside the chip's main `<div>`:

```jsx
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
        {interactive && (
          <span style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            <button type="button" aria-label="copy" title="Copy" onPointerDown={stop} onClick={copyHandler} style={iconBtnStyle}>⎘</button>
            <button type="button" aria-label="replace" title="Replace" onPointerDown={stop} onClick={replaceHandler} style={iconBtnStyle}>⇄</button>
            <button type="button" aria-label="delete" title="Delete" onPointerDown={stop} onClick={deleteHandler} style={iconBtnStyle}>✕</button>
          </span>
        )}
```

Replace with:

```jsx
        <span style={{
          minWidth: 0,
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
            gap: 6,
            marginTop: 3,
            paddingTop: 3,
            borderTop: '1px solid #1f1f24',
          }}>
            <button type="button" aria-label="copy" title="Copy" onPointerDown={stop} onClick={copyHandler} style={iconBtnStyle}>⎘</button>
            <button type="button" aria-label="replace" title="Replace" onPointerDown={stop} onClick={replaceHandler} style={iconBtnStyle}>⇄</button>
            <button type="button" aria-label="delete" title="Delete" onPointerDown={stop} onClick={deleteHandler} style={iconBtnStyle}>✕</button>
          </span>
        )}
```

Then change the chip's outer `<div>` style — switch from row layout (icons on right of label) to column layout (icons below label). Find:

```jsx
        style={{
          background: '#0f0f12',
          border: '1px solid #2a2a30',
          borderLeft: '2px solid #d4181f',
          padding: '3px 3px 3px 5px',
          display: 'flex', alignItems: 'center', gap: 2,
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.6rem',
          letterSpacing: '0.04em',
          color: '#d8d2c2',
          textTransform: 'uppercase',
          cursor: interactive ? 'pointer' : 'default',
          touchAction: interactive ? 'none' : 'manipulation',
          minWidth: 0,
          alignItems: 'flex-start',
          ...dragStyle,
        }}
```

Replace with:

```jsx
        style={{
          background: '#0f0f12',
          border: '1px solid #2a2a30',
          borderLeft: '2px solid #d4181f',
          padding: '4px 5px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
          fontSize: '0.6rem',
          letterSpacing: '0.04em',
          color: '#d8d2c2',
          textTransform: 'uppercase',
          cursor: interactive ? 'pointer' : 'default',
          touchAction: interactive ? 'none' : 'manipulation',
          minWidth: 0,
          ...dragStyle,
        }}
```

Notes on what changed in the chip wrapper:
- `flexDirection: column` instead of row — label on top, icons below.
- `padding: '4px 5px'` — slightly more breathing room.
- Removed conflicting duplicate `alignItems` line (was `center` on first declaration, `flex-start` on second; the duplicate broke styling intent in some browsers).
- `gap: 0` — vertical spacing between label and icon row is handled by the icon row's `marginTop: 3 + paddingTop: 3` (with the divider line between).

Also bump the icon button font size up since they're now in their own dedicated row:

```jsx
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
```

Replace with:

```jsx
  const iconBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#a8a39a',
    fontSize: '0.75rem',
    lineHeight: 1,
    padding: '2px 4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minWidth: 22,
  }
```

## CHANGE 2 — `components/attune/CycleCalendar.jsx`

Change the `TransformWrapper` so the page lands on the LEFT edge of the calendar (SUN/MON visible first) at a slightly zoomed-out scale that shows more columns at once. Find:

```jsx
        <TransformWrapper
          ref={wrapperRef}
          initialScale={1}
          minScale={0.4}
          maxScale={3}
          centerOnInit
          centerZoomedOut={false}
          limitToBounds={false}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
          panning={{ disabled: isChipDragging, velocityDisabled: false, lockAxisX: false, lockAxisY: false }}
          onTransformed={(_, state) => setScale(state.scale)}
        >
```

Replace with:

```jsx
        <TransformWrapper
          ref={wrapperRef}
          initialScale={0.6}
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

Key changes:
- `initialScale: 0.6` — content scales to 806×0.6 ≈ 484px wide, so most of the 7 columns are visible in the 390px viewport (with mild horizontal pan to reach the very right edge).
- `initialPositionX: 0`, `initialPositionY: 0` — start at top-left of the content surface so SUN/MON columns are visible first.
- `centerOnInit: false` — don't auto-center on the middle of the calendar.

## DO NOT

- Touch `DayCell.jsx`, `AutoAttuneButton.jsx`, `app/attune/page.js`, or `lib/`.
- Change the chip's icons or their handlers.
- Add a horizontal scroll bar — pan handles overflow.

## Verify visually

After the change, with a populated cycle loaded:

1. Default view shows SUN/MON columns starting at the left edge of the viewport. User can pan right to see Tue–Sat. At `0.6` scale, ~5 columns are visible.
2. Each chip renders the label across multiple lines (wraps at word boundaries — no mid-letter splits). Below the label there's a thin top-border divider, then a right-aligned row of `⎘ ⇄ ✕` icons.
3. Long exercise names like `1-ARM HALF-KNEELING LAT PULLDOWN` break only at spaces: `1-ARM`/`HALF-KNEELING`/`LAT`/`PULLDOWN`. No `KNEELIN/G` or `PULLDOW/N` mid-character splits.
4. Tap a chip's icon → action fires (verify copy/replace/delete still work).
5. Tap chip body (not on icon) → full action menu still opens.
6. Pinch-zoom in still works for reading; pinch-zoom out goes to 0.4.

Run a playwright eval at 390×844. Take 2 screenshots:
- (a) cold load — SUN/MON visible at left edge, ~5 cols visible
- (b) after auto-attune — chips show full text with icons below label, no mid-word splits

## Commit and push

Single commit:

```
Attune polish: icons below chip label (full label width = no mid-word splits) + initial view at SUN/MON left edge, scale 0.6
```

Push to `origin/dev`.

## Report

Commit hash + 2 screenshots + one-line confirmation `chip icons below label, default view at SUN/MON, no mid-word splits`.
