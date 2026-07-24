'use client'
/*
 * ProfilesPreview — static, non-interactive replica of the WHO ARE YOU
 * screen, rendered by the home page during the forward pan so the
 * camera arrives at an already-populated profiles section (Strikers
 * zero-gap, Jordan 2026-07-23). The real /fitness page mounts over
 * these pixels after the pan settles.
 *
 * Backdrop-free: the WALL owns the lines. Keep layout in lockstep with
 * app/fitness/page.js — drift here = a visible jump at the swap.
 */
import { useEffect, useState } from 'react'
import { profileSlotStats } from '../../lib/exp'
import { LogoStencil, LogoTarget } from '../LogoHalf'

export default function ProfilesPreview() {
  const [profiles, setProfiles] = useState([])
  const [slotStats, setSlotStats] = useState({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gtl-profiles')
      if (raw) {
        const list = JSON.parse(raw)
        setProfiles(list)
        const map = {}
        for (const p of list) map[p] = profileSlotStats(p)
        setSlotStats(map)
      }
    } catch (_) {}
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{ position: 'absolute', top: 0, bottom: 0, left: '100vw', width: '100vw', overflow: 'hidden' }}
    >
      {/* Kanji watermark removed 2026-07-24 — see app/fitness/page.js. */}

      <div className="relative z-10 flex flex-col h-full">
        <nav
          className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-3"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          {/* Retreat chevrons replica — OUT OF FLOW exactly like the real
              RetreatButton (position:fixed; inside this transformed rider,
              fixed resolves against the rider, which lands in the same
              spot). Keeping it in the nav's flow made the preview's top
              bar ~40px taller than the real page's, so content sat lower
              and jumped up at the swap (Jordan 2026-07-23). */}
          <span
            className="group absolute left-0 z-40 inline-flex items-center px-3 py-3 scale-95 origin-left"
            style={{ top: 'env(safe-area-inset-top, 0px)' }}
          >
            <span className="flex items-center gap-0.5 leading-none font-display text-2xl">
              <span className="text-gtl-red opacity-40">◀︎</span>
              <span className="text-gtl-red opacity-70">◀︎</span>
              <span className="text-gtl-red">◀︎</span>
            </span>
          </span>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke">
            IDENTITY / SELECT
          </div>
        </nav>

        <section className="relative z-10 flex-1 flex flex-col px-8 pt-2 pb-8 max-w-3xl mx-auto w-full">
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

          {/* Input row replica */}
          <div className="mb-5 flex items-stretch gap-0">
            <div className="relative flex-1">
              <div
                className="absolute inset-0"
                style={{ clipPath: 'polygon(0% 0%, 97% 0%, 100% 100%, 0% 100%)', background: '#111115', border: '1px solid #26262a' }}
              />
              <div className="absolute top-0 bottom-0 left-0" style={{ width: 2, background: '#26262a' }} />
              {/* Real page: the FIELD pads 1.75rem but the visible
                  placeholder overlay pads px-5 (1.25rem) — match the
                  overlay, since that's what the eye sees. */}
              <div className="relative flex items-center font-display text-xl md:text-3xl text-gtl-smoke tracking-wide uppercase" style={{ padding: '1.5rem 1.25rem', whiteSpace: 'nowrap' }}>
                ENTER YOUR N{'​'}AME
              </div>
            </div>
            {/* Real page renders a <button> here — a div replica sits ~1px
                off because buttons carry their own UA font metrics
                (measured at the slab's bottom edge, Jordan 2026-07-24).
                Same element type = same metrics. Inert: disabled +
                pointer-events none from the preview root. */}
            <button type="button" tabIndex={-1} disabled className="relative shrink-0 outline-none">
              <div className="absolute inset-0" style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', background: '#4a0a0e', transform: 'translate(5px, 5px)' }} />
              <div className="relative flex items-center gap-2" style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', background: '#1a1a1e', padding: '1.5rem 1.75rem' }}>
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase font-bold" style={{ color: '#4a4a4f' }}>ENTER</span>
                <span className="font-display text-xl leading-none" style={{ color: '#4a4a4f' }}>➤︎</span>
              </div>
            </button>
          </div>

          {/* Known warriors replica */}
          {profiles.length > 0 && (
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
                {profiles.map((name) => {
                  const stats = slotStats[name]
                  return (
                    <div key={name} className="relative block w-full -mx-5" style={{ width: 'calc(100% + 40px)' }}>
                      <div className="absolute inset-0" style={{ background: '#4a0a0e', clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', transform: 'translate(5px, 5px)' }} />
                      <div
                        className="relative flex items-center justify-center font-display tracking-[0.25em] uppercase px-24 min-h-[64px] w-full text-3xl"
                        style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', padding: '1.5rem 6rem', background: '#161618', color: '#e8e8f0', border: '1px solid #26262a' }}
                      >
                        <div className="absolute" style={{ left: 'calc(50% - 175px)', top: '50%', width: 56, height: 56, marginTop: -28, opacity: 0.85 }}>
                          <LogoStencil size={56} paused />
                        </div>
                        <div className="absolute" style={{ right: 'calc(50% - 175px)', top: '50%', width: 56, height: 56, marginTop: -28, opacity: 0.85 }}>
                          <LogoTarget size={56} />
                        </div>
                        <span className="relative flex flex-col items-center">
                          <span className="inline-block leading-none tracking-tight">{name.toUpperCase()}</span>
                          {stats && (
                            <span className="mt-2 font-mono text-[9px] tracking-[0.25em] uppercase font-bold whitespace-nowrap" style={{ color: '#8a8a92' }}>
                              LV {stats.level} · {stats.tier} · {stats.daysTrained} {stats.daysTrained === 1 ? 'DAY' : 'DAYS'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
    </div>
  )
}
