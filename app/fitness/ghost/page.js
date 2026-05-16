'use client'
/*
 * /fitness/ghost — Ghost Train. Choose a cycle to run without saving anything.
 *
 * Identical to /fitness/load visually, but the bottom bar only has
 * GHOST TRAIN (no ACTIVATE, no DELETE, no REVIEW). Activating a cycle
 * here navigates to /fitness/ghost/active — a session that makes zero
 * permanent changes to localStorage.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSound } from '../../../lib/useSound'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import FireTransition from '../../../components/FireTransition'
import RetreatButton from '../../../components/RetreatButton'

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS',
  biceps: 'BICEPS', triceps: 'TRICEPS', forearms: 'FOREARMS',
  abs: 'ABS', glutes: 'GLUTES', quads: 'QUADS',
  hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function parseDate(iso) {
  return new Date(iso + 'T12:00:00')
}
function formatDateShort(iso) {
  const d = parseDate(iso)
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

const SLAB_ROTATIONS = ['-1.2deg','0.9deg','-0.7deg','1.4deg','-1deg','0.6deg','-1.5deg','1.1deg']

function MuscleTag({ id, index }) {
  const rot = SLAB_ROTATIONS[index % SLAB_ROTATIONS.length]
  return (
    <div
      className="px-3 py-1 bg-gtl-red border border-gtl-red-bright shrink-0"
      style={{
        clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
        transform: `rotate(${rot})`,
      }}
    >
      <div className="font-display text-sm text-gtl-paper leading-none whitespace-nowrap">
        {MUSCLE_LABELS[id] || id.toUpperCase()}
      </div>
    </div>
  )
}

function CheckSlam({ part = 'face' }) {
  return (
    <>
      <style>{`
        @keyframes check-slam {
          0%   { transform: translateY(-280px) scale(5) rotate(-20deg); opacity: 0; filter: blur(16px); }
          5%   { opacity: 1; filter: blur(8px); }
          55%  { transform: translateY(14px) scale(0.82) rotate(-13deg); opacity: 1; filter: blur(0); }
          70%  { transform: translateY(-8px) scale(1.1) rotate(-11deg); opacity: 1; }
          82%  { transform: translateY(4px) scale(0.97) rotate(-12deg); opacity: 1; }
          91%  { transform: translateY(-2px) scale(1.02) rotate(-12deg); opacity: 1; }
          100% { transform: translateY(0) scale(1) rotate(-12deg); opacity: 1; }
        }
        @keyframes check-ring {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          5%   { opacity: 0.7; }
          100% { transform: translate(-50%, -50%) scale(6); opacity: 0; }
        }
      `}</style>

      {part === 'face' && (
        <>
          <div
            className="absolute pointer-events-none rounded-full"
            style={{
              left: '50%', top: '50%',
              width: '80px', height: '80px',
              border: '3px solid #7a0e14',
              animation: 'check-ring 700ms cubic-bezier(0.2, 0.8, 0.3, 1) 580ms forwards',
              opacity: 0,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none select-none"
            style={{
              animation: 'check-slam 800ms cubic-bezier(0.18, 1.2, 0.35, 1) forwards',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            <div
              className="relative font-display"
              style={{
                fontSize: 'clamp(8rem, 14vw, 13rem)',
                color: '#7a0e14',
                textShadow: '0 0 40px rgba(122,14,20,0.6)',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              ✓
            </div>
          </div>
        </>
      )}

      {part === 'shadow' && (
        <div
          className="pointer-events-none select-none"
          style={{
            animation: 'check-slam 800ms cubic-bezier(0.18, 1.2, 0.35, 1) forwards',
            fontFamily: 'inherit',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          <div
            className="font-display text-gtl-red-deep"
            style={{
              fontSize: 'clamp(8rem, 14vw, 13rem)',
              transform: 'translate(10px, 10px)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            ✓
          </div>
        </div>
      )}
    </>
  )
}

function CycleCard({ cycle, index, selected, onSelect }) {
  const { play } = useSound()
  const cardRot = index % 2 === 0 ? '-0.4deg' : '0.3deg'

  const handleCardClick = () => {
    play(selected ? 'menu-close' : 'option-select')
    onSelect()
    if (!selected) setTimeout(() => play('stamp'), 440)
  }

  const firstDay = cycle.days?.[0]
  const lastDay  = cycle.days?.[cycle.days.length - 1]
  const plannedSessions = cycle.days?.filter(
    (iso) => (cycle.dailyPlan?.[iso] || []).length > 0
  ).length ?? 0

  const created = new Date(cycle.createdAt)
  const createdStr = `${MONTH_SHORT[created.getMonth()]} ${created.getDate()} ${created.getFullYear()}`

  const [doneDays, setDoneDays] = useState({})
  useEffect(() => {
    const result = {}
    for (const iso of (cycle.days || [])) {
      try { result[iso] = localStorage.getItem(pk(`done-${cycle.id}-${iso}`)) === 'true' } catch (_) {}
    }
    setDoneDays(result)
  }, [cycle.id])

  const allDone = cycle.days?.length > 0 && cycle.days.every(iso => doneDays[iso])

  const cardRef = useRef(null)
  const [bloodVisible, setBloodVisible] = useState(false)
  useEffect(() => {
    if (!allDone) return
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setBloodVisible(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [allDone])

  const splatter = useMemo(() => {
    const rnd = (min, max) => min + Math.random() * (max - min)
    const pick = () => Math.random() > 0.45 ? '#8b0000' : '#d4181f'
    const drops = []
    function spray(ox, oy, _bx, _by, count, baseDelay) {
      for (let i = 0; i < count; i++) {
        const angle = rnd(0, Math.PI * 2)
        const dist = i < 3 ? rnd(4, 25) : rnd(20, 110)
        const cx = ox + Math.cos(angle) * dist
        const cy = oy + Math.sin(angle) * dist
        const rx = rnd(3, i < 3 ? 18 : 7)
        const ry = dist > 50 ? rx * rnd(0.3, 0.7) : rx * rnd(0.7, 1.0)
        const rot = (Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI)
        drops.push({ cx, cy, rx, ry, rot, fill: pick(), delay: baseDelay + i * rnd(20, 60) })
      }
    }
    const cx = 500, cy = 210
    spray(220, 195,  cx, cy, 12, 100)
    spray(780, 220,  cx, cy, 12, 850)
    spray(cx,  cy,   cx, cy, 16, 1250)
    return drops
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() } }}
      className="relative bg-gtl-ink overflow-visible transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-gtl-red"
      style={{
        transform: `rotate(${cardRot})`,
        transformOrigin: 'center top',
        borderLeft: selected ? '4px solid #ff2a36' : '4px solid #d4181f',
        border: selected ? '1px solid #d4181f' : '1px solid #2a2a30',
        boxShadow: selected ? '0 0 24px rgba(212,24,31,0.25)' : 'none',
      }}
    >
      {/* Top-right corner: cycle index + deadline stamp */}
      <div className="absolute top-4 right-6 flex flex-col items-end gap-2">
        <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
          CYCLE / {String(index + 1).padStart(2, '0')}
        </div>
        {lastDay && (() => {
          const d = parseDate(lastDay)
          return (
            <div className="relative" style={{ transform: 'rotate(-1.5deg)' }}>
              <div
                className="absolute inset-0 bg-gtl-red-deep"
                style={{
                  clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
                  transform: 'translate(3px, 3px)',
                }}
                aria-hidden="true"
              />
              <div
                className="relative px-6 py-3 bg-gtl-red border-2 border-gtl-red-deep"
                style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}
              >
                <div className="font-display text-base tracking-[0.3em] uppercase text-gtl-paper leading-none mb-2"
                     style={{ textShadow: '2px 2px 0 #070708' }}>
                  ◼ DEADLINE ◼
                </div>
                <div className="font-display text-gtl-paper leading-none"
                     style={{ fontSize: '1.1rem', textShadow: '1px 1px 0 #070708' }}>
                  {d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}
                </div>
                <div className="relative flex items-center justify-center my-1" style={{ width: '100px', height: '100px' }}>
                  <style>{`
                    @keyframes spin-square {
                      from { transform: rotate(0deg); }
                      to   { transform: rotate(360deg); }
                    }
                  `}</style>
                  <div
                    className="absolute"
                    style={{
                      width: '80px', height: '80px',
                      background: '#070708',
                      animation: 'spin-square 8s linear infinite',
                      boxShadow: '0 0 20px rgba(0,0,0,0.8)',
                    }}
                    aria-hidden="true"
                  />
                  <div className="relative font-display text-gtl-paper leading-none"
                       style={{ fontSize: '5rem', textShadow: '4px 4px 0 #070708', lineHeight: 1, zIndex: 1 }}>
                    {String(d.getDate()).padStart(2, '0')}
                  </div>
                </div>
                <div className="font-display text-gtl-paper/80 leading-none mt-1.5"
                     style={{ fontSize: '0.85rem', textShadow: '1px 1px 0 #070708' }}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} · {d.getFullYear()}
                </div>
                {bloodVisible && (
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ zIndex: 10, transform: 'translateX(-12px)' }}
                    aria-hidden="true"
                  >
                    <div style={{
                      animation: 'x-stamp 600ms cubic-bezier(0.2, 1.4, 0.3, 1) 1800ms both',
                      fontFamily: 'Anton, Impact, sans-serif',
                      fontSize: '10rem',
                      color: '#8b0000',
                      lineHeight: 1,
                      textShadow: '3px 3px 0 rgba(0,0,0,0.6)',
                      border: '5px solid #8b0000',
                      padding: '0 10px',
                      opacity: 0.75,
                      userSelect: 'none',
                    }}>
                      ✕
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {selected && (
        <>
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center justify-center overflow-visible pointer-events-none" style={{ zIndex: 5 }}>
            <CheckSlam part="shadow" />
          </div>
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center justify-center overflow-visible pointer-events-none" style={{ zIndex: 20 }}>
            <CheckSlam part="face" />
          </div>
        </>
      )}

      <div className="px-8 pt-6 pb-8">
        <div className="font-mono text-[9px] tracking-[0.35em] uppercase text-gtl-smoke mb-3">
          FORGED {createdStr}
        </div>

        <h2
          className="font-display text-gtl-chalk leading-none mb-1"
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            textShadow: '3px 3px 0 #070708',
            transform: 'rotate(-1deg)',
            transformOrigin: 'left center',
          }}
        >
          {cycle.name}
        </h2>

        {firstDay && lastDay && (
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red mb-5">
            {formatDateShort(firstDay)} — {formatDateShort(lastDay)}
          </div>
        )}

        <div className="flex items-center gap-6 mb-6 flex-wrap">
          <div className="flex items-center gap-6 shrink-0">
            <div>
              <div className="font-display text-3xl leading-none"
                   style={{ color: '#e4b022', textShadow: '2px 2px 0 #8a6612' }}>
                {String(cycle.days?.length ?? 0).padStart(2, '0')}
              </div>
              <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke mt-0.5">BATTLEDAYS</div>
            </div>
            <div className="w-px h-10 bg-gtl-red" style={{ transform: 'skewX(-12deg)' }} />
            <div>
              <div className="font-display text-3xl leading-none"
                   style={{ color: '#e4b022', textShadow: '2px 2px 0 #8a6612' }}>
                {String(cycle.targets?.length ?? 0).padStart(2, '0')}
              </div>
              <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke mt-0.5">TARGETS</div>
            </div>
            <div className="w-px h-10 bg-gtl-red" style={{ transform: 'skewX(-12deg)' }} />
            <div>
              <div className="font-display text-3xl leading-none"
                   style={{ color: '#e4b022', textShadow: '2px 2px 0 #8a6612' }}>
                {String(plannedSessions).padStart(2, '0')}
              </div>
              <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke mt-0.5">SESSIONS</div>
            </div>
          </div>

          {cycle.days?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-24">
              {cycle.days.map((iso) => {
                const date = new Date(iso + 'T12:00:00')
                const dayNum = date.getDate()
                const hasWork = (cycle.dailyPlan?.[iso] || []).length > 0
                const done = doneDays[iso]
                return (
                  <div key={iso} className="relative" style={{ width: '34px', height: '34px' }}>
                    <div style={{
                      width: '100%', height: '100%',
                      background: hasWork ? 'rgba(212,24,31,0.12)' : 'rgba(26,26,30,0.6)',
                      border: `1px solid ${hasWork ? 'rgba(212,24,31,0.35)' : 'rgba(58,58,66,0.4)'}`,
                      clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="font-display leading-none"
                        style={{ fontSize: '0.85rem', color: hasWork ? '#c8c8c8' : '#3a3a42' }}>
                        {dayNum}
                      </span>
                    </div>
                    {done && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                        <span className="font-display leading-none"
                          style={{ fontSize: '1.6rem', color: 'rgba(212,24,31,0.55)', transform: 'rotate(-5deg)', textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>
                          X
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-5 h-px bg-gtl-red" style={{ transform: 'skewX(-8deg)', position: 'relative', zIndex: 10 }} />

        {cycle.targets?.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-4" style={{ overflow: 'visible' }}>
            {cycle.targets.map((id, i) => (
              <MuscleTag key={id} id={id} index={i} />
            ))}
          </div>
        )}
      </div>

      {bloodVisible && (
        <>
          <style>{`
            @keyframes blood-stroke-1 {
              from { stroke-dashoffset: 2000; opacity: 0; }
              2%   { opacity: 1; }
              to   { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes blood-splat {
              0%   { transform: scale(0); opacity: 0; }
              60%  { transform: scale(1.3); opacity: 1; }
              100% { transform: scale(1);   opacity: 0.85; }
            }
            @keyframes blood-text {
              0%   { transform: translate(-50%,-50%) rotate(-18deg) scale(2.5); opacity: 0; filter: blur(8px); }
              60%  { transform: translate(-50%,-50%) rotate(-18deg) scale(0.9); opacity: 1; filter: blur(0); }
              80%  { transform: translate(-50%,-50%) rotate(-18deg) scale(1.06); }
              100% { transform: translate(-50%,-50%) rotate(-18deg) scale(1); opacity: 1; }
            }
            @keyframes x-stamp {
              0%   { transform: rotate(-8deg) scale(2.5); opacity: 0; filter: blur(8px); }
              60%  { transform: rotate(-8deg) scale(0.9); opacity: 1; filter: blur(0); }
              80%  { transform: rotate(-8deg) scale(1.06); }
              100% { transform: rotate(-8deg) scale(1); opacity: 1; }
            }
          `}</style>
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%" height="100%"
            viewBox="0 0 1000 420"
            preserveAspectRatio="none"
            style={{ zIndex: 10 }}
            aria-hidden="true"
          >
            <defs>
              <filter id="blood-blur-ghost">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path d="M 18,22 C 120,48 310,160 498,215 C 680,268 850,340 982,400"
              stroke="rgba(0,0,0,0.55)" strokeWidth="14" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />
            <path d="M 16,20 C 118,46 308,158 496,213 C 678,266 848,338 980,398"
              stroke="#8b0000" strokeWidth="11" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both', filter: 'url(#blood-blur-ghost)' }} />
            <path d="M 16,18 C 118,44 308,156 496,211 C 678,264 848,336 980,396"
              stroke="#d4181f" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />
            <path d="M 16,17 C 118,43 308,155 496,210 C 678,263 848,335 980,395"
              stroke="rgba(255,100,100,0.35)" strokeWidth="2" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />
            {splatter.map(({ cx, cy, rx, ry, rot, fill, delay }, i) => (
              <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                  fill={fill} opacity="0"
                  style={{ animation: `blood-splat 400ms ease-out ${Math.round(delay)}ms both`, transformBox: 'fill-box', transformOrigin: 'center' }} />
              </g>
            ))}
          </svg>
          <div
            className="absolute pointer-events-none select-none"
            style={{
              left: '50%', top: '50%', zIndex: 11,
              animation: 'blood-text 600ms cubic-bezier(0.2, 1.4, 0.3, 1) 1500ms both',
            }}
            aria-hidden="true"
          >
            <div style={{
              transform: 'translate(-50%, -50%) rotate(-18deg)',
              fontFamily: 'Anton, Impact, sans-serif',
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              color: '#8b0000',
              letterSpacing: '0.12em',
              textShadow: '4px 4px 0 rgba(0,0,0,0.75), 0 0 40px rgba(139,0,0,0.7)',
              border: '4px solid #8b0000',
              padding: '6px 20px',
              lineHeight: 1.1,
              opacity: 0.92,
              whiteSpace: 'nowrap',
            }}>
              BLOOD SPILT
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── GHOST TRAIN button ── */
function GhostTrainButton({ onActivate }) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onActivate() }}
      onMouseLeave={() => { setPressed(false); setHovered(false) }}
      onMouseEnter={() => setHovered(true)}
      className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
      style={{ transform: 'rotate(-0.6deg)' }}
    >
      <div
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          background: pressed ? 'translate(0,0)' : '#1a1a2e',
          transform: pressed ? 'translate(0,0)' : 'translate(5px, 5px)',
          transition: 'transform 80ms ease-out',
          backgroundColor: '#1a1a2e',
        }}
        aria-hidden="true"
      />
      <div
        className="relative px-10 py-4"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          background: pressed ? '#2a2a44' : hovered ? '#22223a' : '#1a1a2e',
          border: `1px solid ${hovered ? '#6060a0' : '#3a3a52'}`,
          transform: pressed ? 'translate(5px, 5px)' : 'translate(0,0)',
          transition: 'transform 80ms ease-out, background 80ms ease-out, border-color 200ms',
        }}
      >
        <div className="font-display text-2xl leading-none tracking-tight"
          style={{ color: hovered ? '#a0a0d0' : '#8080b0' }}>
          GHOST TRAIN
        </div>
        <div className="font-mono text-[8px] tracking-[0.35em] uppercase mt-1"
          style={{ color: '#4a4a6a' }}>
          NO DATA WILL BE SAVED
        </div>
      </div>
    </button>
  )
}

/* ── Sticky bottom action bar — ghost edition ── */
function BottomBar({ cycle, onGhostTrain }) {
  const { play } = useSound()

  useEffect(() => {}, [cycle?.id])

  if (!cycle) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: 'rgba(7,7,8,0.97)', borderTop: '2px solid #3a3a52' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
           style={{ background: '#3a3a52', transform: 'skewX(-4deg)', transformOrigin: 'left center' }} />

      <div className="px-8 py-5 flex items-center gap-8 flex-wrap">
        <div className="flex flex-col">
          <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-gtl-smoke mb-0.5">SELECTED</div>
          <div className="font-display text-xl text-gtl-chalk leading-none" style={{ transform: 'rotate(-0.5deg)' }}>
            {cycle.name}
          </div>
        </div>

        <div className="w-px h-10 bg-gtl-edge self-center" style={{ transform: 'skewX(-12deg)' }} />

        <GhostTrainButton onActivate={() => { play('card-confirm'); onGhostTrain(cycle) }} />

        {/* Ghost mode reminder */}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[8px] tracking-[0.3em] uppercase"
            style={{ color: '#4a4a6a' }}>
            GHOST MODE · NOTHING SAVED
          </span>
        </div>
      </div>
    </div>
  )
}

export default function GhostCyclePage() {
  useProfileGuard()
  const router = useRouter()
  const { play } = useSound()
  const [cycles, setCycles]         = useState([])
  const [ready, setReady]           = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [fireActive, setFireActive] = useState(false)
  const [fireDest, setFireDest]     = useState('/fitness/ghost/active')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pk('cycles'))
      if (raw) setCycles(JSON.parse(raw))
    } catch (_) {}
    setReady(true)
  }, [])

  const selectedCycle = cycles.find((c) => c.id === selectedId) ?? null

  const handleSelect = (id) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  const loadCycleIntoStorage = (cycle) => {
    try {
      localStorage.setItem(pk('active-cycle-id'), cycle.id)
      localStorage.setItem(pk('cycle-name'),       cycle.name)
      localStorage.setItem(pk('muscle-targets'),   JSON.stringify(cycle.targets))
      localStorage.setItem(pk('training-days'),    JSON.stringify(cycle.days))
      localStorage.setItem(pk('daily-plan'),       JSON.stringify(cycle.dailyPlan))
    } catch (_) {}
  }

  const handleGhostTrain = (cycle) => {
    loadCycleIntoStorage(cycle)
    setFireDest('/fitness/ghost/active')
    setFireActive(true)
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gtl-void">

      {/* Atmospherics */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(30,30,80,0.18) 0%, transparent 45%, rgba(20,20,60,0.28) 100%)' }}
      />

      {/* Kanji watermark — 幽 (ghost/spirit). Top rooted at safe-area floor so it
          never clips into the iOS Dynamic Island camera area. */}
      <div
        className="absolute -right-24 pointer-events-none select-none"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 64px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '52rem', lineHeight: '0.8',
          color: '#6060a0', opacity: 0.045, fontWeight: 900,
        }}
      >
        幽
      </div>

      {/* Nav */}
      <nav className="relative z-10 shrink-0 flex items-center justify-between pl-0 pr-8 py-5">
        <RetreatButton href="/fitness/hub" />      </nav>

      {/* Ghost mode banner */}
      <div className="relative z-10 mx-8 mb-4">
        <div
          className="flex items-center gap-3 px-5 py-2"
          style={{
            background: 'rgba(30,30,60,0.6)',
            border: '1px solid #3a3a52',
            clipPath: 'polygon(1% 0%, 100% 0%, 99% 100%, 0% 100%)',
          }}
        >
          <span className="font-display text-sm leading-none" style={{ color: '#6060a0' }}>◈</span>
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: '#6060a0' }}>
            GHOST MODE — NOTHING WILL BE SAVED
          </span>
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 px-8 pb-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-0.5 w-12" style={{ background: '#6060a0' }} />
          <span className="font-mono text-[10px] tracking-[0.4em] uppercase font-bold" style={{ color: '#6060a0' }}>
            GHOST TRAIN
          </span>
        </div>
        <h1 className="font-matisse text-5xl text-gtl-chalk leading-none -rotate-1">
          CHOOSE
          <span className="inline-block rotate-1 ml-3"
            style={{ color: '#6060a0', textShadow: '3px 3px 0 #1a1a3e' }}>YOUR CYCLE</span>
        </h1>
      </div>

      {/* Red slash divider */}
      <div
        className="relative z-10 mx-8 mb-10 h-[2px]"
        style={{ background: '#3a3a52', transform: 'skewX(-6deg)', transformOrigin: 'left center' }}
      />

      {/* Cycle list */}
      <section
        className="relative z-10 px-8"
        style={{ paddingBottom: selectedCycle ? '140px' : '80px' }}
      >
        {!ready ? null : cycles.length === 0 ? (
          <div className="flex flex-col items-start gap-6 py-20">
            <div className="font-display text-4xl text-gtl-ash -rotate-1">NO CYCLES FORGED</div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke">
              Complete the new cycle flow to record your first program.
            </div>
            <Link
              href="/fitness/load"
              className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red hover:text-gtl-red-bright transition-colors"
            >
              ← VIEW YOUR CYCLES
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6" style={{ overflow: 'visible' }}>
            {cycles.map((cycle, i) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                index={i}
                selected={selectedId === cycle.id}
                onSelect={() => handleSelect(cycle.id)}
              />
            ))}
          </div>
        )}
      </section>

      <BottomBar
        cycle={selectedCycle}
        onGhostTrain={handleGhostTrain}
      />

      <FireTransition active={fireActive} onComplete={() => router.push(fireDest)} />
    </main>
  )
}
