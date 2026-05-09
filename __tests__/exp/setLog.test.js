import { describe, test, expect, beforeEach } from 'vitest'
import {
  appendSetLog,
  upsertSetSnapshot,
  replaceConsistencyCredit,
  readSetLogForDay,
  sumDayXP,
  sumDayRegionXP,
  hasSnapshots,
  dayXPWithFallback,
  computeProfileTotalXP,
  computeProfileStats,
} from '../../lib/exp/setLog'
import { MUSCLE_TO_REGION } from '../../lib/exp/regions'

// Minimal localStorage shim — vitest's default 'node' environment has no
// window/localStorage. We install one so the helpers' window guard passes
// and the in-memory store is observable across calls.
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
  return ls
}

beforeEach(() => {
  installLocalStorage()
  // pk() reads gtl-active-profile; set one so keys are deterministic.
  localStorage.setItem('gtl-active-profile', 'test')
})

const CYCLE_ID = 'cyc1'
const ISO = '2026-05-08'

const sampleSnapshot = (over = {}) => ({
  type: 'set',
  ts: 1,
  reps: 10, weight: 135,
  rawBase: 1350, baseXP: 1350,
  totalXP: 2025,
  regionWeights: [0, 0, 0, 1.0, 0],   // FRONT 1.0
  regionStars: [0, 0, 0, 1, 0],
  earnsStars: true,
  classification: 'compound',
  ...over,
})

describe('appendSetLog + readSetLogForDay', () => {
  test('append + read returns array', () => {
    appendSetLog(CYCLE_ID, ISO, sampleSnapshot())
    const list = readSetLogForDay(CYCLE_ID, ISO)
    expect(list.length).toBe(1)
    expect(list[0].totalXP).toBe(2025)
  })
  test('returns [] for empty / unknown day', () => {
    expect(readSetLogForDay(CYCLE_ID, '2099-01-01')).toEqual([])
  })
  test('corrupt JSON → []', () => {
    localStorage.setItem('gtl-test-xpLog-' + CYCLE_ID + '-' + ISO, '{not json')
    expect(readSetLogForDay(CYCLE_ID, ISO)).toEqual([])
  })
})

describe('upsertSetSnapshot — re-edit dedup', () => {
  test('same (exerciseName, setIndex) replaces prior snapshot', () => {
    const a = sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 })
    const b = sampleSnapshot({ totalXP: 200, exerciseName: 'BENCH', setIndex: 0 })
    upsertSetSnapshot(CYCLE_ID, ISO, a)
    upsertSetSnapshot(CYCLE_ID, ISO, b)
    const list = readSetLogForDay(CYCLE_ID, ISO).filter(e => e.type === 'set')
    expect(list.length).toBe(1)
    expect(list[0].totalXP).toBe(200)
  })
  test('different setIndex stays separate', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 }))
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 200, exerciseName: 'BENCH', setIndex: 1 }))
    expect(readSetLogForDay(CYCLE_ID, ISO).filter(e => e.type === 'set').length).toBe(2)
  })
  test('different exerciseName stays separate', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 }))
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 200, exerciseName: 'CURL', setIndex: 0 }))
    expect(readSetLogForDay(CYCLE_ID, ISO).filter(e => e.type === 'set').length).toBe(2)
  })
})

describe('sumDayXP', () => {
  test('sums set snapshots', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 }))
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 200, exerciseName: 'BENCH', setIndex: 1 }))
    expect(sumDayXP(CYCLE_ID, ISO)).toBe(300)
  })
  test('includes consistency-credit value', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 }))
    appendSetLog(CYCLE_ID, ISO, { type: 'consistency-credit', ts: 2, value: 50 })
    expect(sumDayXP(CYCLE_ID, ISO)).toBe(150)
  })
})

describe('replaceConsistencyCredit — idempotent re-stamp', () => {
  test('re-stamp replaces prior credit, doesn’t double-count', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({ totalXP: 100, exerciseName: 'BENCH', setIndex: 0 }))
    replaceConsistencyCredit(CYCLE_ID, ISO, { type: 'consistency-credit', ts: 1, value: 50 })
    replaceConsistencyCredit(CYCLE_ID, ISO, { type: 'consistency-credit', ts: 2, value: 80 })
    expect(sumDayXP(CYCLE_ID, ISO)).toBe(180)   // 100 + 80, NOT 100+50+80
  })
})

describe('sumDayRegionXP', () => {
  test('distributes set totalXP via regionWeights', () => {
    // FRONT 0.6 + ARMS 0.4, totalXP 1000
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({
      exerciseName: 'BENCH', setIndex: 0,
      totalXP: 1000, regionWeights: [0, 0.4, 0, 0.6, 0],
    }))
    const r = sumDayRegionXP(CYCLE_ID, ISO)
    expect(r[3]).toBeCloseTo(600, 5)  // FRONT
    expect(r[1]).toBeCloseTo(400, 5)  // ARMS
  })
  test('consistency-credit redistributes proportionally', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({
      exerciseName: 'BENCH', setIndex: 0,
      totalXP: 1000, regionWeights: [0, 0.4, 0, 0.6, 0],
    }))
    appendSetLog(CYCLE_ID, ISO, { type: 'consistency-credit', ts: 2, value: 200 })
    const r = sumDayRegionXP(CYCLE_ID, ISO)
    // base FRONT 600, ARMS 400. consistency 200 distributed 60/40:
    // FRONT +120, ARMS +80.
    expect(r[3]).toBeCloseTo(720, 5)
    expect(r[1]).toBeCloseTo(480, 5)
  })
})

describe('hasSnapshots', () => {
  test('false when only consistency-credit present', () => {
    appendSetLog(CYCLE_ID, ISO, { type: 'consistency-credit', ts: 1, value: 50 })
    expect(hasSnapshots(CYCLE_ID, ISO)).toBe(false)
  })
  test('true when at least one set snapshot present', () => {
    appendSetLog(CYCLE_ID, ISO, sampleSnapshot())
    expect(hasSnapshots(CYCLE_ID, ISO)).toBe(true)
  })
})

describe('dayXPWithFallback + computeProfileTotalXP — legacy fallback path', () => {
  // Build a cycle with one stamped day. Day has raw reps/weights but no
  // setLog snapshots → legacy fallback fires.
  beforeEach(() => {
    const cycle = {
      id: CYCLE_ID, name: 'TEST', days: [ISO],
      dailyPlan: { [ISO]: ['chest'] },
      createdAt: '2026-05-08T00:00:00Z',
    }
    localStorage.setItem('gtl-test-cycles', JSON.stringify([cycle]))
    localStorage.setItem('gtl-test-done-' + CYCLE_ID + '-' + ISO, 'true')
    localStorage.setItem(
      'gtl-test-ex-' + CYCLE_ID + '-' + ISO + '-chest',
      JSON.stringify({ 'BENCH PRESS': [10] }),
    )
    localStorage.setItem(
      'gtl-test-wt-' + CYCLE_ID + '-' + ISO + '-chest',
      JSON.stringify({ 'BENCH PRESS': [135] }),
    )
  })

  test('legacy day → 1350 XP (135 × 1.0 × 10)', () => {
    expect(dayXPWithFallback({ id: CYCLE_ID, dailyPlan: { [ISO]: ['chest'] } }, ISO)).toBeCloseTo(1350, 5)
  })

  test('snapshot day overrides legacy', () => {
    upsertSetSnapshot(CYCLE_ID, ISO, sampleSnapshot({
      exerciseName: 'BENCH PRESS', setIndex: 0, totalXP: 9999,
    }))
    expect(dayXPWithFallback({ id: CYCLE_ID, dailyPlan: { [ISO]: ['chest'] } }, ISO)).toBe(9999)
  })

  test('computeProfileTotalXP picks the right path per day', () => {
    const result = computeProfileTotalXP()
    expect(result.totalDays).toBe(1)
    expect(result.xp).toBeCloseTo(1350, 5)
  })

  test('computeProfileStats produces region XP via legacy 1:1 map', () => {
    const stats = computeProfileStats(MUSCLE_TO_REGION)
    expect(stats.daysCompleted).toBe(1)
    expect(stats.totalXP).toBeCloseTo(1350, 5)
    // muscle 'chest' under R10a → FRONT (index 3).
    expect(stats.regionXP[3]).toBeCloseTo(1350, 5)
  })
})
