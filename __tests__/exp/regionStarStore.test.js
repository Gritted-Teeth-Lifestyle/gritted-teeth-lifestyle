import { describe, test, expect, beforeEach } from 'vitest'
import {
  getRegionStars,
  addRegionStars,
  resetRegionStars,
} from '../../lib/exp/regionStarStore'

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

describe('regionStarStore', () => {
  test('starts at [0,0,0,0,0]', () => {
    expect(getRegionStars()).toEqual([0, 0, 0, 0, 0])
  })

  test('addRegionStars accumulates elementwise', () => {
    addRegionStars([0, 0, 0, 1, 0])  // FRONT 1★
    addRegionStars([0, 1, 0, 1, 0])  // ARMS 1★ + FRONT 1★
    expect(getRegionStars()).toEqual([0, 1, 0, 2, 0])
  })

  test('king compound 3-star vector lands correctly', () => {
    // BACK 1★ + LEGS 1★ + CORE 1★ (deadlift King)
    addRegionStars([1, 0, 1, 0, 1])
    expect(getRegionStars()).toEqual([1, 0, 1, 0, 1])
  })

  test('isolation 2-star vector lands correctly', () => {
    addRegionStars([0, 2, 0, 0, 0])  // ARMS 2★
    expect(getRegionStars()).toEqual([0, 2, 0, 0, 0])
  })

  test('idempotent delta pattern: subtract prior + add new', () => {
    addRegionStars([0, 0, 0, 1, 0])           // initial save: FRONT 1★
    expect(getRegionStars()[3]).toBe(1)
    addRegionStars([0, 0, 0, -1, 0])          // re-edit cancels prior
    addRegionStars([0, 0, 0, 0, 1])           // and adds new BACK 1★
    expect(getRegionStars()).toEqual([0, 0, 0, 0, 1])
  })

  test('rejects malformed input (non-array, wrong length)', () => {
    addRegionStars([1, 0, 0, 0, 0])
    addRegionStars(null)
    addRegionStars([1, 2, 3])
    addRegionStars('bad')
    expect(getRegionStars()).toEqual([1, 0, 0, 0, 0])
  })

  test('non-finite delta entries treated as 0', () => {
    addRegionStars([1, 2, 3, 4, 5])
    addRegionStars([NaN, 1, undefined, 0, -2])
    expect(getRegionStars()).toEqual([1, 3, 3, 4, 3])
  })

  test('resetRegionStars zeros the store', () => {
    addRegionStars([1, 2, 3, 4, 5])
    resetRegionStars()
    expect(getRegionStars()).toEqual([0, 0, 0, 0, 0])
  })

  test('corrupt JSON in localStorage → returns zero vector', () => {
    localStorage.setItem('gtl-test-region-stars', 'not json')
    expect(getRegionStars()).toEqual([0, 0, 0, 0, 0])
  })
})
