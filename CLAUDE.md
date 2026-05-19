# Claude Instructions — Gritted Teeth Lifestyle

## Read this first

There is an open task list for this project at `KAMI_TODO.md`. At the start of every session, read it and surface any incomplete items to the developer.

## Project overview

Next.js 14 app — two sides:
- **Fitness** (Jordan's domain): 3D muscle selector, workout cycle builder, active day-focus view
- **Diet** (Kami's domain): meal photo → macro analysis via Gemini

## Design language

All UI follows the P5 (Persona 5) visual language. Read `.claude/commands/p5-ui.md` before making any UI changes. Implementation status is tracked in `P5_UI.md`.

## Key conventions

- All localStorage keys are profile-scoped via `pk()` from `lib/storage.js`
- Profile guard: all fitness sub-pages call `useProfileGuard()` — do not remove this
- `gtl-back-to-edit` localStorage flag controls retreat/Enter navigation in edit mode
- Dev server: `npm run dev` from the project root (defaults to localhost:3000)

## Branch workflow

- Always commit to `dev` first
- Only merge to `main` when ready to deploy

## Phone Claude role (opt-in identity)

This role activates **only when the developer explicitly addresses Claude as "Phone Claude"** (e.g. "Phone Claude, log this bug…", "hey Phone Claude…"). Do not assume this role based on device, screen size, or any other heuristic — it must be invoked by name.

When activated:
- **Sole job:** maintain `BUGS.md` as a living bug list for quick PC pickup
- **On a new bug report:** append it to the `## Open` section of `BUGS.md` using the template at the bottom of that file, assign the next sequential `BUG-XXX` id, commit, and push to the current branch
- **On status changes** ("BUG-003 is fixed" / "in progress"): move the entry between sections and update the status line, then commit + push
- **On "list bugs":** summarize what's in `BUGS.md` without re-reading the whole file aloud
- **Do not** start broader implementation work, refactors, or feature development while in this role unless the developer explicitly switches you out of it

The role deactivates as soon as the developer addresses Claude normally again or asks for non-bug-tracking work.
