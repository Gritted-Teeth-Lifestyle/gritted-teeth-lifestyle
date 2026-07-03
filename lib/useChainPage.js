'use client'
/**
 * useChainPage — the one way a page participates in the predictive-tap chain.
 *
 * Every chain page used to hand-wire the same four-part ritual (mount-clear,
 * consume, eager-open bridge, skip-route registration) as separate effects,
 * and every historical chain bug came from one page getting one part slightly
 * wrong: the setInAnimation('<prev-step>', true) anti-pattern, the StrictMode
 * clobber of consume's eager-open, the unconditional eager-open that made one
 * tap cascade two hops, duplicate consumers of the same step. This hook owns
 * the ritual once, in the correct order, with the correct guards.
 *
 * Usage per role:
 *
 *   // Entry page (/fitness — profile chip). No consume; unconditional clear.
 *   useChainPage({ step: 'profile', clearTag: 'profile-mount', entry: true,
 *                  routeForward: () => skipNow() })
 *
 *   // Mid-chain page. Consumes its step when `ready` is true.
 *   useChainPage({ step: 'hub-load', clearTag: 'hub-mount',
 *                  onArrive: (intent) => ...schedule primary action...,
 *                  routeForward: () => skipNow() })
 *
 *   // Terminal page (/fitness/active/[iso]/[muscleId]). The chain ENDS here:
 *   // disarm on mount (clears transient state + queue). No consume/register.
 *   useChainPage({ step: 'muscle', clearTag: 'muscleId-terminal', terminal: true })
 *
 * Contract details:
 *  - `ready` gates consume. Consume is attempted whenever `ready` becomes
 *    true and no intent has been consumed yet this mount. Pages whose data
 *    loads async (localStorage) pass their ready state; default true.
 *  - `onArrive(intent)` fires exactly once per mount on a consume MATCH.
 *    The hook eagerly opens the step's anim window (setInAnimation) before
 *    calling it, so taps during the page's deferred primary action still
 *    stage the next hop. The page schedules its own HT/route (usually via
 *    setTimeout, preserving each page's tuned delay).
 *  - `routeForward` is registered as the step's skip-route handler via a
 *    stable trampoline — re-renders update the closure without re-registering
 *    (registerChainStep cleanup clears the grace timer; churning it mid-HT
 *    would break the skip window).
 *  - Eager-open bridge: on mount, if consume is gated (`ready` false) but the
 *    queue head already targets this step, the anim window opens immediately
 *    so rapid taps in the gap between mount and ready-gated consume stage the
 *    NEXT hop instead of falling into inAnim=false and being dropped.
 *    Queue-gated (isPendingChainHead), so cold/manual visits stay idle —
 *    generalizes the fix that previously existed only on /fitness/active.
 *  - StrictMode: the mount-clear is freshness-guarded inside the module
 *    (clearChainTransient skips when consume matched this step milliseconds
 *    ago), and `consumedRef` stops the second consume pass from re-firing.
 */
import { useEffect, useRef } from 'react'
import {
  clearChainTransient,
  consumePrefire,
  disarmChain,
  isPendingChainHead,
  registerChainStep,
  setInAnimation,
} from './predictiveTap'

export function useChainPage({
  step,
  clearTag,
  ready = true,
  onArrive = null,
  routeForward = null,
  entry = false,
  terminal = false,
}) {
  const consumedRef = useRef(false)
  const readyRef = useRef(ready)
  const onArriveRef = useRef(onArrive)
  const routeForwardRef = useRef(routeForward)
  readyRef.current = ready
  onArriveRef.current = onArrive
  routeForwardRef.current = routeForward

  // 1. Mount-clear (or terminal disarm) + eager-open bridge.
  useEffect(() => {
    if (terminal) {
      // Chain END — release transient state AND the queue. Nothing consumes
      // past this page; anything still staged is garbage.
      disarmChain(clearTag || `${step}-terminal`)
      return
    }
    // Entry pages clear unconditionally (nothing to preserve on the way in);
    // mid-chain pages pass their owned step so a consume that just ran in
    // this same StrictMode/HMR mount cycle isn't clobbered.
    clearChainTransient(clearTag || `${step}-mount`, entry ? null : step)
    // Bridge: consume may be gated on async data. If we're mid-chain (queue
    // head is this step), open the anim window now so taps before consume
    // fires stage the next hop instead of being dropped.
    if (!entry && !readyRef.current && isPendingChainHead(step)) {
      setInAnimation(step, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Consume — attempted when ready, once per mount.
  useEffect(() => {
    if (entry || terminal) return
    if (!ready) return
    if (consumedRef.current) return
    const intent = consumePrefire(step)
    if (intent) {
      consumedRef.current = true
      // Idempotent with the page's own primary-handler setInAnimation; makes
      // the grace window start at consume time on every page uniformly.
      setInAnimation(step, true)
      if (typeof onArriveRef.current === 'function') onArriveRef.current(intent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // 3. Skip-route registration — stable trampoline, latest closure via ref.
  useEffect(() => {
    if (terminal) return () => {}
    return registerChainStep(step, () => {
      if (typeof routeForwardRef.current === 'function') routeForwardRef.current()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])
}
