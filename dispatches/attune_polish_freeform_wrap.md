# Attune polish — free-form pan/zoom + DOW headers inside the surface + chip text wraps

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/CycleCalendar.jsx`, `components/attune/SetChip.jsx`.

This polish pass corrects four issues from the just-landed final redesign (commits `035aacf` + `e2d5f5b`).

## DIAGNOSIS

1. **DOW header is rendered outside the `TransformWrapper`** — so when the user pinch-zooms the calendar, the column content scales but the `SUN MON TUE WED THU FRI SAT` labels stay fixed at one size. Result: the labels desync from their columns at any non-1.0 scale and read as a separate UI band, not as headings of the columns themselves.
2. **The calendar can't be panned horizontally**, only vertically. `limitToBounds=true` and the grid using `width: 100%` mean there's nothing to pan to in the X axis at scale 1.
3. **Pan is bounded** — Jordan wants free-form gesture: pinch + pan in all directions, no walls.
4. **Chip text uses `whiteSpace: nowrap` + `text-overflow: ellipsis`** — long exercise names like "1 LEG BOX SQUAT" get cut off as `1 LEG BOX SQU…`. Jordan: "clarity is king, not saving screen space — wrap to multiple lines instead."

## CHANGE 1 — `components/attune/CycleCalendar.jsx`

Three edits inside the file (do NOT do a full file replacement; targeted patches).

### 1a. Remove the outer DOW header `<div>`

Find this block (the sticky DOW header that sits OUTSIDE the `TransformWrapper`):

```jsx
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
```

**Delete it entirely.** The DOW labels move inside the surface and become the top of each column.

### 1b. Reconfigure the `TransformWrapper` for free-form pan + lower minScale

Find the existing `TransformWrapper` props block:

```jsx
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
```

Replace with:

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

Key changes:
- `minScale={0.4}` — user can zoom out to see big cycles.
- `limitToBounds={false}` — free-form pan in any direction with no walls.
- `centerOnInit` true — start centered.
- Explicit `lockAxisX: false, lockAxisY: false` — both axes pannable.

### 1c. Add the DOW label as the first child of each column, and give the grid fixed-pixel column widths so it's wider than the viewport

Find the inner grid block:

```jsx
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
```

Replace with:

```jsx
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 110px)',
                gap: 6,
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
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.22em',
                      color: '#a8a39a',
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      padding: '0.25rem 0',
                      borderBottom: '1px solid #2a2a30',
                    }}
                  >
                    {DOW_HEADERS[dow]}
                  </div>
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
```

Key changes:
- `gridTemplateColumns: repeat(7, 110px)` — fixed 110px per column. Total grid width ≈ 7×110 + 6×6 (gaps) = **806px**, which is wider than the 390px viewport. That gives the user real horizontal content to pan across (and to read at scale 1 by zooming in or panning).
- A `<div>` is added as the first child of every column with the corresponding `DOW_HEADERS[dow]` label. This div lives inside the `TransformWrapper`, so it scales/pans with the column content.

### 1d. Update `contentStyle` padding so the wider grid breathes

Find:

```jsx
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', padding: '0.5rem 0.75rem 7rem 0.75rem' }}
          >
```

Replace with:

```jsx
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ padding: '0.5rem 0.5rem 7rem 0.5rem' }}
          >
```

Removing `width: '100%'` on `contentStyle` lets the grid extend beyond the viewport so horizontal pan has somewhere to go.

## CHANGE 2 — `components/attune/SetChip.jsx`

In the chip's main `<div>` style block, find:

```jsx
          fontSize: '0.5rem',
          letterSpacing: '0.04em',
          color: '#d8d2c2',
          textTransform: 'uppercase',
          cursor: interactive ? 'pointer' : 'default',
          touchAction: interactive ? 'none' : 'manipulation',
          minWidth: 0,
          ...dragStyle,
        }}
```

Bump the font size up (since chips are now in 110px columns, they have more horizontal room) and **do nothing else here** — the wrap fix happens on the inner label span. Replace with:

```jsx
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

(`alignItems: flex-start` so when the label wraps to multiple lines, the icons sit at the top of the chip not the middle.)

Then find the inner label span:

```jsx
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {display}
        </span>
```

Replace with:

```jsx
        <span style={{
          flex: 1, minWidth: 0,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
```

Note: `{display}` (which used the truncated string) becomes `{label}` (the full untruncated string). The `display` / truncation logic is no longer needed but leaving the variable around is harmless — just don't use it in the JSX.

Also `whiteSpace: normal` + `wordBreak: break-word` means long names like `1 LEG BOX SQUAT` wrap to multiple lines inside the chip. The chip's height grows to fit. That cascades: `DayCell`'s flex column auto-grows. Already working in the layout — no `DayCell.jsx` change needed.

## DO NOT

- Do **not** touch `DayCell.jsx`, `AutoAttuneButton.jsx`, `app/attune/page.js`, `lib/attunement.js`, or any other file.
- Do **not** add a sticky DOW header back in. Per Jordan: the labels sit inside each column, scale with the surface.
- Do **not** add a horizontal scroll bar — `limitToBounds: false` + native pan handles overflow.
- Do **not** change `MUSCLE_KANJI`, `MUSCLE_LABEL`, or any text content.
- Do **not** change the kanji font, the English-label font, or the day-number font.
- Do **not** change icon glyphs — `⎘ ⇄ ✕` stay.

## Verify visually

After the change, with a populated cycle loaded (use seed: 14-day span, Mon/Wed/Fri carved both weeks):

1. Each weekday column has its own `SUN`/`MON`/`TUE`/`...` label at the top of the column, **inside** the pannable surface. Pinching to zoom scales the label along with the column content.
2. At scale 1, the calendar is wider than the viewport — the user can pan **left and right** to see Sun/Mon (left) and Fri/Sat (right). Vertical pan still works for tall cycles.
3. Pinching to zoom out (scale 0.4) shows the whole 7-column grid + many weeks of column content fitting in the viewport.
4. Pinching to zoom in (scale 2-3) lets the user read chip text comfortably.
5. Chip with a long exercise name (e.g., `1 LEG BOX SQUAT`) wraps to multiple lines — full text visible, no `…` ellipsis. Chip height grows. Day cell height grows to contain it.
6. Inline `⎘ ⇄ ✕` icons sit aligned at the top-right of the chip, beside the (potentially multi-line) label.
7. Pan is **free-form** — drag in any direction, no walls, no rubber-band snapback.

Run a playwright eval at 390×844 with the cycle seeded into localStorage. Take 2 screenshots:
- (a) cold load with chips populated (some long exercise names visible to verify wrap)
- (b) after pinch-zooming out (visual proof DOW labels scale with content)

## Commit and push

Commit message:

```
Attune polish: DOW labels inside pan/zoom surface + free-form pan in all directions + chip text wraps instead of ellipsis
```

Push to `origin/dev`.

## Report

- Commit hash.
- Both screenshots.
- One-line confirmation: `DOW labels in-surface, free-form pan, chip text wraps.`
