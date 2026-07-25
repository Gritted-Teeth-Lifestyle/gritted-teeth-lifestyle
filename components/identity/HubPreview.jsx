'use client'
/*
 * HubPreview — static, non-interactive replica of CHOOSE YOUR CYCLE at
 * rest, rendered UNDER the profiles screen during the zoom-through
 * transition (profile tap → camera pushes through the wall into the
 * hub "room"). The real /fitness/hub mounts over these pixels after
 * the zoom settles — same zero-gap contract as ProfilesPreview.
 *
 * The hub keeps its own opaque room (bg + noise + gradient + kanji),
 * so this replica carries the full backdrop, unlike the wall-bare
 * previews. Kanji is STATIC here (no flicker — see strikers skill
 * gotcha 5). Keep in lockstep with app/fitness/hub/page.js.
 */
import { useEffect, useState } from 'react'
import { getDraft } from '../../lib/storage'

function CardPreview({ number, label, caption, primary }) {
  return (
    <div className="relative block w-full text-left min-h-[11rem] md:min-h-[20rem]">
      <div
        className="absolute -inset-3 opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,42,54,0.35) 0%, transparent 70%)',
          filter: 'blur(24px)',
        }}
      />
      <div className={`absolute inset-0 gtl-clip-card ${primary ? 'bg-gtl-red' : 'bg-gtl-ink'}`} />
      <div
        className={`absolute -inset-1 gtl-clip-card ${primary ? 'opacity-0' : 'opacity-70'}`}
        style={{ background: 'linear-gradient(135deg, #ff2a36 0%, #d4181f 100%)', zIndex: -1 }}
      />
      <div className={`absolute inset-0 gtl-clip-card ${primary ? 'shadow-inset-edge' : ''}`} />
      <div className={`absolute top-4 right-6 font-mono text-xs tracking-[0.3em] ${primary ? 'text-gtl-paper/70' : 'text-gtl-red/70'}`}>
        OPTION / {number}
      </div>
      <div className="relative h-full flex flex-col justify-end p-8 pt-16">
        <div className={`h-1.5 mb-4 w-16 ${primary ? 'bg-gtl-paper' : 'bg-gtl-red'}`} style={{ transform: 'skewX(-12deg)' }} />
        <h2 className={`font-display text-6xl leading-none mb-2 -rotate-1 ${primary ? 'text-gtl-paper' : 'text-gtl-red'}`}>
          {label}
        </h2>
        <p className={`font-mono text-[10px] tracking-[0.25em] uppercase mt-3 max-w-[60%] ${primary ? 'text-gtl-paper/80' : 'text-gtl-chalk/70'}`}>
          {caption}
        </p>
        <div className="absolute bottom-6 right-8 flex items-center gap-2">
          <div className={`font-display text-5xl leading-none ${primary ? 'text-gtl-paper' : 'text-gtl-red'}`}>➤︎</div>
        </div>
      </div>
    </div>
  )
}

export default function HubPreview() {
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    try { setHasDraft(!!getDraft()) } catch (_) {}
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none select-none absolute inset-0 overflow-hidden bg-gtl-void">
      <div className="absolute inset-0 gtl-noise" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, rgba(122,14,20,0.25) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.35) 100%)' }}
      />
      {/* Kanji — static (no flicker during transitions) */}
      <div
        className="absolute -left-8"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 48px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '40rem', lineHeight: '0.8', color: '#ffffff', opacity: 0.04, fontWeight: 900,
        }}
      >
        闘
      </div>

      <div className="relative z-10 flex flex-col">
        <nav
          className="relative flex items-center justify-between pl-0 pr-8 pb-6"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <span className="absolute left-0 z-40 inline-flex items-center px-3 py-3 scale-95 origin-left" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
            <span className="flex items-center gap-0.5 leading-none font-display text-2xl">
              <span className="text-gtl-red opacity-40">◀︎</span>
              <span className="text-gtl-red opacity-70">◀︎</span>
              <span className="text-gtl-red">◀︎</span>
            </span>
          </span>
        </nav>

        <section className="relative z-10 px-8 pt-4 pb-6 md:pt-12 md:pb-20 max-w-6xl mx-auto w-full">
          <div className="mb-6 md:mb-16">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-16 bg-gtl-red" />
              <span className="font-matisse text-[10px] tracking-[0.3em] uppercase text-gtl-red">
                ENTRY POINT / 01
              </span>
            </div>
            <h1 className="font-matisse text-[3rem] md:text-[8rem] leading-[0.9] text-gtl-chalk -rotate-1">
              CHOOSE
              <br />
              <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-2">
                YOUR CYCLE
              </span>
            </h1>
            <p className="font-matisse text-xs tracking-[0.25em] uppercase text-gtl-ash mt-6 max-w-md">
              Forge a new climb, or return to one already in progress.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div className="md:translate-y-0">
              <CardPreview number="01" label="LOAD CYCLE" caption="Resume an active program. Continue where you left off." />
            </div>
            <div className="md:translate-y-12">
              {hasDraft ? (
                <CardPreview number="02" label="RESUME DRAFT" caption="An unfinished blade waits in the forge." primary />
              ) : (
                <CardPreview number="02" label="NEW CYCLE" caption="Begin from zero. Define the climb. Forge a fresh program." primary />
              )}
            </div>
          </div>

          <div className="mt-20 md:mt-24">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px w-8 bg-gtl-edge" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
                ALTERNATE PATH
              </span>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
