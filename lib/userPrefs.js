'use client'
/**
 * App-level user preferences (not profile-scoped).
 *
 * These are things tied to the human, not the save slot — currently just
 * the user's date of birth. Birthday holiday EXP should fire regardless of
 * which warrior is active, so we promote DOB out of `gtl-{profile}-user-dob`
 * up to the app-level key `gtl-user-dob`.
 *
 * Includes a lazy one-time migration that scans `gtl-{profile}-user-dob` for
 * every known profile, takes the first non-null value, writes it to the
 * app-level key, and deletes the per-profile copies. Runs at most once per
 * module load; idempotent on subsequent calls.
 */

const APP_DOB_KEY = 'gtl-user-dob'
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

let _migrated = false

function migrateAppLevelDOB() {
  if (_migrated) return
  _migrated = true
  if (typeof window === 'undefined') return
  try {
    // If app-level key is already set, nothing to migrate.
    if (localStorage.getItem(APP_DOB_KEY) != null) return

    const rawList = localStorage.getItem('gtl-profiles')
    if (!rawList) return
    let profiles
    try { profiles = JSON.parse(rawList) } catch { return }
    if (!Array.isArray(profiles) || profiles.length === 0) return

    let found = null
    for (const p of profiles) {
      if (!p) continue
      let v = null
      try { v = localStorage.getItem(`gtl-${p}-user-dob`) } catch (_) { continue }
      if (v && ISO_RE.test(v)) { found = v; break }
    }
    if (found) {
      try { localStorage.setItem(APP_DOB_KEY, found) } catch (_) {}
    }
    // Clean up legacy per-profile keys whether or not we found a value —
    // they're no longer the source of truth.
    for (const p of profiles) {
      if (!p) continue
      try { localStorage.removeItem(`gtl-${p}-user-dob`) } catch (_) {}
    }
  } catch (_) {}
}

export function getUserDOB() {
  if (typeof window === 'undefined') return null
  migrateAppLevelDOB()
  try {
    const v = localStorage.getItem(APP_DOB_KEY)
    return v && ISO_RE.test(v) ? v : null
  } catch {
    return null
  }
}

export function setUserDOB(iso) {
  if (typeof window === 'undefined') return
  migrateAppLevelDOB()
  try {
    if (iso == null) {
      localStorage.removeItem(APP_DOB_KEY)
    } else if (ISO_RE.test(iso)) {
      localStorage.setItem(APP_DOB_KEY, iso)
    }
  } catch (_) {}
}
