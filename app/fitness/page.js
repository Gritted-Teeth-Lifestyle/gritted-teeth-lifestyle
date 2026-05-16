'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSound } from '../../lib/useSound'
import HeistTransition from '../../components/HeistTransition'
import RetreatButton from '../../components/RetreatButton'
import { LogoStencil, LogoTarget } from '../../components/LogoHalf'
import { armChain, setInAnimation, registerChainStep } from '../../lib/predictiveTap'
import { pk } from '../../lib/storage'
import BodyweightStep from '../../components/onboarding/BodyweightStep'
import DateOfBirthStep from '../../components/onboarding/DateOfBirthStep'

function ProfileChip({ name, onSelect, onSwipeSelect }) {
  const { play } = useSound()
  // Pointer-tracking refs for swipe-vs-tap discrimination. Signed dx —
  // positive = right swipe, negative = left swipe. Either direction at
  // full traversal triggers swipe-select.
  const startRef = useRef(null)
  const dxRef = useRef(0)
  const swipeFiredRef = useRef(false)
  const velocityTrackerRef = useRef([])
  const VELOCITY_WINDOW_MS = 100
  const FLICK_VELOCITY = 0.4    // px/ms
  const FLICK_MIN_DISTANCE = 40 // px
  const [dragX, setDragX] = useState(0)
  const [ringKey, setRingKey] = useState(0)
  const [ringSide, setRingSide] = useState('right')
  const [entranceDone, setEntranceDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntranceDone(true), 1300)
    return () => clearTimeout(t)
  }, [])
  // Full traversal — gap between bead centers = 2 * (175 - 28) = 294px,
  // beads pinned via calc(50% - 175px). Matches ActivatePopup spacing.
  const SWIPE_THRESHOLD = 294

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY }
    dxRef.current = 0
    swipeFiredRef.current = false
    velocityTrackerRef.current = [{ t: e.timeStamp, x: e.clientX }]
    setDragX(0)
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
    /* Wrapper hosts the button + the shockwave ring. Wrapper has no
       clip-path, so the ring (rendered as a sibling of the button) can scale
       outward freely instead of being cropped to the button's parallelogram
       silhouette. Wrapper carries the -mx-5 + width:calc(100%+40px) layout
       so its bounding box matches the button's, keeping the ring's
       calc(50% - 175px) positioning aligned with the bead positions. */
    <div className="relative block w-full -mx-5" style={{ width: 'calc(100% + 40px)' }}>
    <button
      type="button"
      data-predictive-tap-target="profile"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { startRef.current = null; dxRef.current = 0; swipeFiredRef.current = false; velocityTrackerRef.current = []; setDragX(0) }}
      onClick={handleClick}
      className={`
        relative group flex items-center justify-center
        font-display tracking-[0.25em] uppercase overflow-visible
        px-24 py-5 min-h-[56px] block w-full
        text-3xl text-gtl-chalk [@media(hover:hover)]:hover:text-gtl-paper
        transition-all duration-200 ease-out
        [@media(hover:hover)]:hover:scale-[1.04] active:scale-[0.98]
        bg-gtl-surface border border-gtl-edge
        [@media(hover:hover)]:hover:bg-gtl-red [@media(hover:hover)]:hover:border-transparent
        shadow-[4px_4px_0_#070708]
        [@media(hover:hover)]:hover:shadow-[6px_6px_0_#070708]
        active:shadow-[2px_2px_0_#070708]
      `}
      style={{
        clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <span
        className="relative inline-block leading-none tracking-tight"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        {name.toUpperCase()}
      </span>
      {/* Stencil + target on opposite sides. Whichever side gets pulled rolls
          (wheel-style, no slipping) all the way to the other side and docks. */}
      {(() => {
        // One full rotation across a full swipe — lands upright at fusion.
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
              // Gated on entranceDone too so it stays in phase with the stencil pulse.
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
    {/* Shockwave ring on successful swipe — sibling of the button so the
        button's clip-path doesn't crop the expanding ring. Uses the global
        @keyframes shockwave (matches the muscle-target ALL button). */}
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
  const [input, setInput] = useState('')
  const [ready, setReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  // Onboarding BW step — captured for new warriors before routing to hub.
  const [pendingNewName, setPendingNewName] = useState(null)
  // Onboarding DOB step — runs after BW step; skippable (R16 birthday is
  // optional). Holds the new warrior's name until DOB capture or skip.
  const [pendingDOBName, setPendingDOBName] = useState(null)
  const inputRef = useRef(null)
  // Latches once skipAll fires so HeistTransition.onComplete won't double-route.
  const skippedRef = useRef(false)
  // Synchronous flag — set on first selectProfile so a fast follow-up tap on the
  // same chip / submit button skips even if React hasn't committed `transitioning`
  // to state yet (the window pointerdown listener installs in the post-commit
  // useEffect, so there's a brief window where it isn't yet listening).
  const transitioningRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gtl-profiles')
      if (raw) setProfiles(JSON.parse(raw))
    } catch (_) {}
    setReady(true)
  }, [])

  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    // Don't close the predictive-tap inAnim window — the next page's
    // consumePrefire will re-assert it with the new currentStep.
    // Closing here creates a ~30-60ms gap between hops where rapid
    // taps would silently fall through to reactive-skip-only.
    router.push(HUB_TARGET)
  }

  // Register skip-route for the 'profile' chain step. The module-level
  // listener in lib/predictiveTap.js calls this when a tap arrives past
  // SKIP_GRACE_MS during the profile HT, replacing the per-page window
  // pointerdown listener pattern. Retreat-button exclusion is handled
  // centrally.
  useEffect(() => registerChainStep('profile', () => skipNow()), [])

  const selectProfile = (name) => {
    // Already transitioning → this rapid second tap is a skip.
    if (transitioningRef.current) { skipNow(); return }
    transitioningRef.current = true
    try {
      localStorage.setItem('gtl-active-profile', name)
    } catch (_) {}
    // Arm the predictive-tap chain. The next 4 taps inside the shared
    // hit-zone (during transition animations) prefire forward.
    armChain()
    // The HeistTransition is about to play — flag the chain in-animation
    // so a hit-zone tap during the wipe stages a 'hub-load' prefire.
    setInAnimation('profile', true)
    setTransitioning(true)
  }

  // Swipe-select on a profile chip → deep-launch straight through hub/load/active
  // to the first set's weight popup. Skips HeistTransition entirely. Only works
  // if the profile already has an active cycle (training-days populated under pk).
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
    // inAnim stays open across the hop — next page's consumePrefire
    // re-asserts it. See skipNow comment above.
    if (skippedRef.current) return
    router.push(HUB_TARGET)
  }

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
        createdNew = true
      }
    } catch (_) {}
    play('card-confirm')
    if (createdNew) {
      // Set active profile early so pk('user-bodyweight') writes to the
      // correct profile scope. Then mount the BW capture step before
      // routing — R1a requires bodyweight before any BW-coefficient set.
      try { localStorage.setItem('gtl-active-profile', name) } catch (_) {}
      setPendingNewName(name)
      return
    }
    selectProfile(name)
  }

  const handleBodyweightConfirm = (bw) => {
    if (!pendingNewName) return
    try { localStorage.setItem(pk('user-bodyweight'), String(bw)) } catch (_) {}
    const name = pendingNewName
    setPendingNewName(null)
    play('card-confirm')
    // Hand off to the (skippable) DOB step before routing to hub.
    setPendingDOBName(name)
  }

  const handleDOBConfirm = (iso) => {
    if (!pendingDOBName) return
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      try { localStorage.setItem(pk('user-dob'), iso) } catch (_) {}
    }
    const name = pendingDOBName
    setPendingDOBName(null)
    play('card-confirm')
    selectProfile(name)
  }

  const handleDOBSkip = () => {
    if (!pendingDOBName) return
    const name = pendingDOBName
    setPendingDOBName(null)
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
      /* Onboarding: stencil rolls off the target on mount. translateX
         matches SWIPE_THRESHOLD (294px). */
      @keyframes logo-roll-in-profile {
        0%   { transform: translateX(294px) rotate(360deg); }
        100% { transform: translateX(0)     rotate(0deg);   }
      }
    `}</style>
    <main className="relative min-h-screen bg-gtl-void flex flex-col overflow-hidden">
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(122,14,20,0.2) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.3) 100%)',
        }}
      />

      {/* Kanji watermark — top offset rooted at the safe-area floor so it never clips
          into the iOS Dynamic Island camera area. */}
      <div
        className="absolute -left-8 pointer-events-none select-none animate-flicker"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 48px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '40rem',
          lineHeight: '0.8',
          color: '#ffffff',
          opacity: 0.04,
          fontWeight: 900,
        }}
      >
        名
      </div>

      {/* Content wrapper — atmospheric layers above paint full-bleed (incl. safe area);
          this wrapper holds the actual UI and pads down by the iOS top inset. */}
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Nav */}
      <nav
        className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-3"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <RetreatButton href="/" />      </nav>

      {/* Main */}
      <section className="relative z-10 flex-1 flex flex-col px-8 pt-0 pb-8 max-w-3xl mx-auto w-full">
        {/* Headline */}
        <div className="mb-2">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-16 bg-gtl-red" />
            <span className="font-matisse text-[10px] tracking-[0.3em] uppercase text-gtl-red">
              IDENTITY / 01
            </span>
          </div>
          <h1 className="font-matisse text-[5rem] md:text-[7rem] leading-[0.9] text-gtl-chalk -rotate-1">
            WHO<br />
            <span className="text-gtl-red inline-block rotate-1">ARE YOU</span>
          </h1>
          <p className="font-mono text-xs tracking-[0.25em] uppercase text-gtl-ash mt-1 max-w-sm">
            Your cycles, lifts, and EXP belong to you alone.
          </p>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} action="/" method="post" className="mb-3">
          <div className="flex items-stretch gap-0">
            <div className="relative flex-1">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  clipPath: 'polygon(0% 0%, 97% 0%, 100% 100%, 0% 100%)',
                  background: '#111115',
                  border: '1px solid #3a3a42',
                }}
                aria-hidden="true"
              />
              {/* Visible-prompt overlay — shows when input is empty. Sits inside the
                  input's slot but is a sibling div, NOT the input's placeholder. iOS
                  heuristics scan placeholder text for "name"/"email" keywords; moving
                  the prompt out of the placeholder attribute kills that signal. */}
              {input.length === 0 && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none flex items-center px-4 md:px-6 font-display text-lg md:text-2xl text-gtl-smoke tracking-wide uppercase"
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
                className="relative w-full bg-transparent font-display text-lg md:text-2xl text-gtl-chalk tracking-wide uppercase px-4 md:px-6 py-4 outline-none [&::-webkit-search-cancel-button]:hidden"
                style={{ caretColor: '#d4181f' }}
              />
            </div>
            <button
              type="submit"
              disabled={!trimmed}
              className="relative shrink-0 outline-none group"
            >
              <div
                className={`absolute inset-0 pointer-events-none transition-colors duration-200
                  ${trimmed ? 'bg-gtl-red group-hover:bg-gtl-red-bright' : 'bg-gtl-surface'}`}
                style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }}
                aria-hidden="true"
              />
              <div className="relative px-4 md:px-8 py-4 flex items-center gap-2">
                <span className={`font-mono text-[10px] tracking-[0.3em] uppercase font-bold transition-colors duration-200
                  ${trimmed ? 'text-gtl-paper' : 'text-gtl-ash'}`}>
                  {isNew ? 'CREATE' : isExisting ? 'ENTER' : 'ENTER'}
                </span>
                <span className={`font-display text-lg leading-none transition-colors duration-200
                  ${trimmed ? 'text-gtl-paper' : 'text-gtl-ash'}`}>➤︎</span>
              </div>
            </button>
          </div>
          {isNew && (
            <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash mt-2 pl-1">
              NEW WARRIOR — A FRESH RECORD WILL BE CREATED
            </p>
          )}
        </form>

        {/* Existing profiles */}
        {ready && profiles.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-1">
              <div className="h-px w-8 bg-gtl-edge" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
                KNOWN WARRIORS
              </span>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
            {/* Gesture hint — teaches both interactions for the chip below. */}
            <div className="flex items-center gap-3 mb-1 font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-ash/80">
              <span>TAP TO LOAD PROFILE</span>
              <span className="text-gtl-red">·</span>
              <span>SWIPE TO LIFT NOW →</span>
            </div>
            <div className="flex flex-col gap-3">
              {profiles.map(name => (
                <ProfileChip key={name} name={name} onSelect={selectProfile} onSwipeSelect={swipeSelectProfile} />
              ))}
            </div>
          </div>
        )}
      </section>
      </div>
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
        aria-label="Enter body weight"
      >
        <BodyweightStep onConfirm={handleBodyweightConfirm} />
      </div>
    )}

    {pendingDOBName && (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
        style={{ background: 'rgba(8,8,12,0.78)', backdropFilter: 'blur(4px)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Enter birthday"
      >
        <DateOfBirthStep onConfirm={handleDOBConfirm} onSkip={handleDOBSkip} />
      </div>
    )}
    </>
  )
}
