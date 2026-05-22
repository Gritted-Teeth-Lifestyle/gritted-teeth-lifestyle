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
  const [entranceDone, setEntranceDone] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntranceDone(true), 1300)
    return () => clearTimeout(t)
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
          className="relative inline-block leading-none tracking-tight"
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          {name.toUpperCase()}
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
  const [input, setInput] = useState('')
  const [ready, setReady] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [pendingNewName, setPendingNewName] = useState(null)
  const [pendingDOBName, setPendingDOBName] = useState(null)
  const inputRef = useRef(null)
  const skippedRef = useRef(false)
  const transitioningRef = useRef(false)
  const [submitPressed, setSubmitPressed] = useState(false)

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
    router.push(HUB_TARGET)
  }

  useEffect(() => registerChainStep('profile', () => skipNow()), [])

  const selectProfile = (name) => {
    if (transitioningRef.current) { skipNow(); return }
    transitioningRef.current = true
    try {
      localStorage.setItem('gtl-active-profile', name)
    } catch (_) {}
    armChain()
    setInAnimation('profile', true)
    setTransitioning(true)
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
        @keyframes logo-roll-in-profile {
          0%   { transform: translateX(294px) rotate(360deg); }
          100% { transform: translateX(0)     rotate(0deg);   }
        }
      `}</style>

      <main className="relative min-h-screen bg-gtl-void flex flex-col overflow-hidden">
        <div className="absolute inset-0 gtl-noise pointer-events-none" />

        {/* Atmospheric gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(122,14,20,0.22) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.32) 100%)',
          }}
        />

        {/* Left red accent bar */}
        <div
          className="absolute top-0 bottom-0 left-0 pointer-events-none"
          style={{
            width: 4,
            background: 'linear-gradient(to bottom, #d4181f 0%, rgba(212,24,31,0.3) 60%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        {/* Kanji watermark */}
        <div
          className="absolute -left-8 pointer-events-none select-none animate-flicker"
          aria-hidden="true"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) - 48px)',
            fontFamily: '"FOT-Matisse Pro EB", "Noto Serif JP", serif',
            fontSize: '40rem',
            lineHeight: '0.8',
            color: '#ffffff',
            opacity: 0.04,
            fontWeight: 900,
          }}
        >
          名
        </div>

        {/* Content wrapper */}
        <div className="relative z-10 flex-1 flex flex-col">

          {/* Nav */}
          <nav
            className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-3"
            style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
          >
            <RetreatButton href="/" />
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke">
              IDENTITY / SELECT
            </div>
          </nav>

          {/* Main */}
          <section className="relative z-10 flex-1 flex flex-col px-8 pt-2 pb-8 max-w-3xl mx-auto w-full">

            {/* Headline */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-16 bg-gtl-red" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">
                  IDENTITY / 01
                </span>
                <div className="h-px w-16 bg-gtl-red" />
              </div>
              <h1 className="font-display text-[4.5rem] md:text-[7rem] leading-[0.9] text-gtl-chalk -rotate-1 mb-2">
                WHO<br />
                <span className="text-gtl-red inline-block rotate-1">ARE YOU</span>
              </h1>
              <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-gtl-ash mt-3 max-w-sm leading-relaxed">
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
                      className="font-mono text-[10px] tracking-[0.3em] uppercase font-bold"
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
                  <span className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-red">
                    KNOWN WARRIORS
                  </span>
                  <div className="h-px flex-1 bg-gtl-edge" />
                </div>

                <div className="flex items-center gap-3 mb-3 font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-ash/70">
                  <span>TAP TO LOAD</span>
                  <span className="text-gtl-red">·</span>
                  <span>SWIPE TO LIFT NOW →</span>
                </div>

                <div className="flex flex-col gap-4">
                  {profiles.map(name => (
                    <ProfileChip
                      key={name}
                      name={name}
                      onSelect={selectProfile}
                      onSwipeSelect={swipeSelectProfile}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-6">
                  <div className="h-px flex-1 bg-gtl-edge" />
                  <span className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke">
                    {profiles.length} {profiles.length === 1 ? 'WARRIOR' : 'WARRIORS'} ON RECORD
                  </span>
                  <div className="h-px w-8 bg-gtl-edge" />
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
