'use client'
/*
 * /fitness/stats — War Record screen.
 *
 * Full career overview: level, XP, total cycles, days completed,
 * muscle volume breakdown, and a per-cycle log.
 * All data is read from localStorage at mount — no server needed.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import { useSound } from '../../../lib/useSound'
import RetreatButton from '../../../components/RetreatButton'
import {
  BODY_REGIONS,
  MUSCLE_TO_REGION,
  computeProfileStats,
  getRegionStars,
  getTier,
  getTierCount,
  getNextTierThreshold,
  getRibbonCount,
  countTrainingDays,
} from '../../../lib/exp'
import BodyStarChart from '../../../components/stats/BodyStarChart'
import RibbonRow from '../../../components/profile/RibbonRow'
import TierUpFlourish from '../../../components/exp/TierUpFlourish'

const REGION_STARS_LAST_SEEN_KEY = 'region-stars-last-seen'
const ZERO5 = [0, 0, 0, 0, 0]
function readRegionStarsLastSeen() {
  if (typeof window === 'undefined') return [...ZERO5]
  try {
    const raw = localStorage.getItem(pk(REGION_STARS_LAST_SEEN_KEY))
    if (!raw) return [...ZERO5]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length !== 5) return [...ZERO5]
    return parsed.map((n) => (Number.isFinite(n) && n >= 0) ? n : 0)
  } catch (_) { return [...ZERO5] }
}
function writeRegionStarsLastSeen(stars) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(pk(REGION_STARS_LAST_SEEN_KEY), JSON.stringify(stars)) } catch (_) {}
}

const MAX_LEVEL = 100
function getLevelInfo(totalXP) {
  let level = 0
  let xpUsed = 0
  while (level < MAX_LEVEL) {
    const threshold = 150 + level * 35
    if (xpUsed + threshold > totalXP) {
      return { level, progress: totalXP - xpUsed, threshold }
    }
    xpUsed += threshold
    level++
  }
  return { level: MAX_LEVEL, progress: 1, threshold: 1 }
}

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS', biceps: 'BICEPS',
  triceps: 'TRICEPS', forearms: 'FOREARMS', abs: 'ABS',
  glutes: 'GLUTES', quads: 'QUADS', hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}

const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function parseDate(iso) {
  return new Date(iso + 'T12:00:00')
}

// Builds the full set/rep log for every cycle → day → muscle → exercise
function loadCombatLog() {
  try {
    const raw = localStorage.getItem(pk('cycles'))
    const allCycles = raw ? JSON.parse(raw) : []

    return allCycles.map((cycle) => {
      const days = (cycle.days || []).sort().map((iso) => {
        const completed = localStorage.getItem(pk(`done-${cycle.id}-${iso}`)) === 'true'
        const muscles = (cycle.dailyPlan?.[iso] || []).map((muscleId) => {
          const rRaw = localStorage.getItem(pk(`ex-${cycle.id}-${iso}-${muscleId}`))
          const wRaw = localStorage.getItem(pk(`wt-${cycle.id}-${iso}-${muscleId}`))
          const rData = rRaw ? JSON.parse(rRaw) : {}
          const wData = wRaw ? JSON.parse(wRaw) : {}
          const exercises = Object.keys(rData).map((name) => {
            const rArr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
            const wArr = Array.isArray(wData[name]) ? wData[name] : [wData[name] || 0]
            const sets = rArr.map((reps, i) => ({ reps: reps || 0, weight: wArr[i] || 0 }))
              .filter((s) => s.reps > 0)
            return { name, sets }
          }).filter((ex) => ex.sets.length > 0)
          return { muscleId, exercises }
        }).filter((m) => m.exercises.length > 0)
        return { iso, completed, muscles }
      })
      return { id: cycle.id, name: cycle.name, createdAt: cycle.createdAt || null, days }
    })
  } catch (_) {
    return []
  }
}

function CombatLogPanel({ onClose }) {
  const { play } = useSound()
  const [log, setLog] = useState(null)

  useEffect(() => {
    setLog(loadCombatLog())
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { play('menu-close'); onClose() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, play])

  const hasAnyLog = log && log.some((c) => c.days.some((d) => d.muscles.length > 0))

  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col bg-gtl-void/95"
      style={{ backdropFilter: 'blur(4px)' }}
      aria-modal="true"
      role="dialog"
    >
      {/* Noise overlay */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(80,10,10,0.18) 0%, transparent 50%, rgba(20,20,20,0.4) 100%)' }}
      />

      {/* Header */}
      <div className="relative z-10 shrink-0 flex items-center justify-between px-8 py-5 border-b border-gtl-edge">
        <div>
          <div className="font-mono text-[9px] tracking-[0.45em] uppercase text-gtl-red/70 mb-1">
            WAR RECORD / FULL HISTORY
          </div>
          <h2
            className="font-display leading-none text-gtl-chalk"
            style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', textShadow: '3px 3px 0 #070708' }}
          >
            COMBAT LOG
          </h2>
        </div>
        <button
          type="button"
          onClick={() => { play('menu-close'); onClose() }}
          className="relative shrink-0 font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash border border-gtl-edge px-5 py-2.5 hover:text-gtl-red hover:border-gtl-red transition-colors duration-150"
          style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}
        >
          CLOSE ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 py-6">
        {log === null && (
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke">LOADING...</div>
        )}

        {log !== null && !hasAnyLog && (
          <div className="mt-24 text-center">
            <p className="font-display text-3xl text-gtl-ash">NO SETS LOGGED</p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke mt-4">
              Log a set. Come back and read what you built.
            </p>
          </div>
        )}

        {log !== null && hasAnyLog && (
          <div className="space-y-10 max-w-3xl mx-auto">
            {log.map((cycle) => {
              const loggedDays = cycle.days.filter((d) => d.muscles.length > 0)
              if (loggedDays.length === 0) return null
              const date = cycle.createdAt
                ? new Date(cycle.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
                : null
              return (
                <div key={cycle.id}>
                  {/* Cycle header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="font-display text-xl leading-none text-gtl-chalk px-4 py-2"
                      style={{ background: '#1a1a1e', clipPath: 'polygon(0 0, 97% 0, 100% 100%, 3% 100%)' }}
                    >
                      {cycle.name}
                    </div>
                    {date && (
                      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-gtl-smoke shrink-0">
                        {date}
                      </div>
                    )}
                    <div className="h-px flex-1 bg-gtl-red/30" />
                  </div>

                  {/* Days */}
                  <div className="space-y-4 ml-2">
                    {loggedDays.map((day) => {
                      const d = parseDate(day.iso)
                      const dayLabel = `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}`
                      return (
                        <div key={day.iso}>
                          {/* Day header */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-1.5 h-1.5 bg-gtl-red shrink-0" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
                            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red font-bold">
                              {dayLabel}
                            </span>
                            {day.completed && (
                              <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gtl-red/60 border border-gtl-red/30 px-1.5 py-0.5">COMPLETED</span>
                            )}
                            <div className="h-px flex-1 bg-gtl-edge" />
                          </div>

                          {/* Muscles */}
                          <div className="space-y-3 ml-4">
                            {day.muscles.map((muscle) => (
                              <div key={muscle.muscleId}>
                                {/* Muscle label */}
                                <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash mb-2">
                                  {MUSCLE_LABELS[muscle.muscleId] ?? muscle.muscleId.toUpperCase()}
                                </div>

                                {/* Exercises */}
                                <div className="space-y-2 ml-3">
                                  {muscle.exercises.map((ex) => (
                                    <div
                                      key={ex.name}
                                      className="bg-gtl-surface px-4 py-3"
                                      style={{ clipPath: 'polygon(0 0, 100% 0, 99% 100%, 1% 100%)' }}
                                    >
                                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-gtl-chalk mb-2">
                                        {ex.name}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {ex.sets.map((set, si) => (
                                          <div
                                            key={si}
                                            className="font-mono text-[9px] tracking-[0.15em] uppercase px-2.5 py-1 border border-gtl-edge bg-gtl-ink text-gtl-chalk"
                                            style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}
                                          >
                                            {set.weight > 0
                                              ? `${set.reps}r × ${set.weight}lb`
                                              : `${set.reps} reps`}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Sums setLog snapshots when populated per day; falls back to legacy
// raw-reps recompute for days without snapshots. Region XP: snapshot
// path uses snapshot.regionWeights; legacy fallback uses 1:1
// MUSCLE_TO_REGION (R10a dual-semantics map from lib/exp/regions).
function loadStats() {
  return computeProfileStats(MUSCLE_TO_REGION)
}

// BodyStarChart (transmutation circle + region badges) extracted to
// components/stats/BodyStarChart.jsx (2026-07-18) so DayStarRecap can
// render the exact same image. Edit it there.

// R20a — tier progress bar (cumulative 100%-sessions toward next tier),
// cumulative-count StatBox, and ribbon history strip. Reads from gtl1's
// tierStore via getTierCount + getRibbonCount; the next-tier threshold
// comes from getNextTierThreshold(count). Mirrors the existing horizontal
// XP bar visual at active/page.js:3415-3431 for the bar treatment.
function TierProgress({ tierCount, ribbons }) {
  const tierName = getTier(tierCount)
  const nextThreshold = getNextTierThreshold(tierCount)
  const hasNext = Number.isFinite(nextThreshold)
  // Find the current tier's threshold so the bar fills proportionally
  // within the band rather than against absolute zero.
  // TIER_THRESHOLDS isn't directly imported here to keep the surface
  // narrow — re-derive via getNextTierThreshold's reverse-lookup.
  // For RELAXED (count 0), bar starts at 0; for any other tier, the
  // band-start is the largest threshold ≤ count.
  let bandStart = 0
  if (hasNext) {
    // Walk backwards from nextThreshold-1: bandStart = the threshold
    // that anchors the current tier. cheap: just use count - (count - bandStart).
    // We don't have TIER_THRESHOLDS here, so compute as count baseline:
    // bandStart = nextThreshold - sessionsInThisBand isn't computable
    // without the table. Approximation: bandStart = the count itself
    // minus 0 — we just show progress toward nextThreshold from the
    // current count's standpoint.
    bandStart = 0  // pragmatic: bar shows count / nextThreshold
  }
  const barPct = hasNext
    ? Math.max(0, Math.min(100, Math.round((tierCount / nextThreshold) * 100)))
    : 100

  return (
    <div className="mb-5 md:mb-10">
      <div className="flex items-center gap-4 mb-3 md:mb-6">
        <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-gtl-red font-bold">
          TIER PROGRESS
        </span>
        <div className="h-px flex-1 bg-gtl-edge" />
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display text-3xl md:text-4xl leading-none text-gtl-chalk">
          {tierName}
        </span>
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash">
          {tierCount} {tierCount === 1 ? 'SESSION' : 'SESSIONS'}
        </span>
      </div>

      {/* Horizontal flat bar — mirrors the XP bar treatment. */}
      <div
        className="h-2 bg-gtl-ink"
        style={{ clipPath: 'polygon(0 0, 100% 0, 99% 100%, 1% 100%)' }}
      >
        <div
          className="h-full bg-gtl-red transition-[width] duration-700 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-red">
          {hasNext
            ? `${tierCount} / ${nextThreshold} SESSIONS TO ${getTier(nextThreshold)}`
            : 'PEAK REACHED'}
        </span>
      </div>

      {/* Ribbon history — same RibbonRow at larger size. */}
      {ribbons > 0 && (
        <div className="mt-5 md:mt-8">
          <div className="flex items-center gap-4 mb-3">
            <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-gtl-red font-bold">
              RIBBON HISTORY
            </span>
            <div className="h-px flex-1 bg-gtl-edge" />
          </div>
          <RibbonRow count={ribbons} size={2.0} />
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub }) {
  return (
    <div className="relative">
      <div
        className="bg-gtl-surface px-4 py-4"
        style={{ clipPath: 'polygon(0 0, 96% 0, 93% 100%, 4% 100%)' }}
      >
        <div className="font-display text-4xl md:text-5xl leading-none text-gtl-chalk">{value}</div>
        {sub && (
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-gtl-red mt-1">{sub}</div>
        )}
        <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash mt-2">{label}</div>
      </div>
    </div>
  )
}

export default function StatsPage() {
  useProfileGuard()
  const { play } = useSound()
  const [stats, setStats] = useState(null)
  const [logOpen, setLogOpen] = useState(false)
  // Region stars (R19): read current totals + last-seen snapshot at mount
  // so the chart can pop-in any new stars earned since last visit. After
  // a short window (longer than the staggered animation envelope) we
  // commit current → last-seen so subsequent visits don't re-animate
  // already-seen stars.
  const [regionStars, setRegionStars] = useState(ZERO5)
  const [regionNewStars, setRegionNewStars] = useState(ZERO5)
  // R20a: tier counter + ribbon count for the progress bar + ribbon history.
  const [tierCount, setTierCount] = useState(0)
  const [ribbons, setRibbons] = useState(0)
  const [daysTrained, setDaysTrained] = useState(0)

  useEffect(() => {
    setStats(loadStats())
    setDaysTrained(countTrainingDays())
    const current = getRegionStars()
    const lastSeen = readRegionStarsLastSeen()
    const delta = current.map((c, i) => Math.max(0, c - (lastSeen[i] || 0)))
    setRegionStars(current)
    setRegionNewStars(delta)
    setTierCount(getTierCount())
    setRibbons(getRibbonCount())
    const t = setTimeout(() => writeRegionStarsLastSeen(current), 1100)
    return () => {
      clearTimeout(t)
      writeRegionStarsLastSeen(current)
    }
  }, [])

  if (!stats) return null

  const { level, progress, threshold } = getLevelInfo(stats.totalXP)
  const xpPct = Math.round((progress / threshold) * 100)
  const completionPct = stats.daysScheduled > 0
    ? Math.round((stats.daysCompleted / stats.daysScheduled) * 100)
    : 0

  const hasData = stats.cycles > 0

  return (
    <>
    {logOpen && <CombatLogPanel onClose={() => setLogOpen(false)} />}
    <main className="relative min-h-screen overflow-x-hidden bg-gtl-void">
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(122,14,20,0.22) 0%, transparent 40%, rgba(74,10,14,0.32) 100%)',
        }}
      />

      {/* Kanji watermark — 記 ("record"). Top rooted at safe-area floor so it never
          clips into the iOS Dynamic Island camera area. */}
      <div
        className="absolute -right-8 pointer-events-none select-none animate-flicker"
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
        記
      </div>

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area). */}
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Nav */}
      <nav
        className="relative flex items-center justify-between pl-0 pr-8 pb-6"
        style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      >
        <RetreatButton href="/fitness/hub" />
      </nav>

      {/* Main content */}
      <section className="relative z-10 px-6 md:px-8 pt-3 md:pt-8 pb-12 md:pb-24 max-w-4xl mx-auto">

        {/* Headline */}
        <div className="mb-5 md:mb-10">
          <div className="flex items-center gap-4 mb-2 md:mb-3">
            <div className="h-px w-16 bg-gtl-red" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">
              OPERATIVE FILE
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-matisse text-[3rem] md:text-[7rem] leading-[0.9] text-gtl-chalk -rotate-1">
              WAR
              <br />
              <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-1">
                RECORD
              </span>
            </h1>
            <button
              type="button"
              onClick={() => { play('option-select'); setLogOpen(true) }}
              onMouseEnter={() => play('button-hover')}
              className="relative shrink-0 mb-2 font-mono text-[9px] tracking-[0.3em] uppercase font-bold px-4 py-2.5 text-gtl-paper bg-gtl-red hover:bg-gtl-red-bright border border-gtl-red-bright transition-colors duration-150"
              style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}
            >
              COMBAT<br />LOG ▶︎
            </button>
          </div>
        </div>

        {!hasData ? (
          <div className="mt-16 text-center">
            <p className="font-display text-3xl text-gtl-ash">NO BATTLES LOGGED</p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke mt-4">
              Nothing's been logged. You know what to do.
            </p>
            <Link
              href="/fitness/new"
              className="inline-block mt-8 font-mono text-xs tracking-[0.3em] uppercase text-gtl-red hover:text-gtl-red-bright transition-colors"
            >
              FORGE A CYCLE ▶︎
            </Link>
          </div>
        ) : (
          <>
            {/* ── Level + XP bar ──────────────────────────────────── */}
            <div className="mb-5 md:mb-10">
              <div className="flex items-baseline justify-between mb-2 md:mb-3">
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-5xl md:text-8xl leading-none text-gtl-red">
                    {level}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-gtl-ash">
                    LEVEL
                  </span>
                </div>
                <span className="font-mono text-xs tracking-[0.2em] text-gtl-smoke">
                  {Math.round(stats.totalXP).toLocaleString()} XP TOTAL
                </span>
              </div>

              {/* XP bar */}
              <div className="relative h-3 bg-gtl-surface" style={{ clipPath: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)' }}>
                <div
                  className="absolute inset-y-0 left-0 bg-gtl-gold transition-all duration-700"
                  style={{ width: `${xpPct}%`, clipPath: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)' }}
                />
              </div>
            </div>

            {/* ── Key stats ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 md:mb-10">
              <StatBox label="DAYS TRAINED" value={daysTrained} />
              <StatBox label="CYCLES FORGED" value={stats.cycles} />
              <StatBox label="DAYS COMPLETED" value={stats.daysCompleted} />
              <StatBox label="COMPLETION RATE" value={`${completionPct}%`} />
            </div>

            {/* ── Top muscles — P5 social stats layout ────────────── */}
            {stats.regionXP.some(x => x > 0) && (
              <div className="mb-5 md:mb-10">
                <div className="flex items-center gap-4 mb-3 md:mb-6">
                  <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-gtl-red font-bold">
                    TOP TARGETS
                  </span>
                  <div className="h-px flex-1 bg-gtl-edge" />
                </div>

                <BodyStarChart
                  regionXP={stats.regionXP}
                  regionStars={regionStars}
                  regionNewStars={regionNewStars}
                />
              </div>
            )}

            {/* ── R20a: tier progress + ribbon history ────────────── */}
            <TierProgress tierCount={tierCount} ribbons={ribbons} />

            {/* ── Cycle log ───────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-4 mb-5">
                <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-gtl-red font-bold">
                  CYCLE LOG
                </span>
                <div className="h-px flex-1 bg-gtl-edge" />
              </div>

              <div className="space-y-3">
                {stats.cycleLog.map((c) => {
                  const pct = c.scheduled > 0 ? Math.round((c.completed / c.scheduled) * 100) : 0
                  const date = c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
                    : null
                  return (
                    <div
                      key={c.id}
                      className="bg-gtl-surface px-5 py-4"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 99% 100%, 1% 100%)' }}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0">
                          <div className="font-display text-2xl md:text-3xl leading-none text-gtl-chalk truncate">
                            {c.name}
                          </div>
                          {date && (
                            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-gtl-smoke mt-1">
                              FORGED {date}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-display text-3xl leading-none text-gtl-red">{pct}%</div>
                          <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash mt-0.5">DONE</div>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="h-1.5 bg-gtl-ink" style={{ clipPath: 'polygon(0 0, 100% 0, 99% 100%, 1% 100%)' }}>
                        <div
                          className="h-full bg-gtl-red"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex gap-6 mt-2">
                        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash">
                          {c.completed}/{c.scheduled} DAYS
                        </span>
                        {c.xp > 0 && (
                          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-red">
                            {Math.round(c.xp).toLocaleString()} XP
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 md:mt-16 flex items-center gap-4">
          <div className="h-px flex-1 bg-gtl-edge" />
          <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
            <span className="hidden md:inline">GRITTED TEETH LIFESTYLE / </span>WAR RECORD
          </div>
          <div className="h-px flex-1 bg-gtl-edge" />
        </div>
      </section>
      </div>
      <TierUpFlourish />
    </main>
    </>
  )
}
