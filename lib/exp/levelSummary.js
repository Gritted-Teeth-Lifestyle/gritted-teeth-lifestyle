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

  // Rank inputs: completion rate of the day's planned sets, and the
  // fraction of available EXP left on the table.
  //
  // "Left on the table" = what the missed and underloaded work would
  // have paid at this day's typical working-set rate:
  //   - each unlogged planned set forfeits one average starred-set XP
  //   - each starless (sub-working-weight) logged set forfeits the gap
  //     up to that average
  // Days with no starred sets price the gap at 1.5× the day's average
  // set — a rough "real work pays ~50% more" floor.
  const n = sets.length
  const completionRate = Number(consistency?.completion_pct) || 0
  const missedSets = Math.max(0, (Number(consistency?.sets_planned) || n) - (Number(consistency?.sets_logged) || n))

  const avgSetXP = totalXP / n
  let avgWorkingXP
  if (starredSets > 0) {
    let starredXP = 0
    for (const s of sets) {
      const setStars = Array.isArray(s.regionStars) ? s.regionStars.reduce((a, b) => a + b, 0) : 0
      if (setStars > 0) starredXP += Number(s.totalXP) || 0
    }
    avgWorkingXP = starredXP / starredSets
  } else {
    avgWorkingXP = avgSetXP * 1.5
  }

  let leftOnTable = missedSets * avgWorkingXP
  for (const s of sets) {
    const setStars = Array.isArray(s.regionStars) ? s.regionStars.reduce((a, b) => a + b, 0) : 0
    if (setStars === 0) leftOnTable += Math.max(0, avgWorkingXP - (Number(s.totalXP) || 0))
  }

  const earned = totalXP + consistencyXP
  const leftPct = leftOnTable / (earned + leftOnTable)   // fraction of available EXP forfeited

  // Two-gate grading (Jordan's spec): BOTH conditions are necessary —
  // the grade is whichever gate you fail lower. 50% completion with
  // nothing left on the table is still an F; 100% completion leaving
  // half the EXP behind is also an F.
  //   S: 100% completion AND ≤5% left    A: ≥90% AND ≤10%
  //   B: ≥80% AND ≤20%                   C: ≥70% AND ≤30%
  //   D: ≥60% AND ≤40%                   F: below either floor
  const rank =
      completionRate >= 1.0 && leftPct <= 0.05 ? 'S'
    : completionRate >= 0.9 && leftPct <= 0.10 ? 'A'
    : completionRate >= 0.8 && leftPct <= 0.20 ? 'B'
    : completionRate >= 0.7 && leftPct <= 0.30 ? 'C'
    : completionRate >= 0.6 && leftPct <= 0.40 ? 'D'
    : 'F'

  return {
    rank,
    leftOnTable,
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
