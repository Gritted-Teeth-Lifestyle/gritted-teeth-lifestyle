import { describe, test, expect, beforeEach } from 'vitest'
import { computeDailyReckoning } from '../../lib/exp/dailyReckoning'
import { upsertSetSnapshot } from '../../lib/exp/setLog'
import { tickTier } from '../../lib/exp/tierStore'

function installLocalStorage() {
  const store = new Map()
  const ls = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
  globalThis.window = { localStorage: ls }
  globalThis.localStorage = ls
}

beforeEach(() => {
  installLocalStorage()
  localStorage.setItem('gtl-active-profile', 'test')
})

const CYCLE_ID = 'cyc1'
const ISO = '2026-05-08'

// Seed: 1 muscle ('chest') × DEFAULT_SETS_PER_EXERCISE (2) = 2 planned sets.
function seedDay({ logged = 0, baseXP = 0 } = {}) {
  const dailyPlan = { [ISO]: ['chest'] }
  // Logged reps — fill `logged` non-zero entries on a single exercise.
  const reps = { 'BENCH PRESS': Array(Math.max(2, logged)).fill(0) }
  for (let i = 0; i < logged; i++) reps['BENCH PRESS'][i] = 10
  localStorage.setItem('gtl-test-ex-' + CYCLE_ID + '-' + ISO + '-chest', JSON.stringify(reps))
  // baseXP per snapshot — emulate set snapshots so sumDayBaseXP is non-zero.
  for (let i = 0; i < logged && baseXP > 0; i++) {
    upsertSetSnapshot(CYCLE_ID, ISO, {
      type: 'set', ts: i,
      exerciseName: 'BENCH PRESS', setIndex: i,
      reps: 10, weight: 135,
      baseXP, totalXP: baseXP * 1.5,
      regionWeights: [0, 0, 0, 1, 0],
      regionStars: [0, 0, 0, 0, 0],
      earnsStars: false,
      classification: 'compound',
    })
  }
  return dailyPlan
}

describe('computeDailyReckoning', () => {
  test('zero planned (no muscles) → 0 credit, no tick', () => {
    const r = computeDailyReckoning(CYCLE_ID, ISO, { [ISO]: [] })
    expect(r.completion_pct).toBe(0)
    expect(r.consistency_credit).toBe(0)
    expect(r.shouldTick).toBe(false)
  })

  test('< 50% completion → fizzle (0 credit, no tick)', () => {
    const dailyPlan = seedDay({ logged: 0, baseXP: 0 })
    // 2 planned, 0 logged → 0% completion → fizzle
    const r = computeDailyReckoning(CYCLE_ID, ISO, dailyPlan)
    expect(r.completion_pct).toBe(0)
    expect(r.consistency_credit).toBe(0)
    expect(r.shouldTick).toBe(false)
  })

  test('exactly 50% completion → linear partial credit, no tick', () => {
    const dailyPlan = seedDay({ logged: 1, baseXP: 1000 })
    // 2 planned, 1 logged → 50% completion → credit = baseXP × tierMult × 0.5
    const r = computeDailyReckoning(CYCLE_ID, ISO, dailyPlan)
    expect(r.completion_pct).toBeCloseTo(0.5, 5)
    // RELAXED tier (0 count) = 1.0; baseXP for one snapshot = 1000.
    expect(r.consistency_credit).toBeCloseTo(1000 * 1.0 * 0.5, 5)
    expect(r.shouldTick).toBe(false)
  })

  test('100% completion → full credit + shouldTick true', () => {
    const dailyPlan = seedDay({ logged: 2, baseXP: 1000 })
    const r = computeDailyReckoning(CYCLE_ID, ISO, dailyPlan)
    expect(r.completion_pct).toBeCloseTo(1.0, 5)
    // baseXP × tierMult × 1.0; sumDayBaseXP = 2 × 1000 = 2000.
    expect(r.consistency_credit).toBeCloseTo(2000 * 1.0 * 1.0, 5)
    expect(r.shouldTick).toBe(true)
  })

  test('R5a no-decay: tier multiplier reflects current counter', () => {
    // Tick the counter to PRESSED (count 9..11 → ×1.32). Use 11.
    for (let i = 0; i < 11; i++) tickTier()
    const dailyPlan = seedDay({ logged: 2, baseXP: 1000 })
    const r = computeDailyReckoning(CYCLE_ID, ISO, dailyPlan)
    expect(r.consistency_credit).toBeCloseTo(2000 * 1.32 * 1.0, 5)
  })

  test('logged > planned (over-logging) → completion clamped to 1.0', () => {
    const dailyPlan = seedDay({ logged: 5, baseXP: 1000 })  // 2 planned, 5 logged
    const r = computeDailyReckoning(CYCLE_ID, ISO, dailyPlan)
    expect(r.completion_pct).toBe(1.0)
    expect(r.shouldTick).toBe(true)
  })

  test('null cycleId → safe zero result', () => {
    const r = computeDailyReckoning(null, ISO, {})
    expect(r).toEqual({
      completion_pct: 0, consistency_credit: 0, shouldTick: false,
      sets_planned: 0, sets_logged: 0,
    })
  })
})
