// R2/R3 — per-day XP snapshot store.
//
// One key per day per cycle: pk('xpLog-{cycleId}-{iso}') → Snapshot[].
// Append-only. Snapshots are computed by lib/exp/setXP.calculateSetXP and
// also include {type: 'consistency-credit'} entries appended at end-of-day
// reckoning (R8a).
//
// computeTotalXP and stats-page region aggregator sum from this store
// with a legacy fallback path for days that have raw reps/weights but no
// snapshot entries (pre-existing data carrying through).
//
// localStorage isn't transactional. For single-tab single-user PWA usage
// the read-modify-write pattern is acceptable; multi-tab races are out of
// scope per the plan's accepted-risk note.

import { pk } from '../storage'

function logKey(cycleId, iso) {
  return pk(`xpLog-${cycleId}-${iso}`)
}

function safeRead(key) {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_) {
    return []
  }
}

export function readSetLogForDay(cycleId, iso) {
  if (!cycleId || !iso) return []
  return safeRead(logKey(cycleId, iso))
}

// Append a snapshot to the day's log. Snapshot may be a per-set entry
// (type: 'set') or a per-day reckoning entry (type: 'consistency-credit').
export function appendSetLog(cycleId, iso, snapshot) {
  if (typeof window === 'undefined') return
  if (!cycleId || !iso || !snapshot) return
  const key = logKey(cycleId, iso)
  const list = safeRead(key)
  list.push(snapshot)
  try { localStorage.setItem(key, JSON.stringify(list)) } catch (_) {}
}

// Upsert a per-set snapshot keyed by (exerciseName, setIndex). Re-edits
// of the same set replace prior snapshots rather than double-crediting.
// Snapshot must carry .exerciseName and .setIndex fields for the dedup
// to match.
export function upsertSetSnapshot(cycleId, iso, snapshot) {
  if (typeof window === 'undefined') return
  if (!cycleId || !iso || !snapshot) return
  const key = logKey(cycleId, iso)
  const list = safeRead(key).filter(e =>
    !(e?.type === 'set' &&
      e?.exerciseName === snapshot.exerciseName &&
      e?.setIndex === snapshot.setIndex))
  list.push(snapshot)
  try { localStorage.setItem(key, JSON.stringify(list)) } catch (_) {}
}

// Replace any existing 'consistency-credit' entry for the day with the
// given snapshot. Idempotent — a re-stamp doesn't double-credit.
export function replaceConsistencyCredit(cycleId, iso, snapshot) {
  if (typeof window === 'undefined') return
  if (!cycleId || !iso || !snapshot) return
  const key = logKey(cycleId, iso)
  const list = safeRead(key).filter(e => e?.type !== 'consistency-credit')
  list.push(snapshot)
  try { localStorage.setItem(key, JSON.stringify(list)) } catch (_) {}
}

// Sum totalXP across the day's snapshots. Includes consistency-credit's
// 'value' field (per R8a — the deferred contribution lands as one
// snapshot entry with {value} rather than {totalXP}).
export function sumDayXP(cycleId, iso) {
  const list = readSetLogForDay(cycleId, iso)
  let total = 0
  for (const s of list) {
    if (s?.type === 'consistency-credit') {
      if (Number.isFinite(s.value)) total += s.value
    } else if (Number.isFinite(s?.totalXP)) {
      total += s.totalXP
    }
  }
  return total
}

// Sum per-region XP across the day's snapshots — uses snapshot.totalXP
// distributed by snapshot.regionWeights, GATED on the set having earned
// stars. Consistency-credit entries are distributed proportionally to the
// per-region XP from those starred sets; if no starred set snapshots
// exist for the day, the consistency credit doesn't bind to any region.
//
// Stars gate region EXP (Jordan, 2026-07-18): a region only absorbs work
// from sets heavy enough to earn stars (relative load >= 75% of the
// exercise's heavy-lift threshold). Sub-floor sets still pay full profile
// EXP — they just don't move the transmutation circle. Stars ARE the
// indicator of region gain: no stars, no region flow.
export function sumDayRegionXP(cycleId, iso) {
  const list = readSetLogForDay(cycleId, iso)
  const regionXP = [0, 0, 0, 0, 0]
  let consistencyCredit = 0
  let starredSetXP = 0
  for (const s of list) {
    if (s?.type === 'consistency-credit') {
      if (Number.isFinite(s.value)) consistencyCredit += s.value
      continue
    }
    if (!Number.isFinite(s?.totalXP)) continue
    if (!s.earnsStars) continue
    starredSetXP += s.totalXP
    const w = Array.isArray(s.regionWeights) ? s.regionWeights : null
    if (!w) continue
    for (let i = 0; i < 5; i++) {
      regionXP[i] += s.totalXP * (w[i] || 0)
    }
  }
  // Distribute consistency_credit proportionally to per-region starred
  // setXP totals.
  if (consistencyCredit > 0 && starredSetXP > 0) {
    for (let i = 0; i < 5; i++) {
      regionXP[i] += consistencyCredit * (regionXP[i] / starredSetXP)
    }
  }
  return regionXP
}

// True if the day has at least one set snapshot in the log.
export function hasSnapshots(cycleId, iso) {
  return readSetLogForDay(cycleId, iso).some(s => s?.type === 'set')
}

// Day-star recap source (DayStarRecap cinematic): group the day's set
// snapshots by exercise, in first-logged order, summing regionStars.
// Starless exercises are included (the roll call renders them dim) —
// they show the user which work was too light to move a region.
// Returns [{ name, stars: number[5], starred: boolean }].
export function groupDayStarsByExercise(cycleId, iso) {
  const list = readSetLogForDay(cycleId, iso)
  const order = []
  const byName = new Map()
  for (const s of list) {
    if (s?.type !== 'set') continue
    const name = s.exerciseName || 'UNKNOWN'
    if (!byName.has(name)) {
      byName.set(name, { name, stars: [0, 0, 0, 0, 0], starred: false })
      order.push(name)
    }
    const entry = byName.get(name)
    const stars = Array.isArray(s.regionStars) ? s.regionStars : null
    if (!stars) continue
    for (let i = 0; i < 5; i++) {
      entry.stars[i] += Number.isFinite(stars[i]) ? stars[i] : 0
    }
    if (entry.stars.some(n => n > 0)) entry.starred = true
  }
  return order.map(n => byName.get(n))
}

// Legacy XP recompute for one day (used as fallback when setLog is empty
// for that day but raw reps/weight exist). Mirrors the pre-Wave-1 reduce
// inline in computeTotalXP — `weight × repMult × reps` (or rep-only when
// weight is 0). Imported lazily to avoid a static circular dep.
function legacyDayXP(cycle, iso) {
  if (typeof window === 'undefined') return 0
  let xp = 0
  // Inline repMult since static-importing from setXP would chain back.
  const repMult = (r) => {
    if (r >= 5 && r <= 15) return 1.0
    if (r < 5) return Math.exp(-Math.pow(r - 5, 2) / 8)
    return Math.exp(-Math.pow(r - 15, 2) / 32)
  }
  for (const muscleId of (cycle.dailyPlan?.[iso] || [])) {
    const rRaw = localStorage.getItem(pk(`ex-${cycle.id}-${iso}-${muscleId}`))
    const wRaw = localStorage.getItem(pk(`wt-${cycle.id}-${iso}-${muscleId}`))
    const rData = rRaw ? JSON.parse(rRaw) : {}
    const wData = wRaw ? JSON.parse(wRaw) : {}
    for (const name of Object.keys(rData)) {
      const rArr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
      const wArr = Array.isArray(wData[name]) ? wData[name] : [wData[name] || 0]
      for (let i = 0; i < rArr.length; i++) {
        const reps = rArr[i] || 0
        const weight = wArr[i] || 0
        if (reps === 0) continue
        const mult = repMult(reps)
        xp += weight > 0 ? weight * mult * reps : reps * mult
      }
    }
  }
  // Match the /100 display scale used by calculateSetXP for snapshots.
  return xp / 100
}

// Per-day XP total — same prefer-snapshot, fall-back-to-legacy resolution
// as computeProfileTotalXP, but for a single (cycle, iso) pair. Used by
// the cycle-overview particle animation.
export function dayXPWithFallback(cycle, iso) {
  if (typeof window === 'undefined' || !cycle || !iso) return 0
  if (hasSnapshots(cycle.id, iso)) return sumDayXP(cycle.id, iso)
  return legacyDayXP(cycle, iso)
}

// Walks all cycles in pk('cycles'), sums totalXP per stamped day. Per
// day: prefers setLog snapshots if any 'set' entries exist (R2 multiplier
// stack already folded in), otherwise falls back to the legacy raw-reps
// recompute (so pre-existing data renders without forced backfill).
export function computeProfileTotalXP() {
  if (typeof window === 'undefined') return { xp: 0, totalDays: 0 }
  try {
    const raw = localStorage.getItem(pk('cycles'))
    if (!raw) return { xp: 0, totalDays: 0 }
    const allCycles = JSON.parse(raw)
    let xp = 0
    let totalDays = 0
    for (const cycle of allCycles) {
      if (!cycle.days || !cycle.dailyPlan) continue
      totalDays += cycle.days.length
      for (const iso of cycle.days) {
        if (localStorage.getItem(pk(`done-${cycle.id}-${iso}`)) !== 'true') continue
        if (hasSnapshots(cycle.id, iso)) {
          xp += sumDayXP(cycle.id, iso)
        } else {
          xp += legacyDayXP(cycle, iso)
        }
      }
    }
    return { xp, totalDays }
  } catch (_) {
    return { xp: 0, totalDays: 0 }
  }
}

// Per-cycle stats for the stats page: totalXP + per-region XP +
// daysCompleted + per-cycle xp/completed counts. Mirrors the legacy
// loadStats reduce, but uses setLog (when populated per day) plus the
// legacy fallback. Returns undefined for any cycle field the caller
// doesn't need; counts are always populated.
export function computeProfileStats(MUSCLE_TO_REGION) {
  if (typeof window === 'undefined') {
    return { totalXP: 0, cycles: 0, daysScheduled: 0, daysCompleted: 0, regionXP: [0,0,0,0,0], cycleLog: [] }
  }
  try {
    const raw = localStorage.getItem(pk('cycles'))
    if (!raw) return { totalXP: 0, cycles: 0, daysScheduled: 0, daysCompleted: 0, regionXP: [0,0,0,0,0], cycleLog: [] }
    const allCycles = JSON.parse(raw)
    let totalXP = 0
    let daysScheduled = 0
    let daysCompleted = 0
    const regionXP = [0, 0, 0, 0, 0]
    const cycleStats = []
    for (const cycle of allCycles) {
      if (!cycle.days || !cycle.dailyPlan) continue
      daysScheduled += cycle.days.length
      let cycleDone = 0
      let cycleXP = 0
      for (const iso of cycle.days) {
        const done = localStorage.getItem(pk(`done-${cycle.id}-${iso}`)) === 'true'
        if (!done) continue
        daysCompleted++
        cycleDone++
        if (hasSnapshots(cycle.id, iso)) {
          const dayXP = sumDayXP(cycle.id, iso)
          cycleXP += dayXP
          totalXP += dayXP
          const dayRegions = sumDayRegionXP(cycle.id, iso)
          for (let i = 0; i < 5; i++) regionXP[i] += dayRegions[i]
        } else {
          // Legacy fallback: per-day raw reps/weights, distributed via the
          // 1:1 muscle→region map carried in MUSCLE_TO_REGION (passed in
          // so stats and active routes can pick the right map vintage).
          let xpForDay = 0
          for (const muscleId of (cycle.dailyPlan[iso] || [])) {
            const rRaw = localStorage.getItem(pk(`ex-${cycle.id}-${iso}-${muscleId}`))
            const wRaw = localStorage.getItem(pk(`wt-${cycle.id}-${iso}-${muscleId}`))
            const rData = rRaw ? JSON.parse(rRaw) : {}
            const wData = wRaw ? JSON.parse(wRaw) : {}
            for (const name of Object.keys(rData)) {
              const rArr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
              const wArr = Array.isArray(wData[name]) ? wData[name] : [wData[name] || 0]
              for (let i = 0; i < rArr.length; i++) {
                const reps = rArr[i] || 0
                const weight = wArr[i] || 0
                if (reps === 0) continue
                const mult = (reps >= 5 && reps <= 15) ? 1.0
                  : reps < 5 ? Math.exp(-Math.pow(reps - 5, 2) / 8)
                  : Math.exp(-Math.pow(reps - 15, 2) / 32)
                // /100 display scale matches calculateSetXP snapshots so
                // legacy-day totals are comparable with snapshot-day totals.
                const earned = (weight > 0 ? weight * mult * reps : reps * mult) / 100
                const ri = MUSCLE_TO_REGION?.[muscleId]
                if (ri !== undefined && regionXP[ri] !== undefined) regionXP[ri] += earned
                cycleXP += earned
                totalXP += earned
                xpForDay += earned
              }
            }
          }
        }
      }
      cycleStats.push({
        id:        cycle.id,
        name:      cycle.name,
        scheduled: cycle.days.length,
        completed: cycleDone,
        xp:        cycleXP,
        createdAt: cycle.createdAt || null,
      })
    }
    return { totalXP, cycles: allCycles.length, daysScheduled, daysCompleted, regionXP, cycleLog: cycleStats }
  } catch (_) {
    return { totalXP: 0, cycles: 0, daysScheduled: 0, daysCompleted: 0, regionXP: [0,0,0,0,0], cycleLog: [] }
  }
}
