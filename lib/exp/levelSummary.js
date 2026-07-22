// Level-up results-card summary (Jordan's spec 2026-07-21): when a day's
// EXP pushes the bar over a level, the card shows where that EXP came
// from. Scope = the day that closed (its sets are what filled the bar).
//
// Reads the day's setLog snapshots — every field here already exists on
// the snapshots written by calculateSetXP; this is pure aggregation.

import { readSetLogForDay } from './setLog'
import { est1RM, getProvenBest } from './statusQuo'
import { getExerciseById } from '../exerciseLibrary'
import { pk } from '../storage'

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
  // "Available EXP" is PERSONAL (Jordan's model): every lift has a
  // maximum attainable EXP once a proven record exists — what the same
  // set would have paid at the lifter's own record. Per logged set:
  //   potential = setXP ÷ tax (a taxed set's loss counts as forfeited)
  //             × max(1, provenBest / est-1RM of the set)
  // So an honest beginner at their edge is at 100% efficiency, and an
  // exercise with no record yet has potential = actual (a first session
  // can't leave anything on the table). Missed planned sets forfeit the
  // day's average per-set potential.
  const n = sets.length
  const completionRate = Number(consistency?.completion_pct) || 0
  const missedSets = Math.max(0, (Number(consistency?.sets_planned) || n) - (Number(consistency?.sets_logged) || n))

  let userBW = 0
  try { userBW = parseInt(localStorage.getItem(pk('user-bodyweight')), 10) || 0 } catch (_) {}

  let totalPotential = 0
  for (const s of sets) {
    const xp = Number(s.totalXP) || 0
    // Untax first: a set that lied paid a plausibility toll — that loss
    // is EXP left on the table too.
    const sq = Number(s.statusQuoMult) || 1
    let potential = sq > 0 && sq < 1 ? xp / sq : xp
    const proven = getProvenBest(s.exerciseName)
    if (proven) {
      let load = Number(s.weight) || 0
      const ex = getExerciseById(s.exerciseName)
      if (ex?.equipment === 'bodyweight' && userBW > 0) {
        load = (ex.bw_coefficient ?? 1.0) * userBW + load
      }
      const est = est1RM(load, s.reps)
      if (est > 0) potential *= Math.max(1, proven / est)
    }
    totalPotential += Math.max(potential, xp)
  }
  const avgPotential = totalPotential / n
  const leftOnTable = Math.max(0, totalPotential - totalXP) + missedSets * avgPotential

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
