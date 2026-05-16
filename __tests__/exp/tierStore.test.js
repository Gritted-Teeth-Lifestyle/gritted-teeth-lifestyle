import { describe, test, expect, beforeEach } from 'vitest'
import {
  getTierCount,
  getRibbonCount,
  isPrestigeUnlocked,
  tickTier,
  awardRibbon,
  resetTierForAscend,
} from '../../lib/exp/tierStore'

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

describe('tier counter (R5a)', () => {
  test('starts at 0', () => {
    expect(getTierCount()).toBe(0)
    expect(getRibbonCount()).toBe(0)
    expect(isPrestigeUnlocked()).toBe(false)
  })

  test('tickTier increments by 1', () => {
    expect(tickTier()).toBe(1)
    expect(tickTier()).toBe(2)
    expect(getTierCount()).toBe(2)
  })

  test('no decay — count never decreases', () => {
    for (let i = 0; i < 10; i++) tickTier()
    expect(getTierCount()).toBe(10)
    // Nothing in this module should decrease the counter outside of
    // ascend, which sets it to 0 explicitly.
  })
})

describe('prestige unlock (R9)', () => {
  test('unlocks at count = 120', () => {
    for (let i = 0; i < 119; i++) tickTier()
    expect(isPrestigeUnlocked()).toBe(false)
    tickTier()  // → 120
    expect(isPrestigeUnlocked()).toBe(true)
    expect(getTierCount()).toBe(120)
  })

  test('does NOT unlock at GRITTED (100) — needs +20 hold', () => {
    for (let i = 0; i < 100; i++) tickTier()
    expect(getTierCount()).toBe(100)
    expect(isPrestigeUnlocked()).toBe(false)
  })

  test('subsequent ticks above 120 do not flip flag back off', () => {
    for (let i = 0; i < 125; i++) tickTier()
    expect(isPrestigeUnlocked()).toBe(true)
  })
})

describe('awardRibbon (R9 ascend)', () => {
  test('blocks when prestige not unlocked', () => {
    for (let i = 0; i < 50; i++) tickTier()
    expect(awardRibbon()).toBeNull()
    expect(getRibbonCount()).toBe(0)
    expect(getTierCount()).toBe(50)  // unchanged
  })

  test('award flow: ribbon +1, tier reset to 0, flag cleared', () => {
    for (let i = 0; i < 120; i++) tickTier()
    expect(isPrestigeUnlocked()).toBe(true)
    const ribbons = awardRibbon()
    expect(ribbons).toBe(1)
    expect(getRibbonCount()).toBe(1)
    expect(getTierCount()).toBe(0)
    expect(isPrestigeUnlocked()).toBe(false)
  })

  test('ascend twice in succession requires re-climbing', () => {
    for (let i = 0; i < 120; i++) tickTier()
    awardRibbon()
    expect(awardRibbon()).toBeNull()  // not unlocked again
    for (let i = 0; i < 120; i++) tickTier()
    expect(awardRibbon()).toBe(2)
  })
})

describe('resetTierForAscend', () => {
  test('clears counter + flag without awarding a ribbon (escape hatch)', () => {
    for (let i = 0; i < 120; i++) tickTier()
    resetTierForAscend()
    expect(getTierCount()).toBe(0)
    expect(getRibbonCount()).toBe(0)  // NOT incremented
    expect(isPrestigeUnlocked()).toBe(false)
  })
})
