# Attune fix — DayCell root must not be a `<button>` (button-in-button hydration error)

**Target:** GTL 3 worker. Branch: `dev`. File: `components/attune/DayCell.jsx`.

## DIAGNOSIS

After the polish landed, `/attune` throws an "Unhandled Runtime Error" in dev mode whenever chips are rendered. Stack:

```
Warning: In HTML, button cannot be a descendant of <button>.
This will cause a hydration error.
  at button
  at span
  at div
  at SetChip (components/attune/SetChip.jsx:20:11)
  at div
  at button
  at DayCell (components/attune/DayCell.jsx)
```

`DayCell` renders the cell as `<button>`. The inline icon buttons inside `SetChip` (`⎘ ⇄ ✕`) are also `<button>` elements. Buttons cannot nest inside buttons — invalid HTML.

## CHANGE

In `components/attune/DayCell.jsx`, find the outer `<button>` element (the one that wraps the entire cell) and change it to a `<div>` with `role="button"`. Keep all existing props (`ref={setNodeRef}`, `data-*`, `onClick`, `style`) intact. Drop `type="button"` (no longer applies to a div).

Find:

```jsx
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-attune-day={dayId}
      data-attune-selected={isSelected ? '1' : '0'}
      data-attune-source={isSource ? '1' : '0'}
      onClick={handleClick}
      style={{
        ...
```

Replace with:

```jsx
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      data-attune-day={dayId}
      data-attune-selected={isSelected ? '1' : '0'}
      data-attune-source={isSource ? '1' : '0'}
      onClick={handleClick}
      onKeyDown={(e) => { if (!isLocked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleClick() } }}
      style={{
        ...
```

Then find the matching closing tag at the end of the component:

```jsx
    </button>
  )
}
```

Replace with:

```jsx
    </div>
  )
}
```

That's the only change. Inline icon buttons inside `SetChip` stay as `<button>` — they're the actual interactive elements that fire actions.

## DO NOT

- Touch any other file.
- Change DayCell's children, styles, or logic.
- Convert SetChip's icon buttons to spans — keep them as buttons (they're the real action triggers).

## Verify

After the change, run a playwright eval with chips populated. Console should show 0 hydration errors. The `react-zoom-pan-pinch` `ref` warning is unrelated and stays.

## Commit and push

```
Attune DayCell: root from <button> to <div role="button"> (fix button-in-button hydration error from inline chip icons)
```

Push to `origin/dev`.

## Report

Commit hash + 1 screenshot of /attune with chips populated and DevTools console open showing no hydration error.
