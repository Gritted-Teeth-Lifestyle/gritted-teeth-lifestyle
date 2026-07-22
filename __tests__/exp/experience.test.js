import { describe, test, expect, beforeEach } from 'vitest'
import {
  EXPERIENCE_TIERS,
  EXPERIENCE_BANDS,
  countTrainingDays,
  getClaimedExperience,
  setClaimedExperience,
  earnedExperienceTier,
  getEffectiveExperience,
  getExperienceBands,
} from '../../lib/exp/experience'
import { assessSet } from '../../lib/exp/statusQuo'

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
  localStorage.setItem('gtl-active-profile', 'test')
})

describe('claimed experience storage', () => {
  test('unset reads null', () => {
    expect(getClaimedExperience()).toBe(null)
  })

  test('round-trips a valid tier, rejects junk', () => {
    setClaimedExperience('months')
    expect(getClaimedExperience()).toBe('months')
    setClaimedExperience('immortal')
    expect(getClaimedExperience()).toBe('months')
  })

  test('is profile-scoped', () => {
    setClaimedExperience('decades')
    localStorage.setItem('gtl-active-profile', 'other')
    expect(getClaimedExperience()).toBe(null)
  })
})

describe('earned tier from day count', () => {
  test('thresholds: 10 → weeks, 40 → months, 150 → years', () => {
    expect(earnedExperienceTier(0)).toBe('days')
    expect(earnedExperienceTier(9)).toBe('days')
    expect(earnedExperienceTier(10)).toBe('weeks')
    expect(earnedExperienceTier(39)).toBe('weeks')
    expect(earnedExperienceTier(40)).toBe('months')
    expect(earnedExperienceTier(149)).toBe('months')
    expect(earnedExperienceTier(150)).toBe('years')
    expect(earnedExperienceTier(10000)).toBe('years') // decades is claim-only
  })
})

describe('effective experience', () => {
  test('unset claim defaults to years (original system)', () => {
    expect(getEffectiveExperience()).toBe('years')
  })

  test('claim wins while earned is lower', () => {
    setClaimedExperience('days')
    expect(getEffectiveExperience()).toBe('days')
  })

  test('earned overtakes a lower claim', () => {
    setClaimedExperience('days')
    // 12 distinct training dates → earned 'weeks'
    for (let d = 1; d <= 12; d++) {
      const iso = `2026-07-${String(d).padStart(2, '0')}`
      localStorage.setItem(`gtl-test-xpLog-cycleA-${iso}`, '[]')
    }
    expect(countTrainingDays()).toBe(12)
    expect(getEffectiveExperience()).toBe('weeks')
  })

  test('decades claim is never lowered by earned', () => {
    setClaimedExperience('decades')
    expect(getEffectiveExperience()).toBe('decades')
  })
})

describe('per-tier bands in assessSet', () => {
  // Barbell squat-ish exercise: threshold 1.5 × BW 200 → standard 300.
  const exercise = { id: 'sq', heavy_lift_threshold: 1.5, equipment: 'barbell' }
  const bw = 200
  const assess = (tier, { weight, reps = 1, provenBest = null }) =>
    assessSet({ exercise, weight, reps, bodyweight: bw, provenBest, bands: getExperienceBands(tier) })

  test('every tier id has a bands row', () => {
    for (const t of EXPERIENCE_TIERS) expect(EXPERIENCE_BANDS[t]).toBeTruthy()
  })

  test('years reproduces the original system', () => {
    // claim 2.0 → reject
    expect(assess('years', { weight: 600 }).kind).toBe('reject')
    // claim just above standard, jump beyond 1.3 → mild tax
    const taxed = assess('years', { weight: 310, provenBest: 200 })
    expect(taxed.kind).toBe('tax')
    expect(taxed.mult).toBe(0.75)
    // gradual climb above standard → believed
    expect(assess('years', { weight: 310, provenBest: 290 }).kind).not.toBe('tax')
  })

  test('beginner ceiling is far lower', () => {
    // claim ≈ 1.33 — fine for years, rejected for days (reject 1.3)
    expect(assess('years', { weight: 400 }).kind).not.toBe('reject')
    expect(assess('days', { weight: 400 }).kind).toBe('reject')
  })

  test('beginner jump forgiveness: doubling is untaxed on days tier', () => {
    // est 250 vs proven 130 → jump ≈ 1.92, claim ≈ 0.86 (above days taxStart 0.7)
    expect(assess('days', { weight: 250, provenBest: 130 }).kind).not.toBe('tax')
    expect(assess('years', { weight: 250, provenBest: 130 }).kind).not.toBe('tax') // below years taxStart
    expect(assess('months', { weight: 290, provenBest: 130 }).kind).not.toBe('reject')
  })

  test('days tier taxes sub-standard claims past its taxStart', () => {
    // claim ≈ 0.86 ≥ days taxStart 0.7, jump > 2.0 → taxed
    const a = assess('days', { weight: 250, provenBest: 110 })
    expect(a.kind).toBe('tax')
    expect(a.mult).toBe(0.75)
  })

  test('decades taxes big jumps even below the standard', () => {
    // claim ≈ 0.86 (honest zone for every other tier), jump ≈ 1.25 > 1.15
    const a = assess('decades', { weight: 250, provenBest: 200 })
    expect(a.kind).toBe('tax')
    expect(a.mult).toBe(0.75)
    expect(assess('years', { weight: 250, provenBest: 200 }).kind).not.toBe('tax')
  })

  test('decades below-standard tax needs a proven record', () => {
    // first-ever session, below standard → no jump to judge, no tax
    expect(assess('decades', { weight: 250, provenBest: null }).kind).not.toBe('tax')
  })

  test('no bands param falls back to years behavior', () => {
    const a = assessSet({ exercise, weight: 310, reps: 1, bodyweight: bw, provenBest: 200 })
    expect(a.kind).toBe('tax')
    expect(a.mult).toBe(0.75)
  })
})
