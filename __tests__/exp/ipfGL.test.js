import { describe, test, expect } from 'vitest'
import { ipfGL, bodyweightNormFactor, IPF_GL_PARAMS, REFERENCE_BW, LB_TO_KG } from '../../lib/exp/ipfGL'

describe('ipfGL formula', () => {
  test('returns finite positive value at reference bodyweight', () => {
    const ref_kg = REFERENCE_BW * LB_TO_KG
    const v = ipfGL(ref_kg, IPF_GL_PARAMS.male)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThan(0)
  })

  test('saturates at heavy bodyweight without throwing', () => {
    const v = ipfGL(500 * LB_TO_KG, IPF_GL_PARAMS.male)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThan(0)
  })

  test('finite at near-zero bodyweight', () => {
    const v = ipfGL(0.1, IPF_GL_PARAMS.male)
    expect(Number.isFinite(v)).toBe(true)
  })
})

describe('bodyweightNormFactor — male', () => {
  test('returns ~1.000 at REFERENCE_BW (180 lb)', () => {
    expect(bodyweightNormFactor(180, 'm')).toBeCloseTo(1.000, 3)
  })

  // Spec sample table values (R1a) vs locked-formula output:
  // The brainstorm's sample table has approximate / hand-tuned values
  // (e.g., 100 lb → "1.299") that don't match the literal IPF GL formula
  // output (which gives ~1.366 at 100 lb under the locked male params
  // a/b/c = 1199.72839 / 1025.18162 / 0.00921). The DO NOT list forbids
  // changing the formula or its constants, so the formula is the source
  // of truth and the sample table is illustrative. These tests pin the
  // actual formula output across the ranges of interest.

  test('boosts light user at 100 lb (formula output)', () => {
    expect(bodyweightNormFactor(100, 'm')).toBeCloseTo(1.366, 2)
    expect(bodyweightNormFactor(100, 'm')).toBeGreaterThan(1.0)
  })

  test('boosts 145 lb user (formula output)', () => {
    expect(bodyweightNormFactor(145, 'm')).toBeGreaterThan(1.0)
    expect(bodyweightNormFactor(145, 'm')).toBeLessThan(1.20)
  })

  test('reduces 200 lb user (formula output)', () => {
    expect(bodyweightNormFactor(200, 'm')).toBeLessThan(1.0)
    expect(bodyweightNormFactor(200, 'm')).toBeGreaterThan(0.92)
  })

  test('reduces 300 lb user (formula output)', () => {
    expect(bodyweightNormFactor(300, 'm')).toBeLessThan(0.85)
    expect(bodyweightNormFactor(300, 'm')).toBeGreaterThan(0.70)
  })

  test('monotonic decrease from light to heavy', () => {
    const light = bodyweightNormFactor(100, 'm')
    const ref   = bodyweightNormFactor(180, 'm')
    const heavy = bodyweightNormFactor(300, 'm')
    expect(light).toBeGreaterThan(ref)
    expect(ref).toBeGreaterThan(heavy)
  })
})

describe('bodyweightNormFactor — female', () => {
  test('returns ~1.000 at REFERENCE_BW for female params', () => {
    expect(bodyweightNormFactor(180, 'f')).toBeCloseTo(1.000, 3)
  })

  test('female and male curves diverge at light/heavy weights', () => {
    expect(bodyweightNormFactor(120, 'm')).not.toBeCloseTo(bodyweightNormFactor(120, 'f'), 2)
  })
})

describe('bodyweightNormFactor — sex default', () => {
  test('defaults to male when sex omitted', () => {
    expect(bodyweightNormFactor(200)).toBe(bodyweightNormFactor(200, 'm'))
  })
})
