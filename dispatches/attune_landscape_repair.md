# Attune landscape repair — 3 concrete fixes

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/PickerSheet.jsx`, `components/attune/CycleCalendar.jsx`, `app/fitness/new/branded/page.js`.

**ASK before committing if anything is unclear.**

## The 3 fixes

### 1. Picker drag-resize via top-edge handle

User can grab the picker's top border and drag it up (taller) or down (shorter) to control the sheet's height. The drag area is the top 12px of the sheet (a thin strip with a visible "grabber" pill).

In `components/attune/PickerSheet.jsx`, add a `userHeight` state plus pointer handlers, and use it to override the CSS `max-height`. Skeleton:

```jsx
// near other useState calls
const [userHeight, setUserHeight] = useState(null)  // px; null = use CSS default
const dragStartRef = useRef(null)

const onGrabberPointerDown = (e) => {
  e.preventDefault()
  const sheet = e.currentTarget.parentElement  // the .gtl-picker-sheet div
  const startY = e.clientY
  const startH = sheet.getBoundingClientRect().height
  dragStartRef.current = { startY, startH }
  // capture pointer so move/up fire even if pointer leaves the grabber
  e.currentTarget.setPointerCapture(e.pointerId)
}

const onGrabberPointerMove = (e) => {
  if (!dragStartRef.current) return
  const dy = e.clientY - dragStartRef.current.startY
  // Drag UP (negative dy) grows the sheet. Drag DOWN (positive dy) shrinks it.
  const next = Math.max(180, Math.min(window.innerHeight * 0.92, dragStartRef.current.startH - dy))
  setUserHeight(next)
}

const onGrabberPointerUp = (e) => {
  dragStartRef.current = null
  try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) {}
}
```

Render the grabber as the first child of the `.gtl-picker-sheet` `<div>`:

```jsx
<div
  onPointerDown={onGrabberPointerDown}
  onPointerMove={onGrabberPointerMove}
  onPointerUp={onGrabberPointerUp}
  onPointerCancel={onGrabberPointerUp}
  style={{
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 16,
    cursor: 'ns-resize',
    touchAction: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 5,
  }}
  aria-label="resize picker"
  role="separator"
>
  <span style={{
    width: 36, height: 4,
    background: '#3a3a40',
    borderRadius: 2,
  }} />
</div>
```

The grabber sits at the very top of the sheet (overlaying the `border-top: 2px solid #d4181f`), gives the user a 16px tall hit area, and shows a small grey pill as the visual affordance. Add `position: 'relative'` to the sheet `<div>` and add `paddingTop: 16` (or shift existing top padding) so the grabber doesn't collide with the header.

When `userHeight !== null`, override the CSS-class `max-height` via inline style:

```jsx
<div
  className="gtl-picker-sheet"
  style={{
    pointerEvents: 'auto',
    position: 'relative',           // ← new (so grabber's absolute positioning anchors here)
    background: '#1a1a1e',
    borderTop: '2px solid #d4181f',
    padding: '1.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',  // top bumped 1rem→1.5rem to clear grabber
    fontFamily: 'var(--font-display, Anton, sans-serif)',
    color: '#f1eee5',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.6)',
    height: userHeight ? `${userHeight}px` : undefined,
    maxHeight: userHeight ? `${userHeight}px` : undefined,  // override class max-height
  }}
>
```

When the picker re-opens (or the source day changes), reset `userHeight` to null so the next session starts from the default size:

```jsx
useEffect(() => { setUserHeight(null) }, [sourceDayId])
```

Constraints: clamp between 180px (minimum usable) and `92vh` (just below the very top, leaving the calendar's title visible).

### 2. AUTO-ATTUNE ALL button must not overlay calendar content

In `components/attune/CycleCalendar.jsx`, the calendar's `TransformComponent` content has `padding: '0.5rem 0.5rem 7rem 0.5rem'` — the 7rem bottom is intended to reserve space for the AUTO-ATTUNE button. But in landscape (390px tall) that 7rem (~112px) reservation gets squeezed and the button still overlays the last row of chips because the content area is too small.

Fix in two places:

(a) Bump the bottom padding from `7rem` → `9rem` so chips stay clear of the floating button at all viewport heights:

Find:
```jsx
contentStyle={{ padding: '0.5rem 0.5rem 7rem 0.5rem' }}
```

Replace with:
```jsx
contentStyle={{ padding: '0.5rem 0.5rem 9rem 0.5rem' }}
```

(b) `components/attune/AutoAttuneButton.jsx` — the button currently uses `position: 'absolute'`. In landscape that absolute position is relative to the calendar wrapper, which IS the viewport. Move the button's bottom anchor up slightly so it's not flush against the safe-area edge — gives chips a clear gutter of negative space:

Find:
```jsx
bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
```

Replace with:
```jsx
bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
```

### 3. ATTUNE MOVEMENTS button on schedule page must read clearly in both orientations

In `app/fitness/new/branded/page.js`, the ATTUNE MOVEMENTS button is currently overlaid on top of the `五月` kanji watermark (red background). In portrait the button text is just barely readable; in landscape it's drowned in the red watermark and reads as visual noise.

Find the button's render (search for "ATTUNE" or "AttuneMovementsButton" in the file). Add a backing rectangle behind the button text so the button itself reads as a discrete CTA against any background. The button should be:

- **Background**: solid `#0a0a0c` (page void, same as the rest of the page) with a `#d4181f` (red) border — clip-path skewed like the existing CARVE button — so the button reads as a hard-edged red-bordered tile, NOT as text floating on the kanji
- **Text**: white `#f1eee5`, Anton display, 0.7rem (small but bold), uppercase, letter-spacing `0.2em`
- **Hover/active state**: red fill `#d4181f` with white text (CTA confirmation)

Concretely, the button's existing `<button>` (or `<Link>`) should be wrapped in or replaced with a styled `<button>` that has:

```jsx
<button
  type="button"
  onClick={...}
  style={{
    background: enabled ? '#0a0a0c' : '#0a0a0c',  // or a slightly dimmer #050507 when inactive
    color: enabled ? '#f1eee5' : '#5a5a5e',
    border: `2px solid ${enabled ? '#d4181f' : '#3a3a40'}`,
    padding: '0.4rem 0.7rem',
    fontFamily: 'var(--font-display, Anton, sans-serif)',
    fontSize: '0.7rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontWeight: 900,
    cursor: enabled ? 'pointer' : 'default',
    clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
    boxShadow: enabled ? '3px 3px 0 #070708' : 'none',
    pointerEvents: enabled ? 'auto' : 'none',
    /* … any positioning style preserved from existing implementation … */
  }}
>
  ATTUNE MOVEMENTS
</button>
```

Preserve whatever positioning (absolute / grid-area / etc.) the existing button has — only swap the visual styling. The kanji watermark stays as the background; the button now sits cleanly on top of it as a discrete tile, not as bare text.

If the existing implementation uses a sub-component (e.g., `AttuneMovementsButton`) imported from `components/`, edit that component's render. If it's inline in `branded/page.js`, edit it inline.

## DO NOT

- Don't change `lib/`, `app/attune/page.js`, `DayCell.jsx`, `SetChip.jsx`, or any other file.
- Don't touch the kanji watermark itself (the `五月` rendering and its colors stay).
- Don't change the schedule's calendar grid layout or the muscle grid below it.
- Don't change the picker's exercise-list scroll behavior or the multi-select logic.

## Verify visually

Run a playwright eval in **both** portrait (390×844) and landscape (844×390):

**Portrait /attune**: open picker → grab the top border (the small grey pill) and drag up — picker grows to ~92vh. Drag down — picker shrinks to ~180px minimum. Releasing locks it at the dragged position. Closing/reopening picker (tapping a different day) resets to default height.

**Landscape /attune**: with chips on every day, AUTO-ATTUNE ALL button floats at the bottom WITHOUT covering any chip. Last-row chips have ~24px of clear space between their bottom edge and the button's top edge.

**Schedule page (/fitness/new/branded) in both orientations**: ATTUNE MOVEMENTS button renders as a clean red-bordered tile with white text on the page-void background, NOT as bare red text on the kanji watermark. Button is clearly readable against the kanji.

Take 4 screenshots:
- (a) Portrait /attune with picker dragged ~halfway up
- (b) Landscape /attune populated — AUTO-ATTUNE button doesn't overlap chips
- (c) Portrait schedule page with ATTUNE MOVEMENTS button visible as a tile
- (d) Landscape schedule page with the same tile clearly readable

## Commit and push

Single commit:

```
Attune landscape repair: drag-resize picker + auto-attune no-overlap + ATTUNE MOVEMENTS button reads as a tile
```

Push to `origin/dev`.

## Report

Commit hash + 4 screenshots + one-line confirmation per fix.
