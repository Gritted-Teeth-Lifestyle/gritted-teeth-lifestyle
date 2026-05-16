# KAMI TODO — Gritted Teeth Lifestyle

> **NEW PRIORITY: Mobile redesign is now the active focus.**
> Read `MOBILE_BRIEF.md` before starting any task. It explains the direction, what Jordan is handling, and the rules for mobile.
>
> These tasks were assigned by Jordan. Complete them in the P5 visual language established throughout the fitness side of the app. Reference `.claude/commands/p5-ui.md` for the design bible and `P5_UI.md` for implementation status.

---

## Mobile Tasks (Current Priority)

### M1. Home Page — Mobile Layout [DONE 2026-05-02]
Make the calling card dominate the fold on mobile. The nutrition card is a second act — scrolling to it should feel intentional. Fix the dead space between elements.

### M2. Profiles Page — Touch Targets [DONE 2026-05-02]
WHO ARE YOU looks great. Make the input and ENTER button wider, taller, more satisfying to tap. Press state on ENTER should feel physical.

### M4. Breadcrumb Cleanup
On mobile only, show just the current page label instead of the full path (e.g. `SCHEDULE` not `PALACE / FITNESS / NEW CYCLE / SCHEDULE`).

### M5. Idle Button Animations (touch-aware) [DONE 2026-05-02]
Carry-over from original TODO — but on mobile these must be pulse/glow patterns, not hover states. User's thumb should feel drawn to the right button.

---

---

## 1. Home Page (`/`) — Full UI Overhaul

- Redesign the entire home page layout in the P5 visual language
- The Nutrition card must match the fitness calling card aesthetic — no more rounded generic card
- The overall composition should feel like a hideout or war room, not a website
- Every element should carry weight and intention

## 2. Profiles Page (`/fitness`) — Full UI Overhaul

- Redesign the "WHO ARE YOU" warrior select screen
- This is the first real moment of identity in the app — it should feel dramatic and earned
- The name input and known warrior list both need the full P5 treatment
- Make the user feel like they are stepping into something, not logging in

## 3. Flavor Text — Full Rewrite

- Remove all AI-generated sounding copy throughout the entire app
- Every label, subtitle, body line, motivational phrase, and placeholder needs to be rewritten
- The voice is personal, direct, and earned — Joker's posture, Simon's heart
- Write like someone who has actually gritted their teeth, not like a fitness app

## 4. Idle Button Animations

- Every page must have at least one button doing an idle animation
- Purpose: user guidance and a satisfying, living UI
- Animations should feel intentional — a pulse, a shimmer, a slow breathing glow — not random
- The resting state of the app should never feel completely static

---

## Notes

- Do not touch the fitness flow pages (`/fitness/hub`, `/fitness/new/*`, `/fitness/active`, etc.) — those are Jordan's domain
- Diet/nutrition pages are out of scope for this task list
- When in doubt, look at how the CallingCard or HeistTransition were built for reference on the P5 animation/style approach
