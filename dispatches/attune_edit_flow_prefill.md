# Edit-flow prefill — schedule page hydrates from cycle when entering via edit

**Target:** GTL 3 worker. Branch: `dev`. File: `app/fitness/new/branded/page.js`.

**ASK before committing if anything is unclear.**

## DIAGNOSIS

`/fitness/load`'s **REVIEW / EDIT** action calls `loadCycleIntoStorage(cycle)` (around line 1014) which writes the cycle's full state to localStorage:

```js
localStorage.setItem(pk('active-cycle-id'), cycle.id)
localStorage.setItem(pk('cycle-name'),       cycle.name)
localStorage.setItem(pk('muscle-targets'),   JSON.stringify(cycle.targets))
localStorage.setItem(pk('training-days'),    JSON.stringify(cycle.days))
localStorage.setItem(pk('daily-plan'),       JSON.stringify(cycle.dailyPlan))
```

Then sets `pk('editing-cycle-id') = cycle.id` and routes to `/fitness/edit`.

`/fitness/new/branded/page.js` (the schedule/CARVE page reachable from the edit hub) **does not read any of these on mount**. Its state is initialised blank:

```js
const [selectedDays, setSelectedDays] = useState(new Set())
const [assignments,  setAssignments]  = useState({})
```

So when the user enters from the edit hub, the schedule appears empty — the user has to re-build the cycle from scratch, and any edits never reach `/attune` because they're not committed against the existing cycle's data.

`/fitness/new/summary/page.js` already handles edit-mode commit correctly (its `handleBegin` checks `pk('editing-cycle-id')` and updates the existing cycle in place). The missing piece is the schedule page's state hydration.

## CHANGE

In `app/fitness/new/branded/page.js`, find the existing state declarations (around line 525):

```js
  const [selectedDays, setSelectedDays] = useState(new Set())
  const [assignments,  setAssignments]  = useState({})
```

Leave them alone. Below them, add a `useEffect` that hydrates from localStorage on mount when in edit mode:

```js
  // Hydrate from the cycle's persisted state when entering via the edit
  // hub. /fitness/load's handleReview wrote training-days + daily-plan +
  // editing-cycle-id before routing here. Without this hydration, the
  // schedule starts blank and any user edits never line up with the
  // cycle being edited.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let editing = false
    try { editing = localStorage.getItem(pk('editing-cycle-id')) != null } catch (_) {}
    if (!editing) return

    try {
      const rawDays = localStorage.getItem(pk('training-days'))
      const rawPlan = localStorage.getItem(pk('daily-plan'))
      if (rawDays) {
        const arr = JSON.parse(rawDays)
        if (Array.isArray(arr) && arr.length > 0) {
          setSelectedDays(new Set(arr))
          // Position the displayed month so the cycle's first day is
          // visible on mount instead of whatever month "today" lands in.
          const first = arr[0]
          if (typeof first === 'string') {
            const [y, m] = first.split('-').map(Number)
            if (y && m) setDisplayDate(new Date(y, m - 1, 1))
          }
        }
      }
      if (rawPlan) {
        const plan = JSON.parse(rawPlan)
        if (plan && typeof plan === 'object') {
          const next = {}
          for (const [iso, arr] of Object.entries(plan)) {
            if (Array.isArray(arr)) next[iso] = new Set(arr)
          }
          setAssignments(next)
        }
      }
    } catch (_) {}
  }, [])
```

The effect runs once on mount. If `pk('editing-cycle-id')` is set, it reads the cycle's `training-days` (array of ISO strings) and `daily-plan` (`{iso: muscle[]}`), seeds `selectedDays` and `assignments` accordingly, and shifts `displayDate` so the calendar opens on the month containing the cycle's first day.

Note: `setDisplayDate` is the existing state-setter for the calendar's visible month; it's already declared in the file (`const [displayDate, setDisplayDate] = useState(...)`). Confirm this when reading the file. If the variable is named differently (e.g., `currentMonth` or `viewMonth`), use the actual name.

## DO NOT

- Don't touch `lib/`, `app/attune/page.js`, `app/fitness/load/page.js`, `app/fitness/edit/page.js`, `app/fitness/new/summary/page.js`, `app/fitness/new/muscles/page.js`, `components/attune/*`, or any other file.
- Don't change the existing Quick-Forge useEffect (the auto-fill block that runs when `gtl-quick-forge === '1'`). That's a different code path and stays intact.
- Don't write to localStorage from this useEffect — it only reads.
- Don't unconditionally hydrate from `training-days` / `daily-plan` outside of edit mode. New-cycle creation must continue to start blank. The `editing-cycle-id` check is the gate.

## Verify visually

After the change:

1. From `/fitness/load`, tap a saved cycle, tap **REVIEW / EDIT** → routes to `/fitness/edit`. Tap the schedule edit-nav button → `/fitness/new/branded` opens with the cycle's days already selected and the muscle assignments visible. Calendar's visible month is the month containing the first carved day.
2. Carving via the existing CARVE button works as normal (writes through `pk('daily-plan')` and `pk('training-days')`). Summary's `handleBegin` sees `editing-cycle-id` and updates the cycle in place (existing behavior, unchanged).
3. After the user goes through summary's BEGIN, `/attune` reads the now-updated cycle from `pk('cycles')` via `pk('active-cycle-id')` and shows the new state. (Both `active-cycle-id` and `editing-cycle-id` were set by `loadCycleIntoStorage` and the existing summary `handleBegin` cleanup respectively — no changes needed here.)
4. Direct entry to `/fitness/new/branded` (from `/fitness/new`'s "FORGE NEW CYCLE" path, where `editing-cycle-id` is NOT set) starts blank as before — no regression.

Run a playwright eval at 390×844:
- Seed a cycle into `gtl-KING-cycles` with `days = [<6 ISO dates>]` and `dailyPlan = { iso: ['chest'], iso: ['back'], ... }`.
- Set `gtl-KING-active-cycle-id` and `gtl-KING-editing-cycle-id` and `gtl-KING-training-days` and `gtl-KING-daily-plan` to mirror what `loadCycleIntoStorage` would write.
- Navigate to `/fitness/new/branded`.
- Verify the rendered calendar has the cycle's days visually selected (red outline) and the appropriate muscle chips/highlights shown.

Take 2 screenshots: schedule page in edit mode (filled) vs schedule page in fresh-cycle mode (blank).

## Commit and push

Single commit:

```
Schedule: hydrate selectedDays + assignments from cycle on mount when in edit mode (was always blank)
```

Push to `origin/dev`.

## Report

Commit hash + 2 screenshots + one-line confirmation.
