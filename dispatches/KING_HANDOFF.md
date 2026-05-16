# King GTL handoff — Attune Movements feature

**Read this first if you're a King GTL Claude on a different machine picking up this feature.**

You are the orchestrator. You don't write app code. You dispatch and review the work of three Worker GTL Claudes (gtl1, gtl2, gtl3) running on Jordan's machine. Workers commit and push directly to `origin/dev` and pull each other's work via a `git pull origin dev; sleep 30` loop running in their own terminal.

This file lives in `dispatches/KING_HANDOFF.md` so any King on any PC sees it after `git pull origin dev`.

## What we're building

The **Attune Movements page** — a new Next.js page in the GTL app where, on the planned-cycle path (not the express forge cycle path), the user attunes specific exercise sets to muscle days they've carved on the schedule page.

Core experience:
- Schedule page gets a new "Attune Movements" button overlaid on a watermarked month-kanji, day-gated like the existing CARVE button.
- Tapping enters a full-cycle calendar with zoom + pan (whole cycle visible at once).
- Tap a day → muscle-locked exercise picker (search + scrollable list + multi-day target selector).
- Each placed chip = one set. Long-press chip → Copy / Delete / Replace (Replace has a 3-way cascade scope).
- Drag a chip across days = move. Drop on rest day → confirm "convert this day"; drop on cross-muscle day → confirm "add this muscle"; drop on matching-muscle day → silent.
- Auto-attune all button on first open. Exit guard if leaving with empty workout days. First-time-user instruction popup, globally one-shot.

Full requirements: `dispatches/2026-05-02-gtl-exercise-selection-requirements.md` (R1–R20).
Full implementation plan: `dispatches/2026-05-02-001-feat-attune-exercises-page-plan.md` (6 units, dependency-ordered).

## Current state (as of 2026-05-02)

| Phase | Status |
|---|---|
| Brainstorm (`ce:brainstorm`) | ✅ Complete. Requirements doc landed in `dispatches/`. |
| Implementation plan (`ce:plan`) | ✅ Complete. Plan doc landed in `dispatches/`. |
| Worker dispatch specs | ✅ Drafted. 3 spec files in `dispatches/`. |
| Pyautogui dispatch scripts | ✅ Drafted. 3 scripts in `dispatches/scripts/`. |
| Worker dispatches fired | ⬜ NOT YET DONE. Awaiting Jordan to run the scripts (or copy/paste the prompts). |
| Worker A (Attune page) commits | ⬜ |
| Worker B (Schedule button) commits | ⬜ |
| Worker C (Log-set picker) commits | ⬜ |
| Integration verified | ⬜ |
| Feature ships | ⬜ — when this happens, delete the whole `dispatches/` folder. |

## The three-way split

| Worker | Pane (default 2×2 grid) | Repo path | Spec | Owns |
|---|---|---|---|---|
| **gtl1** | Bottom-right (BR) | `/c/Users/Jordan/gtl-1/` | `dispatches/attune_movements_page.md` | The new Attune page itself — calendar surface, day cells, picker, chip actions, drag-and-drop, auto-attune button, exit guard, first-time popup. **Plan Units 1–5 + page-side parts of Unit 6.** |
| **gtl2** | Top-right (TR) | `/c/Users/Jordan/gtl-2/` | `dispatches/attune_movements_button.md` | The schedule-page entry — month-kanji watermark restyle + new `AttuneMovementsButton` mirroring CARVE's day-gated activation, navigates to `/attune`. |
| **gtl3** | Top-left (TL) | `/c/Users/Jordan/gtl-3/` | `dispatches/log_set_empty_day_picker.md` | The log-set / active-day screen — when arriving at a workout day with zero attuned chips, surface the in-the-moment picker (R17/R18). Reads Worker A's `attunementStore` and uses Worker A's `PickerSheet` in `mode='in-the-moment'`. |

## Critical sequencing

**Worker A's first commit MUST land before Workers B and C can integrate.**

Worker A's spec instructs them to make their FIRST commit a small one that lands the shared `src/state/attunement.ts` (with `SetChip`, `DayAttunement`, store actions, selectors) plus the `src/components/attune/PickerSheet.tsx` component shape (with `mode: 'attune' | 'in-the-moment' | 'replace'` prop). They push that to `origin/dev` immediately. Workers B and C auto-pull every 30s and pick it up.

When you fire the scripts, fire **gtl1 first**, then gtl2, then gtl3. The order doesn't strictly matter (workers handle waiting on their own), but firing in dependency order is cleanest.

## How to dispatch

**Option A — Run the scripts** (requires `pyautogui`, `pygetwindow`, `pyperclip` installed in Python; requires the four Claude panes to be open in the canonical 2×2 layout — gtl1 BR, gtl2 TR, gtl3 TL, King BL):

```bash
git pull origin dev
python dispatches/scripts/dispatch_attune_movements_page_to_gtl1.py
python dispatches/scripts/dispatch_attune_movements_button_to_gtl2.py
python dispatches/scripts/dispatch_log_set_empty_day_picker_to_gtl3.py
```

Each script:
1. Finds the four candidate Claude windows (excludes Chrome/Firefox/Edge by title).
2. Sorts them into quadrants by position.
3. Picks the right quadrant.
4. Clicks into the bottom of that pane (focuses it without ShowWindow / SetForegroundWindow — those are forbidden per memory `feedback_dispatch_no_window_manipulation`).
5. Pastes the prompt and presses Enter.

**Option B — Copy/paste manually** if pyautogui isn't available on this machine, or if the layout differs. Each script's prompt is a short one-liner pointing the worker at its spec file. Pull up each script, copy the `prompt = "..."` string, paste it into the matching worker pane.

## Decisions already made (don't re-litigate)

These were resolved during brainstorm + plan and are baked into the specs. Don't ask the workers to redecide:

- **Two cycle paths**: express (auto, swap on set screen) vs planned (Attune Movements page). Express is unchanged.
- **Set chips, not exercise chips**: each chip = one set. Multiple sets of the same exercise = multiple chips.
- **Picker is muscle-locked**: cannot pick wrong-muscle exercises. Cross-muscle additions only via drag, with confirm prompt.
- **Drag = move, not copy**: copy lives in the chip action menu only.
- **Curated library only**: no user-add flow.
- **Auto-attune button on empty cycle, exit guard if leaving with empty days, first-time-user popup globally one-shot.**
- **Drag library = `@dnd-kit`. Pan/zoom library = `react-zoom-pan-pinch`.**
- **Day-selection gating mirrors CARVE** (no muscle prerequisite). User discovers empty state inside Attune.
- **Onboarding popup copy (verbatim, lowercase)**: *"attune your movements to specific days. copy, move, and replace movements at will."*

## What King may need to decide later

Plan's "Deferred to Implementation" items — workers may surface these and need a call:
- Exact route path (matches GTL Next.js convention; let the implementer mirror the schedule page's routing pattern).
- Whether `autoAttuneAll` should overwrite existing chips or only fill empty days when the cycle isn't pristine.
- Bottom-sheet animation choreography — match existing GTL motion vocab.
- Whether the multi-day target selector should visually preview targets on the calendar while the picker is open.

## What "done" looks like

1. Worker A reports a final commit hash, three screenshots (far-zoom calendar / picker with multi-day selector / drag-drop in flight), and confirms `attunementStore` + `PickerSheet` are exported.
2. Worker B reports a commit hash and three screenshots (schedule page no-day-selected with watermark + both buttons inactive / one-day-selected with both buttons active / navigation reaching Attune page).
3. Worker C reports a commit hash and three screenshots (empty-day arrival picker / post-confirm chip placed / no-muscles-assigned existing empty state).
4. King (you) tests the integration — pull `origin/dev` into a fourth GTL clone or use one of the worker checkouts, walk the full flow on iPhone-size viewport (~390×844), confirm everything composes.
5. Jordan signs off.
6. Delete the entire `dispatches/` folder. Commit. Push. Done.

## Reference: the King role

Per memory `feedback_king_claude.md`: King delegates prompts to other instances, evaluates their work, and never executes app code directly. Per `feedback_king_claude_no_babysitting.md`: King does not watch or click on other Claude panes — fire the dispatch and let workers do their thing.

If a worker hits a blocker and reports back, King decides whether to redispatch with refinements, ask Jordan, or hand off the call. King never reaches into the worker's repo to fix things directly.
