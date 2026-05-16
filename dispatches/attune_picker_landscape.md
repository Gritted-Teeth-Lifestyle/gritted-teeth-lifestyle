# Picker landscape sizing — full-width + shorter in landscape orientation

**Target:** GTL 3 worker. Branch: `dev`. File: `components/attune/PickerSheet.jsx`.

**ASK if unclear before committing.**

## DIAGNOSIS

When the iPhone is rotated to landscape, the picker bottom sheet renders too narrow and too tall:

- `maxWidth: 430` caps the sheet at 430px while the landscape viewport is ~844px wide → sheet becomes a narrow centered band with empty gutters on both sides.
- `maxHeight: 70vh` resolves to 70% of the landscape viewport height (~390px) ≈ 273px → sheet pushes up too far from the bottom, eating most of the viewport vertically.

In portrait the constraints are appropriate. We need landscape-specific overrides.

## CHANGE

In `components/attune/PickerSheet.jsx`, locate the inner sheet `<div>` (around line 110–125) — the one with `pointerEvents: 'auto', width: '100%', maxWidth: 430, maxHeight: '70vh', ...`.

Add a `className="gtl-picker-sheet"` to that `<div>`, and add a `<style>` block at the top of the returned JSX (just inside the outer `role="dialog"` div) that scopes a landscape override:

```jsx
return (
  <div
    role="dialog"
    aria-modal="false"
    aria-label="Pick exercise"
    style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      zIndex: 100,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none',
    }}
  >
    <style>{`
      .gtl-picker-sheet {
        width: 100%;
        max-width: 430px;
        max-height: 70vh;
      }
      @media (orientation: landscape) and (max-height: 500px) {
        .gtl-picker-sheet {
          max-width: 100%;
          max-height: 75vh;
        }
      }
    `}</style>
    <div
      className="gtl-picker-sheet"
      style={{
        pointerEvents: 'auto',
        background: '#1a1a1e',
        borderTop: '2px solid #d4181f',
        padding: '1rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        fontFamily: 'var(--font-display, Anton, sans-serif)',
        color: '#f1eee5',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* ...existing children unchanged... */}
```

Removed from the inline style block (now moved into the `.gtl-picker-sheet` class):
- `width: '100%'`
- `maxWidth: 430`
- `maxHeight: '70vh'`

The class handles those defaults, and the `@media (orientation: landscape) and (max-height: 500px)` query overrides them on landscape phones (where `max-height: 500px` confirms it's a phone-sized landscape, not a desktop landscape window).

In landscape:
- `max-width: 100%` → sheet spans the full ~844px viewport width.
- `max-height: 75vh` → caps at 75% of the ~390px height ≈ 292px (slightly more vertical room than 70vh — gives content breathing space; the rest of the calendar peeks above).

## DO NOT

- Touch any other styling, the sheet's children, or the picker's behavior.
- Change the portrait sizing (still `max-width: 430`, `max-height: 70vh`).
- Add any orientation-detection JavaScript (the CSS media query handles it; no React state needed).

## Verify

After the change:

1. Portrait: sheet renders identically to before (`max-width: 430`, sits at bottom, ~70vh tall).
2. Landscape (iPhone 14 ish, 844×390): sheet spans the full width, top edge sits ~98px from the top of the viewport (390 − 292 = 98), leaving the calendar's top portion visible above.
3. Both orientations: the picker still functions — search, multi-select exercises, confirm, close.

Run a playwright eval at landscape viewport `{width: 844, height: 390}` and screenshot the picker open. Compare to a portrait screenshot for regression-check.

## Commit and push

```
PickerSheet: landscape orientation gets full-width + 75vh max-height (was narrow + 70vh always)
```

Push to `origin/dev`.

## Report

Commit hash + 2 screenshots (portrait picker, landscape picker) + one-line confirmation.
