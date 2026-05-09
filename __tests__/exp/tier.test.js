import { describe, test, expect } from 'vitest'
import {
  TIER_NAMES,
  TIER_THRESHOLDS,
  TIER_MULTIPLIERS,
  getTier,
  getTierIndex,
  getTierMultiplier,
  getNextTierThreshold,
} from '../../lib/exp/tier'

describe('TIER constants', () => {
  test('21 tier names', () => {
    expect(TIER_NAMES.length).toBe(21)
  })
  test('first = RELAXED, last = GRITTED', () => {
    expect(TIER_NAMES[0]).toBe('RELAXED')
    expect(TIER_NAMES[20]).toBe('GRITTED')
  })
  test('TIER_THRESHOLDS aligned, monotonic, ends at 100', () => {
    expect(TIER_THRESHOLDS.length).toBe(21)
    expect(TIER_THRESHOLDS[0]).toBe(0)
    expect(TIER_THRESHOLDS[20]).toBe(100)
    for (let i = 1; i < TIER_THRESHOLDS.length; i++) {
      expect(TIER_THRESHOLDS[i]).toBeGreaterThan(TIER_THRESHOLDS[i - 1])
    }
  })
  test('TIER_MULTIPLIERS aligned, monotonic, ×1.00 → ×3.00', () => {
    expect(TIER_MULTIPLIERS.length).toBe(21)
    expect(TIER_MULTIPLIERS[0]).toBe(1.00)
    expect(TIER_MULTIPLIERS[20]).toBe(3.00)
    for (let i = 1; i < TIER_MULTIPLIERS.length; i++) {
      expect(TIER_MULTIPLIERS[i]).toBeGreaterThan(TIER_MULTIPLIERS[i - 1])
    }
  })
})

describe('getTier', () => {
  test('count 0 → RELAXED ×1.00', () => {
    expect(getTier(0)).toBe('RELAXED')
    expect(getTierMultiplier(0)).toBe(1.00)
  })
  test('count 1 → BRUSHED', () => {
    expect(getTier(1)).toBe('BRUSHED')
  })
  test('count 12 → SQUEEZED ×1.39 (cumulative threshold per R5b)', () => {
    // R5b: PRESSED → SQUEEZED at cumulative 12. So count=12 unlocks SQUEEZED.
    expect(getTier(12)).toBe('SQUEEZED')
    expect(getTierMultiplier(12)).toBe(1.39)
  })
  test('count 11 → PRESSED ×1.32 (just below SQUEEZED threshold)', () => {
    expect(getTier(11)).toBe('PRESSED')
    expect(getTierMultiplier(11)).toBe(1.32)
  })
  test('count 60 → HARDENED ×2.28', () => {
    expect(getTier(60)).toBe('HARDENED')
    expect(getTierMultiplier(60)).toBe(2.28)
  })
  test('count 90 → BLOODIED ×2.84', () => {
    expect(getTier(90)).toBe('BLOODIED')
    expect(getTierMultiplier(90)).toBe(2.84)
  })
  test('count 99 → BLOODIED (still below 100)', () => {
    expect(getTier(99)).toBe('BLOODIED')
  })
  test('count 100 → GRITTED ×3.00', () => {
    expect(getTier(100)).toBe('GRITTED')
    expect(getTierMultiplier(100)).toBe(3.00)
  })
  test('count > 100 stays at GRITTED (no decay)', () => {
    expect(getTier(150)).toBe('GRITTED')
    expect(getTier(1000)).toBe('GRITTED')
  })
  test('negative count clamped to RELAXED', () => {
    expect(getTier(-5)).toBe('RELAXED')
  })
})

describe('getNextTierThreshold', () => {
  test('count 0 → 1 (BRUSHED at threshold 1)', () => {
    expect(getNextTierThreshold(0)).toBe(1)
  })
  test('count 7 → 9 (PRIMED next at threshold 9)', () => {
    expect(getNextTierThreshold(7)).toBe(9)
  })
  test('count 99 → 100 (GRITTED at 100)', () => {
    expect(getNextTierThreshold(99)).toBe(100)
  })
  test('count 100 → null (at peak)', () => {
    expect(getNextTierThreshold(100)).toBeNull()
  })
  test('count 200 → null (beyond peak)', () => {
    expect(getNextTierThreshold(200)).toBeNull()
  })
})

describe('getTierIndex', () => {
  test('lookup by index returns correct name', () => {
    for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
      expect(getTierIndex(TIER_THRESHOLDS[i])).toBe(i)
    }
  })
})
