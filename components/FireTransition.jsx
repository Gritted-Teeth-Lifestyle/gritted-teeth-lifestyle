'use client'
/*
 * FireTransition — the source-side conflagration overlay.
 *
 * After the brand cools, the entire screen erupts in fire. Layered phases:
 *
 *   - 0ms:    pre-buildup heat shimmer
 *   - 150ms:  flame base layer + tongues whip up from below
 *   - 280ms:  white flash 1
 *   - 450ms:  embers begin flying upward (24 of them)
 *   - 700ms:  full conflagration — everything visible
 *   - 950ms:  kanji 火 slams into center
 *   - 1100ms: white flash 2
 *   - 1350ms: navigate
 *
 * Throughout: continuous flame flicker, noise grit, bottom core glow.
 *
 * The destination page mounts FireFadeIn so the cut is hidden inside the
 * flame wall. Every millisecond is busy — there is no flat moment.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSound } from '../lib/useSound'

export default function FireTransition({ active, onComplete }) {
  const { play } = useSound()
  const [armed, setArmed] = useState(false)

  // Pre-compute random ember positions / drifts so they're stable across
  // re-renders. 24 embers spread across the bottom of the screen.
  const embers = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: (i / 24) * 100 + (Math.random() - 0.5) * 8,
        delay: 450 + i * 18 + Math.random() * 200,
        duration: 1100 + Math.random() * 400,
        size: 4 + Math.random() * 9,
        drift: `${(Math.random() - 0.5) * 240}px`,
        glow: Math.random() > 0.5
          ? '0 0 14px rgba(255,200,60,0.95), 0 0 30px rgba(255,120,30,0.7)'
          : '0 0 16px rgba(255,180,40,0.9),  0 0 36px rgba(212,24,31,0.6)',
      })),
    []
  )

  // 12 flame tongues at varied positions/widths/timings/colors
  const tongues = useMemo(
    () => [
      { left: '-8%',  width: '24%', delay: 180, color: 'rgba(255,200,60,0.95)' },
      { left: '6%',   width: '20%', delay: 220, color: 'rgba(255,150,30,0.92)' },
      { left: '18%',  width: '22%', delay: 200, color: 'rgba(255,180,40,0.95)' },
      { left: '30%',  width: '24%', delay: 260, color: 'rgba(255,120,30,0.9)'  },
      { left: '40%',  width: '22%', delay: 190, color: 'rgba(255,170,50,0.95)' },
      { left: '50%',  width: '24%', delay: 240, color: 'rgba(255,140,30,0.92)' },
      { left: '60%',  width: '22%', delay: 210, color: 'rgba(255,190,60,0.95)' },
      { left: '70%',  width: '24%', delay: 270, color: 'rgba(255,130,30,0.9)'  },
      { left: '80%',  width: '22%', delay: 200, color: 'rgba(255,160,40,0.93)' },
      { left: '88%',  width: '20%', delay: 250, color: 'rgba(255,200,60,0.95)' },
      { left: '5%',   width: '18%', delay: 320, color: 'rgba(255,255,180,0.85)' },
      { left: '78%',  width: '18%', delay: 290, color: 'rgba(255,255,180,0.85)' },
    ],
    []
  )

  useEffect(() => {
    if (!active) {
      setArmed(false)
      return
    }
    setArmed(true)

    // Sound choreography. NOT held in cleanup — sound clones play
    // independently of the component lifecycle, so when a tap-skip unmounts
    // this component, the remaining stamp/mega-transition still fire and
    // ride out their natural duration. Visual is gone, audio plays through.
    play('brand-confirm')
    setTimeout(() => play('stamp'), 200)
    setTimeout(() => play('mega-transition'), 700)
    setTimeout(() => play('stamp'), 1000)

    // Navigate at peak
    const t = setTimeout(() => {
      if (onComplete) onComplete()
    }, 1350)

    const cleanup = setTimeout(() => setArmed(false), 1500)

    return () => {
      clearTimeout(t); clearTimeout(cleanup)
    }
  }, [active, onComplete, play])

  if (!armed && !active) return null

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* ── Phase 1: Heat shimmer pre-buildup ─────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,160,40,0.25) 0%, rgba(212,24,31,0.12) 30%, transparent 60%)',
          mixBlendMode: 'screen',
          opacity: armed ? 1 : 0,
          transition: 'opacity 200ms ease-out',
        }}
      />

      {/* (Removed: ripple-style shockwave rings + central fireball bloom — both
          read as a tap/ripple effect we don't want. Flame layer below now starts
          earlier (150ms) so the impact doesn't feel empty.) */}

      {/* ── Phase 4: White flash 1 — at impact peak ───────────────── */}
      <div
        className="absolute inset-0 bg-white"
        style={{
          opacity: 0,
          mixBlendMode: 'screen',
          animation: armed
            ? 'white-flash 220ms cubic-bezier(0.3, 0, 0.4, 1) 280ms forwards'
            : 'none',
        }}
      />

      {/* ── Phase 5: Flame base layer — wide rising gradient ──────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(255,255,200,1) 0%, rgba(255,200,60,1) 12%, rgba(255,130,30,0.98) 30%, rgba(212,24,31,0.95) 50%, rgba(122,14,20,0.85) 70%, rgba(74,10,14,0.5) 88%, transparent 100%)',
          mixBlendMode: 'screen',
          opacity: 0,
          animation: armed
            ? 'flame-rise 1100ms cubic-bezier(0.3, 0.5, 0.3, 1) 150ms forwards'
            : 'none',
          willChange: 'transform, opacity',
        }}
      />

      {/* ── Phase 5b: 12 flame tongues ─────────────────────────────── */}
      {tongues.map((t, i) => (
        <div
          key={`tongue-${i}`}
          className="absolute bottom-0 h-[150%]"
          style={{
            left: t.left,
            width: t.width,
            background: `radial-gradient(ellipse at center bottom, ${t.color} 0%, rgba(255,100,30,0.6) 35%, rgba(212,24,31,0.3) 65%, transparent 90%)`,
            mixBlendMode: 'screen',
            filter: 'blur(18px)',
            opacity: 0,
            transformOrigin: 'center bottom',
            animation: armed
              ? `flame-tongue 1100ms cubic-bezier(0.25, 0.5, 0.3, 1) ${t.delay}ms forwards`
              : 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* ── Phase 6: 24 embers flying upward ───────────────────────── */}
      {embers.map((e, i) => (
        <div
          key={`ember-${i}`}
          className="absolute rounded-full"
          style={{
            bottom: '0%',
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            background: 'rgba(255, 230, 130, 1)',
            boxShadow: e.glow,
            opacity: 0,
            mixBlendMode: 'screen',
            // CSS vars are read by the keyframe via var(--drift)
            ['--drift']: e.drift,
            animation: armed
              ? `ember-rise ${e.duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${e.delay}ms forwards`
              : 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* ── Phase 7: Bright bottom core glow ───────────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center bottom, rgba(255,255,200,0.95) 0%, rgba(255,200,80,0.7) 25%, rgba(255,140,30,0.4) 55%, transparent 80%)',
          mixBlendMode: 'screen',
          filter: 'blur(40px)',
          opacity: 0,
          animation: armed
            ? 'fade-in-late 600ms ease-out 500ms forwards'
            : 'none',
        }}
      />
      <style jsx>{`
        @keyframes fade-in-late {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ── Phase 8: Continuous flicker overlay ───────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 25% 100%, rgba(255,255,180,0.5) 0%, transparent 50%), radial-gradient(ellipse at 75% 100%, rgba(255,200,60,0.4) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, rgba(255,255,220,0.6) 0%, transparent 40%)',
          mixBlendMode: 'screen',
          filter: 'blur(20px)',
          opacity: armed ? 1 : 0,
          transition: 'opacity 400ms ease-out 350ms',
          animation: armed ? 'flame-flicker 220ms steps(4, end) infinite' : 'none',
        }}
      />

      {/* ── Phase 9: Big kanji 火 ("fire") slamming into the center ── */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: 0, animation: armed ? 'fade-kanji 200ms ease-out 950ms forwards' : 'none' }}
      >
        <div
          className="relative"
          style={{
            animation: armed ? 'kanji-slam 500ms cubic-bezier(0.2, 1.4, 0.4, 1) 950ms forwards' : 'none',
            transformOrigin: 'center center',
            willChange: 'transform, opacity',
          }}
        >
          <div
            style={{
              fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
              fontSize: '32rem',
              fontWeight: 900,
              lineHeight: '0.8',
              color: '#ffffff',
              textShadow:
                '0 0 40px #ffe066, 0 0 80px #ff8c00, 0 0 160px #d4181f, 0 0 240px #ff2a36',
              mixBlendMode: 'screen',
            }}
          >
            火
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fade-kanji { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ── Phase 10: White flash 2 — at peak / kanji impact ──────── */}
      <div
        className="absolute inset-0 bg-white"
        style={{
          opacity: 0,
          mixBlendMode: 'screen',
          animation: armed
            ? 'white-flash 240ms cubic-bezier(0.3, 0, 0.4, 1) 1100ms forwards'
            : 'none',
        }}
      />

      {/* ── Phase 11: Embers/noise overlay during flame phase for grit */}
      <div
        className="absolute inset-0 gtl-noise"
        style={{
          opacity: armed ? 0.65 : 0,
          transition: 'opacity 300ms ease-out 350ms',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
}
