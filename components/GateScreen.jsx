'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSound } from '../lib/useSound'

// Module-level flag: tracks whether GateScreen has mounted in the current JS
// bundle's lifetime. Resets on full page reload (module re-evaluates) but
// persists across soft navigation back to /. On return visits the very first
// useState initializer reads this true, skipLoading is true on initial render,
// and the loading-only DOM elements are conditionally not rendered at all —
// no flash possible because nothing exists to paint.
// SSR-safe: server always sees a fresh module, so SSR + client first render
// agree on skipLoading=false during initial cold load. No hydration mismatch.
let gateHasMountedOnce = false

// Slashes take 500ms + 140ms stagger = 640ms total.
// Exit at 600ms — slashes are 95%+ across, seamless handoff to gate-reveal.
const EXIT_MS = 600
const SWIPE_THRESHOLD = 50
// Double-tap window. iOS uses ~300ms for double-tap-to-zoom; 350ms is slightly
// more lenient and still feels like a "fast second tap" rather than two
// separate intentional taps.
const DOUBLE_TAP_MS = 350

const MANTRAS = [
  'THE BLADE IS YOU',
  'BECOME THE EDGE',
  'STRUGGLE',
  'CARRY THE WEIGHT',
  'PIERCE THE HEAVENS',
  'STAND UP AND WALK',
  'HOLD NOTHING BACK',
  'AWAKEN YOUR PERSONA',
  'GO BEYOND THE LIMIT',
]

const FAUX_SYSTEM_PHRASES = [
  'RACKING WEIGHTS...',
  'WIPING DOWN BENCH...',
  'UNRACKING THE BAR...',
  'GOING FULL DEPTH...',
]

// Settled, hero presentation: each word fades in 200ms after the prior.
// Spaces stay live in flow even while the word is invisible so the line
// length doesn't visibly grow.
// Cycles through the supplied (already-shuffled) phrases until unmount.
// Per-phrase loop: render full phrase + animated trailing dots → hold ~1500ms
// → fade-out 200ms → 100ms gap → next phrase. Three dots cycle in/out
// continuously while the phrase is held; phrase trailing dots in the bank
// are stripped and replaced by the live animated dots.
function FauxSystemCycle({ phrases }) {
  const [index, setIndex] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const [dotPhase, setDotPhase] = useState(1)  // 1..3 (always at least one dot)
  const phrase = phrases[index]
  useEffect(() => {
    const t = setInterval(() => setDotPhase((d) => (d % 3) + 1), 400)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    // Hold each phrase for 2 full ellipsis cycles (2 × 3 × 400ms = 2400ms)
    // before fading to the next, so the user sees the "..." cycle through twice.
    let cancelled = false
    let t1, t2, t3
    t1 = setTimeout(() => {
      if (cancelled) return
      setOpacity(0)
      t2 = setTimeout(() => {
        if (cancelled) return
        t3 = setTimeout(() => {
          if (cancelled) return
          setOpacity(1)
          setIndex((i) => (i + 1) % phrases.length)
        }, 100)
      }, 200)
    }, 2400)
    return () => {
      cancelled = true
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
    }
  }, [index, phrases.length])
  const stripped = phrase.replace(/\.+$/, '')
  return (
    <span
      style={{
        opacity,
        transition: 'opacity 200ms ease-out',
        display: 'inline-block',
      }}
    >
      {stripped}
      <span aria-hidden="true" style={{ display: 'inline-block', marginLeft: '0.04em' }}>
        <span style={{ opacity: dotPhase >= 1 ? 1 : 0 }}>.</span>
        <span style={{ opacity: dotPhase >= 2 ? 1 : 0 }}>.</span>
        <span style={{ opacity: dotPhase >= 3 ? 1 : 0 }}>.</span>
      </span>
    </span>
  )
}

export default function GateScreen({ onEnter, onCommit, onMusicStart, onSkip, onFastToHeist, swipeHintLabels }) {
  const { play } = useSound()
  const router = useRouter()

  // skipLoading: true from initial render on return visits within this JS
  // bundle's lifetime (soft nav back to / from any sub-route). When true, the
  // loading-only DOM elements (mantra slot, faux-system, bar) aren't rendered
  // at all and the entrance cascade is bypassed.
  const [skipLoading] = useState(() => gateHasMountedOnce)
  useEffect(() => {
    gateHasMountedOnce = true
  }, [])

  // Warm up the route bundles for every destination the user can hit from
  // the gate (or from the first screen after it), so post-gate taps don't
  // sit on a cold lazy-load + hydration delay. The loading gate itself
  // waits for these to resolve (see prefetchSettled below) — the loading
  // screen IS the warm-up window for the whole entry path.
  const PREFETCH_ROUTES = ['/fitness', '/diet', '/attune', '/fitness/hub', '/fitness/load', '/fitness/active']
  const [prefetchSettled, setPrefetchSettled] = useState(skipLoading)
  useEffect(() => {
    let cancelled = false
    const promises = PREFETCH_ROUTES.map((href) => Promise.resolve(router.prefetch(href)))
    Promise.allSettled(promises).then(() => {
      // Small buffer for Next.js's background module-graph processing
      // after the prefetch RPCs resolve.
      setTimeout(() => { if (!cancelled) setPrefetchSettled(true) }, 800)
    })
    // Failsafe: never trap the user if a prefetch hangs.
    const failsafe = setTimeout(() => {
      if (!cancelled) setPrefetchSettled(true)
    }, 4000)
    return () => {
      cancelled = true
      clearTimeout(failsafe)
    }
  }, [router])

  // Two-phase loading bar:
  //   Phase 1 (rising) — asymptotic climb capped at BAR_PAUSE_PCT. Slow
  //     enough (tau=3000ms) that the curve doesn't reach 69% until
  //     ~3.5s. On a typical warm-cache load (loadingComplete around
  //     1.5-2s) the bar is around 40-50% when phase 2 takes over —
  //     the user almost never dwells at 69%.
  //   Phase 2 (finishing) — fires when loadingComplete settles. Linear
  //     ramp from current pct to 100 over BAR_PHASE2_MS regardless of
  //     where it picks up, so the finish stays snappy even though
  //     phase 1 is slow.
  // Cross-fade out is gated on the BAR reaching 100% (+ 10ms hold), not
  // on loadingComplete directly — so the user always sees a true 100%
  // before the loading screen yields to PRESS START.
  const BAR_TAU = 5000
  const BAR_PAUSE_PCT = 69
  const BAR_PHASE2_MS = 700
  const [timePct, setTimePct] = useState(skipLoading ? 100 : 0)
  // Phase 1 — rising to BAR_PAUSE_PCT.
  useEffect(() => {
    if (skipLoading) return
    const start = Date.now()
    const t = setInterval(() => {
      const elapsed = Date.now() - start
      const raw = 100 * (1 - Math.exp(-elapsed / BAR_TAU))
      const pct = Math.min(BAR_PAUSE_PCT, Math.round(raw))
      setTimePct((prev) => (prev >= BAR_PAUSE_PCT ? prev : pct))
      if (pct >= BAR_PAUSE_PCT) clearInterval(t)
    }, 60)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [phase, setPhase] = useState(skipLoading ? 'idle' : 'pre')
  // pre → in → idle → out
  // `instant` flag: when set by snapToIdle, all entrance keyframes + transitions
  // null out so elements jump to their settled state instead of continuing to
  // play out their delayed animation schedule.
  const [instant, setInstant] = useState(skipLoading)
  const exitTimerRef = useRef(null)
  const touchStartY = useRef(null)
  // Tracks the timestamp of a tap that landed during entrance (snapToIdle).
  // A subsequent tap within DOUBLE_TAP_MS triggers fastToHeist instead of the
  // full idle commit cascade — same effect as a swipe during entrance.
  const lastEntranceTapRef = useRef(0)
  // Random roll-in direction for the logo. SSR + initial render uses 'left';
  // useEffect re-randomizes on mount. Transition stays disabled while
  // active=false so the direction-pick re-render pops instantly off-screen
  // (both -180vw and +180vw are far off-viewport, no visible jump).
  const [rollDir, setRollDir] = useState('left')
  // Sparkles wake up only after the logo has finished rolling in. Entrance
  // schedule: phase='in' at +60ms, transform transition is 200ms delay +
  // 1400ms duration = lands at +1660ms. Bump a bit past that for safety.
  const [logoEntranceDone, setLogoEntranceDone] = useState(skipLoading)
  // Gate the entrance cascade on ALL assets being ready: window.load (CSS,
  // scripts, any DOM images), document.fonts.ready (web fonts), and the
  // logo <img> firing load/error. Failsafe: 6s timeout flips this true so a
  // stuck asset never traps the user.
  const [imgLoaded, setImgLoaded] = useState(skipLoading)
  const [pageLoaded, setPageLoaded] = useState(skipLoading)
  const assetsLoaded = imgLoaded && pageLoaded
  // Lazy initializers so neither reroll on rerender. Mantra is one random
  // pick. Faux-system cycles through all 3 in a randomized order.
  // Random pick must happen post-mount, not in a useState initializer:
  // Math.random() returns different values on SSR vs client, which causes
  // a React hydration mismatch ("Text content did not match"). null on SSR;
  // populated client-side, the brand-label + press-start slots render the
  // post-loadingComplete static labels until then (which is fine — the
  // grid-stack already handles both children visibility-gated).
  const [pickedMantra, setPickedMantra] = useState(null)
  const [shuffledSystem, setShuffledSystem] = useState(null)
  useEffect(() => {
    setPickedMantra(MANTRAS[Math.floor(Math.random() * MANTRAS.length)])
    setShuffledSystem([...FAUX_SYSTEM_PHRASES].sort(() => Math.random() - 0.5))
  }, [])
  // Minimum-display floor: loading visuals always shown ≥1500ms from mount,
  // even on warm cache reloads where assetsLoaded fires near-instantly.
  // Bumped from 1200ms to give time for at least one full faux-system cycle
  // plus the mantra reveal.
  const [minTimeElapsed, setMinTimeElapsed] = useState(skipLoading)
  useEffect(() => {
    if (skipLoading) return
    const t = setTimeout(() => setMinTimeElapsed(true), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // loadingComplete now also gates on every prefetched route having settled,
  // so PRESS START is only revealed once the post-gate destinations are warm.
  const loadingComplete = assetsLoaded && minTimeElapsed && prefetchSettled
  // Phase 2 — bar finishes from current pct to 100 over BAR_PHASE2_MS.
  // Linear ramp; rate scales with how far there is to go so the finish
  // always lands in ~700ms regardless of where phase 1 paused.
  useEffect(() => {
    if (!loadingComplete) return
    const start = Date.now()
    const startPct = timePct
    const ratePerMs = (100 - startPct) / BAR_PHASE2_MS
    const t = setInterval(() => {
      const elapsed = Date.now() - start
      const raw = startPct + ratePerMs * elapsed
      const pct = Math.min(100, Math.round(raw))
      setTimePct(pct)
      if (pct >= 100) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingComplete])

  // crossfadeReady: real cross-fade trigger — fires 10ms after the bar
  // reaches 100%. All opacity gates that USED to read loadingComplete now
  // read this so the loading screen never fades out mid-bar.
  // On skipLoading return-visits this starts true so mantra/faux/bar stay
  // invisible and the static labels render directly.
  const [crossfadeReady, setCrossfadeReady] = useState(skipLoading)
  useEffect(() => {
    if (skipLoading) return
    if (timePct < 100) return
    const t = setTimeout(() => setCrossfadeReady(true), 10)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePct])

  // After crossfadeReady, hold 250ms (loading-content fade-out duration)
  // before fading the static brand label + PRESS START in. On skipLoading
  // this also starts true so the static labels render with opacity 1 from
  // the get-go.
  const [staticLabelsVisible, setStaticLabelsVisible] = useState(skipLoading)
  useEffect(() => {
    if (!crossfadeReady) return
    if (skipLoading) return
    const t = setTimeout(() => setStaticLabelsVisible(true), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossfadeReady])

  useEffect(() => {
    setRollDir(Math.random() < 0.5 ? 'left' : 'right')

    let cancelled = false
    const checks = []

    if (typeof document !== 'undefined' && document.readyState !== 'complete') {
      checks.push(new Promise((resolve) => {
        window.addEventListener('load', resolve, { once: true })
      }))
    }
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      checks.push(document.fonts.ready)
    }

    Promise.all(checks).then(() => {
      if (!cancelled) setPageLoaded(true)
    })

    const failsafe = setTimeout(() => {
      if (cancelled) return
      setImgLoaded(true)
      setPageLoaded(true)
    }, 6000)

    return () => {
      cancelled = true
      clearTimeout(failsafe)
    }
  }, [])

  // Bands / bloom / corners play immediately so the entrance IS the loading
  // screen — the user always sees motion. The logo wrapper (see logoActive
  // below) stays off-screen until assetsLoaded, then rolls in.
  useEffect(() => {
    if (skipLoading) return
    const t = setTimeout(() => setPhase('in'), 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Logo roll completion + idle handoff are scheduled relative to assetsLoaded
  // so they line up with the actual roll-in (which only starts once assets are
  // ready). On warm loads this fires near-immediately and matches original timing.
  useEffect(() => {
    if (skipLoading) return
    if (!assetsLoaded) return
    // Logo roll-in: 200ms delay + 1400ms duration = lands at +1600ms after assetsLoaded.
    const t1 = setTimeout(() => setLogoEntranceDone(true), 1800)
    const t2 = setTimeout(() => setPhase('idle'), 2200)
    return () => {
      clearTimeout(t1); clearTimeout(t2)
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsLoaded])

  // Full-cascade commit (idle → gate-exit slashes → onEnter triggers calling
  // card + heist). Used by tap and swipe once the user is at PRESS START.
  const commit = (kind) => {
    if (phase !== 'idle') return
    // Fire bg music start SYNCHRONOUSLY inside the user-gesture handler. iOS PWA
    // blocks audio.play() outside the synchronous click context — anything called
    // after the setTimeout below is outside that window and the play promise
    // rejects silently.
    if (onMusicStart) onMusicStart()
    play('brand-confirm')
    if (onCommit) onCommit(kind)  // sync, so parent can stash target
    setPhase('out')
    exitTimerRef.current = setTimeout(() => onEnter && onEnter(kind), EXIT_MS)
  }

  // Any input during 'out' (tap OR swipe) skips the rest of the cascade.
  const skipFromOut = () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    if (onSkip) onSkip()
  }

  // Tap during entrance: snap to PRESS START (idle), start music, no commit.
  // User then needs another gesture to commit. `instant` kills the in-flight
  // entrance keyframes/transitions so elements jump to their final state
  // instead of continuing the delayed schedule.
  const snapToIdle = () => {
    if (onMusicStart) onMusicStart()
    setInstant(true)
    setPhase('idle')
  }

  // Swipe during entrance: skip entrance + gate slashes + calling card,
  // play HeistTransition, then route. Music starts here too.
  const fastToHeist = (kind) => {
    if (onMusicStart) onMusicStart()
    play('brand-confirm')
    if (onCommit) onCommit(kind)
    if (onFastToHeist) onFastToHeist(kind)
  }

  const handleClick = () => {
    if (!assetsLoaded) return
    if (phase === 'out') { skipFromOut(); return }
    const now = Date.now()
    const isDoubleTap = now - lastEntranceTapRef.current < DOUBLE_TAP_MS
    if (phase === 'pre' || phase === 'in') {
      // Two fast taps both during entrance → fastToHeist (same as swipe).
      if (isDoubleTap) { lastEntranceTapRef.current = 0; fastToHeist('fitness'); return }
      lastEntranceTapRef.current = now
      snapToIdle()
      return
    }
    // phase === 'idle' — second tap of a double-tap that started during
    // entrance also fast-tracks. Past the window it's a normal commit.
    if (isDoubleTap) { lastEntranceTapRef.current = 0; fastToHeist('fitness'); return }
    commit('fitness')
  }

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0]?.clientY ?? null
  }
  const handleTouchEnd = (e) => {
    if (!assetsLoaded) { touchStartY.current = null; return }
    if (touchStartY.current == null) return
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current
    const dy = endY - touchStartY.current
    touchStartY.current = null
    const isSwipe = Math.abs(dy) > SWIPE_THRESHOLD
    if (phase === 'out' && isSwipe) { skipFromOut(); return }
    if (isSwipe && (phase === 'pre' || phase === 'in')) {
      fastToHeist(dy < 0 ? 'fitness' : 'nutrition')
      return
    }
    // Tap-then-swipe within DOUBLE_TAP_MS — same effect as double-tap.
    // (Caller's first tap snapped to idle; this swipe lands during 'idle'
    // but inside the followup window, so it short-circuits to fastToHeist
    // instead of running the full commit cascade.)
    if (isSwipe && Date.now() - lastEntranceTapRef.current < DOUBLE_TAP_MS) {
      lastEntranceTapRef.current = 0
      fastToHeist(dy < 0 ? 'fitness' : 'nutrition')
      return
    }
    if (dy < -SWIPE_THRESHOLD)      commit('fitness')
    else if (dy > SWIPE_THRESHOLD)  commit('nutrition')
    // Otherwise it's a tap — click event fires next, handleClick takes it.
  }

  const active = phase !== 'pre'
  const exiting = phase === 'out'
  // Logo waits until assets load — bands/bloom/corners play during the wait.
  const logoActive = active && assetsLoaded
  // Helpers: when `instant` is set, drop all entrance animation/transition so
  // the styled `active`-true target values apply immediately (no in-flight tween).
  const animOf  = (s) => instant ? 'none' : (active ? s : 'none')
  const transOf = (s) => instant ? 'none' : s

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Enter Gritted Teeth Lifestyle"
      style={{
        // Anchored to the parent <main> (flow-based, min-h:100svh) instead of
        // the viewport. Avoids the iOS PWA safe-area-inset-bottom clip that hits
        // any position:fixed element — even with viewport-fit=cover and a
        // negative-bottom calc. 100svh (small viewport height, locked at parse
        // time) sidesteps the dvh-stale-on-first-mount band on iOS PWA cold
        // launch.
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        width: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        // Near-black base — atmospheric bg is red bands + bloom on top of black.
        // iOS PWA safe-area gaps fall back to html/body #280609 (globals.css) +
        // <main>'s #280609, so any clipping reads dark red, not pure black.
        background: '#070708', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Noise grain */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />


      {/* Red atmosphere bloom — bright red center fading to transparent so
          black bg shows through. Brighter than original to give the
          negative-photo difference blend a wider color range to chew on. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 55%, rgba(212,24,31,0.45) 0%, transparent 65%)',
          opacity: active ? 1 : 0,
          transition: transOf('opacity 1400ms ease 300ms'),
        }}
      />

      {/* ── Diagonal background bands (slide from left) ──
          Each band uses top/bottom anchors instead of explicit height so it
          naturally over-spans the parent in both directions, regardless of
          iOS safe-area or dvh oddities. */}
      {/* Cascade entrance keyframes — driven by CSS, NOT React state, so
          the bands + corner accents start sliding in the moment HTML parses
          (during the SSR-to-hydration gap, which on dev mode can be hundreds
          of ms). Otherwise the page is pure black until React hydrates. */}
      <style>{`
        @keyframes gtl-band-1-in {
          from { transform: skewX(-12deg) translateX(-120%); }
          to   { transform: skewX(-12deg) translateX(0); }
        }
        @keyframes gtl-band-3-in {
          from { transform: skewX(-12deg) translateX(120%); }
          to   { transform: skewX(-12deg) translateX(0); }
        }
        @keyframes gtl-corner-h-in { from { width: 0; }  to { width: 168px; } }
        @keyframes gtl-corner-v-in { from { height: 0; } to { height: 168px; } }
      `}</style>
      {/* Band 1 — bright red, widest */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-25%', bottom: '-25%', left: '-5%', width: '52%',
          background: 'rgba(212,24,31,0.75)',
          transform: 'skewX(-12deg) translateX(0)',
          animation: skipLoading ? 'none' : 'gtl-band-1-in 1100ms cubic-bezier(0.15, 0, 0.1, 1) 150ms both',
        }}
      />
      {/* Band 2 removed — it overlapped Band 1 inside ~10–47% of the viewport,
          and the composited area read as a darker stripe through the F in
          FITNESS / E in SWIPE. Without Band 2, Band 1 is a clean uniform
          color across its full width with no overlap-induced color shift. */}
      {/* Band 3 — bright red, right-side accent */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-25%', bottom: '-25%', right: '-8%', width: '20%',
          background: 'rgba(212,24,31,0.55)',
          transform: 'skewX(-12deg) translateX(0)',
          animation: skipLoading ? 'none' : 'gtl-band-3-in 1100ms cubic-bezier(0.15, 0, 0.1, 1) 225ms both',
        }}
      />

      {/* ── Corner accent lines ── CSS-driven entrance, same reason as bands. */}
      <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
        style={{ height: 5, width: 168, animation: skipLoading ? 'none' : 'gtl-corner-h-in 1000ms cubic-bezier(0.2,1,0.3,1) 700ms both' }} />
      <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
        style={{ width: 5, height: 168, animation: skipLoading ? 'none' : 'gtl-corner-v-in 1000ms cubic-bezier(0.2,1,0.3,1) 800ms both' }} />
      <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
        style={{ height: 5, width: 168, animation: skipLoading ? 'none' : 'gtl-corner-h-in 1000ms cubic-bezier(0.2,1,0.3,1) 700ms both' }} />
      <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
        style={{ width: 5, height: 168, animation: skipLoading ? 'none' : 'gtl-corner-v-in 1000ms cubic-bezier(0.2,1,0.3,1) 800ms both' }} />

      {/* ── Swipe hints — plain red, no blend mode, no underlay.
          Outer wrapper handles the loadingComplete opacity gate so the inner
          pulse animation keeps cycling underneath without being clobbered. */}
      {swipeHintLabels && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              opacity: crossfadeReady ? 1 : 0,
              transition: 'opacity 400ms ease-out',
            }}
          >
            <div
              style={{
                fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
                fontSize: '1.2rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#d4181f',
                mixBlendMode: 'difference',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                animation: 'swipe-hint-pulse 2400ms ease-in-out infinite',
              }}
            >
              ▲ {swipeHintLabels.top}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              opacity: crossfadeReady ? 1 : 0,
              transition: 'opacity 400ms ease-out',
            }}
          >
            <div
              style={{
                fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
                fontSize: '1.2rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#d4181f',
                mixBlendMode: 'difference',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                animation: 'swipe-hint-pulse 2400ms ease-in-out infinite',
              }}
            >
              ▼ {swipeHintLabels.bottom}
            </div>
          </div>
          <style>{`
            @keyframes swipe-hint-pulse {
              0%, 100% { opacity: 0.85; }
              50%      { opacity: 1.0; }
            }
          `}</style>
        </>
      )}

      {/* ── Center content ── */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>

        {/* Logo — forge-slam from above. Wrapper hosts the post-roll sparkle
            overlay (3 ✦ glints anchored to the white tooth row, twinkling
            on/off at staggered offsets once the roll-in completes). */}
        <div
          style={{
            position: 'relative',
            width: 'clamp(128px, 24vw, 200px)',
            height: 'clamp(128px, 24vw, 200px)',
            transform: logoActive
              ? `translateX(0) rotate(${rollDir === 'left' ? 720 : -720}deg)`
              : `translateX(${rollDir === 'left' ? '-180vw' : '180vw'}) rotate(0deg)`,
            transition: logoActive ? transOf('transform 1400ms cubic-bezier(0.2, 0.8, 0.3, 1) 200ms') : 'none',
          }}
        >
          <img
            src="/logo.png"
            alt="GTL"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {logoEntranceDone && (
            <>
              <style>{`
                @keyframes gtl-gate-tooth-sparkle {
                  0%   { transform: translate(-50%, -50%) scale(0);    opacity: 0; }
                  18%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
                  36%  { transform: translate(-50%, -50%) scale(0);    opacity: 0; }
                  100% { transform: translate(-50%, -50%) scale(0);    opacity: 0; }
                }
              `}</style>
              {[
                { left: '42%', top: '26%', delay: '0s',   dur: '2.4s' },
                { left: '66%', top: '38%', delay: '0.7s', dur: '2.6s' },
                { left: '76%', top: '32%', delay: '1.4s', dur: '2.8s' },
              ].map((s, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: s.left,
                    top: s.top,
                    color: '#fff',
                    fontSize: '2.1rem',
                    lineHeight: 1,
                    textShadow: '0 0 6px rgba(255,255,255,0.7)',
                    pointerEvents: 'none',
                    transformOrigin: 'center center',
                    animation: `gtl-gate-tooth-sparkle ${s.dur} ease-in-out ${s.delay} infinite`,
                    opacity: 0,
                  }}
                >
                  ✦
                </span>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem' }}>

          {/* Brand-label slot — during loading hosts the chosen mantra
              (big diagonal white Anton, GTL-headline-style, no animation).
              On loadingComplete the mantra fades out, then the static
              GRITTED TEETH LIFESTYLE label fades in. Both children stack
              in the same grid cell so the swap is layout-stable. zIndex
              preserves the blend backdrop chain. */}
          <div style={{
            display: 'grid', placeItems: 'center',
            position: 'relative', zIndex: 10,
          }}>
            {!skipLoading && (
              <div style={{
                gridArea: '1 / 1',
                opacity: crossfadeReady ? 0 : 1,
                transition: 'opacity 250ms ease-out',
                pointerEvents: 'none',
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.6rem',
                  transform: 'rotate(-27deg)',
                }}>
                  <div style={{
                    fontFamily: 'Anton, Impact, sans-serif',
                    fontSize: 'clamp(2.5rem, 9vw, 5rem)',
                    lineHeight: 1.05,
                    letterSpacing: '-0.01em',
                    color: '#f1eee5',
                    textShadow: '3px 3px 0 #d4181f, 6px 6px 0 #070708',
                    textTransform: 'uppercase',
                    maxWidth: '85vw',
                    textAlign: 'center',
                  }}>
                    {pickedMantra}
                  </div>
                  {/* Mantra slash underline. */}
                  <div style={{
                    height: 5,
                    background: '#d4181f',
                    transform: 'skewX(-12deg)',
                    mixBlendMode: 'difference',
                    width: pickedMantra ? 'clamp(6rem, 18vw, 12rem)' : 0,
                    transition: 'width 900ms cubic-bezier(0.2, 1, 0.3, 1) 300ms',
                  }} />
                </div>
              </div>
            )}
            <div style={{
              gridArea: '1 / 1',
              opacity: staticLabelsVisible ? 1 : 0,
              transition: 'opacity 250ms ease-in',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
                fontSize: '1rem', letterSpacing: '0.16em',
                fontWeight: 900,
                textTransform: 'uppercase', color: '#d4181f',
                mixBlendMode: 'difference',
              }}>
                GRITTED TEETH LIFESTYLE
              </div>
            </div>
          </div>

          {/* Big GTL headline — hidden during loading, fades in once
              loadingComplete fires alongside the slash + sub-hint. */}
          <div style={{
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: 'clamp(5rem, 14vw, 10rem)',
            lineHeight: 1, letterSpacing: '-0.02em',
            color: '#f1eee5',
            textShadow: '3px 3px 0 #d4181f, 6px 6px 0 #070708',
            opacity: crossfadeReady ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}>
            GTL
          </div>

          {/* Slash divider — obeys the same negative-photo rule as the labels.
              Width transition stays gated on `active`; opacity stacks on top so
              the divider stays invisible during the loading phase. */}
          <div style={{
            height: 5, background: '#d4181f', transform: 'skewX(-12deg)',
            mixBlendMode: 'difference',
            width: active ? 'clamp(8rem, 20vw, 14rem)' : 0,
            transition: transOf('width 1000ms cubic-bezier(0.2, 1, 0.3, 1) 1200ms, opacity 400ms ease-out'),
            opacity: crossfadeReady ? 1 : 0,
          }} />

          {/* PRESS-START slot — during loading hosts the cycling
              faux-system phrases. On loadingComplete the cycle fades out,
              then PRESS START fades in. Same grid-stack pattern as the
              brand-label slot above; both swaps run in parallel. */}
          <div style={{ display: 'grid', placeItems: 'center' }}>
            {!skipLoading && (
              <div style={{
                gridArea: '1 / 1',
                opacity: crossfadeReady ? 0 : 1,
                transition: 'opacity 250ms ease-out',
                pointerEvents: 'none',
              }}>
                <div style={{
                  fontFamily: '"FOT-Matisse Pro EB", Anton, Impact, sans-serif',
                  fontSize: 'clamp(1.3rem, 3.8vw, 2.2rem)',
                  fontWeight: 900,
                  letterSpacing: '0.10em', color: '#d4181f',
                  mixBlendMode: 'difference',
                  whiteSpace: 'nowrap',
                }}>
                  {shuffledSystem && <FauxSystemCycle phrases={shuffledSystem} />}
                </div>
              </div>
            )}
            <div style={{
              gridArea: '1 / 1',
              opacity: staticLabelsVisible ? 1 : 0,
              transition: 'opacity 250ms ease-in',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: '"FOT-Matisse Pro EB", Anton, Impact, sans-serif',
                fontSize: 'clamp(1.3rem, 3.8vw, 2.2rem)',
                fontWeight: 900,
                letterSpacing: '0.10em', color: '#d4181f',
                mixBlendMode: 'difference',
                animation: 'cursor-blink 1.2s steps(2, end) infinite',
              }}>
                PRESS START
              </div>
            </div>
          </div>

          {/* Loading progress bar — time-based: fills smoothly over
              BAR_DURATION_MS, holds at 100% until loadingComplete cross-
              fades it out. Skewed -12deg to match the slash divider. */}
          {!skipLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              opacity: crossfadeReady ? 0 : 1,
              transition: 'opacity 250ms ease-out',
              pointerEvents: 'none',
            }}>
              <style>{`
                @keyframes gtl-bar-stripes {
                  from { transform: translateX(0); }
                  to   { transform: translateX(17px); }
                }
              `}</style>
              <div style={{
                width: 'clamp(8rem, 32vw, 16rem)',
                height: 8,
                background: 'rgba(212, 24, 31, 0.15)',
                transform: 'skewX(-12deg)',
                // Forward-pointing arrowhead clip — chevron point on the right
                // end, flat left end. Sharper, blade-slot feel.
                clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, bottom: 0, left: 0,
                  width: `${timePct}%`,
                  background: '#d4181f',
                  transition: 'width 60ms linear',
                  overflow: 'hidden',
                }}>
                  {/* Scrolling diagonal stripes — gentle white overlay
                      gives the fill a sense of motion. */}
                  <div style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: '-24px', right: '-24px',
                    backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.45) 0 6px, transparent 6px 12px)',
                    animation: 'gtl-bar-stripes 600ms linear infinite',
                  }} />
                </div>
              </div>
              <div style={{
                fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
                fontSize: '0.85rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: '#d4181f',
                mixBlendMode: 'difference',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '2.8em',
                textAlign: 'right',
              }}>
                {timePct}%
              </div>
            </div>
          )}

          {/* Sub-hint — no entrance animation; visible from t=0 in red so the
              difference-blend live-flips as bands sweep behind it. */}
          <div style={{
            fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
            fontSize: '0.9rem', letterSpacing: '0.14em',
            fontWeight: 900,
            textTransform: 'uppercase', color: '#d4181f',
            mixBlendMode: 'difference',
            opacity: crossfadeReady ? 1 : 0,
            transition: 'opacity 400ms ease-out',
          }}>
            // CLICK OR TOUCH TO ENTER //
          </div>

        </div>
      </div>

      {/* ── EXIT: three slash wipes at 500ms each, staggered ── */}
      {exiting && (
        <>
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            top: '-25%', left: '-50%', width: '200%', height: '65vh',
            background: '#d4181f',
            transform: 'skewY(-12deg)', transformOrigin: 'top left',
            animation: 'slash-wipe 500ms cubic-bezier(0.7, 0, 0.2, 1) forwards',
          }} />
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            bottom: '-25%', right: '-50%', width: '200%', height: '65vh',
            background: '#ff2a36',
            transform: 'skewY(-12deg)', transformOrigin: 'bottom right',
            animation: 'slash-wipe 500ms cubic-bezier(0.7, 0, 0.2, 1) 70ms forwards',
          }} />
          <div style={{
            position: 'absolute', pointerEvents: 'none',
            top: '-50%', right: '-33%', width: '200%', height: '90vh',
            background: '#7a0e14',
            transform: 'skewY(15deg)', transformOrigin: 'top right',
            animation: 'slash-wipe 500ms cubic-bezier(0.7, 0, 0.2, 1) 140ms forwards',
          }} />
        </>
      )}
    </button>
  )
}
