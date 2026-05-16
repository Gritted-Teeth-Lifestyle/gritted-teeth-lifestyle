'use client'
/*
 * HeistTransition — the P5 menu-transition overlay.
 *
 * Mounted at the top of a layout. Renders nothing when idle. When triggered
 * (by setting `active` to true), it plays a multi-phase animated sequence
 * with diagonal red slashes, a cover, and a reveal.
 *
 * Two intensities:
 *   - 'normal' (default): two slashes, ~900ms total. Used for routine
 *     navigation between major sections (e.g., home → fitness).
 *   - 'mega': four slashes from different angles, longer duration, a
 *     pulsing destination title card flash, an extra impact sound. Used
 *     for high-stakes commitments (e.g., starting a new cycle).
 *
 * Usage:
 *   const [t, setT] = useState(false)
 *   <HeistTransition active={t} intensity="mega" title="NEW CYCLE"
 *     onComplete={() => router.push('/fitness/new')} />
 *   <button onClick={() => setT(true)}>...</button>
 */
import { useEffect, useState } from 'react'
import { useSound } from '../lib/useSound'

export default function HeistTransition({
  active,
  onComplete,
  intensity = 'normal',
  title = 'GRIT THOSE TEETH',
}) {
  const { play } = useSound()
  const [phase, setPhase] = useState('idle')

  // Mega timings are longer to give the user time to register the moment
  const TIMINGS = intensity === 'mega'
    ? { slash: 0, slash2: 200, cover: 600, navigate: 800, reveal: 1100, cleanup: 1700 }
    : { slash: 0, slash2: 80,  cover: 380, navigate: 520, reveal: 700,  cleanup: 1100 }

  useEffect(() => {
    if (!active) {
      setPhase('idle')
      return
    }

    setPhase('slash')
    play('transition-slash')
    if (intensity === 'mega') {
      // A second heavier impact when the secondary slashes hit
      setTimeout(() => play('mega-transition'), 200)
    }

    const t1 = setTimeout(() => setPhase('cover'), TIMINGS.cover)
    const t2 = setTimeout(() => { if (onComplete) onComplete() }, TIMINGS.navigate)
    const t3 = setTimeout(() => setPhase('reveal'), TIMINGS.reveal)
    const t4 = setTimeout(() => setPhase('idle'), TIMINGS.cleanup)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4)
    }
  }, [active, onComplete, play, intensity])

  if (phase === 'idle' && !active) return null

  const isMega = intensity === 'mega'

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Slash 1 — upper-left to lower-right */}
      <div
        className={`
          absolute -top-1/4 -left-1/2 w-[200%] h-[60vh] bg-gtl-red
          ${phase === 'slash' || phase === 'cover' ? 'animate-slash-wipe' : 'opacity-0'}
        `}
        style={{ transform: 'skewY(-12deg)', transformOrigin: 'top left' }}
      />

      {/* Slash 2 — counter from lower-right */}
      <div
        className={`
          absolute -bottom-1/4 -right-1/2 w-[200%] h-[60vh] bg-gtl-red-bright
          ${phase === 'slash' || phase === 'cover' ? 'animate-slash-wipe' : 'opacity-0'}
        `}
        style={{
          transform: 'skewY(-12deg)',
          transformOrigin: 'bottom right',
          animationDelay: '80ms',
        }}
      />

      {/* MEGA only: third and fourth slashes from opposite diagonal */}
      {isMega && (
        <>
          <div
            className={`
              absolute -top-1/2 -right-1/3 w-[200%] h-[80vh] bg-gtl-blood
              ${phase === 'slash' || phase === 'cover' ? 'animate-slash-wipe' : 'opacity-0'}
            `}
            style={{
              transform: 'skewY(15deg)',
              transformOrigin: 'top right',
              animationDelay: '180ms',
            }}
          />
          <div
            className={`
              absolute -bottom-1/2 -left-1/3 w-[200%] h-[80vh] bg-gtl-red-deep
              ${phase === 'slash' || phase === 'cover' ? 'animate-slash-wipe' : 'opacity-0'}
            `}
            style={{
              transform: 'skewY(15deg)',
              transformOrigin: 'bottom left',
              animationDelay: '260ms',
            }}
          />
        </>
      )}

      {/* Full black cover — drops over everything at peak then retreats */}
      <div
        className={`
          absolute inset-0 bg-gtl-void
          transition-transform duration-300 ease-out
          ${phase === 'cover' ? 'translate-y-0' : ''}
          ${phase === 'slash' ? 'translate-y-full' : ''}
          ${phase === 'reveal' ? '-translate-y-full' : ''}
          ${phase === 'idle' ? 'translate-y-full' : ''}
        `}
      />

      {/* Center stamp — flashes through the middle of the slash */}
      <div
        className={`
          absolute inset-0 flex items-center justify-center
          ${phase === 'slash' || phase === 'cover' ? 'opacity-100' : 'opacity-0'}
          transition-opacity duration-150
        `}
      >
        <div className="font-display text-gtl-paper -rotate-3 leading-none gtl-headline-shadow text-center text-[18vw]">
          {title}
        </div>
      </div>
    </div>
  )
}
