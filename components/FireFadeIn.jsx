'use client'
/*
 * FireFadeIn — the destination-side counterpart to FireTransition.
 *
 * Mounted on a page that the user just navigated to via the fire
 * transition. Shows a full-screen fire wall identical to the peak frame
 * of FireTransition, then fades it out over 800ms while the page reveals
 * underneath.
 *
 * The result: navigation feels continuous. The user sees fire on the
 * source page, the cut happens, and the destination page already has
 * fire visible — the cut is hidden inside the flame wall.
 */
import { useEffect, useState } from 'react'

export default function FireFadeIn({ duration = 800 }) {
  // Quick-forge chain (FORGE swipe) suppresses the destination-side fire wall
  // because those pages cut to red slashes instead. Summary's default
  // ETCH-CYCLE flow keeps the fire wall on /fitness/active for visual continuity
  // — so we ONLY check gtl-quick-forge here, not gtl-deep-launch.
  const isQuickForge = (() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('gtl-quick-forge') === '1' } catch (_) { return false }
  })()
  const [active, setActive] = useState(isQuickForge ? 'done' : true)

  useEffect(() => {
    if (active === 'done') return
    // Trigger fade after a single frame so the initial paint is full fire
    const t = setTimeout(() => setActive(false), 50)
    const t2 = setTimeout(() => {
      // Fully unmount after animation completes so it doesn't intercept
      // any later interactions or paint costs.
      setActive('done')
    }, duration + 200)
    // Skip-on-tap: any pointer/touch input collapses the flame wall and
    // unmounts immediately. Capture-phase so a tap on a button below also
    // dismisses the flame in the same gesture.
    const skip = () => {
      clearTimeout(t); clearTimeout(t2)
      setActive('done')
    }
    window.addEventListener('pointerdown', skip, { capture: true })
    window.addEventListener('touchstart',  skip, { capture: true, passive: true })
    return () => {
      clearTimeout(t); clearTimeout(t2)
      window.removeEventListener('pointerdown', skip, { capture: true })
      window.removeEventListener('touchstart',  skip, { capture: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  if (active === 'done') return null

  // Same flame tongue arrangement as FireTransition for visual continuity
  const tongues = [
    { left: '-5%',  width: '30%', color: 'rgba(255,200,60,0.95)' },
    { left: '15%',  width: '28%', color: 'rgba(255,150,30,0.9)'  },
    { left: '32%',  width: '32%', color: 'rgba(255,180,40,0.95)' },
    { left: '50%',  width: '30%', color: 'rgba(255,120,30,0.9)'  },
    { left: '66%',  width: '32%', color: 'rgba(255,170,50,0.92)' },
    { left: '82%',  width: '28%', color: 'rgba(255,140,30,0.88)' },
  ]

  const fadeStyle = {
    opacity: active === true ? 1 : 0,
    transition: `opacity ${duration}ms cubic-bezier(0.4, 0, 0.6, 1)`,
  }

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Base flame layer */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(255,255,200,1) 0%, rgba(255,200,60,1) 12%, rgba(255,130,30,0.98) 30%, rgba(212,24,31,0.95) 50%, rgba(122,14,20,0.85) 70%, rgba(74,10,14,0.5) 88%, transparent 100%)',
          mixBlendMode: 'screen',
          ...fadeStyle,
        }}
      />

      {/* Flame tongues */}
      {tongues.map((t, i) => (
        <div
          key={i}
          className="absolute bottom-0 h-[140%]"
          style={{
            left: t.left,
            width: t.width,
            background: `radial-gradient(ellipse at center bottom, ${t.color} 0%, rgba(255,100,30,0.6) 35%, rgba(212,24,31,0.3) 65%, transparent 90%)`,
            mixBlendMode: 'screen',
            filter: 'blur(18px)',
            ...fadeStyle,
          }}
        />
      ))}

      {/* Flicker overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 25% 100%, rgba(255,255,180,0.5) 0%, transparent 50%), radial-gradient(ellipse at 75% 100%, rgba(255,200,60,0.4) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, rgba(255,255,220,0.6) 0%, transparent 40%)',
          mixBlendMode: 'screen',
          filter: 'blur(20px)',
          animation: active === true ? 'flame-flicker 220ms steps(4, end) infinite' : 'none',
          ...fadeStyle,
        }}
      />

      {/* Bright core */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center bottom, rgba(255,255,200,0.9) 0%, rgba(255,200,80,0.6) 25%, rgba(255,140,30,0.3) 55%, transparent 80%)',
          mixBlendMode: 'screen',
          filter: 'blur(30px)',
          ...fadeStyle,
        }}
      />

      {/* Noise grit */}
      <div
        className="absolute inset-0 gtl-noise"
        style={{
          mixBlendMode: 'overlay',
          opacity: active === true ? 0.55 : 0,
          transition: `opacity ${duration}ms ease-out`,
        }}
      />
    </div>
  )
}
