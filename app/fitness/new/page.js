'use client'
/*
 * /fitness/new — Name Your Cycle screen.
 *
 * The user has just survived a mega heist transition. They're now staring
 * at the most important screen in this slice: a single text input where
 * each typed character starts the size of the screen and crashes down to
 * inline size with a brand-iron sound and a full-screen vibration.
 *
 * - Random default name pre-loaded on mount, cascades in
 * - Each subsequent keystroke triggers char-stamp + screen-shake + sound
 * - Backspace is silent (no shake) — only adds get the moment
 * - Background flavor text reduced to one sentence per latest spec
 * - No forge button; RETREAT is the only way out
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSound } from '../../../lib/useSound'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import FireTransition from '../../../components/FireTransition'
import HeistTransition from '../../../components/HeistTransition'
import SpeedLines from '../../../components/SpeedLines'
import RetreatButton from '../../../components/RetreatButton'
import { LogoStencil, LogoTarget } from '../../../components/LogoHalf'

const MAX_LEN = 40

const RANDOM_NAMES = [
  'PIERCE THE HEAVENS',
  'FORGE THE ABYSS',
  'BURN THE DAY',
  'DRILL THROUGH STONE',
  'CLIMB THE SPIRAL',
  'BREAK THE CHAIN',
  'STEEL THE WILL',
  'IGNITE THE MARROW',
  'OUTRUN THE SHADOW',
  'EIGHT WEEKS OF FIRE',
  'BLOOD AND BONE',
  'THE CRUCIBLE',
  'INTO THE STORM',
  'FIRST LIGHT',
  'NEVER KNEEL',
  'BEYOND THE BREAK',
  'THE LONG ASCENT',
  'CARVE THE PATH',
]

function pickRandomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
}

/* ── FORGE button with tap-vs-swipe gesture ── */
function ForgeButton({ forgeRef, disabled, onTap, onSwipe }) {
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
  // Full traversal — gap between bead centers = 294px, beads pinned at
  // calc(50% - 175px) on each side near the button ends.
  const SWIPE_THRESHOLD = 294

  const handlePointerDown = (e) => {
    if (disabled) return
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

    if (fired && onSwipe) {
      swipeFiredRef.current = true
      setRingSide(dxRef.current > 0 ? 'right' : 'left')
      setRingKey((k) => k + 1)
      onSwipe()
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
    onTap()
  }
  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD)

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
      /* Onboarding: stencil rolls off the target on mount. translateX value
         matches the FORGE button's SWIPE_THRESHOLD (294px). */
      @keyframes logo-roll-in-forge {
        0%   { transform: translateX(294px) rotate(360deg); }
        100% { transform: translateX(0)     rotate(0deg);   }
      }
    `}</style>
    {/* Wrapper hosts the button + the shockwave ring as siblings. Wrapper
        has no clip-path, so the ring scales outward freely instead of being
        cropped by the button's parallelogram silhouette. */}
    <div className="relative block w-full -mx-5" style={{ width: 'calc(100% + 40px)' }}>
    <button
      ref={forgeRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { startRef.current = null; dxRef.current = 0; swipeFiredRef.current = false; velocityTrackerRef.current = []; setDragX(0) }}
      onClick={handleClick}
      disabled={disabled}
      className={`
        relative font-display tracking-[0.25em] uppercase overflow-visible
        px-24 py-5 min-h-[56px] block w-full
        text-3xl text-gtl-paper
        transition-all duration-200 ease-out
        disabled:opacity-30 disabled:cursor-not-allowed
        enabled:[@media(hover:hover)]:hover:scale-[1.04] enabled:active:scale-[0.98]
        enabled:bg-gtl-red-bright bg-gtl-red
        shadow-[4px_4px_0_#070708]
        enabled:[@media(hover:hover)]:hover:shadow-[6px_6px_0_#070708]
        enabled:active:shadow-[2px_2px_0_#070708]
      `}
      style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', touchAction: 'pan-y' }}
    >
      <span className="relative inline-block">
        {swipeProgress >= 1 ? 'LIFT NOW' : 'FORGE'}
      </span>
      {/* Logo halves on opposite sides. Swipe in either direction pulls one
          across to the other's slot to fuse. */}
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
              opacity: 0.9 + swipeProgress * 0.1,
              transition: dragX === 0 ? 'transform 220ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms' : 'opacity 100ms',
              animation: !entranceDone
                ? 'logo-roll-in-forge 1300ms cubic-bezier(0.85, 0, 0.15, 1) forwards'
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
              opacity: 0.9 + swipeProgress * 0.1,
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
        button's clip-path doesn't crop the expanding ring. */}
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
    </>
  )
}

/**
 * StampedNameInput — the main event.
 *
 * Renders an offscreen real <input> for accessibility/native handling,
 * and a custom display where each character is its own animated <span>.
 * New characters get fresh keys, which forces remount and triggers the
 * mega char-stamp animation.
 *
 * Calls `onCharAdded` whenever a NEW character is typed (not on delete),
 * so the parent can fire the screen shake and sound at the right moment.
 */
function StampedNameInput({ value, onChange, maxLength, isInitialMount, entranceSkipped, onCharAdded, onConfirm, isBranding, onInputFocus }) {
  const inputRef = useRef(null)
  const charKeysRef = useRef([])
  const { play } = useSound()
  const prevLenRef = useRef(0)

  if (value.length !== prevLenRef.current) {
    if (value.length > prevLenRef.current) {
      while (charKeysRef.current.length < value.length) {
        charKeysRef.current.push(`k-${Date.now()}-${Math.random()}`)
      }
    } else {
      charKeysRef.current = charKeysRef.current.slice(0, value.length)
    }
    prevLenRef.current = value.length
  }

  const handleChange = (e) => {
    if (isBranding) return
    const raw = e.target.value
    const next = raw.toUpperCase().slice(0, maxLength)
    if (next.length > value.length) {
      const numAdded = next.length - value.length
      for (let i = 0; i < numAdded; i++) {
        setTimeout(() => onCharAdded && onCharAdded(), i * 60)
      }
    } else if (next.length < value.length) {
      play('char-erase')
    }
    onChange(next)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isBranding && value.trim().length > 0) {
      e.preventDefault()
      if (onConfirm) onConfirm()
    }
  }

  const handleWrapperClick = () => {
    if (isBranding) return
    if (inputRef.current) inputRef.current.focus()
  }

  // No auto-focus on mount. iOS PWA queues a pending focus() call when the
  // page mounts; the user's first tap *anywhere* on the page during the
  // gesture-activation window then pops up the keyboard, even taps under the
  // FORGE button. Keyboard now only opens on a deliberate input-area tap
  // (handleWrapperClick) or via Enter on a hardware keyboard.

  return (
    <div
      onClick={handleWrapperClick}
      className="relative cursor-text select-none"
      role="presentation"
      style={{ overflow: 'visible' }}
    >
      {/* Hidden real input — captures all keyboard input. inputMode + enterKeyHint
          standardize the iOS keyboard layout (text + Done) across all cycle-name entry. */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onInputFocus}
        maxLength={maxLength}
        className="sr-only"
        aria-label="Cycle name"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        disabled={isBranding}
      />

      {/* Visible character display.
          IMPORTANT: overflow visible at every level so the giant scaled
          characters can extend beyond the container without being clipped.
          pointer-events: none — during char-stamp animation the spans are
          scaled to ~20x and cover the whole screen; without this any tap
          (including under FORGE) bubbles up to the wrapper's onClick →
          focus → iOS keyboard pops on first gesture. The wrapper still
          receives taps on its own natural bbox so deliberate input-area
          taps still focus the input. */}
      <div
        className="relative flex flex-wrap items-baseline justify-center gap-y-2 min-h-[2.5rem] md:min-h-[6rem] px-4 pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {value.split('').map((char, i) => (
          <span
            key={isBranding ? `brand-${i}` : charKeysRef.current[i]}
            className={`
              inline-block font-display text-4xl md:text-7xl lg:text-8xl leading-none
              ${isBranding
                ? 'animate-brand-letter'
                : entranceSkipped
                  ? 'text-gtl-chalk'        /* class-based skip: drop animate-char-stamp so the keyframe doesn't run */
                  : 'text-gtl-chalk animate-char-stamp'}
            `}
            style={{
              animationDelay: isBranding
                ? `${i * 20}ms`
                : (isInitialMount ? `${i * 35}ms` : '0ms'),
              transformOrigin: 'center center',
              willChange: 'transform, opacity, filter, color, text-shadow',
              position: 'relative',
              zIndex: 50,
            }}
          >
            {char === ' ' ? '\u00a0' : char}
          </span>
        ))}

        {/* Blinking cursor — hidden during branding */}
        {!isBranding && (
          <span
            className="inline-block w-1.5 md:w-2 h-10 md:h-20 bg-gtl-red-bright animate-cursor-blink ml-1 self-end"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export default function NewCycleNamePage() {
  useProfileGuard()
  const router = useRouter()
  let backHref = '/fitness/hub'
  try { if (localStorage.getItem('gtl-back-to-edit') === '1') backHref = '/fitness/edit' } catch (_) {}
  // Initialize name SYNCHRONOUSLY on first render so the cascade text is on
  // screen frame-1 (no flash of empty content). Editing flow still needs the
  // localStorage lookup; useState initializer reads it on the client only
  // (typeof window check) — server render falls back to empty so hydration
  // matches.
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const editingId = window.localStorage.getItem(pk('editing-cycle-id'))
      const savedName = window.localStorage.getItem(pk('cycle-name'))
      if (editingId && savedName && savedName.trim().length > 0) return savedName.trim()
    } catch (_) {}
    return pickRandomName()
  })
  const nameRef = useRef(name)
  useEffect(() => { nameRef.current = name }, [name])

  // Ref + focus handler for scrolling FORGE into view when the iOS keyboard opens.
  // The hidden input is sr-only at (0,0) so iOS doesn't auto-scroll on focus the way
  // it does for visible inputs (e.g. WHO ARE YOU). 300ms lets the keyboard begin its
  // slide-up animation; then we scroll FORGE to the vertical center of the viewport.
  const forgeButtonRef = useRef(null)
  const handleInputFocus = () => {
    setTimeout(() => {
      forgeButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 300)
  }
  useEffect(() => {
    try { if (localStorage.getItem('gtl-back-to-edit') !== '1') return } catch (_) { return }
    const handleKey = (e) => {
      if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)) {
        const trimmed = nameRef.current.trim()
        if (trimmed) {
          try {
            localStorage.setItem(pk('cycle-name'), trimmed)
            const cycleId = localStorage.getItem(pk('editing-cycle-id'))
            if (cycleId) {
              const raw = localStorage.getItem(pk('cycles'))
              if (raw) {
                const all = JSON.parse(raw)
                localStorage.setItem(pk('cycles'), JSON.stringify(
                  all.map(c => c.id === cycleId ? { ...c, name: trimmed } : c)
                ))
              }
            }
          } catch (_) {}
        }
        router.push('/fitness/edit')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])
  const [isInitialMount, setIsInitialMount] = useState(true)
  const [entranceSkipped, setEntranceSkipped] = useState(false)
  const initialMountTimerRef = useRef(null)
  const [isBranding, setIsBranding] = useState(false)
  const [isFireActive, setIsFireActive] = useState(false)
  const [quickHeistActive, setQuickHeistActive] = useState(false)
  const [quickForgeRunning, setQuickForgeRunning] = useState(false)
  const mainRef = useRef(null)
  const { play } = useSound()
  // Synchronous flag set on first FORGE tap so rapid follow-up taps short-circuit
  // to skipNow before React commits isBranding.
  const brandingRef = useRef(false)
  // Latches once skipNow fires so FireTransition.onComplete + the brand→fire
  // setTimeout don't double-route after we've already navigated.
  const skippedRef = useRef(false)
  // Holds the brand→fire timeout so skipNow can clear it.
  const fireKickoffTimerRef = useRef(null)
  const NEXT_TARGET = '/fitness/new/muscles'

  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    if (fireKickoffTimerRef.current) clearTimeout(fireKickoffTimerRef.current)
    router.push(NEXT_TARGET)
  }

  // Auto-finish the initial char-stamp cascade (initial.length * 35ms stagger
  // + ~500ms tail). Held in a ref so the entrance-skip handler can clear it.
  useEffect(() => {
    initialMountTimerRef.current = setTimeout(
      () => setIsInitialMount(false),
      nameRef.current.length * 35 + 500
    )
    return () => clearTimeout(initialMountTimerRef.current)
  }, [])

  // Skip-the-entrance: any pointerdown / touchstart during the initial
  // char-stamp cascade snaps the characters to settled state. Excludes
  // RetreatButton so retreat still navigates back. The class-based skip
  // (drop animate-char-stamp from each span via entranceSkipped prop) is
  // what makes the snap actually take effect — overriding inline animation
  // didn't reliably stop the in-flight Tailwind keyframe.
  useEffect(() => {
    if (!isInitialMount) return
    const handler = (e) => {
      if (e.target?.closest?.('[data-retreat]')) return
      setEntranceSkipped(true)
      setIsInitialMount(false)
      if (initialMountTimerRef.current) clearTimeout(initialMountTimerRef.current)
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [isInitialMount])

  /**
   * triggerBrandConfirm — fired when the user presses Enter on a non-empty
   * name. Fires the heavy confirm sound, sets branding state (which swaps
   * the character animation class to brand-letter), and navigates to the
   * stub destination after the brand has cooled.
   */
  const triggerBrandConfirm = () => {
    // Already in brand or fire phase → this rapid follow-up tap skips the
    // remaining cooldown + transition and routes straight to /fitness/new/muscles.
    if (brandingRef.current) { skipNow(); return }
    if (name.trim().length === 0) return
    brandingRef.current = true
    setIsBranding(true)
    try {
      localStorage.setItem(pk('cycle-name'), name.trim())
      // Tap path is the MANUAL forge — clear any leftover gtl-quick-forge
      // flag from a previous (abandoned) swipe attempt. Without this, the
      // downstream muscles/branded pages would auto-progress and fire the
      // speed-lines + heist transition even though the user tapped, not
      // swiped. Flag is normally cleared on /fitness/new/summary, so it
      // sticks if the user bails out of the chain earlier.
      localStorage.removeItem('gtl-quick-forge')
    } catch (_) {}
    play('brand-confirm')
    // Play a second impact ~400ms in to reinforce the peak of the brand
    setTimeout(() => play('stamp'), 380)
    // Shake the screen once at ignition
    if (mainRef.current) {
      mainRef.current.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-12px, 8px)' },
          { transform: 'translate(10px, -10px)' },
          { transform: 'translate(-8px, -5px)' },
          { transform: 'translate(6px, 6px)' },
          { transform: 'translate(-4px, 3px)' },
          { transform: 'translate(2px, -2px)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
      )
    }
    // After the brand cools, fire the fire transition. It then navigates.
    const brandDuration = name.length * 20 + 1650
    fireKickoffTimerRef.current = setTimeout(() => {
      setIsFireActive(true)
    }, brandDuration)
  }

  /**
   * When the fire transition becomes active, run a continuous, violent
   * page shake for the full duration so the source page feels like it's
   * being torn apart by the conflagration.
   */
  useEffect(() => {
    if (!isFireActive) return
    const totalDuration = 1300
    const shakeInterval = 130 // fire a fresh shake every 130ms
    const intervalId = setInterval(() => {
      if (mainRef.current) {
        const j = (mag) => (Math.random() - 0.5) * mag * 2
        mainRef.current.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: `translate(${j(14)}px, ${j(10)}px)` },
            { transform: `translate(${j(14)}px, ${j(10)}px)` },
            { transform: `translate(${j(14)}px, ${j(10)}px)` },
            { transform: `translate(${j(14)}px, ${j(10)}px)` },
            { transform: 'translate(0, 0)' },
          ],
          { duration: 160, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
        )
      }
    }, shakeInterval)
    const stop = setTimeout(() => clearInterval(intervalId), totalDuration)
    return () => { clearInterval(intervalId); clearTimeout(stop) }
  }, [isFireActive])

  /** Called from FireTransition when its sequence peaks — navigate now. */
  const handleFireComplete = () => {
    if (skippedRef.current) return
    router.push(NEXT_TARGET)
  }

  // Skip-the-cascade: once the user has committed (brand+fire on tap, OR
  // HeistTransition on swipe-forge), the next pointer/touch input anywhere
  // routes to /fitness/new/muscles immediately. Excludes RetreatButton
  // (data-retreat) so retreat goes back instead of fast-forwarding.
  // pointerdown + touchstart for iOS PWA reliability.
  useEffect(() => {
    if (!isBranding && !isFireActive && !quickHeistActive) return
    const handler = (e) => {
      if (e.target?.closest?.('[data-retreat]')) return
      skipNow()
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [isBranding, isFireActive, quickHeistActive])

  /**
   * triggerImpact — fired by the input whenever a new character is added.
   * Times the sound + screen shake to land at the moment the character
   * "lands" at scale 1, which is roughly 70% through the 480ms animation.
   */
  const triggerImpact = () => {
    if (isBranding) return
    // Land timing: 480ms × 0.70 = 336ms after the keystroke. We delay
    // the sound and shake to sync with the character's impact.
    setTimeout(() => {
      play('char-stamp')
      // Screen shake via Web Animations API — more reliable than CSS
      // class toggling for rapid re-triggering.
      if (mainRef.current) {
        mainRef.current.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: 'translate(-10px, 6px)' },
            { transform: 'translate(9px, -8px)' },
            { transform: 'translate(-7px, -4px)' },
            { transform: 'translate(6px, 6px)' },
            { transform: 'translate(-5px, 3px)' },
            { transform: 'translate(4px, -5px)' },
            { transform: 'translate(-2px, 4px)' },
            { transform: 'translate(1px, -1px)' },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: 320,
            easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
          }
        )
      }
    }, 320)
  }

  return (
    <main
      ref={mainRef}
      className={`
        relative min-h-screen overflow-hidden bg-gtl-void
        ${isFireActive ? 'animate-page-consume' : ''}
      `}
      style={{ willChange: 'transform, filter' }}
    >
      {/* Background atmospherics */}
      <div className="absolute inset-0 gtl-noise" />

      {/* Ignition flash overlay — only renders during branding */}
      {isBranding && (
        <div
          className="absolute inset-0 pointer-events-none z-40 animate-ignition-flash"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,200,80,0.5) 0%, rgba(255,100,30,0.35) 30%, rgba(212,24,31,0.2) 60%, transparent 100%)',
            mixBlendMode: 'screen',
          }}
          aria-hidden="true"
        />
      )}

      {/* Diagonal gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(122,14,20,0.30) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.40) 100%)',
        }}
      />

      {/* Kanji watermark — 名 ("name") top-right. Top rooted at safe-area floor so it
          never clips into the iOS Dynamic Island camera area. */}
      <div
        className="absolute -right-16 pointer-events-none select-none animate-flicker"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 48px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '46rem',
          lineHeight: '0.8',
          color: '#ffffff',
          opacity: 0.05,
          fontWeight: 900,
        }}
      >
        名
      </div>

      {/* Background flavor text — ONE sentence, oversized, faded inscription */}
      <div
        className="absolute pointer-events-none select-none"
        aria-hidden="true"
        style={{
          right: '4rem',
          bottom: '6rem',
          maxWidth: '54rem',
          opacity: 0.08,
          transform: 'rotate(-1.5deg)',
        }}
      >
        <p className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.0] text-gtl-chalk text-right uppercase">
          You will be stuck with this name for weeks — choose wisely.
        </p>
      </div>

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area). */}
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Top nav row */}
      <nav
        className="relative flex items-center justify-between pl-0 pr-8 pb-6"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <RetreatButton href={backHref} />      </nav>

      {/* Main content area */}
      <section className="relative z-10 px-8 pt-12 pb-20 max-w-6xl mx-auto" style={{ overflow: 'visible' }}>
        {/* Step indicator + headline — significantly bolder than v1 */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-4 mb-6">
            <div className="h-0.5 w-20 bg-gtl-red" />
            <span className="font-matisse text-xs tracking-[0.4em] uppercase text-gtl-red font-bold">
              STEP / 01 / NAME
            </span>
            <div className="h-0.5 w-20 bg-gtl-red" />
          </div>
          <h1 className="font-matisse text-6xl md:text-7xl lg:text-8xl text-gtl-chalk leading-none -rotate-1">
            NAME
            <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-2 ml-4">
              YOUR CYCLE
            </span>
          </h1>
        </div>

        {/* The input — center stage */}
        <div className="relative mb-8" style={{ overflow: 'visible' }}>
          {/* Giant ghosted "01" stamp number — much bigger now */}
          <div
            className="absolute -top-32 -left-12 font-display text-[22rem] leading-none text-gtl-red/[0.06] select-none pointer-events-none"
            aria-hidden="true"
          >
            01
          </div>

          <StampedNameInput
            value={name}
            onChange={setName}
            maxLength={MAX_LEN}
            isInitialMount={isInitialMount}
            entranceSkipped={entranceSkipped}
            onCharAdded={triggerImpact}
            onConfirm={triggerBrandConfirm}
            isBranding={isBranding}
            onInputFocus={handleInputFocus}
          />

          {/* The slot/engraving rail beneath the text — thicker and wider.
              During branding, the slot itself heats and cools along with
              the letters. */}
          <div className="relative mt-6 mx-auto max-w-4xl">
            <div
              className={`h-2.5 gtl-slash ${isBranding ? 'animate-brand-slot' : 'bg-gtl-red-bright'}`}
              aria-hidden="true"
            />
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gtl-red-bright rotate-45" aria-hidden="true" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gtl-red-bright rotate-45" aria-hidden="true" />
          </div>
        </div>

        {/* State indicator + character counter */}
        <div className="mt-8 flex items-center justify-center gap-8">
          <span
            className={`
              font-mono text-xs tracking-[0.3em] uppercase font-bold transition-colors duration-300
              ${isBranding ? 'text-gtl-red-bright' : 'text-gtl-ash'}
            `}
          >
            {isBranding
              ? '▸ BRANDING…'
              : name.length === 0
              ? 'AWAITING DECLARATION'
              : name.length >= MAX_LEN
              ? 'LIMIT REACHED'
              : 'ENGRAVING…'}
          </span>
          <span className="font-mono text-xs tracking-[0.3em] uppercase text-gtl-red font-bold">
            {String(name.length).padStart(2, '0')} / {MAX_LEN}
          </span>
        </div>

        {/* Forge button + Enter hint — visible once the user typed something. The
            button is the primary path (a chunky tap target with the GTL red-bright
            slab); the keyboard hint stays as a secondary affordance for desktop +
            iOS users who want to commit straight from the soft keyboard. */}
        {!isBranding && (
          <div className="mt-6 flex flex-col items-center">
            <ForgeButton
              forgeRef={forgeButtonRef}
              disabled={name.trim().length === 0}
              onTap={triggerBrandConfirm}
              onSwipe={() => {
                if (name.trim().length === 0) return
                // Quick-forge path: persist + flag + HeistTransition (red slash)
                // to muscles. No FireTransition.
                try {
                  localStorage.setItem(pk('cycle-name'), name.trim())
                  localStorage.setItem('gtl-quick-forge', '1')
                } catch (_) {}
                setQuickForgeRunning(true)
                setQuickHeistActive(true)
              }}
            />
            <div className="mt-2 flex items-center gap-3 font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-ash/80">
              <span>TAP TO FORGE</span>
              <span className="text-gtl-red">·</span>
              <span>SWIPE TO LIFT NOW →</span>
            </div>
          </div>
        )}
      </section>

      {/* Footer slash */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center gap-4 px-8">
        <div className="h-px flex-1 bg-gtl-edge" />
        <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
          GRITTED TEETH LIFESTYLE / FITNESS PALACE / NAMING
        </div>
        <div className="h-px flex-1 bg-gtl-edge" />
      </div>

      </div>
      {/* Fire transition overlay — plays after brand cools, then navigates */}
      <FireTransition active={isFireActive} onComplete={handleFireComplete} />
      {/* First hop on the quick-forge swipe — uses the same HeistTransition the
          home page uses (default 'GRIT THOSE TEETH' red-slash overlay). */}
      <HeistTransition active={quickHeistActive} onComplete={() => { if (!skippedRef.current) router.push(NEXT_TARGET) }} />
      <SpeedLines active={quickForgeRunning} />
    </main>
  )
}
