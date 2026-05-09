import { describe, test, expect } from 'vitest'
import { getHolidayMultiplier } from '../../lib/exp/holidays'

// Local-date helper. Months are 1-based here for readability; the function
// itself receives a Date constructed in local time.
const d = (y, m, day) => new Date(y, m - 1, day)

describe('getHolidayMultiplier', () => {
  describe('Tier 1 — major (×1.5)', () => {
    test("New Year's Day (Jan 1)", () => {
      expect(getHolidayMultiplier(d(2026, 1, 1), null)).toBe(1.5)
    })
    test('Christmas (Dec 25)', () => {
      expect(getHolidayMultiplier(d(2026, 12, 25), null)).toBe(1.5)
    })
    test('User birthday', () => {
      expect(getHolidayMultiplier(d(2026, 6, 15), '1990-06-15')).toBe(1.5)
    })
    test('User birthday in a different year', () => {
      expect(getHolidayMultiplier(d(2030, 6, 15), '1990-06-15')).toBe(1.5)
    })
  })

  describe('Tier 2 — feast (×1.0)', () => {
    test('Independence Day (Jul 4)', () => {
      expect(getHolidayMultiplier(d(2026, 7, 4), null)).toBe(1.0)
    })
    test('Thanksgiving 2026 (4th Thu Nov = Nov 26)', () => {
      expect(getHolidayMultiplier(d(2026, 11, 26), null)).toBe(1.0)
    })
    test('Thanksgiving 2027 (4th Thu Nov = Nov 25)', () => {
      expect(getHolidayMultiplier(d(2027, 11, 25), null)).toBe(1.0)
    })
  })

  describe('Tier 3 — federal (×0.5) — 2026 dates', () => {
    test('MLK Day (3rd Mon Jan 2026 = Jan 19)', () => {
      expect(getHolidayMultiplier(d(2026, 1, 19), null)).toBe(0.5)
    })
    test("Presidents' Day (3rd Mon Feb 2026 = Feb 16)", () => {
      expect(getHolidayMultiplier(d(2026, 2, 16), null)).toBe(0.5)
    })
    test('Memorial Day (last Mon May 2026 = May 25)', () => {
      expect(getHolidayMultiplier(d(2026, 5, 25), null)).toBe(0.5)
    })
    test('Juneteenth (Jun 19)', () => {
      expect(getHolidayMultiplier(d(2026, 6, 19), null)).toBe(0.5)
    })
    test('Labor Day (1st Mon Sep 2026 = Sep 7)', () => {
      expect(getHolidayMultiplier(d(2026, 9, 7), null)).toBe(0.5)
    })
    test('Columbus Day (2nd Mon Oct 2026 = Oct 12)', () => {
      expect(getHolidayMultiplier(d(2026, 10, 12), null)).toBe(0.5)
    })
    test('Veterans Day (Nov 11)', () => {
      expect(getHolidayMultiplier(d(2026, 11, 11), null)).toBe(0.5)
    })
  })

  describe('Non-holiday days return 0', () => {
    test('Mid-March', () => {
      expect(getHolidayMultiplier(d(2026, 3, 15), null)).toBe(0)
    })
    test('Mid-August', () => {
      expect(getHolidayMultiplier(d(2026, 8, 8), null)).toBe(0)
    })
    test('Day before MLK Day 2026', () => {
      expect(getHolidayMultiplier(d(2026, 1, 18), null)).toBe(0)
    })
    test('Day after MLK Day 2026', () => {
      expect(getHolidayMultiplier(d(2026, 1, 20), null)).toBe(0)
    })
  })

  describe('DOB undefined / null', () => {
    test('Holiday-by-date checks still fire', () => {
      expect(getHolidayMultiplier(d(2026, 12, 25), undefined)).toBe(1.5)
      expect(getHolidayMultiplier(d(2026, 7, 4), null)).toBe(1.0)
      expect(getHolidayMultiplier(d(2026, 1, 19), undefined)).toBe(0.5)
    })
    test('Birthday returns 0 (no DOB to match)', () => {
      expect(getHolidayMultiplier(d(2026, 6, 15), undefined)).toBe(0)
      expect(getHolidayMultiplier(d(2026, 6, 15), null)).toBe(0)
    })
  })

  describe('Stacking — higher tier wins, no addition', () => {
    test('Birthday on Christmas → 1.5 (not 3.0, not 2.5)', () => {
      expect(getHolidayMultiplier(d(2026, 12, 25), '1990-12-25')).toBe(1.5)
    })
    test('Birthday on a Tier-3 day → 1.5 (Tier 1 wins over Tier 3)', () => {
      // 2026 Memorial Day = May 25
      expect(getHolidayMultiplier(d(2026, 5, 25), '1990-05-25')).toBe(1.5)
    })
    test("Birthday on New Year's Day → 1.5", () => {
      expect(getHolidayMultiplier(d(2026, 1, 1), '1990-01-01')).toBe(1.5)
    })
  })

  describe('Feb 29 leap-year birthday — rollback to Feb 28 in non-leap years', () => {
    test('Feb 29 of a leap year fires the bonus', () => {
      expect(getHolidayMultiplier(d(2024, 2, 29), '2000-02-29')).toBe(1.5)
    })
    test('Feb 28 of a non-leap year fires the rollback bonus', () => {
      expect(getHolidayMultiplier(d(2026, 2, 28), '2000-02-29')).toBe(1.5)
    })
    test('Feb 28 of a non-leap year (different year) also fires', () => {
      expect(getHolidayMultiplier(d(2025, 2, 28), '2000-02-29')).toBe(1.5)
    })
    test('Feb 28 of a LEAP year is a normal day (bonus fires Feb 29 instead)', () => {
      expect(getHolidayMultiplier(d(2024, 2, 28), '2000-02-29')).toBe(0)
    })
    test('Mar 1 of a non-leap year is a normal day (rollback goes back, not forward)', () => {
      expect(getHolidayMultiplier(d(2026, 3, 1), '2000-02-29')).toBe(0)
    })
    test('Non-Feb-29 DOB does NOT trigger Feb 28 rollback', () => {
      // DOB Mar 5 must not accidentally trigger on Feb 28 of any year.
      expect(getHolidayMultiplier(d(2026, 2, 28), '1990-03-05')).toBe(0)
    })
    test('Year 2000 (leap, century-divisible-by-400) — Feb 29 fires', () => {
      expect(getHolidayMultiplier(d(2000, 2, 29), '1980-02-29')).toBe(1.5)
    })
    test('Year 2100 (non-leap, century-not-divisible-by-400) — Feb 28 rollback fires', () => {
      expect(getHolidayMultiplier(d(2100, 2, 28), '2000-02-29')).toBe(1.5)
    })
  })
})
