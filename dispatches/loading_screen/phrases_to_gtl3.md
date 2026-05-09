# Dispatch — gtl3 — Loading screen phrase bank + strict scope cleanup

While you're on standby for EXP Wave 2, this is a separate small UI task. Independent of the EXP work.

## Read first

1. `components/GateScreen.jsx` — current state. Loading mechanics already partially wired (assetsLoaded gate, logo waits off-screen until ready, "LOADING" text replaces "PRESS START" while loading, bands/bloom/corners cascade plays immediately).
2. The recent commits on `dev` for loading-screen context: `1d3111f`, `fb576f1`. (Use `git log --oneline` to scan.)

## Goal

Replace the static "LOADING" text with a **random rotating phrase from a curated bank**, type-animated letter-by-letter, with a guaranteed 1.2s minimum display time. **Strip the loading screen down to ONLY the brand label + the rotating phrase + the cascading red bands/bloom/corners in the background.** Everything else hides during loading and fades in once assets are ready.

## Scope

### Phrase bank (locked, do not modify)

Add this constant near the top of `components/GateScreen.jsx`, after `DOUBLE_TAP_MS`:

```js
const LOADING_PHRASES = [
  // Mantras
  'THE BLADE IS YOU',
  'BECOME THE EDGE',
  'STRUGGLE',
  'CARRY THE WEIGHT',
  'PIERCE THE HEAVENS',
  'STAND UP AND WALK',
  'HOLD NOTHING BACK',
  'AWAKEN YOUR PERSONA',
  'GO BEYOND THE LIMIT',
  // Gym faux-system
  'RACKING WEIGHTS...',
  'WIPING THE BENCH...',
  'UNRACKING THE BAR...',
]
```

12 phrases. Pick one at random per mount (lazy useState initializer so it doesn't reroll on every render).

### Type animation (locked specs)

- Each character types in **60ms apart**.
- Trailing **blinking `_` cursor** while typing AND for the post-typing hold.
- Once typing completes, hold the full phrase visible until both:
  - `assetsLoaded === true`
  - **AND** at least 1200ms have elapsed since component mount (the minimum display floor — even on warm cache reloads, the phrase is always visible for ≥1.2s)
- When both conditions met, fade phrase out (250ms ease-out), then fade `PRESS START` in (250ms ease-in).

### Strict loading-screen scope (the cleanup pass)

During loading state (i.e., `!assetsLoaded || not yet at 1.2s floor`), the **only** things visible are:

1. **`GRITTED TEETH LIFESTYLE`** label (already rendered — leave alone)
2. **The rotating phrase** (replaces the current `LOADING` slot)
3. **Red bands / bloom / corners cascading in** (already rendered — leave alone, they ARE the loading screen)

**Hide during loading; fade in only once `loadingComplete` (= assetsLoaded && minTimeElapsed):**

| Element | Current location |
|---|---|
| Big `GTL` headline | `components/GateScreen.jsx` around `:417-425` (`Anton, Impact, sans-serif`, `clamp(5rem, 14vw, 10rem)`) |
| Slash divider | `:428-433` (`bg: '#d4181f'`, skewX, gated on `active`) |
| `// CLICK OR TOUCH TO ENTER //` sub-hint | `:451-459` |
| Top swipe hint (`▲ SWIPE UP FOR FITNESS`) | `:230-252` |
| Bottom swipe hint (`▼ SWIPE DOWN FOR NUTRITION`) | `:253-273` |

For each, gate `opacity: loadingComplete ? 1 : 0` with a transition `opacity 400ms ease-out` (apply as a unified fade-in moment on completion). The slash divider currently has its own width transition tied to `active` — keep that, just add an opacity gate on top so it's invisible during loading.

The big `GTL` headline should also stay hidden during loading — it currently renders unconditionally. Add the same opacity gate.

### State variable

Introduce a `loadingComplete` state derived from `assetsLoaded && minTimeElapsed`:

- `minTimeElapsed`: useState false; useEffect on mount sets a 1200ms timer that flips it to true.
- `loadingComplete = assetsLoaded && minTimeElapsed` — used as the new gate for everything that should hide during loading.

**Do not** change the existing `imgLoaded` / `pageLoaded` / `assetsLoaded` machinery. Layer `loadingComplete` on top.

### Phrase rendering — replace the current LOADING slot

Currently `:446-447` does:
```js
{assetsLoaded ? 'PRESS START' : 'LOADING'}
```

Replace with a small typing-animated component that:
- Renders `loadingComplete ? 'PRESS START' : <TypingPhrase phrase={pickedPhrase} />`
- During the transition (loadingComplete just became true), cross-fades phrase out / PRESS START in
- The `<TypingPhrase>` component handles its own letter-by-letter reveal + cursor blink

You can inline `<TypingPhrase>` in `GateScreen.jsx` (small, local) OR put it in `components/loading/TypingPhrase.jsx` if it grows. Your call — but keep it tight; this is one concern.

## DO NOT

- Add anything else to the loading screen besides the 3 listed visible elements.
- Add an indicator dot, spinner, progress bar, decorative kanji, or anything not in the locked spec.
- Change the cascade animation timings (bands/bloom/corners).
- Change the logo entrance choreography.
- Modify the phrase bank — the 12 phrases are locked.
- Reroll the phrase mid-mount; pick once via lazy useState initializer.
- Inline the phrase bank inside the JSX (define at module top — see locked snippet above).
- Touch any EXP-related code (`lib/exp/*`, `pk('user-bodyweight')`, etc.) — that's gtl1's domain.

## Locked timings (no discretion needed)

- Typing per-character: **60ms**
- Cursor blink: **600ms on / 600ms off** (steady-state during hold)
- Phrase fade-out on loadingComplete: **250ms ease-out**
- PRESS START fade-in (after phrase fades out): **250ms ease-in**
- Hidden-elements unified fade-in on loadingComplete: **400ms ease-out**
- Minimum display floor: **1200ms from mount**

## NO-DISCRETION PROTOCOL

If you hit a judgment call (component split decision, edge-case in cross-fade, anything not specified above), **STOP**. Write to `dispatches/blockers/gtl3_loading_screen_<topic>.md` with question + 2-3 candidates + recommendation. Commit, push, pause. King relays to Jordan.

Things that DON'T require a blocker:
- Mirroring existing GateScreen styling vocabulary (font families, colors, blend modes already in the file).
- Standard React patterns (useEffect cleanup, lazy useState init).

Things that DO require a blocker:
- Any structural choice between `<TypingPhrase>` inline vs separate file IF it materially changes test/import surface.
- Any styling deviation from existing GateScreen typography for the rotating phrase.

## Done when

Single commit lands on `origin/dev` with:
- The `LOADING_PHRASES` constant added.
- The `<TypingPhrase>` reveal mechanic working.
- The `minTimeElapsed` + `loadingComplete` gating wired.
- All 5 hidden-during-loading elements opacity-gated correctly.
- A clean test on iPhone PWA: throttle network to slow 3G, confirm phrase types in, holds, then everything fades in coherently when assets land.

Reply with the commit hash + a one-line "verified on iPhone PWA at slow 3G" or "verified in browser only — couldn't test PWA, here's why" note.
