/**
 * predictiveTap — predictive tap-skip across the 5-button chain.
 *
 * The 5-button chain (profile → load-cycle → activate → today → muscle)
 * occupies the same screen rect on every step (per the geometry-unify
 * dispatch). When the user taps inside that shared rect during a
 * page-transition animation, this module fires the next page's
 * primary-button handler automatically — chaining the cascade forward
 * without a second tap. Tap-anywhere-else still skips reactively
 * (existing behavior, unchanged).
 *
 * State machine (module-level, window-scoped via __gtlPredictiveTap):
 *   armed     — true once the profile button has been tapped, false
 *               again after the muscle button fires (chain complete) or
 *               on a fresh profile tap (starts a new chain).
 *   hopIndex  — current position in the chain. Profile=0 starts the
 *               chain; the prefire window applies to hops 1..4.
 *   inAnim    — set true by the page during its outgoing animation,
 *               false on animation end. The hit-zone tap only counts
 *               as a prefire when inAnim is true.
 *
 * Prefire intent is staged in sessionStorage under PREFIRE_KEY so the
 * incoming page can read it synchronously on mount. Cleared on consume.
 *
 * Debugging: every decision (arm, disarm, hit, miss, prefire fired,
 * consumed) is console.log'd with a `[prefire]` prefix. Per Jordan's
 * decision (2026-05-02): no guard-bail behavior — if a guard redirects
 * the user away mid-chain, the URL change makes it visible. Bail logic
 * can be added later once the system is stable.
 */

const PREFIRE_KEY = 'gtl-predictive-tap-prefire'
const STATE_KEY   = '__gtlPredictiveTap'
// Stale-intent TTL — if the destination button doesn't mount within this
// window (e.g., user lands on /fitness/load with zero saved cycles, the
// ActivatePopup never appears, user walks away), the staged intent
// expires so a future visit doesn't unexpectedly auto-fire.
const PREFIRE_TTL_MS = 10000

// Chain step names. The cycle card on /fitness/load auto-selects on
// page render, so it's NOT a tap step — the chain skips it. Profile is
// the first tap (arms the chain); the four after it are predictive-skippable.
const CHAIN_ORDER = ['profile', 'hub-load', 'activate', 'today', 'muscle']

function chainIndex(stepName) {
  return CHAIN_ORDER.indexOf(stepName)
}

// Staging-event subscribers. Components mounted BEFORE their consume
// window opens (e.g., DayFocus subscribes for 'muscle' but the user
// taps to stage 'muscle' AFTER DayFocus already mounted) need a way
// to re-attempt consume when an intent gets staged. They subscribe
// here; the pointerdown handler notifies on stage.
const stageListeners = new Set()
export function subscribeStaged(fn) {
  stageListeners.add(fn)
  return () => stageListeners.delete(fn)
}
function notifyStaged(stepName) {
  for (const fn of stageListeners) {
    try { fn(stepName) } catch (_) {}
  }
}

function getState() {
  if (typeof window === 'undefined') return null
  if (!window[STATE_KEY]) {
    window[STATE_KEY] = {
      armed: false,
      hopIndex: -1,           // -1 = no chain active; 0 = profile fired
      inAnim: false,
      currentStep: null,      // step name of the page currently animating
      pointerHandler: null,   // installed window pointerdown listener
      touchHandler: null,     // installed window touchstart fallback (iOS)
      lastFireAt: 0,          // dedup so pointerdown+touchstart for one tap fires once
    }
  }
  return window[STATE_KEY]
}

// In-app log mirror — last N decisions kept in a ring buffer so a
// debug overlay can render them on iOS PWA where the dev console isn't
// reachable. Subscribers (the overlay component) re-render on each push.
const LOG_RING_SIZE = 16
const _logRing = []
const _logListeners = new Set()
export function subscribeLogs(fn) {
  _logListeners.add(fn)
  return () => _logListeners.delete(fn)
}
export function getRecentLogs() { return _logRing.slice() }

// External log entry — same ring buffer, so other modules (e.g. useSound)
// can surface diagnostics in the on-device overlay.
export function pushDebugLog(...args) { log(...args) }

function log(...args) {
  if (typeof window === 'undefined') return
  const line = args.map(a => typeof a === 'string' ? a : String(a)).join(' ')
  const entry = { ts: Date.now(), line }
  _logRing.push(entry)
  if (_logRing.length > LOG_RING_SIZE) _logRing.shift()
  for (const fn of _logListeners) {
    try { fn(entry) } catch (_) {}
  }
  // eslint-disable-next-line no-console
  console.log('[prefire]', ...args)
}

// ── Public API ──────────────────────────────────────────────────────────────

// armChain / disarmChain kept as no-ops so existing call sites compile,
// but the chain no longer has an "armed" concept. Predictive tap works
// always — gated only by inAnim (set by chain page transitions) and
// the canonical hit-zone test. The pointerdown listener installs on
// module load below and stays installed.
export function armChain() {
  const s = getState(); if (!s) return
  // Clear any leftover prefire intent — defensive, in case a prior
  // interrupted chain left something staged.
  try { sessionStorage.removeItem(PREFIRE_KEY) } catch (_) {}
  s.hopIndex = 0
  s.inAnim = false
  s.currentStep = null
  s.lastFireAt = 0
  log('arm (no-op gate): cleared stale intent + reset state')
}

export function disarmChain(reason = 'muscle-fired') {
  const s = getState(); if (!s) return
  s.hopIndex = -1
  s.inAnim = false
  s.currentStep = null
  try { sessionStorage.removeItem(PREFIRE_KEY) } catch (_) {}
  log(`disarm (no-op gate): ${reason}`)
}

/**
 * Called by each chain page when its outgoing animation begins. inAnim
 * is the only gate that matters now. Pointerdown handler stages the
 * next intent only when inAnim is true and the tap is in the canonical
 * hit-zone.
 */
export function setInAnimation(stepName, active) {
  const s = getState(); if (!s) return
  const idx = chainIndex(stepName)
  if (idx < 0) return
  // Idempotent against StrictMode double-mount regressions: if we've
  // already advanced past this step (hopIndex > idx), don't re-open the
  // window for it — that would regress currentStep and cause the next
  // tap to compute the wrong nextHopAfter. (React StrictMode re-fires
  // mount effects in dev, so /fitness mounting twice would otherwise
  // call setInAnimation('profile', true) AFTER consume('hub-load') has
  // already advanced hopIndex to 1.)
  if (active && idx < s.hopIndex) {
    log(`anim start on step "${stepName}" ignored — already past (hopIndex=${s.hopIndex})`)
    return
  }
  s.inAnim = !!active
  s.currentStep = active ? stepName : (s.currentStep === stepName ? null : s.currentStep)
  log(`anim ${active ? 'start' : 'end'} on step "${stepName}" (hop ${s.hopIndex})`)
}

/**
 * Called by each destination page on mount. Returns the staged prefire
 * intent if the previous hop's hit-zone tap matches THIS page's step,
 * else null. Caller fires its primary button handler synchronously.
 */
// Read the staged intent in queue form. Backward-compat: legacy
// {target, ts} shape (pre-queue) is treated as a one-element queue.
// Returns { queue: string[], ts: number|null }.
function readPrefireQueue() {
  if (typeof window === 'undefined') return { queue: [], ts: null }
  let raw = null
  try { raw = sessionStorage.getItem(PREFIRE_KEY) } catch (_) {}
  if (!raw) return { queue: [], ts: null }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.queue)) return { queue: parsed.queue.slice(), ts: parsed.ts || null }
    if (parsed?.target) return { queue: [parsed.target], ts: parsed.ts || null }   // legacy
  } catch (_) {}
  return { queue: [], ts: null }
}

function writePrefireQueue(queue) {
  if (typeof window === 'undefined') return
  try {
    if (queue.length === 0) {
      sessionStorage.removeItem(PREFIRE_KEY)
    } else {
      sessionStorage.setItem(PREFIRE_KEY, JSON.stringify({ queue, ts: Date.now() }))
    }
  } catch (_) {}
}

export function consumePrefire(stepName) {
  if (typeof window === 'undefined') return null
  const s = getState(); if (!s) return null

  // Idempotent against StrictMode double-mount: if we've already advanced
  // past (or to) this step, the legitimate consume already ran. A second
  // call must NOT touch the queue, or it'd treat the next-step entry as
  // a "mismatch" and wipe out real prefires (activate/today/muscle).
  const idx = chainIndex(stepName)
  if (idx >= 0 && idx <= s.hopIndex) {
    log(`consume "${stepName}": already advanced past (hopIndex=${s.hopIndex}) — idempotent no-op`)
    return null
  }

  const { queue, ts } = readPrefireQueue()

  // TTL — drop the entire queue if stale (chain stalled, e.g., user
  // navigated away mid-chain and came back hours later).
  if (ts && (Date.now() - ts) > PREFIRE_TTL_MS) {
    log(`consume "${stepName}": queue expired (age ${Date.now() - ts}ms > ${PREFIRE_TTL_MS}ms) — clearing`)
    writePrefireQueue([])
    return null
  }

  if (queue.length === 0) {
    log(`consume "${stepName}": no intent`)
    return null
  }

  const head = queue[0]
  if (head !== stepName) {
    // Queue head doesn't match what THIS destination consumes. This means
    // the user's taps staged a target for a different hop (e.g., they
    // back-navigated and the route changed). Clear the whole queue to
    // prevent zombie auto-fires on a future page.
    log(`consume "${stepName}": queue head "${head}" mismatch — clearing queue (depth was ${queue.length})`)
    writePrefireQueue([])
    return null
  }

  // Pop head; persist remaining queue (or remove the key if empty).
  queue.shift()
  writePrefireQueue(queue)

  // Advance hop counter + eagerly open inAnim so an extremely fast
  // follow-up tap doesn't fall into the gap between consume and the
  // primary handler's setInAnimation(stepName, true) call. Both are
  // idempotent — the primary handler's setInAnimation will be a no-op.
  s.hopIndex = chainIndex(stepName)
  s.inAnim = true
  s.currentStep = stepName
  log(`consume "${stepName}": MATCH — fire primary handler, hop=${s.hopIndex} (queue depth after pop: ${queue.length}, inAnim opened eagerly)`)

  // Return shape mirrors the legacy {target, ts} for caller compatibility.
  return { target: stepName, ts: ts || Date.now() }
}

/**
 * Convenience hook — runs consumePrefire on mount and calls primary()
 * synchronously if matched. Returns nothing; primary() owns whatever
 * navigation/state-mutation it does.
 *
 * Use from each chain page (load-cycle, activate, today, muscle):
 *
 *   usePredictivePrefire('load-cycle', () => loadCycleIntoStorage(...))
 */
export function usePredictivePrefire(stepName, primary) {
  // Lazy-import to avoid pulling React into pages that don't need it.
  // Standard React useEffect contract.
  const React = require('react')
  React.useEffect(() => {
    const intent = consumePrefire(stepName)
    if (intent && typeof primary === 'function') {
      try { primary(intent) } catch (e) { log('primary handler threw:', e) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// ── Internals ───────────────────────────────────────────────────────────────

// iOS PWA suppresses pointerdown events during rapid-tap sequences
// (documented in the GTL project memory: feedback_ios_pwa_rapid_tap_gotchas).
// Listen for touchstart as a fallback so an iOS-suppressed pointerdown
// still triggers prefire staging. Dedup so a normal tap (which fires
// touchstart THEN pointerdown ~5-16ms apart) doesn't stage twice.
//
// 30ms window: wide enough to reliably catch the paired events for the
// same physical tap (which fire within ~16ms), tight enough to let
// genuine rapid-tap sequences through (humans cap out around ~30-50ms
// between distinct taps). Earlier 80ms window was eating the activate
// hop when the user tapped the chain very fast.
const SAME_TAP_DEDUP_MS = 30

function installPointerHandler() {
  const s = getState(); if (!s) return
  if (s.pointerHandler) return
  const fire = (clientX, clientY, sourceLabel) => {
    const now = Date.now()
    if (s.lastFireAt && (now - s.lastFireAt) < SAME_TAP_DEDUP_MS) return
    s.lastFireAt = now
    onPointerDown({ clientX, clientY, _source: sourceLabel })
  }
  const pointerHandler = (e) => fire(e.clientX, e.clientY, 'pointerdown')
  const touchHandler = (e) => {
    const t = e.touches && e.touches[0]
    if (!t) return
    fire(t.clientX, t.clientY, 'touchstart')
  }
  window.addEventListener('pointerdown', pointerHandler, { capture: true })
  window.addEventListener('touchstart',  touchHandler,   { capture: true, passive: true })
  s.pointerHandler = pointerHandler
  s.touchHandler   = touchHandler
}

function uninstallPointerHandler() {
  const s = getState(); if (!s) return
  if (s.pointerHandler) {
    window.removeEventListener('pointerdown', s.pointerHandler, { capture: true })
    s.pointerHandler = null
  }
  if (s.touchHandler) {
    window.removeEventListener('touchstart', s.touchHandler, { capture: true })
    s.touchHandler = null
  }
  s.lastFireAt = 0
}

// Canonical chain hit-zone — the shared screen rect that every chain
// button occupies (matches ACTIVE_TOP_Y=479 on /fitness/active and the
// activate-popup top:466 + py-5 + min-h:56px geometry on /fitness/load).
// Tests against this rect directly INSTEAD of bbox-querying the chain
// target elements — earlier bbox-based logic missed taps during entrance
// animations (e.g. BEGIN HERE muscle has a 380ms delay before its bbox
// reaches its settled position; a tap during that window had no element
// to match against and silently fell through to reactive-skip-only).
//
// Buttons keep their data-predictive-tap-target attributes for visual
// documentation + potential future debug use, but they are no longer
// load-bearing for the hit test.
const CANONICAL_LEFT_INSET  = 12
const CANONICAL_RIGHT_INSET = 12
const CANONICAL_TOP         = 466   // ActivatePopup top; TODAY hero centers at 479
const CANONICAL_HEIGHT      = 96    // generous: covers the 70px button + ~13px slop top/bottom

function inCanonicalHitZone(clientX, clientY) {
  if (typeof window === 'undefined') return false
  const left   = CANONICAL_LEFT_INSET
  const right  = (window.innerWidth || 0) - CANONICAL_RIGHT_INSET
  const top    = CANONICAL_TOP
  const bottom = CANONICAL_TOP + CANONICAL_HEIGHT
  return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom
}

function onPointerDown(e) {
  const s = getState(); if (!s) return
  if (!s.inAnim) {
    if (inCanonicalHitZone(e.clientX, e.clientY)) {
      log(`${e._source || 'pointerdown'} in zone but inAnim=false (currentStep=${s.currentStep}) — no stage`)
    }
    return
  }

  // Hit-test against the canonical chain rect. Bbox-querying actual
  // chain elements was unreliable during entrance animations — the
  // canonical rect is stable regardless of what's mounted or animating.
  if (!inCanonicalHitZone(e.clientX, e.clientY)) {
    log(`${e._source || 'pointerdown'} @ (${Math.round(e.clientX)}, ${Math.round(e.clientY)}): outside canonical chain rect — reactive skip applies`)
    return
  }

  const hitName = '<canonical-zone>'

  // Queue-based push: rapid-fire taps in the same animation window each
  // advance one hop deeper, instead of overwriting the same prefire.
  // The next hop pushed is computed from the LAST entry in the queue
  // (or currentStep if queue is empty), so consecutive taps stage
  // hub-load → activate → today → muscle in order.
  const { queue } = readPrefireQueue()
  const tailStep = queue.length > 0 ? queue[queue.length - 1] : s.currentStep
  const nextStepName = nextHopAfter(tailStep)
  if (!nextStepName) {
    log(`hit "${hitName}" but no further hops (tail=${tailStep}, queue depth=${queue.length}) — chain saturated`)
    return
  }

  queue.push(nextStepName)
  writePrefireQueue(queue)
  log(`HIT "${hitName}" during "${s.currentStep}" anim → pushed "${nextStepName}" (queue depth ${queue.length})`)

  // Notify any subscribers (e.g., DayFocus listening for 'muscle' stages)
  // so destinations that mounted BEFORE the staging window can re-attempt
  // consume immediately rather than waiting for a re-render.
  notifyStaged(nextStepName)

  // Don't preventDefault — let the existing reactive skip handler also
  // fire so the in-flight animation ends and the next page mounts. The
  // destination page's mount-time consumePrefire then fires its primary
  // handler, advancing the chain. With the queue model, each subsequent
  // page mount pops its own prefire off the front, so rapid-fire taps
  // in one anim window can cascade through every hop.
}

function nextHopAfter(stepName) {
  const i = chainIndex(stepName)
  if (i < 0) return null
  const next = CHAIN_ORDER[i + 1]
  return next || null
}

// Install the pointerdown listener once at module load. Predictive tap
// is always on; the inAnim flag (set by chain pages during transitions)
// is the only gate. No "armed" concept — the chain just works for
// chain buttons whenever they're transitioning.
if (typeof window !== 'undefined') {
  installPointerHandler()
}
