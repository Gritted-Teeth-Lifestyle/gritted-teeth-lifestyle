import { describe, test, expect } from 'vitest'
import { repMult } from '../../lib/exp/repMult'

describe('repMult', () => {
  test('flat 1.0 across the [5, 15] plateau', () => {
    for (let r = 5; r <= 15; r++) {
      expect(repMult(r)).toBe(1.0)
    }
  })

  test('bell tail r < 5', () => {
    expect(repMult(4)).toBeCloseTo(Math.exp(-1 / 8), 10)
    expect(repMult(1)).toBeCloseTo(Math.exp(-16 / 8), 10)
  })

  test('bell tail r > 15', () => {
    expect(repMult(16)).toBeCloseTo(Math.exp(-1 / 32), 10)
    expect(repMult(20)).toBeCloseTo(Math.exp(-25 / 32), 10)
  })

  test('symmetric tail behavior at boundary', () => {
    expect(repMult(4)).toBeLessThan(1.0)
    expect(repMult(16)).toBeLessThan(1.0)
    // Slower r>15 tail decays slower than fast r<5 tail.
    expect(repMult(16)).toBeGreaterThan(repMult(4))
  })
})
