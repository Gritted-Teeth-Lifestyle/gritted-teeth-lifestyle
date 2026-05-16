import { describe, test, expect } from 'vitest'
import { getPrestigeMultiplier } from '../../lib/exp/prestige'

describe('getPrestigeMultiplier', () => {
  test('0 ribbons → 0', () => {
    expect(getPrestigeMultiplier(0)).toBe(0)
  })
  test('5 ribbons → 0.50', () => {
    expect(getPrestigeMultiplier(5)).toBeCloseTo(0.50, 5)
  })
  test('10 ribbons → 1.00', () => {
    expect(getPrestigeMultiplier(10)).toBeCloseTo(1.00, 5)
  })
  test('negative input → 0 (no decay)', () => {
    expect(getPrestigeMultiplier(-3)).toBe(0)
  })
  test('non-finite input → 0', () => {
    expect(getPrestigeMultiplier(NaN)).toBe(0)
    expect(getPrestigeMultiplier(undefined)).toBe(0)
  })
})
