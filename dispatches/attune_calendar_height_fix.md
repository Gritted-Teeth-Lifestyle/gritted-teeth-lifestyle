# Attune calendar collapses to a 132px strip — height-claim fix

**Target:** GTL 1 worker (`/c/Users/Jordan/gtl-1/`). Branch: `dev`. Dev server: http://localhost:3001 (or whichever you've got).

## DIAGNOSIS

On `/attune` with a real cycle loaded, the `CycleCalendar` is rendering at only ~132px tall — a single horizontal row of muscle-kanji cells crammed at the top of the viewport. The remaining ~700px below is dead black void, and the user sees a tiny strip of cells instead of a usable calendar.

Root cause: in `app/attune/page.js`, the calendar's parent wrapper is

```jsx
<div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
  <CycleCalendar ... />
  <AutoAttuneButton cycle={cycle} />
</div>
```

and `CycleCalendar.jsx` line 48 starts with

```jsx
<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
```

The parent is `position: relative; flex: 1` but **not** `display: flex`. So the `flex: 1` on `CycleCalendar`'s outer div is a no-op — it gets block layout, sizes to its content, and the `TransformWrapper`'s `wrapperStyle: height: '100%'` resolves to 100% of a content-sized box (one row of cells ≈ 132px). The whole pan-zoom surface collapses to one row.

`AutoAttuneButton` is `position: absolute; bottom: ...` and needs the parent to remain `position: relative`. So the fix has to keep `position: relative` and *also* establish a flex column so `flex: 1` propagates.

## REPLACE

In `app/fitness/.../app/attune/page.js` (around line 306), find:

```jsx
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <CycleCalendar
              cycle={cycle}
              onDayTap={handleDayTap}
              onChipReplace={onChipReplace}
              selectedDayIds={selectedDayIds}
              sourceDayId={sourceDayId}
            />
            <AutoAttuneButton cycle={cycle} />
          </div>
```

Replace the wrapper opening tag with:

```jsx
          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
```

Leave everything inside unchanged. Keep the `<AutoAttuneButton ...>` sibling. The added `display: flex; flexDirection: column` makes `flex: 1` on `CycleCalendar`'s outer wrapper actually claim the parent's height, while `position: relative` is preserved so the absolutely-positioned `AutoAttuneButton` still anchors to this wrapper.

The actual prop name (`onChipReplace`) may differ slightly — match whatever's already there. The only change is the parent `<div>`'s `style`.

## DO NOT

- Do **not** modify `components/attune/CycleCalendar.jsx`. The component's `flex: 1` is correct; only its parent needs the flex-column upgrade.
- Do **not** touch `AutoAttuneButton.jsx`, `DayCell.jsx`, `PickerSheet.jsx`, or any other Attune component.
- Do **not** change the nav, divider, or `<main>` outer layout.
- Do **not** edit `app/fitness/new/branded/page.js` (the schedule page) — the just-landed button redo lives there and is not part of this fix.
- Do **not** add `overflow: auto` or scroll containers — `CycleCalendar` already manages its own pan-zoom via `react-zoom-pan-pinch` and any extra overflow box will fight it.

## Verify visually

After the change, with a populated cycle loaded:

1. Calendar fills the available vertical space between the nav (with KING title + retreat) and the safe-area bottom.
2. Day cells sized via `react-zoom-pan-pinch`'s initial scale render at a usable size, with multiple rows visible if the cycle has >7 days, or one well-proportioned row using the full height if 7 or fewer.
3. `AutoAttuneButton` (visible while every day has 0 chips) still anchors to the bottom of the calendar region with safe-area inset.
4. No regression on the schedule page — `/fitness/new/branded` still shows the Attune button overlay over the row-1 empty cells.

A quick playwright eval that seeds a 7-day cycle into `localStorage` (keys: `gtl-active-profile=KING`, `gtl-KING-active-cycle-id=<id>`, `gtl-KING-cycles=[{id, name, days, dailyPlan}]`) and screenshots `/attune` is sufficient.

## Commit and push

Commit message:

```
Attune: parent of CycleCalendar must be flex column so calendar claims full height

Without display: flex on the parent, CycleCalendar's flex: 1 was a no-op
and the calendar collapsed to one row (~132px) leaving most of the
viewport as dead black void.
```

Push to `origin/dev`.

## Report

- Commit hash.
- Two screenshots: (a) `/attune` with a populated 7-day cycle (calendar fills the viewport), (b) `/fitness/new/branded` (regression check — button overlay still correct).
- Confirmation that the AutoAttuneButton still anchors correctly at the bottom.
