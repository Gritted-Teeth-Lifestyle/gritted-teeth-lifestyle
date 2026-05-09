import { describe, test, expect } from 'vitest'
import { BODY_REGIONS, MUSCLE_TO_REGION, REGION_INDEX, regionWeights } from '../../lib/exp/regions'

describe('R10a dual-semantics MUSCLE_TO_REGION', () => {
  test('5 regions in canonical order CORE/ARMS/LEGS/FRONT/BACK', () => {
    expect(BODY_REGIONS.map(r => r.id)).toEqual(['core', 'arms', 'legs', 'front', 'back'])
  })

  test('upper-body torso semantics: chest → FRONT, back → BACK', () => {
    expect(MUSCLE_TO_REGION.chest).toBe(REGION_INDEX.front)
    expect(MUSCLE_TO_REGION.back).toBe(REGION_INDEX.back)
  })

  test('upper-body limb semantics: all delts + biceps + triceps + forearms → ARMS', () => {
    expect(MUSCLE_TO_REGION.shoulders).toBe(REGION_INDEX.arms)
    expect(MUSCLE_TO_REGION.biceps).toBe(REGION_INDEX.arms)
    expect(MUSCLE_TO_REGION.triceps).toBe(REGION_INDEX.arms)
    expect(MUSCLE_TO_REGION.forearms).toBe(REGION_INDEX.arms)
  })

  test('CORE = abs', () => {
    expect(MUSCLE_TO_REGION.abs).toBe(REGION_INDEX.core)
  })

  test('lower-body position semantics: quads → FRONT, hamstrings → BACK', () => {
    expect(MUSCLE_TO_REGION.quads).toBe(REGION_INDEX.front)
    expect(MUSCLE_TO_REGION.hamstrings).toBe(REGION_INDEX.back)
  })

  test('LEGS catch-all: glutes + calves', () => {
    expect(MUSCLE_TO_REGION.glutes).toBe(REGION_INDEX.legs)
    expect(MUSCLE_TO_REGION.calves).toBe(REGION_INDEX.legs)
  })
})

describe('regionWeights — 60/40 primary/secondary split', () => {
  test('bench press (chest primary; shoulders + triceps secondary) → FRONT 0.60 / ARMS 0.40', () => {
    const w = regionWeights({
      primaryMuscles: ['chest'],
      secondaryMuscles: ['shoulders', 'triceps'],
    })
    expect(w[REGION_INDEX.front]).toBeCloseTo(0.60, 5)
    expect(w[REGION_INDEX.arms]).toBeCloseTo(0.40, 5)
    expect(w[REGION_INDEX.core]).toBe(0)
    expect(w[REGION_INDEX.legs]).toBe(0)
    expect(w[REGION_INDEX.back]).toBe(0)
  })

  test('barbell squat (quads primary; glutes + back secondary) → FRONT 0.60 / LEGS 0.20 / BACK 0.20', () => {
    const w = regionWeights({
      primaryMuscles: ['quads'],
      secondaryMuscles: ['glutes', 'back'],
    })
    expect(w[REGION_INDEX.front]).toBeCloseTo(0.60, 5)
    expect(w[REGION_INDEX.legs]).toBeCloseTo(0.20, 5)
    expect(w[REGION_INDEX.back]).toBeCloseTo(0.20, 5)
  })

  test('deadlifts (back primary; glutes + hamstrings + abs secondary) → BACK ~0.733 / LEGS ~0.133 / CORE ~0.133', () => {
    const w = regionWeights({
      primaryMuscles: ['back'],
      secondaryMuscles: ['glutes', 'hamstrings', 'abs'],
    })
    // back = 0.6 (primary) + 0.4/3 (hamstrings → BACK per R10a)
    expect(w[REGION_INDEX.back]).toBeCloseTo(0.60 + 0.40 / 3, 5)
    expect(w[REGION_INDEX.legs]).toBeCloseTo(0.40 / 3, 5)
    expect(w[REGION_INDEX.core]).toBeCloseTo(0.40 / 3, 5)
  })

  test('isolation (single primary, no secondary) → primary owns 100%', () => {
    const w = regionWeights({
      primaryMuscles: ['biceps'],
      secondaryMuscles: [],
    })
    expect(w[REGION_INDEX.arms]).toBeCloseTo(1.0, 5)
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1.0, 5)
  })

  test('weights sum to 1.0 for any non-empty exercise', () => {
    const w = regionWeights({
      primaryMuscles: ['chest', 'triceps'],
      secondaryMuscles: ['shoulders', 'forearms'],
    })
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1.0, 5)
  })

  test('empty exercise → all zeros', () => {
    expect(regionWeights({ primaryMuscles: [], secondaryMuscles: [] })).toEqual([0, 0, 0, 0, 0])
    expect(regionWeights(null)).toEqual([0, 0, 0, 0, 0])
    expect(regionWeights(undefined)).toEqual([0, 0, 0, 0, 0])
  })
})
