# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

There is an open task list at `KAMI_TODO.md` and an active mobile redesign brief at `MOBILE_BRIEF.md`. At the start of every session, read both and surface any incomplete items to the developer. Mobile is the primary target — when mobile and desktop layouts conflict, favor mobile.

## Project overview

Next.js 14 (App Router) app — two domains:
- **Fitness** (Jordan's domain): 3D muscle selector, workout cycle builder, day-focus active view, XP/tier system
- **Diet** (Kami's domain): meal photo → macro analysis via Gemini

The exercise library is derived from [wger.de](https://wger.de/) (CC-BY-SA 4.0, see `LICENSE-thirdparty.md`).

## Commands

```bash
npm run dev                # Next dev server on :3000
npm run build              # Production build
npm run start              # Run production build
npm run lint               # next lint (ESLint)
npm test                   # vitest run (one-shot)
npm run test:watch         # vitest watch mode
npm run import:exercises   # Re-import wger.de catalog → lib/exerciseLibrary.js
```

Run a single test file or pattern:
```bash
npx vitest run __tests__/exp/repMult.test.js
npx vitest run -t "tier multiplier"
```

Test environment is `node` (see `vitest.config.mjs`); tests live in `__tests__/` and `__tests__/exp/`. Diet route handlers expect `GEMINI_API_KEY` in `.env.local`.

## Architecture

### Routing & top-level shape
Next.js App Router under `app/`. The root layout (`app/layout.js`) mounts two always-on clients: `IOSPWAKeyboardFix` and `PredictiveTapChainGuard`. Major route groups:
- `app/page.js` — hideout home (calling card + nutrition entry)
- `app/fitness/` — `page.js` (profile select), `hub/` (cycle menu), `new/{muscles,summary,branded}/` (cycle creation flow), `load/`, `ghost/`, `edit/`, `active/[iso]/` (day-focus, plus `[iso]/[muscleId]/`), `profile/`, `stats/`
- `app/diet/`, `app/attune/`, `app/settings/{page,music}`
- `app/api/diet/{analyze,voice}/route.js` — Gemini-backed image + voice endpoints
- `app/api/fitness/plan/route.js`

### Persistence — profile-scoped localStorage
All client state goes through `lib/storage.js`. `pk(key)` namespaces by `gtl-active-profile`, so `pk('cycles') → gtl-jordan-cycles`. Multiple users on the same device get fully isolated cycles, sets, and XP. **Never read or write a `gtl-*` key directly — always go through `pk()` or `getItem`/`setItem`.**

Profile guard: every fitness sub-page calls `useProfileGuard()` from `lib/useProfileGuard.js`, which redirects to `/fitness` when no active profile exists. **Do not remove this hook from any fitness sub-page.**

### XP / tier system (`lib/exp/`)
The XP runtime is a self-contained math module re-exported through `lib/exp/index.js`. Core pieces:
- `repMult`, `ipfGL` — per-set XP calculation (IPF GL formula + rep multiplier)
- `regions`, `regionStarStore` — body-region star tracking
- `tier`, `tierStore`, `prestige` — tier thresholds, multipliers, prestige unlocks
- `setLog`, `setXP`, `dailyReckoning`, `holidays` — set logging + daily rollup

Each module has a matching test in `__tests__/exp/`. When changing XP math, run the full `__tests__/exp/` suite before committing.

### 3D muscle selector (`components/MuscleBody.jsx`)
React Three Fiber canvas with per-model hitbox definitions and a three-pass stencil-masked gold glow that projects only onto the body surface inside each hitbox volume. Hitbox calibration is ongoing for the `anatomy` model — see `CALIBRATION.md` for the workflow (`DEBUG_HITBOXES = true`, T/S/R gizmos, console log → paste into `MODELS.anatomy.hitboxes`). Goku / SSJ / Gohan still use `buildStandardHitboxes`. Canvas requests `gl={{ stencil: true }}`; any change to the glow passes must preserve `transparent: true` on all three passes or the stencil clears too early.

### Predictive tap chain (`lib/predictiveTap.js` + `components/PredictiveTapChainGuard.jsx`)
The 5-button "profile → load-cycle → activate → today → muscle" chain occupies the same screen rect on every step. Tapping inside that rect mid-transition prefires the next page's primary handler via `sessionStorage`. `PredictiveTapChainGuard` (mounted in root layout) disarms the chain when the user navigates off-chain. All decisions log with `[prefire]`. Don't repurpose the chain rect geometry without auditing both modules.

### Exercise library
`lib/exerciseLibrary.js` is **generated** by `npm run import:exercises` (`scripts/import-wger.js` + `scripts/wgerMap.js`). Hand edits get clobbered. To adjust naming or muscle mapping, edit `lib/exerciseAliases.js` / `scripts/wgerMap.js` and re-run the importer. Notoriety ordering lives in `lib/exerciseNotoriety.js`.

## Design language — P5 (Persona 5)

All UI follows the P5 visual language. **Read `.claude/commands/p5-ui.md` before making any UI changes** — it has the full design bible, color tokens, clip-path library, shadow-slab pattern, and writing voice. Implementation status per screen is tracked in `P5_UI.md`; when a screen moves from ⛔ / ⚠ to ✅, update that table in the same commit. The voice is "Joker's posture, Simon's heart" — P5 grammar (torn cards, diagonal slashes, kanji watermarks, ransom-note type) with Gurren Lagann verb vocabulary (FORGE, PIERCE, ASCEND, IGNITE).

Always reuse:
- `gtl-*` Tailwind tokens defined in `tailwind.config.js` (`gtl-void`, `gtl-red`, `gtl-paper`, `gtl-gold`, etc.)
- The shadow-slab pattern documented in the P5 skill for any red action button
- `useSound()` from `lib/useSound.js` for interactive sound cues (named cues like `button-hover`, `option-select`, `menu-close`, `stamp`)
- Transition components: `HeistTransition`, `FireTransition`, `FireFadeIn`, `SlashWipe`, `SpeedLines`

## Conventions

- `gtl-back-to-edit` localStorage flag controls retreat/Enter navigation in edit mode (see `RetreatButton` pattern in the P5 skill).
- Components that touch the DOM must guard with `typeof window === 'undefined'` checks — Next.js server-renders the App Router by default.
- Do not commit `tools/` vision-and-control output (`screen.png`, `browser_state.json`); the vision tooling itself lives in a separate `claude-vision` repo per `README.md`.
- `app/fitness/_legacy_form.js` is dead — do not import it.

## Branch workflow

- Always commit to `dev` first.
- Only merge to `main` when ready to deploy.
- Per session instructions, development happens on the branch the operator specifies; push to that branch, never to `main` or `dev` without explicit permission.
