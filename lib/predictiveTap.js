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

// Minimum HT playtime before a tap can skip-route. iOS PWA can also leak
// the originating tap from the previous page into the new page's listener
// for ~100-150ms after route, so the floor doubles as leaked-tap absorption.
// Tunable knob.
const SKIP_GRACE_MS = 350

// Registered routeForward callbacks per step. Pages call registerChainStep
// on mount; the module owns the window pointerdown/touchstart listener
// (already installed below for staging) AND the skip-route decision.
const stepHandlers = new Map()  // stepName -> routeForward

// HT timing for grace-based skip. setInAnimation(step, true) starts this;
// setInAnimation(step, false) or registerChainStep cleanup clears it.
let activeHTStep = null
let htStartedAt = 0
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

// Zero the transient HT state (inAnim + currentStep) on chain-page mount
// WITHOUT touching hopIndex or the prefire queue. Call this from each
// chain page's mount effect. Replaces the older pattern of
// `setInAnimation(<prev-step>, true)` which incorrectly re-armed inAnim
// on a static page and let pointerdown stage stale next-hop intents.
//
// `ownedStep` is the step this page's consumePrefire targets. If state
// already reads (currentStep === ownedStep, inAnim === true), the consume
// on a prior render in this StrictMode/HMR mount cycle already eagerly
// populated state — skip the clear so we don't clobber it. Without this
// guard, StrictMode's second mount clobbers consume's eager open, leaving
// inAnim=false for the brief window before setTimeout-fired setInAnimation
// re-opens. Taps in that window get silently dropped.
export function clearChainTransient(reason = 'page-mount', ownedStep = null) {
  const s = getState(); if (!s) return
  if (ownedStep && s.currentStep === ownedStep && s.inAnim) {
    log(`clear transient skipped (consume owns "${ownedStep}"): ${reason}`)
    return
  }
  s.inAnim = false
  s.currentStep = null
  activeHTStep = null
  htStartedAt = 0
  log(`clear transient (no-op gate): ${reason}`)
}

/**
 * Called by each chain page when its outgoing animation begins. inAnim
 * is the only gate that matters now. Pointerdown handler stages the
 * next intent only when inAnim is true and the tap is in the canonical
 * hit-zone.
 */
export function setInAnimation(stepName, active) {
  const s = getState(); if (!s) return
  if (chainIndex(stepName) < 0) return
  s.inAnim = !!active
  s.currentStep = active ? stepName : (s.currentStep === stepName ? null : s.currentStep)
  // Record HT timing so the module-level pointerdown handler can decide
  // whether a tap is past the SKIP_GRACE_MS floor.
  // Only reset htStartedAt when transitioning INTO a new step. Repeated
  // setInAnimation(stepName, true) for the SAME step is a no-op for timing
  // — preserves the original anim start time so the grace doesn't keep
  // sliding forward when a component re-mounts or an effect re-fires.
  // Different-step transitions still reset normally, so re-entry into the
  // chain from a fresh step starts a clean grace window.
  if (active) {
    if (activeHTStep !== stepName) {
      activeHTStep = stepName
      htStartedAt = performance.now()
    }
  } else if (activeHTStep === stepName) {
    activeHTStep = null
    htStartedAt = 0
  }
  log(`anim ${active ? 'start' : 'end'} on step "${stepName}" (hop ${s.hopIndex})`)
}

/**
 * Page registers itself as the active chain step's owner and provides a
 * routeForward callback the module calls when a tap passes the grace floor
 * during this step's HT. Returns an unregister function suitable for
 * useEffect cleanup.
 *
 *   useEffect(() => registerChainStep('today', () => {
 *     router.push('/fitness/active/' + fireDayHopRef.current)
 *   }), [router])
 *
 * Replaces the per-page window pointerdown/touchstart skip-listener
 * pattern. The module already owns one listener; this just teaches it
 * the right route-forward action per step.
 */
export function registerChainStep(stepName, routeForward) {
  if (chainIndex(stepName) < 0) return () => {}
  if (typeof routeForward !== 'function') return () => {}
  stepHandlers.set(stepName, routeForward)
  return () => {
    if (stepHandlers.get(stepName) === routeForward) {
      stepHandlers.delete(stepName)
      if (activeHTStep === stepName) {
        activeHTStep = null
        htStartedAt = 0
      }
    }
  }
}

// True iff the prefire queue's head is `stepName`. Used by chain pages
// that want to "eagerly open" inAnim on mount (closing the gap between
// mount and ready-gated consume) without pre-arming non-chain visits.
// On a cold/manual visit, the queue is empty and this returns false —
// the page stays idle until the user actually taps a chain button.
export function isPendingChainHead(stepName) {
  if (typeof window === 'undefined') return false
  const { queue, ts } = readPrefireQueue()
  if (queue.length === 0) return false
  if (ts && (Date.now() - ts) > PREFIRE_TTL_MS) return false
  return queue[0] === stepName
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
    // Queue head doesn't match what THIS destination consumes. Most
    // common cause: a duplicate mount/effect re-firing consume() for
    // the same step AFTER the legitimate first consume already popped
    // it. The earlier "clear queue on mismatch" behavior treated this
    // as malice and wiped the real prefires (activate/today/muscle)
    // staged behind hub-load. Now: silent no-op, leave the queue alone.
    // The legitimate destination page for the actual head step will
    // find its target when it mounts. Genuinely-stale queues (back-nav
    // mid-chain) are cleaned up by the 10s TTL or by armChain on the
    // next chain start.
    log(`consume "${stepName}": queue head "${head}" mismatch — no-op (queue preserved, depth ${queue.length})`)
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
  const fire = (clientX, clientY, target, sourceLabel) => {
    const now = Date.now()
    if (s.lastFireAt && (now - s.lastFireAt) < SAME_TAP_DEDUP_MS) return
    s.lastFireAt = now
    onPointerDown({ clientX, clientY, target, _source: sourceLabel })
  }
  const pointerHandler = (e) => fire(e.clientX, e.clientY, e.target, 'pointerdown')
  const touchHandler = (e) => {
    const t = e.touches && e.touches[0]
    if (!t) return
    fire(t.clientX, t.clientY, t.target || e.target, 'touchstart')
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

  const inZone = inCanonicalHitZone(e.clientX, e.clientY)

  // Staging (canonical zone only): push the next-deeper hop onto the
  // prefire queue. Rapid-fire taps in the same anim each advance one
  // hop further — hub-load, activate, today, muscle stage in order.
  if (inZone) {
    const hitName = '<canonical-zone>'
    const { queue } = readPrefireQueue()
    const tailStep = queue.length > 0 ? queue[queue.length - 1] : s.currentStep
    const nextStepName = nextHopAfter(tailStep)
    if (!nextStepName) {
      log(`hit "${hitName}" but no further hops (tail=${tailStep}, queue depth=${queue.length}) — chain saturated`)
    } else {
      queue.push(nextStepName)
      writePrefireQueue(queue)
      log(`HIT "${hitName}" during "${s.currentStep}" anim → pushed "${nextStepName}" (queue depth ${queue.length})`)
      notifyStaged(nextStepName)
    }
  } else {
    log(`${e._source || 'pointerdown'} @ (${Math.round(e.clientX)}, ${Math.round(e.clientY)}): outside canonical chain rect`)
  }

  // Skip-route (regardless of zone): if an HT is past the SKIP_GRACE_MS
  // floor, fire the registered routeForward so the chain advances on
  // the user's tap. This replaces the per-page window pointerdown skip
  // listeners that each page used to install. Retreat-button taps are
  // honored (no skip) so back-nav still works.
  if (activeHTStep && htStartedAt > 0) {
    const elapsed = performance.now() - htStartedAt
    if (elapsed < SKIP_GRACE_MS) {
      log(`tap during "${activeHTStep}" anim within grace (${Math.round(elapsed)}ms < ${SKIP_GRACE_MS}ms) — no skip-route`)
      return
    }
    if (e.target?.closest?.('[data-retreat]')) {
      log(`tap on retreat — no skip-route`)
      return
    }
    const route = stepHandlers.get(activeHTStep)
    if (typeof route !== 'function') {
      log(`tap during "${activeHTStep}" anim past grace but no routeForward registered`)
      return
    }
    const step = activeHTStep
    // Clear HT state immediately so a second tap (e.g., touchstart leak
    // for the same physical tap) can't double-fire routeForward.
    activeHTStep = null
    htStartedAt = 0
    log(`SKIP-ROUTE "${step}" (grace passed at ${Math.round(elapsed)}ms)`)
    try { route() } catch (err) { log('routeForward threw:', err) }
  }
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
