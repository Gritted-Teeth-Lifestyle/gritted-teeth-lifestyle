import { describe, test, expect } from 'vitest'
import { ALL_EXERCISES, getExerciseById } from '../lib/exerciseLibrary'

describe('getExerciseById', () => {
  test('known id returns the entry', () => {
    const e = getExerciseById('BENCH PRESS')
    expect(e).toBeDefined()
    expect(e.id).toBe('BENCH PRESS')
  })

  test('returns canonical entry with matching id and same field surface', () => {
    const id = ALL_EXERCISES[0].id
    const looked = getExerciseById(id)
    expect(looked.id).toBe(ALL_EXERCISES[0].id)
    expect(looked.equipment).toBe(ALL_EXERCISES[0].equipment)
    expect(looked.heavy_lift_threshold).toBe(ALL_EXERCISES[0].heavy_lift_threshold)
    expect(looked.primaryMuscles).toEqual(ALL_EXERCISES[0].primaryMuscles)
  })

  test('unknown id returns undefined', () => {
    expect(getExerciseById('NOT A REAL EXERCISE')).toBeUndefined()
  })

  test('library contains 263 entries (post-R10 curation)', () => {
    expect(ALL_EXERCISES.length).toBe(263)
  })

  test('every entry has primaryMuscles + heavy_lift_threshold', () => {
    for (const e of ALL_EXERCISES) {
      expect(Array.isArray(e.primaryMuscles)).toBe(true)
      expect(typeof e.heavy_lift_threshold).toBe('number')
    }
  })
})
