'use client'
/*
 * GatePreview — static, non-interactive replica of GateScreen's IDLE
 * state, rendered by the profiles page during the retreat pan so the
 * camera arrives at an already-populated gate (Strikers zero-gap,
 * Jordan 2026-07-23). The real gate mounts over these exact pixels
 * after the pan settles, making the page swap invisible.
 *
 * Backdrop-free by design: the WALL owns the lines. Keep every
 * font/size/gap in lockstep with components/GateScreen.jsx (idle
 * branch) — drift here = a visible jump at the swap.
 */

export default function GatePreview() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{
        position: 'absolute', top: 0, bottom: 0, left: '-100vw', width: '100vw',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Swipe hints */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#d4181f', whiteSpace: 'nowrap' }}>
          ▲ SWIPE UP FOR FITNESS
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#d4181f', whiteSpace: 'nowrap' }}>
          ▼ SWIPE DOWN FOR NUTRITION
        </div>
      </div>

      {/* Center column — mirrors GateScreen's idle content stack */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ position: 'relative', width: 'clamp(128px, 24vw, 200px)', height: 'clamp(128px, 24vw, 200px)' }}>
          <img
            src="/logo.png"
            alt=""
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem' }}>
          <div style={{ fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace', fontSize: '1rem', letterSpacing: '0.16em', fontWeight: 900, textTransform: 'uppercase', color: '#d4181f' }}>
            GRITTED TEETH LIFESTYLE
          </div>
          <div style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 'clamp(5rem, 14vw, 10rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#f1eee5', textShadow: '3px 3px 0 #d4181f, 6px 6px 0 #070708' }}>
            GTL
          </div>
          <div style={{ height: 5, background: '#d4181f', transform: 'skewX(-12deg)', width: 'clamp(8rem, 20vw, 14rem)' }} />
          <div style={{ fontFamily: '"FOT-Matisse Pro EB", Anton, Impact, sans-serif', fontSize: 'clamp(1.3rem, 3.8vw, 2.2rem)', fontWeight: 900, letterSpacing: '0.10em', color: '#d4181f' }}>
            PRESS START
          </div>
          <div style={{ fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace', fontSize: '0.9rem', letterSpacing: '0.14em', fontWeight: 900, textTransform: 'uppercase', color: '#d4181f' }}>
            {'// CLICK OR TOUCH TO ENTER //'}
          </div>
        </div>
      </div>
    </div>
  )
}
