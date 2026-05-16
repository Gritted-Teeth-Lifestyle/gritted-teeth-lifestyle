---
date: 2026-05-02
topic: gtl-exercise-selection
---

# GTL Exercise Selection

## Problem Frame

GTL's CARVE screen lets a user assign muscle(s) to each day of a training cycle, but once a workout day arrives there is no defined path from "today is chest day" to "log a set of bench press." This brainstorm covers exercise selection — how the user (or the app) decides which specific exercise(s) get done for each muscle on each day.

GTL has two cycle creation paths:

| | Express forge cycle (existing) | Planned cycle (this brainstorm) |
|---|---|---|
| Muscle assignment | Auto: all muscles | User picks per day in CARVE |
| Exercise selection | Auto-picked, swappable on set/weight/reps screen | User attunes specific exercises via a new Attune Exercises page |
| User intent | "Just lift, surprise me" | "I have a plan and I want to shape this cycle" |

The express path is in scope only as context — its auto-pick logic is not part of this brainstorm. The new work is the **Attune Exercises page** for the planned path.

## Requirements

**Page Surface and Navigation**
- R1. The planned-cycle calendar exposes an "Attune Exercises" entry point that opens the Attune Exercises page.
- R2. The Attune Exercises page renders the entire cycle calendar at once, with every day visible.
- R3. The user can zoom in and out on the calendar; while zoomed in, the user can pan in any direction.
- R4. Tapping a workout day opens a picker for that day, scoped strictly to the day's assigned muscle(s).

**Terminology**
- A **set chip** is one set of one exercise. Each chip on a day cell represents a single set. To attune three sets of bench press to a chest day, the user places three bench-press chips. Sets of the same exercise repeat as separate chips.

**Exercise Picker**
- R5. The picker is a scrollable list of exercises filtered to the day's muscle(s), with a search bar at the top.
- R6. The user cannot see or pick exercises that don't match the day's muscle(s) from inside the picker. (Cross-muscle additions happen only via drag — see R15.)
- R7. The exercise library is curated and shipped by the GTL team. There is no user-add flow.
- R8. Selecting an exercise from the picker places one set chip on the current day. The picker also exposes a **multi-day target selector** — the user can optionally select additional days from the visible calendar before confirming, and on confirmation a set chip is placed on every selected day in one operation. This lets the user complete attunement of an exercise across many days from a single picker invocation.

**Day Capacity and Defaults**
- R9. Each muscle on each day can hold 0 to N set chips with no app-imposed cap. The same exercise can appear as multiple chips (one per set).
- R10. On first open of a fresh planned cycle, the calendar starts empty. A prominent "Auto-attune all" button populates every muscle-day in one tap; until used, days remain empty.
- R10a. The Attune page is placement-only — it has no reorder affordance. Order of execution is decided at workout time on the workout screen, via drag-and-drop of the set list. Day cell chips render in placement order, treated as an initial draft sequence the user can rearrange later.

**Editing Set Chips**
- R11. Each set chip exposes three actions: **Copy**, **Delete**, and **Replace**.
- R11a. **Copy** duplicates the set chip in place — the duplicate appears immediately below the source on the same day, same exercise. This is the primary path to building up multiple sets of the same exercise.
- R12. **Replace** swaps the chip's exercise for another (picker-driven). After picking the new exercise, the user is prompted to choose the cascade scope: (a) just this chip, (b) all chips of this exercise on this day only, or (c) all chips of this exercise across the entire cycle.
- R13. Set chips are drag-and-droppable from one day's cell to another. Drag is a **move** — the chip leaves the source day and lands on the destination day. To duplicate across days, the user either invokes the picker's multi-day target selector (R8) at attune time, or taps **Copy** on the chip first (R11a) and drags the copy.
- R14. Dropping an exercise on a **rest day** prompts: "Convert this rest day to a [muscle] day?" If confirmed, the rest day becomes a workout day with that muscle and the exercise lands.
- R15. Dropping an exercise on a **workout day already assigned a different muscle** prompts: "Add [muscle] to this day's training?" If confirmed, the muscle is added to the day and the exercise lands. Symmetric with R14.
- R16. Dropping an exercise on a workout day already assigned the matching muscle silently appends it to that day's chip stack.

**Empty Days**
- R17. If the user starts a planned cycle without attuning a given workout day, arriving at that workout day opens an in-the-moment picker scoped to today's muscle(s).
- R18. The in-the-moment picker uses the same muscle-lock rule as R6.
- R19. When the user attempts to leave the Attune Exercises page while one or more workout days have zero attuned exercises, they are prompted: "You have N workout day(s) with no exercises attuned. Are you sure you want to leave?" — with the count of empty days shown. Confirming leaves with empty days (and R17 takes over at workout time); cancelling keeps the user on the page. Days the user has explicitly converted from rest to workout are included in the count if still empty.

**Onboarding**
- R20. The first time a user ever lands on the Attune Movements page (across all cycles, persisted globally — not per-cycle), an instruction popup appears with the copy: "attune your movements to specific days. copy, move, and replace movements at will." The popup is one-shot — dismissing it sets a persistent "onboarding seen" flag. Subsequent visits, even on new cycles, do not show the popup.

## Success Criteria

- A user who wants ritual ownership can build a fully bespoke cycle exercise-by-exercise, day-by-day, without falling back to auto-pick.
- A user who wants speed can tap "Auto-attune all" and immediately have a usable cycle.
- A user who attunes only some days never gets blocked when an unattuned day arrives — the in-the-moment picker (R17) bridges them.
- Attune Exercises feels visually consistent with CARVE and the broader P5/Gurren aesthetic — full-cycle visibility, ritual interactions, no generic list-view feel.

## Scope Boundaries

- The Express forge cycle path's internals (how it auto-picks exercises, swap UX on the set screen) are out of scope.
- The contents and taxonomy of the curated exercise library (what exercises, how they're tagged, how many per muscle) are out of scope. This doc assumes "enormous curated library" exists.
- Set, rep, and weight prescription is out of scope. The log set screen redesign is a separate effort.
- Search ranking, fuzzy matching, and search analytics are out of scope.
- Sync, cloud, or community sharing of attunements is out of scope.

## Key Decisions

- **Two paths, two philosophies.** Express = full-auto with in-the-moment swap. Planned = full-control via Attune. No shared exercise selection logic between them.
- **Muscle-locked picker, drag-permissive movement.** The picker prevents accidental cross-muscle picks. Drag-and-drop allows intentional cross-muscle additions, gated by a confirmation prompt.
- **No user-added exercises.** Library is curated. Reduces moderation, search-quality, and content-variance concerns.
- **Empty-by-default + Auto-attune button.** Forces the user to choose ceremony vs convenience explicitly on each new cycle.
- **Symmetric drop prompts.** Rest-day and cross-muscle drops both prompt with a yes/no consent dialog. One mental model.

## Outstanding Questions

### Resolve Before Planning

_None — all blocking questions resolved._

### Deferred to Planning

- [Affects R1][Technical] Where exactly in the existing CARVE / cycle-creation flow does the "Attune Exercises" entry point live? Button at end of CARVE? Always-visible button on the cycle calendar? Both?
- [Affects all][User decision] Can the user re-enter Attune mid-cycle, after the cycle has started? If yes, how are already-completed workout days visually distinguished and are they editable?
- [Affects R2, R3][Needs research] At maximum zoom-out, how is a multi-chip day cell rendered when chips don't fit (count badge, kanji-only, color dots)?
- [Affects R8][Technical] After picker selection lands a chip, does the picker stay open for adding more from the same list, or close fully (forcing a re-tap on the day to add another)?

## Next Steps

→ `/ce:plan` for structured implementation planning.
