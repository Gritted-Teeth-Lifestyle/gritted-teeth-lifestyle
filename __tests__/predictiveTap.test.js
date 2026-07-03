import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'

// ── Environment shims ────────────────────────────────────────────────────────
// vitest runs in 'node'; predictiveTap needs window (+ its pointerdown
// listener install at module load), sessionStorage, and performance.now.
// Shims go up BEFORE the dynamic import so module-load side effects land
// on them. Captured listeners let tests fire synthetic taps directly.

let fakeNow = 0                      // performance.now clock (ms)
const listeners = { pointerdown: [], touchstart: [] }

function installShims() {
  const sessionStore = new Map()
  const sessionStorage = {
    getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
  }
  const windowShim = {
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) },
    removeEventListener: (type, fn) => {
      const arr = listeners[type] || []
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    },
  }
  globalThis.window = windowShim
  globalThis.sessionStorage = sessionStorage
  windowShim.sessionStorage = sessionStorage
  globalThis.performance = { now: () => fakeNow }
}

// Synthetic tap through the module's captured pointerdown listener.
// Coordinates default to inside the canonical hit-zone (y 466..562).
function tap({ x = 195, y = 500, retreat = false } = {}) {
  const target = { closest: (sel) => (retreat && sel === '[data-retreat]' ? {} : null) }
  for (const fn of listeners.pointerdown.slice()) {
    fn({ clientX: x, clientY: y, target })
  }
}

// Advance both clocks so SAME_TAP_DEDUP_MS (Date.now) and the grace timer
// (performance.now) stay in sync, like real time passing.
function elapse(ms) {
  fakeNow += ms
  vi.setSystemTime(Date.now() + ms)
}

let pt // module exports

function readQueue() {
  const raw = sessionStorage.getItem('gtl-predictive-tap-prefire')
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed?.queue) ? parsed.queue : parsed?.target ? [parsed.target] : []
}

function state() {
  return window.__gtlPredictiveTap
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000_000)
  installShims()
  pt = await import('../lib/predictiveTap')
})

beforeEach(() => {
  // Full reset between tests: disarm clears queue + transient state +
  // freshness marker; drop any leftover registered handlers via the
  // unregister fns tests capture themselves.
  pt.disarmChain('test-reset')
  sessionStorage.clear()
  elapse(60_000) // far from any freshness/TTL window of the prior test
})

// ── Staging (queue) ──────────────────────────────────────────────────────────

describe('staging', () => {
  test('rapid in-zone taps during an anim stage successive hops in order', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap(); elapse(50)
    tap(); elapse(50)
    tap()
    expect(readQueue()).toEqual(['hub-load', 'activate', 'today'])
  })

  test('taps with inAnim=false stage nothing', () => {
    pt.armChain()
    tap()
    expect(readQueue()).toEqual([])
  })

  test('queue saturates at the terminal step — no hop after muscle', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    for (let i = 0; i < 6; i++) { tap(); elapse(50) }
    expect(readQueue()).toEqual(['hub-load', 'activate', 'today', 'muscle'])
  })

  test('out-of-zone taps stage nothing', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap({ y: 100 })
    expect(readQueue()).toEqual([])
  })

  test('paired pointer events within the dedup window count once', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap(); elapse(10); tap() // same physical tap, 10ms apart
    expect(readQueue()).toEqual(['hub-load'])
  })
})

// ── Consume ──────────────────────────────────────────────────────────────────

describe('consumePrefire', () => {
  function stage(n) {
    pt.armChain()
    pt.setInAnimation('profile', true)
    for (let i = 0; i < n; i++) { tap(); elapse(50) }
  }

  test('pops the head on match and eagerly opens the anim window', () => {
    stage(2) // [hub-load, activate]
    const intent = pt.consumePrefire('hub-load')
    expect(intent?.target).toBe('hub-load')
    expect(readQueue()).toEqual(['activate'])
    expect(state().inAnim).toBe(true)
    expect(state().currentStep).toBe('hub-load')
  })

  test('mismatch is a silent no-op — queue preserved', () => {
    stage(2) // [hub-load, activate]
    expect(pt.consumePrefire('activate')).toBeNull()
    expect(readQueue()).toEqual(['hub-load', 'activate'])
  })

  test('empty queue returns null', () => {
    expect(pt.consumePrefire('hub-load')).toBeNull()
  })

  test('TTL expiry drops the whole queue', () => {
    stage(3)
    elapse(11_000)
    expect(pt.consumePrefire('hub-load')).toBeNull()
    expect(readQueue()).toEqual([])
  })

  test('legacy single-intent shape is migrated', () => {
    sessionStorage.setItem('gtl-predictive-tap-prefire',
      JSON.stringify({ target: 'today', ts: Date.now() }))
    expect(pt.consumePrefire('today')?.target).toBe('today')
    expect(readQueue()).toEqual([])
  })
})

// ── isPendingChainHead ───────────────────────────────────────────────────────

describe('isPendingChainHead', () => {
  test('true only for the queue head, false when empty or expired', () => {
    expect(pt.isPendingChainHead('today')).toBe(false)
    pt.armChain()
    pt.setInAnimation('activate', true)
    tap() // stages 'today'
    expect(pt.isPendingChainHead('today')).toBe(true)
    expect(pt.isPendingChainHead('muscle')).toBe(false)
    elapse(11_000)
    expect(pt.isPendingChainHead('today')).toBe(false)
  })
})

// ── clearChainTransient freshness guard ──────────────────────────────────────

describe('clearChainTransient', () => {
  test('skips when consume matched this step milliseconds ago (StrictMode re-run)', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap() // stage hub-load
    pt.consumePrefire('hub-load')        // eager-open + freshness mark
    elapse(20)                            // StrictMode re-run gap
    pt.clearChainTransient('hub-mount', 'hub-load')
    expect(state().inAnim).toBe(true)     // NOT clobbered
    expect(state().currentStep).toBe('hub-load')
  })

  test('clears when the consume is stale (real navigation, not a re-run)', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap()
    pt.consumePrefire('hub-load')
    elapse(2_000)                         // long past CONSUME_FRESH_MS
    pt.clearChainTransient('hub-mount', 'hub-load')
    expect(state().inAnim).toBe(false)
    expect(state().currentStep).toBeNull()
  })

  test('regression: state left by a manual hop does NOT satisfy the guard', () => {
    // Old shape-based guard bug: [iso] hopped to the terminal via
    // setInAnimation('muscle', true) (no consume). Retreat back to [iso]
    // re-ran clear('iso-mount', 'muscle') and the shape matched, so stale
    // inAnim survived navigation forever. Freshness guard: no recent
    // consume for 'muscle' → clear runs.
    pt.armChain()
    pt.setInAnimation('muscle', true)     // manual hop, not a consume
    elapse(500)
    pt.clearChainTransient('iso-mount', 'muscle')
    expect(state().inAnim).toBe(false)
    expect(state().currentStep).toBeNull()
  })

  test('running the clear resets the freshness marker', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap()
    pt.consumePrefire('hub-load')
    elapse(2_000)
    pt.clearChainTransient('a', 'hub-load')  // clears + resets marker
    pt.setInAnimation('hub-load', true)      // new manual state
    elapse(20)
    pt.clearChainTransient('b', 'hub-load')  // marker gone → must clear
    expect(state().inAnim).toBe(false)
  })
})

// ── disarmChain ──────────────────────────────────────────────────────────────

describe('disarmChain', () => {
  test('terminal disarm releases queue, transient state, and freshness', () => {
    pt.armChain()
    pt.setInAnimation('profile', true)
    tap(); elapse(50); tap()
    pt.consumePrefire('hub-load')
    pt.disarmChain('muscle-terminal')
    expect(readQueue()).toEqual([])
    expect(state().inAnim).toBe(false)
    expect(state().currentStep).toBeNull()
    // freshness marker reset → a guarded clear right after must still clear
    pt.setInAnimation('hub-load', true)
    elapse(20)
    pt.clearChainTransient('after-disarm', 'hub-load')
    expect(state().inAnim).toBe(false)
  })
})

// ── Skip-route (grace + retreat + single-fire) ───────────────────────────────

describe('skip-route', () => {
  test('taps within grace do not route; past grace routes exactly once', () => {
    const route = vi.fn()
    const unregister = pt.registerChainStep('profile', route)
    pt.armChain()
    pt.setInAnimation('profile', true)

    elapse(100)
    tap()                                  // 100ms < 350ms grace
    expect(route).not.toHaveBeenCalled()

    elapse(400)
    tap()                                  // past grace → route
    expect(route).toHaveBeenCalledTimes(1)

    elapse(400)
    tap()                                  // HT state cleared by first fire
    expect(route).toHaveBeenCalledTimes(1)
    unregister()
  })

  test('retreat taps never skip-route', () => {
    const route = vi.fn()
    const unregister = pt.registerChainStep('profile', route)
    pt.armChain()
    pt.setInAnimation('profile', true)
    elapse(400)
    tap({ y: 700, retreat: true })
    expect(route).not.toHaveBeenCalled()
    unregister()
  })
})
