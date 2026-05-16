'use client'
/*
 * /fitness/edit — Edit Cycle hub.
 *
 * Landing page after "REVIEW / EDIT" from the load screen.
 * Shows the cycle name and navigation buttons to each editing sub-page.
 */
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSound } from '../../../lib/useSound'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import RetreatButton from '../../../components/RetreatButton'

function EditNavButton({ number, label, caption, href }) {
  const { play } = useSound()
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => { setHovered(true); play('button-hover') }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { play('option-select'); try { localStorage.setItem('gtl-back-to-edit', '1') } catch (_) {} }}
      className="group relative flex items-stretch outline-none focus-visible:ring-2 focus-visible:ring-gtl-red"
    >
      {/* Shadow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: '#8a0e13',
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          transform: hovered ? 'translate(2px,2px)' : 'translate(5px,5px)',
          transition: 'transform 100ms ease-out',
        }}
        aria-hidden="true"
      />
      {/* Face */}
      <div
        className="relative flex items-center gap-6 px-6 py-5 w-full transition-colors duration-150"
        style={{
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          background: hovered ? '#d4181f' : '#1a1a1e',
          border: `1px solid ${hovered ? '#ff2a36' : '#2a2a30'}`,
          transform: hovered ? 'translate(5px,5px)' : 'translate(0,0)',
          transition: 'transform 100ms ease-out, background 150ms ease-out, border-color 150ms ease-out',
        }}
      >
        {/* Number */}
        <div
          className="font-display leading-none shrink-0"
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            color: hovered ? '#f5f0e8' : '#3a3a42',
            textShadow: hovered ? '3px 3px 0 #8a0e13' : 'none',
            transition: 'color 150ms, text-shadow 150ms',
            minWidth: '3rem',
          }}
        >
          {String(number).padStart(2, '0')}
        </div>

        {/* Divider */}
        <div
          className="self-stretch w-px shrink-0"
          style={{
            background: hovered ? 'rgba(245,240,232,0.3)' : '#2a2a30',
            transform: 'skewX(-12deg)',
            transition: 'background 150ms',
          }}
        />

        {/* Text */}
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className="font-display leading-none"
            style={{
              fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
              color: hovered ? '#f5f0e8' : '#c8c0b0',
              textShadow: hovered ? '2px 2px 0 #070708' : 'none',
              transition: 'color 150ms',
            }}
          >
            {label}
          </div>
          <div
            className="font-mono text-[10px] tracking-[0.3em] uppercase leading-none"
            style={{
              color: hovered ? 'rgba(245,240,232,0.6)' : '#3a3a42',
              transition: 'color 150ms',
            }}
          >
            {caption}
          </div>
        </div>

        {/* Arrow */}
        <div
          className="ml-auto font-display leading-none shrink-0"
          style={{
            fontSize: '1.2rem',
            color: hovered ? '#f5f0e8' : '#3a3a42',
            transform: hovered ? 'translateX(4px)' : 'translateX(0)',
            transition: 'color 150ms, transform 150ms',
          }}
        >
          ▶︎
        </div>
      </div>
    </Link>
  )
}

export default function EditCyclePage() {
  useProfileGuard()

  const [cycleName, setCycleName] = useState('')

  useEffect(() => {
    // Clear the back-to-edit flag — we're home
    try { localStorage.removeItem('gtl-back-to-edit') } catch (_) {}
    try {
      const cycleId = localStorage.getItem(pk('editing-cycle-id'))
      const raw = localStorage.getItem(pk('cycles'))
      const cycles = raw ? JSON.parse(raw) : []
      const cycle = cycles.find((c) => c.id === cycleId)
      const name = cycle?.name || localStorage.getItem(pk('cycle-name'))
      if (name) setCycleName(name)
    } catch (_) {}
  }, [])

  return (
    <main className="relative h-screen overflow-hidden flex flex-col bg-gtl-void">
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(80,10,10,0.12) 0%, transparent 50%, rgba(20,20,20,0.3) 100%)' }} />

      {/* Kanji watermark — 改 (reform/edit). Top rooted at safe-area floor so it never
          clips into the iOS Dynamic Island camera area. */}
      <div className="absolute -right-16 pointer-events-none select-none" aria-hidden="true"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) - 32px)', fontFamily: '"Noto Serif JP", "Yu Mincho", serif', fontSize: '48rem', lineHeight: '0.8', color: '#d4181f', opacity: 0.04, fontWeight: 900 }}>
        改
      </div>

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area);
          wrapper holds UI flow with iOS top-inset padding. */}
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Nav */}
      <nav
        className="relative shrink-0 flex items-center gap-4 pl-0 pr-8 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <RetreatButton href="/fitness/load" />
        <div className="w-px self-stretch bg-gtl-edge" style={{ transform: 'skewX(-12deg)' }} />      </nav>

      <div className="relative z-10 mx-8 mb-6 h-[2px] shrink-0"
           style={{ background: '#d4181f', transform: 'skewX(-6deg)', transformOrigin: 'left center' }} />

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 pb-8 flex flex-col gap-8">

        {/* Header */}
        <div>
          <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red/60 mb-2">
            EDITING CYCLE
          </div>
          <h1
            className="font-display text-gtl-chalk leading-none"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 6rem)',
              textShadow: '4px 4px 0 #070708',
              transform: 'rotate(-0.5deg)',
              transformOrigin: 'left center',
            }}
          >
            {cycleName || 'UNTITLED'}
          </h1>
        </div>

        {/* Red slash divider */}
        <div
          className="h-[3px] bg-gtl-red shrink-0"
          style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center' }}
        />

        {/* Edit section label */}
        <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-ash">
          SELECT SECTION TO EDIT
        </div>

        {/* Nav buttons */}
        <div className="flex flex-col gap-3">
          <EditNavButton
            number={1}
            label="NAME & IDENTITY"
            caption="Cycle name and description"
            href="/fitness/new"
          />
          <EditNavButton
            number={2}
            label="TARGETS"
            caption="Muscle groups to conquer"
            href="/fitness/new/muscles"
          />
          <EditNavButton
            number={3}
            label="SCHEDULE"
            caption="Training days, dates, and muscle assignments"
            href="/fitness/new/branded"
          />
          <EditNavButton
            number={4}
            label="RE-ETCH CYCLE"
            caption="Full cycle summary"
            href="/fitness/new/summary"
          />
        </div>
      </div>

      </div>
    </main>
  )
}
