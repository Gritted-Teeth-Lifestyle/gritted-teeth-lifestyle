# Dispatch: Draft Cycle Model

## Diagnosis

ATTUNE MOVEMENTS on /fitness/new/branded silently fails for new cycles because
`pk('active-cycle-id')` is only set at Summary→ETCH. `syncActiveCycle` no-ops
when neither active nor editing IDs exist, so /attune mounts and reads stale
or missing cycle data. The mental model the user wants:

> The cycle is born when you FORGE its name. CARVE and ATTUNE both edit that
> same live thing. ETCH is the only commit. If you bail, your draft waits on
> the hub.

## Storage shape

- `pk('draft-cycle')` — single JSON object `{id, name, muscles, days, dailyPlan, step}`. Null when no draft.
- `pk('draft-attunement')` — chip state for the draft, same shape as `attunement-{cycleId}`.
- `pk('editing-cycle-id')` — repurposed. Set when draft is a clone of a real cycle (replace on ETCH); null when draft is new (append on ETCH).
- `pk('cycles')` — unchanged. Holds only promoted (real) cycles.
- `pk('active-cycle-id')` — unchanged. Set on ETCH to the promoted cycle's id.

## Lifecycle (canonical flow)

| Step | Action |
|---|---|
| **FORGE** (Name → Next) | Create draft `{id: uuid, name, muscles:[], days:[], dailyPlan:{}, step:'muscles'}` in `pk('draft-cycle')`. Clear `editing-cycle-id`. Clear any prior `draft-attunement`. |
| **HONE** (Muscles) | Read draft.muscles, write back on every change. Set draft.step='schedule' on advance. |
| **CARVE** (Schedule) | Read draft.days + draft.dailyPlan; write back on every commit-worthy change. Always — no editing-cycle-id gate. **Orphan-chip cleanup:** when a muscle is removed from `dailyPlan[dayId]`, remove from `draft-attunement[dayId]` any chip whose exercise's primaryMuscles ∩ new `dailyPlan[dayId]` = ∅. Set draft.step='attune' on ATTUNE button tap, 'summary' on CARVE→Summary advance. |
| **ATTUNE button** | Route to /attune. No syncActiveCycle. The draft IS source of truth. |
| **Attune page** | Read draft + draft-attunement. Writes (addChip, addMuscleToDay, convertRestDay) go to draft + draft-attunement. |
| **Back-nav to CARVE** | Re-hydrate selectedDays + assignments from draft.days + draft.dailyPlan unconditionally on mount. |
| **ETCH** (Summary) | **Promote**: push draft into `pk('cycles')` (replace by id if editing-cycle-id is set; else append). Move `pk('draft-attunement')` to `pk('attunement-{realId})`. Set `pk('active-cycle-id') = realId`. Clear `draft-cycle`, `draft-attunement`, `editing-cycle-id`. |
| **Edit existing cycle** | From /fitness/load Review: clone the real cycle into draft slot, clone its attunement to draft-attunement, set `editing-cycle-id = real cycle's id`, route to FORGE (Name page) with name pre-filled. |

## Hub behavior

- If `pk('draft-cycle')` exists:
  - Show "Resume Draft" affordance with summary line: `"N days carved · M chips attuned"`
  - Show "Start Fresh" affordance
- Resume Draft → route into the cycle flow at `draft.step` (`'muscles'` → /fitness/new/muscles, `'schedule'` → /fitness/new/branded, `'attune'` → /attune, `'summary'` → /fitness/new/summary)
- Start Fresh → confirm dialog: *"Discard current draft? You've picked N days."* → on confirm, clear draft + draft-attunement + editing-cycle-id, route to /fitness/new (FORGE/Name)

## Work units (commit per unit recommended)

1. **lib/storage.js helpers**: `getDraft()`, `setDraft(patch)`, `clearDraft()`, `getDraftAttunement()`, `setDraftAttunement(state)`, `promoteDraft()`
2. **FORGE create-draft** on Name → Next (app/fitness/new/page.js)
3. **HONE draft binding** (app/fitness/new/muscles/page.js): read/write draft.muscles
4. **CARVE draft binding** (app/fitness/new/branded/page.js): read draft on mount unconditionally, write on every change. Remove `syncActiveCycle`. Simplify `handleAttuneHandoff` to `setDraft({step:'attune'}); router.push('/attune')`.
5. **CARVE orphan-chip cleanup**: when muscle removed from a day, prune draft-attunement.
6. **Attune page draft binding** (app/attune/page.js): replace `loadActiveCycle()` with `loadDraftOrActive()` (prefer draft; fallback only if no draft exists, for any future read-only viewing).
7. **lib/attunement.js draft routing**: when `cycleId === draft.id`, key into `pk('draft-attunement')` instead of `pk('attunement-{cycleId}')`.
8. **ETCH promote** in Summary: replace existing cycles[].push pattern with `promoteDraft()`.
9. **Edit-existing clone-into-draft** in app/fitness/load (handleReview): clone selected cycle into draft slot, set editing-cycle-id, route to Name page with name pre-filled.
10. **Hub Resume Draft / Start Fresh UI** (app/fitness/page.js or wherever the hub lives — likely `/fitness` profile page or `/fitness/hub`).
11. **Start Fresh confirm dialog** component.

## Non-changes (DO NOTs)

- DO NOT change `pk('cycles')` shape.
- DO NOT change `active-cycle-id` semantics (still only set on ETCH).
- DO NOT touch SetXPCinematic, TierUpFlourish, or handleStamp in `/fitness/active/[iso]/page.js`.
- DO NOT change `attunement-{realId}` key shape for real cycles.
- DO NOT change `contiguousSpan` rest-day auto-fill behavior.
- DO NOT merge to main.

## Verification (mobile, 390×844)

1. **New cycle empty path**: hub → FORGE name → tap ATTUNE button immediately (no days picked) → /attune shows "no carved days" empty state. Back-nav to CARVE → pick Mon/Wed/Fri → tap ATTUNE → /attune shows those days.
2. **Round-trip add muscle**: FORGE → CARVE pick Mon, assign chest → ATTUNE → add 3 chips to Mon-chest → back to CARVE → add shoulders to Mon → ATTUNE → Mon shows chest (3 chips) + shoulders (0 chips).
3. **Round-trip remove muscle (orphan cleanup)**: same setup as #2 but remove chest from Mon → ATTUNE → Mon shows shoulders only, no orphan chest chips.
4. **Abandon + resume**: build a cycle to /attune step, hard-close the PWA (or navigate away to hub), reopen → hub shows "Resume Draft (3 days carved · 5 chips attuned)" + "Start Fresh".
5. **Resume routes to last step**: tap Resume Draft → lands on /attune (the step they were on per draft.step).
6. **Start Fresh confirm**: with draft existing, tap Start Fresh → confirm dialog appears with day count → confirm → draft + draft-attunement cleared → routes to FORGE.
7. **ETCH promotes**: complete a cycle to ETCH → after cinematic, `pk('cycles')` has new entry, `pk('active-cycle-id')` set to its id, `pk('draft-cycle')` is null, `pk('draft-attunement')` is null.
8. **Edit existing cycle**: hub → Load Cycle → tap real cycle → Review/Edit → clone into draft → edit days → ATTUNE → back to CARVE → no data loss → ETCH → real cycle is REPLACED in `pk('cycles')` (not appended); `pk('editing-cycle-id')` cleared.

## Report format

- Commit hash per work unit (or grouped sensibly — prefer atomic).
- Files touched per commit.
- Playwright/manual session demonstrating verifications 1-8 with screenshots or transcript.
- Any blockers raised as `dispatches/blockers/gtl3_draft_cycle_<topic>.md` files, like prior pattern.

## Commit message tone

Match the existing project style: terse, factual, lowercase-ish module prefix, no trailing punctuation. Examples:
- `lib/storage: draft-cycle helpers (getDraft/setDraft/clearDraft/promoteDraft)`
- `FORGE: create draft cycle on name → next`
- `CARVE: read/write draft cycle unconditionally; remove syncActiveCycle`
- `CARVE: orphan-chip cleanup when muscle removed from day`
- `Attune: loadDraftOrActive prefers draft slot`
- `ETCH: promote draft → cycles[]; clear draft slot`
- `Hub: Resume Draft / Start Fresh affordances when draft exists`
