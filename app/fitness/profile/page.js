'use client'
/*
 * /fitness/profile — R20 identity surface.
 *
 * Mirrors the stats-page shell (kanji watermark + RetreatButton +
 * useProfileGuard + headline) at app/fitness/stats/page.js:629-668.
 * Headline = the active warrior name. Below: TierTag (current tier
 * name + multiplier) and RibbonRow (Galaxy-Spiral ribbons earned).
 *
 * Data flows:
 *   - localStorage.getItem('gtl-active-profile') → headline
 *   - getTierCount() → getTier() / getTierMultiplier() → TierTag
 *   - getRibbonCount() → RibbonRow
 *   - isPrestigeUnlocked() → conditionally mounts AscendPrompt (R9)
 */
import { useEffect, useState } from 'react'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import RetreatButton from '../../../components/RetreatButton'
import {
  getTier,
  getTierCount,
  getTierMultiplier,
  getRibbonCount,
  isPrestigeUnlocked,
} from '../../../lib/exp'
import TierTag from '../../../components/profile/TierTag'
import RibbonRow from '../../../components/profile/RibbonRow'

export default function ProfilePage() {
  useProfileGuard()
  const [activeProfile, setActiveProfile] = useState(null)
  const [tier, setTier] = useState('RELAXED')
  const [tierMult, setTierMult] = useState(1.0)
  const [ribbons, setRibbons] = useState(0)
  const [prestigeReady, setPrestigeReady] = useState(false)

  const refreshFromStore = () => {
    try { setActiveProfile(localStorage.getItem('gtl-active-profile') || null) } catch (_) {}
    const count = getTierCount()
    setTier(getTier(count))
    setTierMult(getTierMultiplier(count))
    setRibbons(getRibbonCount())
    setPrestigeReady(isPrestigeUnlocked())
  }

  useEffect(() => {
    refreshFromStore()
  }, [])

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gtl-void">
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(122,14,20,0.22) 0%, transparent 40%, rgba(74,10,14,0.32) 100%)',
        }}
      />

      {/* Kanji watermark — 名 ("name") for the identity surface. */}
      <div
        className="absolute -left-8 pointer-events-none select-none animate-flicker"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 32px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '36rem',
          lineHeight: '0.8',
          color: '#ffffff',
          opacity: 0.04,
          fontWeight: 900,
        }}
      >
        名
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <nav
          className="relative flex items-center justify-between pl-0 pr-8 pb-6"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <RetreatButton href="/fitness/hub" />
        </nav>

        <section className="relative z-10 px-6 md:px-8 pt-3 md:pt-8 pb-12 md:pb-24 max-w-4xl mx-auto w-full">

          {/* Eyebrow */}
          <div className="mb-3 md:mb-4">
            <div className="flex items-center gap-4">
              <div className="h-px w-16 bg-gtl-red" />
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">
                IDENTITY
              </span>
            </div>
          </div>

          {/* Warrior name */}
          <h1 className="font-matisse text-[3rem] md:text-[7rem] leading-[0.9] text-gtl-chalk -rotate-1 break-all">
            <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-1">
              {activeProfile || 'WARRIOR'}
            </span>
          </h1>

          {/* Tier identity tag */}
          <div className="mt-6 md:mt-8 flex flex-col items-center">
            <TierTag tier={tier} multiplier={tierMult} />
            <RibbonRow count={ribbons} />
          </div>

          {/* Footer link to stats for analytic detail (R20a lives there). */}
          <div className="mt-12 md:mt-16 flex items-center gap-4">
            <div className="h-px flex-1 bg-gtl-edge" />
            <a
              href="/fitness/stats"
              className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash hover:text-gtl-paper transition-colors"
            >
              WAR RECORD ▶︎
            </a>
            <div className="h-px flex-1 bg-gtl-edge" />
          </div>
        </section>
      </div>

      {/* AscendPrompt mounts here when prestige is unlocked — wired in
          commit 4 of the wave 2 dispatch. `prestigeReady` is read so
          downstream surfaces can react when the flag flips. */}
    </main>
  )
}
