# Attune — picker shorter in landscape + kanji in picker header + UPPER/LOWER/FULL BODY collapse

**Target:** GTL 3 worker. Branch: `dev`. Files: `components/attune/PickerSheet.jsx`, `components/attune/DayCell.jsx`.

**ASK before committing if anything is unclear.**

## The 3 fixes

### 1. Picker still too high in landscape — drop to 60vh

In `components/attune/PickerSheet.jsx`, the landscape media-query override currently sets `max-height: 75vh`. That's still too tall on iPhone landscape (~292px out of 390 viewport, only 98px of calendar visible above). Drop it to 60vh (~234px tall, ~156px of calendar visible).

Find the existing `<style>` block:

```jsx
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
```

Change `max-height: 75vh` to `max-height: 60vh`:

```jsx
<style>{`
  .gtl-picker-sheet {
    width: 100%;
    max-width: 430px;
    max-height: 70vh;
  }
  @media (orientation: landscape) and (max-height: 500px) {
    .gtl-picker-sheet {
      max-width: 100%;
      max-height: 60vh;
    }
  }
`}</style>
```

Portrait stays at `70vh`. Only landscape changes.

### 2. Picker header shows the muscle kanji alongside the English name

In `components/attune/PickerSheet.jsx`, near the top of the file (after imports), add a kanji map (or import one — there's an identical map in `DayCell.jsx`; you can import it from there if you'd rather, but inline duplication is fine for a one-off picker label):

```js
const MUSCLE_KANJI = {
  chest: '胸', shoulders: '肩', back: '背', forearms: '腕',
  quads: '腿', hamstrings: '裏', calves: '脛',
  biceps: '二', triceps: '三', glutes: '尻', abs: '腹',
}
```

In the picker header `<div>` (the one that currently renders just `{(sourceMuscle || '').toUpperCase()}`), prepend the kanji. Find:

```jsx
<span>{(sourceMuscle || '').toUpperCase()}</span>
```

Replace with:

```jsx
<span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
  {sourceMuscle && MUSCLE_KANJI[sourceMuscle] && (
    <span style={{
      fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
      fontSize: '1.2rem',
      lineHeight: 1,
      color: '#d4181f',
    }}>
      {MUSCLE_KANJI[sourceMuscle]}
    </span>
  )}
  <span>{(sourceMuscle || '').toUpperCase()}</span>
</span>
```

Reads as: `胸 CHEST` (kanji red, label red Anton). The `×` close button stays on the right unchanged.

### 3. DayCell collapses UPPER / LOWER / FULL BODY into a single labeled group

Currently `DayCell.jsx` renders the muscle stack as a row of kanji (e.g., `胸 肩 背 腕 腿 裏 脛 二 三 尻 腹`) plus each English name joined with `· ` (e.g., `CHEST · SHOULDERS · BACK · ...`). For a day with all 11 muscles assigned that's overwhelming.

When a day's `muscles` set matches exactly one of these special groups, render a single collapsed kanji + label instead:

| Match | Kanji | English label |
|---|---|---|
| All 11 muscles (the full canonical list) | `全` | `FULL BODY` |
| Exactly the UPPER set: `chest, back, shoulders, biceps, triceps, forearms` | `上` | `UPPER` |
| Exactly the LOWER set: `quads, hamstrings, calves, glutes` | `下` | `LOWER` |
| Anything else (single muscle or any other mix) | Current behavior — list each kanji + each English label joined with `· `. |

Match is **exact set equality**: e.g., `[chest, back, shoulders, biceps, triceps]` (5 of 6 upper muscles) does NOT match UPPER — it falls through to the default mixed rendering. Same for any partial match.

`abs` is treated as core — its presence prevents UPPER and LOWER matches; only a FULL BODY day (all 11) includes it via the special label.

In `components/attune/DayCell.jsx`, near the top alongside `MUSCLE_KANJI` and `MUSCLE_LABEL`, add the group definitions:

```js
const ALL_MUSCLES = ['chest', 'shoulders', 'back', 'forearms', 'quads', 'hamstrings', 'calves', 'biceps', 'triceps', 'glutes', 'abs']
const UPPER_MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']
const LOWER_MUSCLES = ['quads', 'hamstrings', 'calves', 'glutes']

function setEquals(a, b) {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

function muscleGroupLabel(muscles) {
  if (!muscles || muscles.length < 2) return null
  if (setEquals(muscles, ALL_MUSCLES))   return { kanji: '全', label: 'FULL BODY' }
  if (setEquals(muscles, UPPER_MUSCLES)) return { kanji: '上', label: 'UPPER' }
  if (setEquals(muscles, LOWER_MUSCLES)) return { kanji: '下', label: 'LOWER' }
  return null
}
```

Then in the `DayCell` component body, after computing `kanjiStack` and `labelStack`, branch on the group label:

```js
const group = muscleGroupLabel(muscles)
const kanjiStack = group
  ? group.kanji
  : (muscles.length > 0 ? muscles.map(muscleKanji).join('') : (isRestDay ? '休' : '·'))
const labelStack = group
  ? group.label
  : (muscles.length > 0
      ? muscles.map(muscleLabel).filter(Boolean).join(' · ')
      : (isRestDay ? 'REST' : ''))
```

The render section that uses `kanjiStack` and `labelStack` doesn't need to change — it just consumes whatever those resolve to. UPPER/LOWER/FULL_BODY days now render as a single big kanji + a single label, identical visually to a single-muscle day's structure.

## DO NOT

- Don't touch `lib/`, `app/attune/page.js`, `CycleCalendar.jsx`, `SetChip.jsx`, `AutoAttuneButton.jsx`, or any other component.
- Don't change the kanji glyphs already mapped (`胸` for chest, etc.).
- Don't change the abs handling — abs is core, only counts toward FULL BODY.
- Don't reintroduce the picker's old `PICKER · ATTUNE · LOCKED:` prefix or `TAP DAYS...` subtext.

## Verify visually

After all 3 land:

1. Open picker in portrait — header renders `胸 CHEST` (kanji red, label red mono) on the left, `×` on the right. Sheet height unchanged from before.
2. Open picker in landscape (iPhone-sized 844×390) — sheet is full-width, top edge at y≈156, ~234px tall.
3. Seed a cycle where one day has all 11 muscles, one day has exactly UPPER (chest+back+shoulders+biceps+triceps+forearms), one day has exactly LOWER (quads+hamstrings+calves+glutes), one day has a single muscle (e.g., chest), one day has a partial mix (e.g., chest+biceps). Verify each cell renders:
   - Full day: `全` / `FULL BODY`
   - Upper day: `上` / `UPPER`
   - Lower day: `下` / `LOWER`
   - Single chest: `胸` / `CHEST` (current behavior unchanged)
   - Mixed chest+biceps: `胸二` / `CHEST · BICEPS` (current behavior unchanged)

Run a playwright eval at 390×844. Take screenshots:
- (a) Picker portrait — kanji + English in header
- (b) Picker landscape — full-width, lower position
- (c) `/attune` cold load with cycle containing FULL BODY + UPPER + LOWER + single + mixed days, all visible at once

## Commit and push

Single commit:

```
Attune: picker landscape 60vh + kanji in header (胸 CHEST) + UPPER/LOWER/FULL BODY day collapse (上/下/全)
```

Push to `origin/dev`.

## Report

Commit hash + 3 screenshots + one-line confirmation per fix.
