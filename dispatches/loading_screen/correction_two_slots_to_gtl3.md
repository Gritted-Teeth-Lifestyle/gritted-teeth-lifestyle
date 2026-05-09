# Correction dispatch — gtl3 — Loading screen TWO-SLOT redesign

The previous loading-screen dispatch (`dispatches/loading_screen/phrases_to_gtl3.md`) was wrong. Jordan wants **two simultaneous slots**, not one rotating slot. This dispatch supersedes it.

## What's changing

The current implementation in `components/GateScreen.jsx` picks ONE phrase from a combined bank and types it in a single slot. **Replace that with two slots:**

### During `!loadingComplete` (loading state)

| Slot | Position | Content | Animation |
|---|---|---|---|
| **Brand-label slot** (currently shows `GRITTED TEETH LIFESTYLE`) | Top of center stack | **One mantra**, randomly picked at mount | **Word-by-word reveal**: each word fades in 200ms apart. No cursor. Settled, hero presentation. |
| **PRESS-START slot** (currently shows `LOADING` / typed phrase) | Below GTL/slash, where PRESS START lives | **Cycling faux-system phrases** | **Typing with cursor** (60ms/char, blinking `_`). After typing completes, hold 500ms, fade out 200ms, 100ms gap, type next phrase. Cycle through all 3 in random order until loadingComplete. |

### After `loadingComplete` (cross-fade to settled state)

| Slot | Content |
|---|---|
| Brand-label slot | `GRITTED TEETH LIFESTYLE` (the existing label, with its existing styling) |
| PRESS-START slot | `PRESS START` (existing) |

The brand-label slot's mantra fades out (250ms), then `GRITTED TEETH LIFESTYLE` fades in (250ms). Same pattern for PRESS-START slot's faux-system → `PRESS START`. Both swaps happen in parallel.

The other elements (GTL big headline, slash divider, sub-hint, swipe hints) all fade in at `loadingComplete` per the original dispatch — that part stays.

## Split the bank into two arrays

Replace the single `LOADING_PHRASES` constant with two separate constants:

```js
const MANTRAS = [
  'THE BLADE IS YOU',
  'BECOME THE EDGE',
  'STRUGGLE',
  'CARRY THE WEIGHT',
  'PIERCE THE HEAVENS',
  'STAND UP AND WALK',
  'HOLD NOTHING BACK',
  'AWAKEN YOUR PERSONA',
  'GO BEYOND THE LIMIT',
]

const FAUX_SYSTEM_PHRASES = [
  'RACKING WEIGHTS...',
  'WIPING THE BENCH...',
  'UNRACKING THE BAR...',
]
```

## Locked timings

| Param | Value |
|---|---|
| Mantra word reveal stagger | **200ms between words** |
| Mantra full reveal time (worst case "GO BEYOND THE LIMIT" = 4 words) | ~800ms |
| Faux-system typing | **60ms / char** (unchanged) |
| Faux-system hold after typing complete | **500ms** |
| Faux-system fade-out | **200ms** |
| Faux-system gap between phrases | **100ms** |
| Faux-system cycle order | random shuffle of all 3, then loop if needed |
| Min display floor | **1500ms** (bumped from 1200ms — gives time for at least one full faux-system cycle plus mantra reveal) |
| Slot cross-fade on loadingComplete | mantra/faux-system fade-out 250ms, then label/PRESS-START fade-in 250ms |
| Hidden-elements unified fade-in | 400ms ease-out (unchanged) |

## Architecture

Two new components (or one parametrized — your call as long as the split is clean):

- `<MantraReveal phrase={mantra} />` — word-by-word fade-in.
- `<FauxSystemCycle phrases={shuffled} />` — typing + cursor + cycle through phrases until unmount.

Mount both during `!loadingComplete`. On `loadingComplete`, fade them out (250ms), then swap to the static labels.

State to add in `GateScreen.jsx`:

```js
const [pickedMantra] = useState(() =>
  MANTRAS[Math.floor(Math.random() * MANTRAS.length)]
)
const [shuffledSystem] = useState(() =>
  [...FAUX_SYSTEM_PHRASES].sort(() => Math.random() - 0.5)
)
```

## DO NOT

- Keep the old single-slot typing animation. Replace it.
- Mix mantras and faux-system in the same array.
- Show `GRITTED TEETH LIFESTYLE` during loading (it's hidden now — replaced by the mantra slot).
- Add any other text to the loading screen (GTL big headline, slash, sub-hint, swipe hints all stay opacity-gated to `loadingComplete`, unchanged from prior dispatch).
- Build a separate "mantra label" slot. The mantra **takes over** the existing brand-label slot's position + size. Same coordinates, same wrapper.
- Use the same animation for both slots (word-by-word for mantra, typing for faux-system — the contrast is the point).

## Mantra slot styling

The mantra goes into the existing brand-label JSX (currently renders `GRITTED TEETH LIFESTYLE` with `font-mono uppercase letter-spacing 0.16em fontSize 1rem color #d4181f mixBlendMode difference`). **Same styling — just change the text and add the word-by-word reveal during loading.** Don't restyle.

If a mantra is too long for the slot's natural width on iPhone (`GO BEYOND THE LIMIT` is the longest at 19 chars), the existing `whiteSpace: nowrap` may need to flex. If it overflows, that's a blocker — surface and ask.

## NO-DISCRETION PROTOCOL

Standard rules. Anything not specified above (component structure variations, font-size tweaks, edge cases when loadingComplete fires mid-faux-system-typing) → blocker file at `dispatches/blockers/gtl3_loading_<topic>.md`. Don't guess.

## Done when

Single commit lands on `origin/dev` superseding the previous loading-screen commit. Reply with:
- the commit hash
- a one-line PWA verification (or browser-only note)
- any blockers raised
