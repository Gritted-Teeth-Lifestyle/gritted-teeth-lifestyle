// Profile-scoped store of user-typed custom exercises, keyed by muscle.
// Anything submitted via the picker's + (or auto-flushed on ATTUNE) is
// remembered here so the same name surfaces at the top of the picker
// next time the user opens it for that muscle.
//
// Shape:  { [muscleId]: string[] }    insertion-ordered, dedup'd.
// Storage: pk('custom-exercises').

import { pk } from './storage'

const KEY = 'custom-exercises'

function read() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(pk(KEY))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (_) { return {} }
}

function write(map) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(pk(KEY), JSON.stringify(map)) } catch (_) {}
}

// Return the unique list of custom-exercise names recorded against ANY
// of the supplied muscles. Order: per-muscle insertion order, with
// later muscles' names appended after earlier ones' (dedup'd).
export function getCustomExercisesForMuscles(muscleIds) {
  if (!Array.isArray(muscleIds) || muscleIds.length === 0) return []
  const map = read()
  const seen = new Set()
  const out = []
  for (const m of muscleIds) {
    const list = map[m]
    if (!Array.isArray(list)) continue
    for (const name of list) {
      if (typeof name === 'string' && name && !seen.has(name)) {
        seen.add(name)
        out.push(name)
      }
    }
  }
  return out
}

// Record `name` under EVERY supplied muscleId. Idempotent — re-adding
// a name that's already there is a no-op.
export function addCustomExercise(name, muscleIds) {
  if (!name || typeof name !== 'string') return
  if (!Array.isArray(muscleIds) || muscleIds.length === 0) return
  const map = read()
  let changed = false
  for (const m of muscleIds) {
    if (!m || typeof m !== 'string') continue
    const list = map[m] || []
    if (!list.includes(name)) {
      map[m] = [...list, name]
      changed = true
    }
  }
  if (changed) write(map)
}

// Remove a custom name from a single muscle (or, if muscleId is null,
// from every muscle that records it). Used by a future delete affordance.
export function removeCustomExercise(name, muscleId = null) {
  if (!name) return
  const map = read()
  let changed = false
  for (const m of Object.keys(map)) {
    if (muscleId && m !== muscleId) continue
    const list = map[m] || []
    const next = list.filter((n) => n !== name)
    if (next.length !== list.length) {
      map[m] = next
      changed = true
    }
  }
  if (changed) write(map)
}
