# Attune Movements button — VISUAL REDO (Worker B / GTL 2)

**Target:** GTL 2 (`/c/Users/Jordan/gtl-2/` on `gtl2`). Branch: `dev`. Dev server: http://localhost:3002.

**Supersedes:** `dispatches/attune_movements_button.md` (original spec, partially implemented but visually wrong).

**File:** `app/fitness/new/branded/page.js`

## Diagnosis

The first pass implemented "demote the kanji" and "add an Attune button" as two unrelated edits. The original spec's phrase **"Attune Movements button sits in front of the kanji watermark"** was interpreted as z-index ordering (button above the kanji in DOM stack) instead of as **spatial overlay** (button physically on top of where the kanji previously rendered on screen).

What the page used to look like (production at https://gritthoseteeth.com/fitness/new/branded):
- The `五月` kanji was rendered **bold and red**, occupying the calendar's empty top-row cells (the gap between the previous month's tail days and day 1 of the current month) — a dominant visual element in the calendar header band.
- Muscle grid was `2-col × 6-row` (12 cells: 11 muscles + CARVE).

What's on dev now (broken):
- Kanji demoted to a faint single-cell watermark (correct demotion, kept in original spot).
- Attune Movements button rendered as a **thin gold horizontal strip BELOW the calendar**, sandwiched between the calendar and the muscle grid (wrong location).
- Muscle grid was restructured to `3-col × 4-row` to make room for the new strip (collateral damage — should be reverted).

## Correct visual composition

The Attune Movements button should **occupy the calendar's empty top-row slots** — the same spatial real estate the bold `五月` kanji previously held. The demoted watermark kanji stays rendered behind the button (z-index lower, opacity ~0.12), so the button reads as if it's "branded onto" the kanji watermark.

Conceptually the layered stack at the top of the calendar grid (top-row empty slots) becomes:
- Layer 1 (back): the demoted `五月` kanji at low opacity (already in place)
- Layer 2 (front): the Attune Movements button itself, gold/skewed/clip-path, occupying the same horizontal extent

The button should match CARVE's visual weight — same height, same gold treatment, same skew/clip-path, same pulse animation. The two buttons should read as siblings, not as a primary CTA + a sliver afterthought.

## What to change

### 1. Remove the standalone horizontal strip

In `app/fitness/new/branded/page.js`, find the `{sheetOpen && ( <div className="px-3 pt-2 pb-1 shrink-0"> <AttuneMovementsButton ... /> )}` block (around line 921). **Remove that whole block.** The Attune button no longer lives below the calendar.

### 2. Revert the muscle grid back to 2-col × 6-row

Find `grid grid-cols-3 grid-rows-4` (the muscle grid container). Change back to `grid grid-cols-2 grid-rows-6`. Restore the original 12-cell layout (11 muscles + CARVE in the 12th cell). This matches production and gives CARVE its proper prominence as the bottom-half primary CTA.

### 3. Place the Attune Movements button over the calendar's top-row empty slots

The calendar already computes `targetSlots` (empty cells in row 1 or row 5) where the kanji renders. The Attune Movements button should **sit on top of those same slots in row 1**, sharing the spatial extent that the bold kanji used to occupy.

Implementation options (pick whichever is cleanest):
- **Grid-span approach**: render the Attune button as a calendar grid item that uses `grid-column` to span the empty row-1 cells. Then the kanji watermark sits inside the same span at z-index 0; the button sits on top at z-index 1.
- **Absolute overlay**: keep the calendar grid unchanged, render the Attune button as `position: absolute` overlaying the row-1 empty-cells region. Watermark stays in the cells beneath.

Either is fine — the goal is that the button visually occupies the calendar header band, with the kanji watermark visible behind/beneath it.

The button should:
- Be visible AT ALL TIMES on the schedule page (not gated on `sheetOpen` — see step 4)
- Be **active** when at least one day is selected (CARVE-button parity), inactive (dimmed) when no days are selected
- Match CARVE's height/weight/treatment

### 4. Always-visible button, not sheet-gated

The original spec was specifically: button is **visible** at all times but **inactive** until a day is selected. The first pass made the button conditional on `sheetOpen`, which means it disappears entirely when no days are selected. Fix this — the button stays rendered always, with the `enabled` prop driven by whether any days are selected (probably `cycleDays > 0` or whatever existing flag CARVE uses for its enabled state).

This way: a user who opens the page sees both the muscle of the calendar AND the Attune Movements button as the top-band call-to-action, with the button waiting in its disabled state until they pick a day.

### 5. The kanji watermark stays exactly as is

Don't touch the existing kanji watermark code or its opacity (0.12 is correct). The watermark stays as the background layer; only the spatial relationship of the button changes.

## Verify visually

After the change, take screenshots at iPhone size (~390×844):

1. **No day selected**: calendar with the watermarked `五月` visible behind the dimmed Attune Movements button overlaid on the top-row empty cells. Logo visible below. Muscle grid hidden.
2. **One day selected**: same composition, but the Attune Movements button is now active (gold, full opacity, pulse animation). Muscle grid (2-col × 6-row) visible below the calendar with CARVE in cell 12.
3. **Compare to production** at https://gritthoseteeth.com/fitness/new/branded — the calendar's header band should now feel similar, just with the Attune button replacing the bold kanji as the primary visual anchor.

The Attune button and CARVE button should read as **two equal-weight siblings** — one for the calendar/scheduling layer (Attune), one for the muscles layer (CARVE).

## DO NOT

- Touch the existing CARVE button's logic, animation, or styling.
- Touch the kanji watermark's opacity or color (0.12 red is correct).
- Touch the calendar grid's day rendering (the cell layout, day numbers, TODAY indicator).
- Touch the logo / blade rendering below the calendar.
- Touch any of Worker A's Attune page code (`app/attune/`, `components/attune/`, `lib/attunement.js`).
- Add any new dependencies.

## Commit and push

Commit message: `Schedule: Attune Movements button overlays calendar header (in place of bold kanji); revert muscle grid to 2x6`

Push to `origin/dev`.

## Report

- Commit hash.
- Two screenshots: (a) no day selected, (b) one day selected.
- Confirmation that the muscle grid is back to 2-col × 6-row with CARVE in the last cell.
