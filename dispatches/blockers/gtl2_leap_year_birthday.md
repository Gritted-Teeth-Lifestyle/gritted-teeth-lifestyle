# Blocker: Feb 29 leap-year birthday handling in `getHolidayMultiplier`

**Worker:** gtl2
**Affects:** R16 (`lib/exp/holidays.js` — `getHolidayMultiplier(date, userDOB)`)

**Question:** When a user's DOB is Feb 29 (leap-year birthday), what should `getHolidayMultiplier` return on Feb 28 and Mar 1 in non-leap years? The brainstorm and plan are silent on this; the dispatch flags it explicitly as a discretion question.

**Candidate answers:**

1. **Roll back to Feb 28 in non-leap years** — Feb 29 birthday triggers ×1.5 on Feb 28 of any non-leap year. Feb 28 of a *leap* year stays a normal day (Feb 29 hasn't arrived yet); the bonus fires on Feb 29 itself. Mirrors common state-issued-ID and US Selective Service practice. **Recommended.** Reason: the user gets their bonus every year (no "skipped" year), and the rollback is unambiguous. Feels like a reward, never a punishment.
2. **Roll forward to Mar 1 in non-leap years** — same idea but other direction. Common in some birthday-tracking apps (Facebook). Tradeoff: Feb 29 birthday-havers conceptually "share" Mar 1 with Mar 1 birthdays, which feels a tiny bit off-brand for an identity holiday. The rollback-to-Feb-28 model is more standard.
3. **Skip in non-leap years (no bonus those years)** — Feb 29 birthday only fires on Feb 29; non-leap years give zero birthday bonus. Cleaner code, but the user loses ~75% of their bonus opportunities (3 of every 4 years), which contradicts R16's "12 days/yr per user" promise — it would actually be 9 in leap years out of every 4.

**Recommendation:** Option 1 (roll back to Feb 28). It preserves the "12 days/yr" promise and matches the most common civil-law convention.

**What's blocked:** The Feb 29 corner of `getHolidayMultiplier` (one branch) and the corresponding test case in `__tests__/exp/holidays.test.js`. The rest of `getHolidayMultiplier` does NOT depend on this answer and is being implemented and shipped now; this blocker covers only the leap-year branch and its test.

## Resolution

Jordan: "ok" → **Option 1: roll back to Feb 28** in non-leap years.

- Feb 29 birthday → ×1.5 fires on Feb 29 in leap years; on Feb 28 in non-leap years.
- Feb 28 in a leap year stays a normal day (no birthday bonus — the bonus fires on Feb 29 itself).
- Preserves "12 days/yr per user" promise from R16.
- Standard civil-law convention.

Resume `getHolidayMultiplier` leap-year branch + corresponding test case.
