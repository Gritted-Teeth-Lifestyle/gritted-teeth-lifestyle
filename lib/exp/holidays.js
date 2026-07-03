// R16 holiday multiplier — local-machine date check, no server roundtrip.
//
// Three tiers:
//   1.5  user birthday, New Year's Day, Christmas
//   1.0  Independence Day, Thanksgiving
//   0.5  MLK Day, Presidents' Day, Memorial Day, Juneteenth, Labor Day,
//        Columbus Day, Veterans Day
//
// Stacking: if two trigger on the same day (e.g., birthday on Christmas),
// the higher tier wins — no addition.
//
// userDOB is an ISO date string `'YYYY-MM-DD'` (read via
// `getUserDOB()` from `lib/userPrefs.js` — app-level, not profile-scoped)
// or null/undefined to skip the birthday check.
//
// Feb 29 birthday rollback (per blocker resolution
// dispatches/blockers/gtl2_leap_year_birthday.md):
// a Feb 29 DOB triggers on Feb 29 in leap years, and rolls back to Feb 28
// in non-leap years. Feb 28 of a leap year is a normal day for Feb 29
// DOB-havers — the bonus fires on Feb 29 itself.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

// Returns the date of the Nth weekday of a given month/year.
// weekday: 0=Sun ... 6=Sat. n: 1-based ordinal.
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return 1 + offset + (n - 1) * 7
}

// Returns the date of the LAST given weekday in a month/year.
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(year, month + 1, 0)
  const offset = (last.getDay() - weekday + 7) % 7
  return last.getDate() - offset
}

function parseDOB(userDOB) {
  if (userDOB == null) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(userDOB))
  if (!m) return null
  return { month: parseInt(m[2], 10) - 1, day: parseInt(m[3], 10) }
}

export function getHolidayMultiplier(date, userDOB) {
  const year = date.getFullYear()
  const month = date.getMonth() // 0-11
  const day = date.getDate()

  const dob = parseDOB(userDOB)
  const isBirthday = dob != null && dob.month === month && dob.day === day
  // Feb 29 DOB rolls back to Feb 28 in non-leap years.
  const isFeb29Rollback =
    dob != null &&
    dob.month === 1 && dob.day === 29 &&
    month === 1 && day === 28 &&
    !isLeapYear(year)

  // Tier 1 — major (×1.5)
  if (isBirthday || isFeb29Rollback) return 1.5
  if (month === 0 && day === 1) return 1.5     // New Year's Day
  if (month === 11 && day === 25) return 1.5    // Christmas

  // Tier 2 — feast (×1.0)
  if (month === 6 && day === 4) return 1.0      // Independence Day
  if (month === 10 && day === nthWeekdayOfMonth(year, 10, 4, 4)) return 1.0  // Thanksgiving (4th Thu Nov)

  // Tier 3 — federal (×0.5)
  if (month === 0 && day === nthWeekdayOfMonth(year, 0, 1, 3)) return 0.5    // MLK Day (3rd Mon Jan)
  if (month === 1 && day === nthWeekdayOfMonth(year, 1, 1, 3)) return 0.5    // Presidents' Day (3rd Mon Feb)
  if (month === 4 && day === lastWeekdayOfMonth(year, 4, 1)) return 0.5      // Memorial Day (last Mon May)
  if (month === 5 && day === 19) return 0.5     // Juneteenth
  if (month === 8 && day === nthWeekdayOfMonth(year, 8, 1, 1)) return 0.5    // Labor Day (1st Mon Sep)
  if (month === 9 && day === nthWeekdayOfMonth(year, 9, 1, 2)) return 0.5    // Columbus Day (2nd Mon Oct)
  if (month === 10 && day === 11) return 0.5    // Veterans Day

  return 0
}
