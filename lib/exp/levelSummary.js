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
  let totalXP = 0, stars = 0, starredSets = 0
  let heavy = 0, overload = 0, fresh = 0, power = 0
  let biggest = null

  for (const s of sets) {
    const xp = Number(s.totalXP) || 0
    totalXP += xp
    const name = s.exerciseName || 'UNKNOWN'
    byExercise[name] = (byExercise[name] || 0) + xp
    const setStars = Array.isArray(s.regionStars) ? s.regionStars.reduce((a, b) => a + b, 0) : 0
    stars += setStars
    if (setStars > 0) starredSets++
    if ((Number(s.heavyLiftBonus) || 0) > 0) heavy++
    if (s.statusQuoKind === 'climb') overload++
    if (s.statusQuoKind === 'fresh') fresh++
    if (s.classification === 'king_compound') power++
    if (!biggest || xp > biggest.xp) biggest = { name, xp }
  }

  const consistency = list.find(e => e?.type === 'consistency-credit')
  const consistencyXP = Number(consistency?.value) || 0
  const top = Object.entries(byExercise).sort((a, b) => b[1] - a[1])[0]

  // Day rank (S/A/B/C/D): quality of the day that produced the level,
  // normalized by day size so short and long days grade fairly.
  //   40% star rate      — fraction of sets at genuine working weight
  //   20% bonus rate     — fraction earning OVERLOAD / NEW CYCLE
  //   15% heavy rate     — fraction firing HEAVY LIFT
  //   25% completion     — consistency credit landed (100% day)
  const n = sets.length
  const score =
      0.40 * (starredSets / n)
    + 0.20 * ((overload + fresh) / n)
    + 0.15 * (heavy / n)
    + 0.25 * (consistencyXP > 0 ? 1 : 0)
  const rank = score >= 0.8 ? 'S' : score >= 0.6 ? 'A' : score >= 0.4 ? 'B' : score >= 0.2 ? 'C' : 'D'

  return {
    rank,
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
