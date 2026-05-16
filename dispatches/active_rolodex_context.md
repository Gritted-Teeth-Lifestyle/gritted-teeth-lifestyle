# Active Rolodex — context for Worker C (GTL 3)

The day-selection surface on `/fitness/active` was rebuilt as a vertical
"rolodex." Here's everything you need to know before touching anything that
interacts with it (e.g. the log-set empty-day picker, deep-launch flows,
or other routes that depend on `[data-rolodex-iso]` / day click semantics).

## Where it lives

- `app/fitness/active/page.js`
  - `DayButton` component (~line 91–187): the per-day button that mirrors
    the `ACTIVATE` button on `/fitness/load` visually.
  - Rolodex section (~line 3030–3110): the scroll container + per-card
    wrappers that drive prominence + tap gating.
  - Scroll listener + auto-center `useEffect` blocks (~line 2782–2845).
- `app/globals.css` (~line 280–310): the `[data-scroll-passthrough]` CSS
  exception that lets pan gestures bubble through buttons, plus the
  `[data-rolodex-iso][data-rolodex-centered]` prominence ring rules.

## DayButton — what each card looks like

Mirrors the ACTIVATE button's exact size + style:

- `clip-path: polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)` — same slash
- `bg-gtl-red` (or `bg-gtl-surface` when done)
- `boxShadow: '4px 4px 0 #070708'` — sharp black offset (matches ACTIVATE)
- Inner padding: `px-6 py-5 min-h-[56px]`
- Date text: `font-display text-3xl tracking-tight`

Content varies by `isToday`:
- **TODAY:** status label (`UPCOMING|MISSED|DONE` not used; just `TODAY`)
  + day text + muscle text list + ➤︎ arrow on the right.
- **Non-TODAY:** day text on the left + muscle **kanji glyphs** on the
  right (one kanji per muscle, `MUSCLE_KANJI` map mirrors
  `app/fitness/new/branded/page.js`'s SHEET_MUSCLES). REST days show a
  small `REST` pill on the right.
- **Done days:** strikethrough on the date, dimmed bg, dimmer kanji.

`done` is read from `localStorage.getItem(pk(\`done-${cycleId}-${iso}\`))`.

## Rolodex container — scroll mechanics

Section uses inline-style flex chain (defensive; Tailwind `flex-1 min-h-0`
classes broke iOS PWA layout in earlier attempts):

```
flex: '1 1 0%', minHeight: 0, height: '100%',
overflow-y: auto, overflow-x: hidden,
WebkitOverflowScrolling: 'touch',
overscroll-behavior-y: contain,
touch-action: pan-y,
scrollSnapType: 'y mandatory',
paddingTop: '40vh', paddingBottom: '40vh',  // phantom space so first/last cards can reach the active line
```

Marked with `data-scroll-passthrough` and `data-rolodex-container`.

Each card wrapper:
```
flexShrink: 0, minHeight: '56px',
scrollSnapAlign: 'center', scrollSnapStop: 'always',
opacity: 'calc(0.45 + 0.55 * var(--rolodex-t, 0))',
data-rolodex-iso={iso}
```

## The "active line" — y=479

`ACTIVE_TOP_Y = 479`. This is the viewport y-coordinate where the
**selected card's TOP edge** sits. It's the same `top: 479px` value
ACTIVATE uses on `/fitness/load`, so the selected rolodex card occupies
the exact same screen slot ACTIVATE does (same x via `px-3` section
padding = left:12/right:12 inset, same y, same width, same height).

If you need to reference the active line in your own code, pull the
constant from `app/fitness/active/page.js` (it's defined at the start of
the rolodex `useEffect` block) or duplicate it (it's a magic number,
not exported — yet).

## Scroll listener — the per-card prominence

Walks every `[data-rolodex-iso]` on every scroll tick:

```js
const dist = Math.abs(rect.top - ACTIVE_TOP_Y)
const t = Math.max(0, Math.min(1, 1 - Math.max(0, dist - 30) / 170))
card.style.setProperty('--rolodex-t', String(t))
if (t >= 0.9) card.setAttribute('data-rolodex-centered', '')
else card.removeAttribute('data-rolodex-centered')
```

Effects driven by the variable + attribute:
- Card opacity 0.45 → 1.0 (in inline style on the wrapper).
- `[data-rolodex-iso][data-rolodex-centered]` gets red `drop-shadow`
  prominence ring (CSS in globals.css).
- Non-centered cards get `filter: saturate(0.55)` (CSS in globals.css).
- Tap gating uses the attribute (see below).

Listener also re-runs on `ResizeObserver` events for layout shifts.

## Tap gating — only the centered card opens day-focus

Wrapper-level `onClickCapture`:

```js
onClickCapture={(e) => {
  const wrapper = e.currentTarget
  if (!wrapper.hasAttribute('data-rolodex-centered')) {
    e.preventDefault()
    e.stopPropagation()
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}}
```

So a tap on:
- The centered card → click bubbles to DayButton's `onClick` → opens the
  day-focus zoom for that day.
- A non-centered card → suppresses the click and scrolls that card to
  center. The user has to tap again to actually open it.

If you're calling `handleDayClick(iso, rect)` from the outside (e.g.
deep-launch from `/fitness/page.js` profile chip swipe), that path
bypasses the rolodex tap-gating entirely — it goes straight to the
day-focus overlay. Already wired and working.

## Auto-center on mount

Double-rAF before measuring (so layout settles), then:

```js
const rect = todaysCardNode.getBoundingClientRect()
const delta = rect.top - ACTIVE_TOP_Y
container.scrollBy({ top: delta, behavior: 'instant' })
```

`rolodexCenteredRef` latches so re-renders (e.g. after a set is logged
and `cardRefreshKey` bumps) don't yank the user's manual scroll back to
today.

## Page-level scroll lock

The active page locks page scroll completely:

```js
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
document.body.style.position = 'fixed'
document.body.style.inset = '0'
document.body.style.width = '100%'
document.body.style.height = '100%'
document.body.style.touchAction = 'none'
```

Restored on unmount. Children opt into scroll via `data-scroll-passthrough`.

If your screen renders ON TOP of `/fitness/active` (e.g., a modal/overlay
spawned from there), keep this in mind — body is fixed/inset so absolute
positioning of overlays may behave differently than on other routes.

## Touch-action specifics

`app/globals.css` has a universal:
```css
a, button, [role="button"] { touch-action: manipulation; }
```

This used to break the rolodex (manipulation on the per-card button
swallowed pan gestures). Fix: a higher-specificity rule scoped via
`data-scroll-passthrough`:
```css
[data-scroll-passthrough] a,
[data-scroll-passthrough] button,
[data-scroll-passthrough] [role="button"],
[data-scroll-passthrough] {
  touch-action: pan-y;
}
```

If you add a new scrollable container ANYWHERE that needs to bubble pan
gestures through buttons inside it, add `data-scroll-passthrough` on
the container — don't override `touch-action` inline (iOS PWA WebKit
ignores inline `touch-action: pan-y` on `<button>` elements).

## Click-flow integration points (in case your work touches them)

- `handleDayClick(iso, rect)` is the function that opens the day-focus
  overlay for a given day. Defined in the active-page component scope.
- `[data-rolodex-iso="${iso}"]` is the canonical selector if you need to
  programmatically scroll to a particular day.
- `data-rolodex-centered` attribute is the source-of-truth for "this
  card is currently selected." You can read it but don't write it (the
  scroll listener owns it).
- `__gtlBgMusicTrackId`, `__gtlBgMusic`, `__gtlBgMusicStarted`,
  `__gtlBgMusicCtx`, `__gtlBgMusicGain`, `__gtlBgMusicFadeInterval` are
  the BGM singleton globals — unrelated to rolodex but mentioning them
  here so you don't accidentally collide with existing window keys.

## Data dependencies

- `days` (state on the active page): array of ISO date strings, sorted.
  Source: `localStorage.getItem(pk('training-days'))`.
- `dailyPlan` (state): map of `iso → muscleId[]`. Source: `pk('daily-plan')`.
- Per-day done flag: `pk(\`done-${cycleId}-${iso}\`)` set to `'true'`.
- Per-day per-muscle exercise/weight data: `pk(\`ex-${cycleId}-${iso}-${muscleId}\`)`,
  `pk(\`wt-${cycleId}-${iso}-${muscleId}\`)`.

## Commit chain (in case you need to trace)

Most relevant recent commits, oldest first:
- `da70175` — initial rolodex (post-revert)
- `8924c3c` — opacity-only prominence (no transform/filter)
- `05119e4` — height-chain inline-style backstop
- `5e83c0c` — DayButton inline `touch-action: pan-y`
- `08184a9` — `data-scroll-passthrough` CSS rule
- `904a933` — `min-h-0` on the content wrapper (made flex chain resolve)
- `3205a37` — page-scroll lock, scroll-snap, prominence ring,
  center-only-tap, double-rAF auto-center
- `e95ab39` — kanji-only non-TODAY cards
- `5dd8102` — DayButton matches ACTIVATE size + style
- `96956cc` — pin today's top edge to y=479 (ACTIVATE position)

## DO NOT

- Don't read `--rolodex-t` from inside DayButton — it's set on the
  wrapper, not the button. Use `data-rolodex-centered` on the wrapper if
  you need to know the active state.
- Don't bring back `transform: scale` or `filter: brightness` on cards
  during scroll — they create GPU composite layers that swallow iOS PWA
  scroll capture inside an overflow-y container. Opacity-only.
- Don't change `ACTIVE_TOP_Y` unless you're also moving the ACTIVATE
  button on `/fitness/load`. They're the same anchor by design.
- Don't touch the body scroll lock useEffect — it's the reason iOS PWA
  doesn't viewport-pan in any direction.
- Don't rely on the rolodex container being a particular height. The
  flex chain is delicate; treat it as opaque.
