# Blocker: No test framework installed; spec mandates tests for math modules

**Worker:** gtl1
**Affects:** Wave 1 commits 1-6 (every commit per dispatch must pass linting + smoke tests; plan Units 1-5, 7 each list `__tests__/exp/*.test.js` files; dispatch DO NOT explicitly forbids "Skip writing tests for the math modules"; plan calls for "test-first" on Unit 2 algo and Unit 5 reckoning)

**Question:** What test framework / runner should I install and use for the `__tests__/exp/*.test.js` files the plan calls for? Adding a framework is a structural decision (dev dep + config + npm script + possibly a babel/swc transform) that the no-discretion protocol explicitly flags.

**Candidate answers:**

1. **Vitest** — fast, zero-config for ESM, native TS support, works with Next.js 14 App Router projects without ejecting. Add `vitest` to devDeps + `"test": "vitest run"` script + tiny `vitest.config.js`. Zero touch on Next config. Pure-function math tests run in milliseconds. **Recommended.**
2. **Jest** — Next.js 14 docs default. Heavier setup (`jest.config.js` + `babel.config.js` or `next/jest` preset), slower cold start, but the official Next-blessed path. Adds `jest`, `@types/jest`, `jest-environment-jsdom` to devDeps.
3. **Plain `node:assert` standalone scripts** — zero new deps. Each test file is a `.js` script run via `node __tests__/exp/ipfGL.test.js`. Add `"test": "node __tests__/run-all.js"` aggregator. No watcher, no describe/it grammar, but truly minimal footprint and survives Next.js config changes.

**Recommendation:** Vitest. Smallest install footprint vs Jest, native ESM matches the lib/exp modules' shape, watch mode helps the test-first cycles in Units 2 and 5. Plain node:assert (option 3) is fine for math but loses describe/it readability that the plan's test-scenario enumerations map to naturally.

**What's blocked:** All 6 commits. Commit 1 (foundation math modules) is the first to need test files per the plan; without an answer here I can't write `__tests__/exp/ipfGL.test.js` etc. Cannot proceed.

## Resolution

_(awaiting King)_
