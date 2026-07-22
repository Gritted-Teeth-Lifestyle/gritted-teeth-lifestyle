// Level-up results-card summary (Jordan's spec 2026-07-21): when a day's
// EXP pushes the bar over a level, the card shows where that EXP came
// from. Scope = the day that closed (its sets are what filled the bar).
//
// Reads the day's setLog snapshots — every field here already exists on
// the snapshots written by calculateSetXP; this is pure aggregation.

import { readSetLogForDay } from './setLog'

export function summarizeDayForLevelCard(cycleId, iso) {
  let list = []
  try { list = readSetLogForDay(cycleId, iso) } catch (_) { return null }
  const sets = list.filter(e => e?.type === 'set')
  if (!sets.length) return null

  const byExercise = {}
  let totalXP = 0, stars = 0
  let heavy = 0, overload = 0, fresh = 0, power = 0
  let biggest = null

  for (const s of sets) {
    const xp = Number(s.totalXP) || 0
    totalXP += xp
    const name = s.exerciseName || 'UNKNOWN'
    byExercise[name] = (byExercise[name] || 0) + xp
    if (Array.isArray(s.regionStars)) stars += s.regionStars.reduce((a, b) => a + b, 0)
    if ((Number(s.heavyLiftBonus) || 0) > 0) heavy++
    if (s.statusQuoKind === 'climb') overload++
    if (s.statusQuoKind === 'fresh') fresh++
    if (s.classification === 'king_compound') power++
    if (!biggest || xp > biggest.xp) biggest = { name, xp }
  }

  const consistency = list.find(e => e?.type === 'consistency-credit')
  const consistencyXP = Number(consistency?.value) || 0
  const top = Object.entries(byExercise).sort((a, b) => b[1] - a[1])[0]

  return {
    totalXP: totalXP + consistencyXP,
    setCount: sets.length,
    exerciseCount: Object.keys(byExercise).length,
    topExercise: top ? { name: top[0], xp: top[1] } : null,
    biggestSet: biggest,
    stars,
    heavy,        // sets that fired HEAVY LIFT
    overload,     // sets that earned the OVERLOAD bonus
    fresh,        // sets that earned the NEW CYCLE bonus
    power,        // power-lift-class sets
    consistencyXP,
  }
}
