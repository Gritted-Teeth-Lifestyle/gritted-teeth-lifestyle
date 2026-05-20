# Dispatch: Hydration Cleanup (revert middleware, defer reads, fix one mismatch)

git fetch && git merge --ff-only origin/dev before starting.

## Why

The gate-warmup middleware we just landed (`f863ad4`, `bafaee6`) was the
wrong tool for this bug class. It only protects **cold** deep-link entry,
not **warm refresh** — which is the realistic bypass in a PWA-first app.
We're switching to the canonical fix: defer every localStorage read out of
the render path into a `useEffect`. That's SSR-safe regardless of how the
user got to the page.

The Name page fix in `1e6b28f` is correct and stays. The other two commits
get reverted. Then we audit the rest of the app for the same pattern and
convert them.

While we're in there, fix one **pre-existing** SSR mismatch that surfaced
during eval: `ForgeButton`'s `<style>` block contains an apostrophe in a
comment, which server-encodes to `&#x27;` and mismatches the client.

## Work units

### 1. Revert middleware + gate cookie/returnTo (keep Name useEffect fix)

Two commits to undo:
- `f863ad4 middleware: gate-warmup bounce for non-gate routes`
- `bafaee6 Gate: set gtl-warm cookie on mount + honor returnTo searchParam`

`1e6b28f NewCycle Name: defer localStorage read to useEffect (SSR-safe)`
**stays** — it's the canonical fix.

Cleanest path: `git revert --no-commit bafaee6 f863ad4` then commit the
revert as one. Or hand-undo the diffs. Either works; one revert commit
matching project tone is fine.

After revert:
- `middleware.js` at repo root should be **deleted**.
- `app/page.js` should no longer reference `useSearchParams`, `gtl-warm`
  cookie, `returnTo`, or `isSafeReturnTo`. The `activate`,
  `handleGateCommit`, and `handleFastToHeist` functions go back to using
  `defaultTarget` directly.

### 2. Audit the app for `useState(() => readLocalStorage())` patterns

Grep the codebase for `useState(() =>` and check each match. Any initializer
that touches `localStorage`, `sessionStorage`, `document.cookie`, or any
client-only API needs the SSR-safe pattern:

```js
const [foo, setFoo] = useState(defaultValue)
useEffect(() => {
  try {
    const raw = localStorage.getItem(...)
    if (raw) setFoo(parse(raw))
  } catch (_) {}
}, [])
```

For each match found, convert it. Keep the same fallback ordering / branching
logic the initializer had — just move it into the effect, replacing each
`return value` with `setFoo(value); return` so early-exit semantics carry.

Confirmed targets (start here, but don't stop here — grep is the source
of truth):
- `app/fitness/new/muscles/page.js` — likely has a similar `useState(() => …)`
  initializer reading `muscle-targets` or the draft.
- `app/fitness/new/branded/page.js` — already uses a separate `hydrated` flag
  via useEffect for the draft hydration, but double-check the
  `useState(new Set())` and `useState({})` initializers don't read storage.
- `app/fitness/new/summary/page.js` — Fix 2's audit migrated this to draft-
  first; verify it doesn't have a `useState(() => ...)` reading storage.
- `app/attune/page.js` — re-check after revert.
- `app/fitness/hub/page.js` — `refreshDraftSummary` is in useEffect, good;
  verify no other initializers.
- `app/fitness/load/page.js` — likely safe but check.
- `app/fitness/active/[iso]/page.js` and `.../[muscleId]/page.js` — these
  do a lot of localStorage reads; verify all reads land in useEffect /
  event handlers, NOT in useState initializers.
- `app/fitness/stats/page.js` — likely safe but check.
- `app/fitness/profile/page.js` — likely safe but check.
- `components/GateScreen.jsx` — check.
- `lib/useSound.js` / `lib/predictiveTap.js` — typically use module-level
  state, but check any internal `useState` calls.

If you find a match that needs a different fix shape (e.g., it's tied to
SSR data fetching), file a blocker. Otherwise, convert and commit.

### 3. Fix the ForgeButton style-block apostrophe

`app/fitness/new/page.js` line ~146, inside the `<style>{...}</style>` block
in `ForgeButton`:

```
/* Onboarding: stencil rolls off the target on mount. translateX value
   matches the FORGE button's SWIPE_THRESHOLD (294px). */
```

Server SSR encodes the apostrophe in `button's` as `&#x27;`; client renders
as `'`. React hydration mismatches.

**Pick one fix:**
- (a) Remove the apostrophe entirely: `FORGE button SWIPE_THRESHOLD` (cleanest).
- (b) Use a different word: `the FORGE swipe threshold (294px)`.
- (c) Move the comment out of the `<style>` block — put it before the
  `<style>` tag as a JSX comment `{/* … */}`. The mismatch only happens
  for text inside `<style>` tags.

Option (c) is most defensive (preserves the comment), but (a) or (b) is
simpler. Your call.

While you're in that file, sanity-check the other `<style>` blocks for the
same shape — any text content inside `<style>{...}</style>` with `'`, `"`,
`<`, `>`, or `&` characters could mismatch. Curly-brace JSX expressions
(`${var}`) are fine.

## Non-changes (DO NOTs)

- DO NOT revert `1e6b28f` (Name useEffect fix). That stays.
- DO NOT add `dynamic({ssr:false})` anywhere — we're using the useEffect
  pattern, not the SSR-skip pattern.
- DO NOT touch the draft-cycle storage helpers in `lib/storage.js`.
- DO NOT merge to main.

## Verification (mobile 390x844)

1. **Middleware gone**: `curl -I http://localhost:3020/fitness/new` returns
   200 (not 307). No `middleware.js` in repo root.
2. **Cookie gone**: open `/` in browser, check cookies — no `gtl-warm`.
3. **Name page still SSR-safe**: navigate to `/fitness/new` with a draft
   seeded in localStorage. No "Text content did not match" console warning
   about the input value.
4. **ForgeButton mismatch gone**: same page, no `Warning: Text content did
   not match ... @keyframes yy-pulse-left` warning about the style block.
5. **No regressions in eval suite**: run
   `C:/Users/Jordan/claudesandbox/eval_draft_fixes.py` from a fresh state.
   All 17 checks should still pass. (You can ignore the
   `eval_gate_warmup.py` script — its checks no longer apply since we're
   removing the middleware.)
6. **Audit completeness**: report which files had `useState(() => …)`
   initializers reading storage, and which were converted. If any were
   skipped (e.g., didn't actually read storage), say so explicitly.

## Commit grouping

3 commits, in this order:
1. `revert: gate-warmup middleware + cookie/returnTo (keep Name useEffect)`
2. `SSR-safe: defer remaining useState(() => readLocalStorage()) to useEffect`
3. `ForgeButton: fix style-block apostrophe SSR mismatch`

(Commit 2 may be split per-file if the audit finds many, but one commit is
fine if they're all small.)

## Report format

- Commit hashes per work unit
- Files touched per commit
- Audit report: list of files searched, list of useState-initializer
  conversions made
- Console verification: paste the relevant console output from
  `/fitness/new` (with seeded draft) showing no hydration warnings
- Any blockers as `dispatches/blockers/gtl3_hydration_cleanup_<topic>.md`
