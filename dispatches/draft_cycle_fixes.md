# Dispatch: Draft-Cycle Follow-up Fixes (4 items)

Follow-up to `dispatches/draft_cycle_model.md`. Eval found 4 bugs/regressions
in the just-landed work. Ordered by severity.

git fetch && git merge --ff-only origin/dev to get latest before starting.

---

## Fix 1 — Day-removal orphan-chip cleanup (P1, correctness)

**Bug:** Removing a muscle from a day in CARVE prunes draft-attunement chips
for that muscle (commit `6dff4fc`). But removing a whole day from CARVE
(deselecting the day) leaves the day's entire chip block orphaned in
`draft-attunement`. If the user re-selects the day later, the old chips
resurrect — violates the "auto-delete on removal" rule Jordan locked in.

**Fix:** In `app/fitness/new/branded/page.js`, find the day-deselect path
(wherever `selectedDays` shrinks). When a day ISO is removed from
`selectedDays`:
- Read `getDraftAttunement()`
- Delete `nextAtt[removedIso]` if present
- Call `setDraftAttunement(nextAtt)` if changed

Same defensive pattern as the muscle-removal cleanup at line ~938. Custom
chips on the day go with the day — auto-delete is total when the day itself
goes away.

**Verify:** seed a draft with chips on Mon. Deselect Mon from CARVE.
Re-select Mon. Mon's chips are gone (not resurrected).

---

## Fix 2 — Edit-clone double-write stale state (P1, correctness)

**Bug:** `app/fitness/load/page.js` `handleReview` writes both the draft slot
AND legacy keys (`training-days`, `daily-plan`, `muscle-targets`, `cycle-name`)
at clone time. Subsequent CARVE edits go to draft only. Legacy keys go stale.

CARVE hydration currently prefers draft and falls back to legacy when no
draft. That fallback is the problem surface: any code path that reads legacy
keys directly (without checking for a draft first) will see stale clone-time
data during edit-mode flows.

**Fix:**
1. In `app/fitness/load/page.js` `handleReview`, **remove the legacy-key
   writes**. Keep only: `draft-cycle`, `draft-attunement`, `editing-cycle-id`.
2. Audit `app/fitness/new/branded/page.js` hydration (lines ~689-722): when a
   draft exists, the legacy fallback should NOT run. (Already true per current
   logic — confirm. If not, fix.)
3. Audit `app/fitness/new/muscles/page.js` and `app/fitness/new/page.js`
   (Name) hydration: same rule — prefer draft, never read legacy when draft
   exists.
4. Audit `app/fitness/new/summary/page.js` hydration: same.

If any audit turns up a consumer that REQUIRES legacy keys and can't be
migrated to draft this pass, drop a blocker file
`dispatches/blockers/gtl3_draft_cycle_legacy_audit.md` describing what you
found and why — do NOT silently keep the double-write.

**Verify:** edit an existing cycle from Load Cycle. Change days. Go ATTUNE.
Back-nav to CARVE. Day changes are still there. Hop forward to ETCH. The
real cycle is replaced with the edited content (not the clone-time snapshot).

---

## Fix 3 — Edit route revert (P2, my design call)

**Bug:** `app/fitness/load/page.js` `handleReview` now routes to
`/fitness/new` (FORGE/Name page). Original behavior routed to
`/fitness/edit` (the edit hub). King's previous dispatch spec instructed
the Name-page route; revert to the edit hub instead.

**Fix:** In `app/fitness/load/page.js` `handleReview`, change:
- `fireDestRef.current = '/fitness/new'` → `'/fitness/edit'`
- `setFireDest('/fitness/new')` → `setFireDest('/fitness/edit')`

Confirm `/fitness/edit` still functions correctly as an edit-mode hub on
top of the draft slot. If it reads legacy keys instead of the draft, fix it
to prefer draft (related to Fix 2's audit).

**Verify:** Load Cycle → tap a real cycle → Review. Lands on `/fitness/edit`,
not Name page.

---

## Fix 4 — Resume Draft caption text (P3, cosmetic)

**Bug:** `app/fitness/hub/page.js` Resume Draft caption reads
``${draftSummary.carvedDays} days carved · ${draftSummary.chips} chips attuned``.
Jordan's locked design spec wants narrative copy.

**Fix:** Replace the caption with the literal string:
```
An unfinished blade waits in the forge.
```

`draftSummary` can stay populated for the confirm-dialog day-count line — only
the card's caption changes.

**Verify:** seed a draft (or build one), open `/fitness/hub`. RESUME DRAFT
card caption reads "An unfinished blade waits in the forge." not the
count line.

---

## Non-changes (DO NOTs)

- Don't refactor unrelated code.
- Don't touch `lib/storage.js` (helpers are correct).
- Don't change `promoteDraft()` semantics.
- Don't change Start Fresh confirm dialog copy.
- Don't merge to main.

## Commit grouping

One commit per fix (4 total) is preferred. Group only if fixes share a single
trivial diff.

## Report format

- 4 commit hashes
- Files touched per commit
- Verification result per fix (screenshot or playwright transcript)
- Any blockers as `dispatches/blockers/gtl3_<topic>.md`
