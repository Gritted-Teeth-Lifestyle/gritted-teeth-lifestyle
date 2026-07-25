'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSound } from '../../lib/useSound'
import HeistTransition from '../../components/HeistTransition'
import RetreatButton from '../../components/RetreatButton'
import { LogoStencil, LogoTarget } from '../../components/LogoHalf'
import { armChain, setInAnimation } from '../../lib/predictiveTap'
import { useChainPage } from '../../lib/useChainPage'
import { pk } from '../../lib/storage'
import { setUserDOB } from '../../lib/userPrefs'
import VitalsStep from '../../components/onboarding/VitalsStep'
import ExperienceStep from '../../components/onboarding/ExperienceStep'
import { setClaimedExperience, profileSlotStats } from '../../lib/exp'
import { setWallCamera, WALL_PAN_MS } from '../../lib/wallCamera'
import GatePreview from '../../components/identity/GatePreview'
import HubPreview from '../../components/identity/HubPreview'

function ProfileChip({ name, stats, onSelect, onSwipeSelect, instantEntrance = false }) {
  const { play } = useSound()
  const startRef = useRef(null)
  const dxRef = useRef(0)
  const swipeFiredRef = useRef(false)
  const velocityTrackerRef = useRef([])
  const VELOCITY_WINDOW_MS = 100
  const FLICK_VELOCITY = 0.4
  const FLICK_MIN_DISTANCE = 40
  const [dragX, setDragX] = useState(0)
  const [ringKey, setRingKey] = useState(0)
  const [ringSide, setRingSide] = useState('right')
  // instantEntrance (arrival via the wall pan): the preview already
  // showed this chip settled, so replaying the 1300ms logo roll-in reads
  // as assets blinking into position (Jordan 2026-07-23). Start settled.
  const [entranceDone, setEntranceDone] = useState(instantEntrance)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (instantEntrance) return
    const t = setTimeout(() => setEntranceDone(true), 1300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const SWIPE_THRESHOLD = 294

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY }
    dxRef.current = 0
    swipeFiredRef.current = false
    velocityTrackerRef.current = [{ t: e.timeStamp, x: e.clientX }]
    setDragX(0)
    setPressed(true)
  }
  const handlePointerMove = (e) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) {
      const clamped = Math.max(-SWIPE_THRESHOLD, Math.min(dx, SWIPE_THRESHOLD))
      dxRef.current = clamped
      setDragX(clamped)
    }
    const tracker = velocityTrackerRef.current
    tracker.push({ t: e.timeStamp, x: e.clientX })
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS
    while (tracker.length > 0 && tracker[0].t < cutoff) tracker.shift()
  }
  const handlePointerUp = () => {
    setPressed(false)
    const tracker = velocityTrackerRef.current
    let velocity = 0
    if (tracker.length >= 2) {
      const oldest = tracker[0]
      const newest = tracker[tracker.length - 1]
      const dt = newest.t - oldest.t
      if (dt > 0) velocity = (newest.x - oldest.x) / dt
    }
    const distance = Math.abs(dxRef.current)
    const dirMatches = dxRef.current === 0 || Math.sign(velocity) === Math.sign(dxRef.current)
    const fired =
      distance >= SWIPE_THRESHOLD ||
      (Math.abs(velocity) >= FLICK_VELOCITY && distance >= FLICK_MIN_DISTANCE && dirMatches)

    if (fired && onSwipeSelect) {
      swipeFiredRef.current = true
      setRingSide(dxRef.current > 0 ? 'right' : 'left')
      setRingKey((k) => k + 1)
      play('card-confirm')
      onSwipeSelect(name)
    }
    startRef.current = null
    dxRef.current = 0
    velocityTrackerRef.current = []
    setDragX(0)
  }
  const handleClick = (e) => {
    if (swipeFiredRef.current) {
      e.preventDefault(); e.stopPropagation()
      swipeFiredRef.current = false
      return
    }
    play('card-confirm')
    onSelect(name)
  }
  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD)

  return (
    <div className="relative block w-full -mx-5" style={{ width: 'calc(100% + 40px)' }}>
      {/* Shadow slab behind the button */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: '#4a0a0e',
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          transform: pressed ? 'translate(0,0)' : 'translate(5px, 5px)',
          transition: 'transform 80ms ease-out',
        }}
        aria-hidden="true"
      />
      <button
        type="button"
        data-predictive-tap-target="profile"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          startRef.current = null
          dxRef.current = 0
          swipeFiredRef.current = false
          velocityTrackerRef.current = []
          setDragX(0)
          setPressed(false)
        }}
        onMouseEnter={() => { setHovered(true); play('button-hover') }}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
        className="relative group flex items-center justify-center font-display tracking-[0.25em] uppercase overflow-visible px-24 min-h-[64px] block w-full text-3xl"
        style={{
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          touchAction: 'pan-y',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          padding: '1.5rem 6rem',
          background: pressed ? '#ff2a36' : hovered ? '#d4181f' : '#161618',
          color: (hovered || pressed) ? '#f4ede0' : '#e8e8f0',
          transform: pressed ? 'translate(5px, 5px)' : 'translate(0,0)',
          transition: 'transform 80ms ease-out, background 200ms ease-out, color 200ms ease-out',
          border: (hovered || pressed) ? 'none' : '1px solid #26262a',
        }}
      >
        <span
          className="relative flex flex-col items-center"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <span className="inline-block leading-none tracking-tight">
            {name.toUpperCase()}
          </span>
          {/* Save-slot line: level · EXP tier · days trained. */}
          {stats && (
            <span
              className="mt-2 font-mono text-[9px] leading-none tracking-[0.25em] uppercase font-bold whitespace-nowrap"
              style={{ color: (hovered || pressed) ? '#f4ede0' : '#8a8a92', transition: 'color 200ms ease-out' }}
            >
              LV {stats.level} · {stats.tier} · {stats.daysTrained} {stats.daysTrained === 1 ? 'DAY' : 'DAYS'}
            </span>
          )}
        </span>
        {(() => {
          const rollFactor = 360 / SWIPE_THRESHOLD
          const stencilTx = Math.max(0, dragX)
          const targetTx  = Math.min(0, dragX)
          return (
            <>
              <div
                className="absolute pointer-events-none"
                style={{
                  left: 'calc(50% - 175px)',
                  top: '50%',
                  width: '56px',
                  height: '56px',
                  marginTop: '-28px',
                  transform: `translateX(${stencilTx}px) rotate(${stencilTx * rollFactor}deg)`,
                  opacity: 0.85 + swipeProgress * 0.15,
                  transition: dragX === 0 ? 'transform 220ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms' : 'opacity 100ms',
                  animation: !entranceDone
                    ? 'logo-roll-in-profile 1300ms cubic-bezier(0.85, 0, 0.15, 1) forwards'
                    : (dragX === 0 ? 'yy-pulse-left 1.5s ease-in-out infinite' : 'none'),
                  zIndex: 2,
                }}
                aria-hidden="true"
              >
                <LogoStencil size={56} paused={!entranceDone || dragX !== 0}/>
              </div>
              <div
                className="absolute pointer-events-none"
                style={{
                  right: 'calc(50% - 175px)',
                  top: '50%',
                  width: '56px',
                  height: '56px',
                  marginTop: '-28px',
                  transform: `translateX(${targetTx}px) rotate(${targetTx * rollFactor}deg)`,
                  opacity: 0.85 + swipeProgress * 0.15,
                  transition: dragX === 0 ? 'transform 220ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms' : 'opacity 100ms',
                  animation: (entranceDone && dragX === 0) ? 'yy-pulse-right 1.5s ease-in-out infinite' : 'none',
                  zIndex: 1,
                }}
                aria-hidden="true"
              >
                <LogoTarget size={56}/>
              </div>
            </>
          )
        })()}
      </button>
      {ringKey > 0 && (
        <div
          key={ringKey}
          className="absolute pointer-events-none rounded-full"
          style={{
            top: '50%',
            marginTop: '-28px',
            ...(ringSide === 'right'
              ? { right: 'calc(50% - 175px)' }
              : { left:  'calc(50% - 175px)' }),
            width: '56px',
            height: '56px',
            borderStyle: 'solid',
            borderColor: '#d4181f',
            animation: 'shockwave 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
            zIndex: 3,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

const HUB_TARGET = '/fitness/hub'

export default function ProfilePage() {
  const router = useRouter()
  const { play } = useSound()
  const [profiles, setProfiles] = useState([])
  const [slotStats, setSlotStats] = useState({})
  // Arrived via the wall pan → chips render pre-settled (no roll-in).
  const [instantChips, setInstantChips] = useState(false)
  // True while retreating back to the gate — the reverse camera move:
  // content rides off right as the wall pans home; push lands at the end
  // of the pan so the gate (whose backdrop is pixel-identical to wall
  // section 0) pops in invisibly.
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const handleRetreat = () => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    setWallCamera(0)
    // Strikers zero-gap: this page's rider carries a GatePreview one
    // screen to the left, so the camera arrives at a populated gate.
    // Push after the pan settles; the real gate mounts over the
    // preview's identical resting pixels.
    try { sessionStorage.setItem('gtl-wall-return', '1') } catch (_) {}
    setTimeout(() => router.push('/'), WALL_PAN_MS + 80)
  }
  const [input, setInput] = useState('')
  const [ready, setReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  // Zoom-through to the hub (profile tap) — see selectProfile.
  const [zooming, setZooming] = useState(false)
  const [pendingNewName, setPendingNewName] = useState(null)
  const [pendingExpName, setPendingExpName] = useState(null)
  const inputRef = useRef(null)
  const skippedRef = useRef(false)
  const transitioningRef = useRef(false)
  const [submitPressed, setSubmitPressed] = useState(false)

  useEffect(() => {
    // Wall camera: mid-pan arrival keeps the in-flight transition (an
    // instant snap here would cut it short); direct visits snap to
    // section 1 so the wall backdrop is in place.
    let fromPan = false
    try {
      fromPan = sessionStorage.getItem('gtl-wall-arrive') === '1'
      sessionStorage.removeItem('gtl-wall-arrive')
    } catch (_) {}
    // Arrived via the pan: camera's already at rest on section 1 (the
    // home page's ProfilesPreview covered the trip) — touch nothing, and
    // let chips render settled instead of replaying entrances.
    if (fromPan) setInstantChips(true)
    else setWallCamera(1, { instant: true })
    try {
      const raw = localStorage.getItem('gtl-profiles')
      if (raw) {
        const list = JSON.parse(raw)
        setProfiles(list)
        // Save-slot stats per chip. Sync localStorage scans — cheap for a
        // handful of warriors.
        const map = {}
        for (const p of list) map[p] = profileSlotStats(p)
        setSlotStats(map)
      }
    } catch (_) {}
    setReady(true)
  }, [])

  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    router.push(HUB_TARGET)
  }

  // Predictive-tap chain wiring — entry page. Clears any stale chain state
  // left by an abandoned run (e.g. retreat from hub mid-HT) on mount, and
  // registers the 'profile' skip-route. No consume: the chain starts here
  // via armChain() in selectProfile, not from a staged intent.
  useChainPage({
    step: 'profile',
    clearTag: 'profile-mount',
    entry: true,
    routeForward: () => skipNow(),
  })

  const ZOOM_MS = 800
  const selectProfile = (name) => {
    if (transitioningRef.current) { skipNow(); return }
    transitioningRef.current = true
    try {
      localStorage.setItem('gtl-active-profile', name)
    } catch (_) {}
    armChain()
    setInAnimation('profile', true)
    // Zoom-through (Jordan 2026-07-25): the camera pushes INTO the wall —
    // this screen scales past the lens while the hub "room" (HubPreview)
    // grows from depth beneath it. Push after it settles; the real hub
    // mounts over identical pixels. The LET'S SEE mantra word rides a
    // text-thin ribbon across the zoom (Jordan kept it from the old
    // heist cut).
    play('transition-slash')
    setZooming(true)
    setTimeout(() => {
      if (!skippedRef.current) {
        skippedRef.current = true
        router.push(HUB_TARGET)
      }
    }, ZOOM_MS + 60)
  }

  const swipeSelectProfile = (name) => {
    if (transitioningRef.current) return
    transitioningRef.current = true
    try {
      localStorage.setItem('gtl-active-profile', name)
      localStorage.setItem('gtl-deep-launch', '1')
    } catch (_) {}
    router.push('/fitness/active')
  }

  const handleTransitionComplete = () => {
    if (skippedRef.current) return
    router.push(HUB_TARGET)
  }

  // Tap mid-zoom skips straight to the hub (predictive-chain rhythm).
  useEffect(() => {
    if (!zooming) return
    const handler = () => skipNow()
    window.addEventListener('pointerdown', handler, { capture: true })
    return () => window.removeEventListener('pointerdown', handler, { capture: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zooming])

  const handleSubmit = (e) => {
    e.preventDefault()
    const name = input.trim()
    if (!name) return
    let createdNew = false
    try {
      const existing = JSON.parse(localStorage.getItem('gtl-profiles') || '[]')
      if (!existing.includes(name)) {
        const updated = [name, ...existing]
        localStorage.setItem('gtl-profiles', JSON.stringify(updated))
        setProfiles(updated)
        setSlotStats(s => ({ ...s, [name]: { level: 0, tier: 'RELAXED', daysTrained: 0 } }))
        createdNew = true
      }
    } catch (_) {}
    play('card-confirm')
    if (createdNew) {
      try { localStorage.setItem('gtl-active-profile', name) } catch (_) {}
      setPendingNewName(name)
      return
    }
    selectProfile(name)
  }

  // Body weight (required) + birthday (optional, null when the wheels
  // were left on '—') from the single VitalsStep card. DOB is app-level
  // (not profile-scoped): one human → one birthday, even with multiple
  // warrior save slots. See lib/userPrefs.js.
  const handleVitalsConfirm = (bw, iso) => {
    if (!pendingNewName) return
    try { localStorage.setItem(pk('user-bodyweight'), String(bw)) } catch (_) {}
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      setUserDOB(iso)
    }
    const name = pendingNewName
    setPendingNewName(null)
    play('card-confirm')
    setPendingExpName(name)
  }

  // Lifting experience — profile-scoped claim seeding the honesty bands
  // (lib/exp/experience.js). pk() works here because the new profile was
  // already made active in handleSubmit. Skip leaves it unset → 'years'.
  const handleExperienceConfirm = (tier) => {
    if (!pendingExpName) return
    setClaimedExperience(tier)
    const name = pendingExpName
    setPendingExpName(null)
    play('card-confirm')
    selectProfile(name)
  }

  const handleExperienceSkip = () => {
    if (!pendingExpName) return
    const name = pendingExpName
    setPendingExpName(null)
    play('menu-close')
    selectProfile(name)
  }

  const trimmed = input.trim()
  const isNew = trimmed.length > 0 && !profiles.includes(trimmed)
  const isExisting = trimmed.length > 0 && profiles.includes(trimmed)

  return (
    <>
      <style>{`
        @keyframes yy-pulse-left {
          0%, 100% { transform: translateX(0)   scale(1); }
          50%      { transform: translateX(7px) scale(1.06); }
        }
        @keyframes yy-pulse-right {
          0%, 100% { transform: translateX(0)    scale(1); }
          50%      { transform: translateX(-7px) scale(1.06); }
        }
        @keyframes logo-roll-in-profile {
          0%   { transform: translateX(294px) rotate(360deg); }
          100% { transform: translateX(0)     rotate(0deg);   }
        }
      `}</style>

      {/* Transparent main — this screen sits on section 1 of the root-
          layout WallBackdrop (identical to the press-start backdrop), so
          the entry pan reads as one camera move (Jordan 2026-07-23).
          The old void bg + noise + gradient now come from the wall. */}
      <main className="relative flex flex-col overflow-hidden" style={{ minHeight: '100%' }}>
        {/* Strikers rider: on retreat, this page's whole visual rides
            right IN LOCKSTEP with the wall while a GatePreview rides in
            from the left — both places visible the entire pan, nothing
            disappears, no empty beat (Jordan 2026-07-23). */}
        <style>{`
          @keyframes gtl-zoomtitle-ride {
            0%   { transform: rotate(-3deg) translateX(-120vw); }
            24%  { transform: rotate(-3deg) translateX(0); }
            76%  { transform: rotate(-3deg) translateX(0); }
            100% { transform: rotate(-3deg) translateX(120vw); }
          }
          @keyframes gtl-zoom-out {
            0%   { transform: scale(1);   opacity: 1; }
            55%  {                        opacity: 1; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          @keyframes gtl-hub-rise {
            0%   { transform: scale(0.85); opacity: 0; }
            30%  {                         opacity: 1; }
            100% { transform: scale(1);    opacity: 1; }
          }
          @keyframes gtl-rider-back {
            from { transform: translateX(0); }
            to   { transform: translateX(100vw); }
          }
        `}</style>

        {/* Rider — carries EVERYTHING this page paints (accent bar, kanji,
            content) plus the GatePreview one screen left. On retreat it
            translates in lockstep with the wall; at rest it's an inert
            full-size wrapper. Arrival needs no animation: the home page's
            ProfilesPreview covered the pan, and this real page mounts
            over its identical resting pixels. */}
        {/* LET'S SEE — the mantra word kept from the heist cut, riding a
            ribbon exactly as tall as its own letters (Jordan 2026-07-25:
            "as thin as the LET'S SEE font is"). Grouped band + text sweep
            in from the left, hold through the dive, exit right. */}
        {zooming && (
          <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-hidden" aria-hidden="true">
            <div
              className="relative"
              style={{ animation: 'gtl-zoomtitle-ride 800ms cubic-bezier(0.25, 0.9, 0.3, 1) both' }}
            >
              <div
                className="absolute bg-gtl-red"
                style={{ left: '-60vw', right: '-60vw', top: '50%', height: '0.78em', transform: 'translateY(-50%)', fontSize: '18vw' }}
              />
              <div className="relative font-display text-gtl-paper leading-none gtl-headline-shadow text-center text-[18vw] whitespace-nowrap">
                LET&apos;S SEE
              </div>
            </div>
          </div>
        )}

        {/* The hub room grows from depth beneath this screen during the
            zoom-through. */}
        {zooming && (
          <div
            className="absolute inset-0"
            style={{ animation: 'gtl-hub-rise 800ms cubic-bezier(0.3, 0.6, 0.2, 1) both', transformOrigin: '50% 45%' }}
          >
            <HubPreview />
          </div>
        )}
        <div
          className="relative flex-1 flex flex-col"
          style={{
            animation: zooming
              ? 'gtl-zoom-out 800ms cubic-bezier(0.55, 0, 0.6, 0.4) both'
              : leaving
                ? `gtl-rider-back ${WALL_PAN_MS}ms cubic-bezier(0.65, 0, 0.2, 1) both`
                : 'none',
            transformOrigin: '50% 45%',
            pointerEvents: (leaving || zooming) ? 'none' : 'auto',
          }}
        >
        {leaving && <GatePreview />}

        {/* Kanji watermark removed 2026-07-24 (Jordan) — its flicker layer
            caused mid-pan bleed-through and a flicker-state mismatch at the
            preview swap. The wall carries the atmosphere now. */}

        {/* Content wrapper */}
        <div className="relative z-10 flex-1 flex flex-col">

          {/* Nav */}
          <nav
            className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-3"
            style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
          >
            <RetreatButton href="/" onNavigate={handleRetreat} />
            <div className="font-mono text-[10px] leading-none tracking-[0.3em] uppercase text-gtl-smoke">
              IDENTITY / SELECT
            </div>
          </nav>

          {/* Main */}
          <section className="relative z-10 flex-1 flex flex-col px-8 pt-2 pb-8 max-w-3xl mx-auto w-full">

            {/* Headline */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-16 bg-gtl-red" />
                <span className="font-mono text-[10px] leading-none tracking-[0.3em] uppercase text-gtl-red">
                  IDENTITY / 01
                </span>
                <div className="h-px w-16 bg-gtl-red" />
              </div>
              <h1 className="font-display text-[4.5rem] md:text-[7rem] leading-[65px] md:leading-[0.9] text-gtl-chalk -rotate-1 mb-2">
                WHO<br />
                <span className="text-gtl-red inline-block rotate-1">ARE YOU</span>
              </h1>
              <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-gtl-ash mt-3 max-w-sm leading-[18px]">
                Your cycles, lifts, and EXP belong to you alone.<br />
                Step in. Own the record.
              </p>
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit} action="/" method="post" className="mb-5">
              <div className="flex items-stretch gap-0">

                {/* Text field */}
                <div className="relative flex-1">
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      clipPath: 'polygon(0% 0%, 97% 0%, 100% 100%, 0% 100%)',
                      background: '#111115',
                      border: '1px solid #26262a',
                    }}
                    aria-hidden="true"
                  />
                  {/* Left focus indicator */}
                  <div
                    className="absolute top-0 bottom-0 left-0 pointer-events-none"
                    style={{
                      width: trimmed ? 3 : 2,
                      background: trimmed ? '#d4181f' : '#26262a',
                      transition: 'width 200ms ease-out, background 200ms ease-out',
                    }}
                    aria-hidden="true"
                  />
                  {input.length === 0 && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none flex items-center px-5 md:px-7 font-display text-xl md:text-3xl text-gtl-smoke tracking-wide uppercase"
                    >
                      ENTER YOUR N{'​'}AME
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="search"
                    name="gtl-warrior-token"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    inputMode="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={24}
                    className="relative w-full bg-transparent font-display text-xl md:text-3xl text-gtl-chalk tracking-wide uppercase px-5 md:px-7 outline-none [&::-webkit-search-cancel-button]:hidden"
                    style={{ caretColor: '#d4181f', padding: '1.5rem 1.75rem' }}
                  />
                </div>

                {/* Submit — shadow slab */}
                <button
                  type="submit"
                  disabled={!trimmed}
                  className="relative shrink-0 outline-none"
                  onPointerDown={() => setSubmitPressed(true)}
                  onPointerUp={() => setSubmitPressed(false)}
                  onPointerCancel={() => setSubmitPressed(false)}
                >
                  {/* Shadow */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                      background: '#4a0a0e',
                      transform: (submitPressed && trimmed) ? 'translate(0,0)' : 'translate(5px, 5px)',
                      transition: 'transform 80ms ease-out',
                    }}
                    aria-hidden="true"
                  />
                  {/* Face */}
                  <div
                    className="relative flex items-center gap-2"
                    style={{
                      clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                      background: !trimmed ? '#1a1a1e' : (submitPressed ? '#ff2a36' : '#d4181f'),
                      transform: (submitPressed && trimmed) ? 'translate(5px, 5px)' : 'translate(0,0)',
                      transition: 'transform 80ms ease-out, background 80ms ease-out',
                      padding: '1.5rem 1.75rem',
                    }}
                  >
                    <span
                      className="font-mono text-[10px] leading-none tracking-[0.3em] uppercase font-bold"
                      style={{ color: trimmed ? '#f4ede0' : '#4a4a4f', transition: 'color 200ms' }}
                    >
                      {isNew ? 'FORGE' : 'ENTER'}
                    </span>
                    <span
                      className="font-display text-xl leading-none"
                      style={{ color: trimmed ? '#f4ede0' : '#4a4a4f', transition: 'color 200ms' }}
                    >
                      ➤︎
                    </span>
                  </div>
                </button>
              </div>

              {isNew && (
                <div className="flex items-center gap-3 mt-3 pl-1">
                  <div className="h-px w-6 bg-gtl-red opacity-60" />
                  <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash">
                    NEW WARRIOR — A FRESH RECORD WILL BE FORGED
                  </p>
                </div>
              )}
            </form>

            {/* Known warriors */}
            {ready && profiles.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="h-px w-8 bg-gtl-red" />
                  <span className="font-mono text-[9px] leading-none tracking-[0.4em] uppercase text-gtl-red">
                    KNOWN WARRIORS
                  </span>
                  <div className="h-px flex-1 bg-gtl-edge" />
                </div>

                <div className="flex items-center gap-3 mb-3 font-mono text-[8px] leading-none tracking-[0.25em] uppercase text-gtl-ash/70">
                  <span>TAP TO LOAD</span>
                  <span className="text-gtl-red">·</span>
                  <span>SWIPE TO LIFT NOW →</span>
                </div>

                <div className="flex flex-col gap-4">
                  {profiles.map(name => (
                    <ProfileChip
                      key={name}
                      name={name}
                      stats={slotStats[name]}
                      onSelect={selectProfile}
                      onSwipeSelect={swipeSelectProfile}
                      instantEntrance={instantChips}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-6">
                  <div className="h-px flex-1 bg-gtl-edge" />
                  <span className="font-mono text-[8px] leading-none tracking-[0.3em] uppercase text-gtl-smoke">
                    {profiles.length} {profiles.length === 1 ? 'WARRIOR' : 'WARRIORS'} ON RECORD
                  </span>
                  <div className="h-px w-8 bg-gtl-edge" />
                </div>
              </div>
            )}
          </section>
        </div>
        </div>{/* /rider */}
      </main>

      <HeistTransition
        active={transitioning}
        title="LET'S SEE"
        onComplete={handleTransitionComplete}
      />

      {pendingNewName && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
          style={{ background: 'rgba(8,8,12,0.78)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Enter body weight and birthday"
        >
          <VitalsStep onConfirm={handleVitalsConfirm} />
        </div>
      )}

      {pendingExpName && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
          style={{ background: 'rgba(8,8,12,0.78)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="How long have you been lifting"
        >
          <ExperienceStep onConfirm={handleExperienceConfirm} onSkip={handleExperienceSkip} />
        </div>
      )}
    </>
  )
}
