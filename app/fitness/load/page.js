'use client'
/*
 * /fitness/load — Your Cycles. The war record.
 *
 * Each cycle card has a parallelogram stamp toggle (like muscle chips).
 * Selecting a cycle stamps it active and reveals the ACTIVATE / DELETE
 * action bar fixed at the bottom. Only one cycle selected at a time.
 * DELETE goes through three confirmation stages in the bottom bar.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSound } from '../../../lib/useSound'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import HeistTransition from '../../../components/HeistTransition'
import RetreatButton from '../../../components/RetreatButton'
import { LogoStencil, LogoTarget } from '../../../components/LogoHalf'
import { consumePrefire, setInAnimation, registerChainStep, clearChainTransient } from '../../../lib/predictiveTap'

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

/* ── Giant checkmark slam — mounts on select, unmounts on deselect ── */
/* part='shadow' renders only the offset shadow; part='face' renders ring + face */
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
          {/* Shockwave ring */}
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
          {/* Face */}
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
        /* Hard shadow — animates identically so it tracks the face */
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

/* ── Cycle dossier card — click anywhere to select/deselect ── */
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

  // Only start blood animation once the card is scrolled into view
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

  // Random splatter — generated once per card mount so it's different every time
  const splatter = useMemo(() => {
    const rnd = (min, max) => min + Math.random() * (max - min)
    const pick = () => Math.random() > 0.45 ? '#8b0000' : '#d4181f'
    const drops = []

    // Spray around a focal point, biased toward (bx,by) direction
    function spray(ox, oy, _bx, _by, count, baseDelay) {
      for (let i = 0; i < count; i++) {
        // full 360° random scatter — no directional bias
        const angle = rnd(0, Math.PI * 2)
        const dist = i < 3 ? rnd(4, 25) : rnd(20, 110) // first few close, rest far
        const cx = ox + Math.cos(angle) * dist
        const cy = oy + Math.sin(angle) * dist
        const rx = rnd(3, i < 3 ? 18 : 7)
        // elongated drops for distant ones
        const ry = dist > 50 ? rx * rnd(0.3, 0.7) : rx * rnd(0.7, 1.0)
        const rot = (Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI)
        drops.push({ cx, cy, rx, ry, rot, fill: pick(), delay: baseDelay + i * rnd(20, 60) })
      }
    }

    // Stroke runs top-left→bottom-right at ~22°.
    // Perpendicular offset (rotated 90°): dx≈-0.37, dy≈0.93 — pushes origins off the line.
    // Two clusters on opposite sides of the stroke + one at center.
    const cx = 500, cy = 210
    spray(220, 195,  cx, cy, 12, 100)   // upper-third, offset below-left of stroke
    spray(780, 220,  cx, cy, 12, 850)   // lower-third, offset above-right of stroke
    spray(cx,  cy,   cx, cy, 16, 1250)  // center intersection — full burst

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
      {/* Giant checkmark — shadow behind deadline block, face in front */}
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
        {/* Cycle name — top of card, dominant. Wrapped in a min-h-[56px]
            flex strip tagged data-predictive-tap-target="load-cycle" so the
            upcoming predictive-tap module can target this row's bbox
            instead of the full card's. The CARD remains the actual click
            target (whole card selects on tap); this attribute marks the
            inner strip the predictive-tap-chain hit-zone aligns with. */}
        <div
          data-predictive-tap-target="load-cycle"
          className="min-h-[56px] flex items-center mb-3"
        >
          <h2
            className="font-display text-gtl-chalk leading-none"
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              textShadow: '3px 3px 0 #070708',
              transform: 'rotate(-1deg)',
              transformOrigin: 'left center',
              wordBreak: 'break-word',
            }}
          >
            {cycle.name}
          </h2>
        </div>

        {/* Top-meta row: FORGED date on left, CYCLE / 0X on right. */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[9px] tracking-[0.35em] uppercase text-gtl-smoke">
            FORGED {createdStr}
          </div>
          <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
            CYCLE / {String(index + 1).padStart(2, '0')}
          </div>
        </div>

        {/* Silhouette + deadline stamp row — silhouette left, stamp right with
            tight 10px gap between them. */}
        <div className="flex items-center mb-4" style={{ gap: '10px' }}>
          {/* Silhouette: wakizashi (1–6 days, tinted red) / ouroboros (7) /
              drill (8–13) / scroll (15+). Wakizashi uses CSS mask-image so we
              can recolor the silhouette to GTL red without altering the SVG. */}
          <div className="shrink-0" style={{ marginLeft: '-16px' }}>
            {(() => {
              const n = cycle.days?.length || 0
              if (n >= 1 && n <= 6) {
                return (
                  <div
                    aria-hidden="true"
                    className="select-none pointer-events-none"
                    style={{
                      width: '90px',
                      height: '120px',
                      backgroundColor: '#d4181f',
                      WebkitMaskImage: 'url(/reference/wakizashi_solid_silhouette.svg)',
                      maskImage: 'url(/reference/wakizashi_solid_silhouette.svg)',
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskPosition: 'left center',
                      maskPosition: 'left center',
                      opacity: 0.9,
                    }}
                  />
                )
              }
              if (n === 7) {
                return (
                  <img src="/reference/ouroboros.svg" alt=""
                    className="opacity-90 select-none pointer-events-none"
                    style={{ height: '120px', width: 'auto', maxWidth: '140px' }}
                    draggable={false} />
                )
              }
              if (n >= 8 && n <= 13) {
                return (
                  <img src="/reference/drill.svg" alt=""
                    className="opacity-90 select-none pointer-events-none"
                    style={{ height: '120px', width: 'auto', maxWidth: '140px' }}
                    draggable={false} />
                )
              }
              if (n >= 15) {
                return (
                  <div style={{ width: '110px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <img src="/reference/scroll.svg" alt=""
                      className="opacity-90 select-none pointer-events-none"
                      style={{ width: '120px', height: '95px', transform: 'rotate(-90deg)' }}
                      draggable={false} />
                  </div>
                )
              }
              return null
            })()}
          </div>

          {/* Deadline stamp */}
          {lastDay && (() => {
            const d = parseDate(lastDay)
            return (
              <div className="relative shrink-0" style={{ transform: 'rotate(-1.5deg)', marginLeft: '-8px' }}>
                {/* Shadow slab */}
                <div
                  className="absolute inset-0 bg-gtl-red-deep"
                  style={{
                    clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
                    transform: 'translate(3px, 3px)',
                  }}
                  aria-hidden="true"
                />
                {/* Stamp face */}
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
                  {/* Day number with spinning square behind */}
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

        {/* Day progress chips — slanted parallelogram cells per day; red X
            overlay on completed days. Sit below the silhouette. */}
        {cycle.days?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
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

      {/* Completed cycle — blood spilt X (only renders once card enters viewport) */}
      {bloodVisible && (
        <>
          <style>{`
            @keyframes blood-stroke-1 {
              from { stroke-dashoffset: 2000; opacity: 0; }
              2%   { opacity: 1; }
              to   { stroke-dashoffset: 0; opacity: 1; }
            }
            @keyframes blood-stroke-2 {
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
              <filter id="blood-blur">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* ── STROKE 1: top-left → bottom-right (straight diagonal) ── */}
            {/* shadow */}
            <path d="M 18,22 L 982,400"
              stroke="rgba(0,0,0,0.55)" strokeWidth="14" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />
            {/* main */}
            <path d="M 16,20 L 980,398"
              stroke="#8b0000" strokeWidth="11" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both', filter: 'url(#blood-blur)' }} />
            {/* wet sheen */}
            <path d="M 16,18 L 980,396"
              stroke="#d4181f" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.7"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />
            {/* highlight */}
            <path d="M 16,17 L 980,395"
              stroke="rgba(255,100,100,0.35)" strokeWidth="2" strokeLinecap="round" fill="none"
              strokeDasharray="2000" style={{ animation: 'blood-stroke-1 800ms cubic-bezier(0.3,0,0.2,1) 100ms both' }} />

{/* ── INK SPLATTER — randomly placed on mount ── */}
            {splatter.map(({ cx, cy, rx, ry, rot, fill, delay }, i) => (
              <g key={i} transform={`rotate(${rot} ${cx} ${cy})`}>
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                  fill={fill} opacity="0"
                  style={{ animation: `blood-splat 400ms ease-out ${Math.round(delay)}ms both`, transformBox: 'fill-box', transformOrigin: 'center' }} />
              </g>
            ))}
          </svg>

          {/* BLOOD SPILT stamp */}
          <div
            className="absolute pointer-events-none select-none"
            style={{
              left: 'calc(50% + 120px)', top: 'calc(50% - 110px)', zIndex: 11,
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

/* LogoHalf moved to components/LogoHalf.jsx (shared across all swipe buttons). */

/* ── Quick-nav ACTIVATE popup with tap-vs-swipe gesture ── */
function ActivatePopup({ cycle, onTap, onSwipe }) {
  const startRef = useRef(null)
  const dxRef = useRef(0)
  const swipeFiredRef = useRef(false)
  // Velocity tracker for flick-detection. Each entry: { t, x } in
  // (timestamp, clientX). Pruned to a 100ms rolling window on each move.
  const velocityTrackerRef = useRef([])
  const VELOCITY_WINDOW_MS = 100
  const FLICK_VELOCITY = 0.4    // px/ms — minimum speed to count as a flick
  const FLICK_MIN_DISTANCE = 40 // px — minimum drag before flick can fire
  const [dragX, setDragX] = useState(0)
  // Shockwave ring counter — increments on each successful swipe so the
  // ring element remounts and re-runs the keyframe. ringSide tracks where
  // the swipe ended (right swipe → fusion at right bead, etc.) so the
  // shockwave radiates from the docked logo, not the button center.
  const [ringKey, setRingKey] = useState(0)
  const [ringSide, setRingSide] = useState('right')
  // Entrance: stencil starts fused with target (right slot) and rolls left
  // to its idle slot, demonstrating to first-time users that the gesture
  // is the inverse — they need to pull the stencil BACK over the target.
  const [entranceDone, setEntranceDone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setEntranceDone(true), 1300)
    return () => clearTimeout(t)
  }, [])
  // Full traversal distance — the swiped bead travels all the way across to
  // the other side. Gap between bead centers = 2 * (175 - 28) = 294, fixed
  // by calc(50% - 175px) on each side. Threshold matches the gap so 1:1
  // finger drag fully docks the bead at the other end.
  const SWIPE_THRESHOLD = 294

  const handlePointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY }
    dxRef.current = 0
    swipeFiredRef.current = false
    velocityTrackerRef.current = [{ t: e.timeStamp, x: e.clientX }]
    setDragX(0)
  }
  const handlePointerMove = (e) => {
    if (!startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) {
      // SIGNED clamp: positive = right swipe, negative = left swipe.
      const clamped = Math.max(-SWIPE_THRESHOLD, Math.min(dx, SWIPE_THRESHOLD))
      dxRef.current = clamped
      setDragX(clamped)
    }
    // Sample for flick detection. Push current sample, prune > 100ms old.
    const tracker = velocityTrackerRef.current
    tracker.push({ t: e.timeStamp, x: e.clientX })
    const cutoff = e.timeStamp - VELOCITY_WINDOW_MS
    while (tracker.length > 0 && tracker[0].t < cutoff) tracker.shift()
  }
  const handlePointerUp = () => {
    // Compute velocity (px/ms) from the rolling window.
    const tracker = velocityTrackerRef.current
    let velocity = 0
    if (tracker.length >= 2) {
      const oldest = tracker[0]
      const newest = tracker[tracker.length - 1]
      const dt = newest.t - oldest.t
      if (dt > 0) velocity = (newest.x - oldest.x) / dt
    }
    const distance = Math.abs(dxRef.current)
    const dirMatches = dxRef.current === 0 || Math.sign(velocity) === Math.sign(dxRef.current)
    // Fire if EITHER: full traversal, OR flick (high velocity + min distance
    // in same direction). Slow + short gesture still doesn't fire.
    const fired =
      distance >= SWIPE_THRESHOLD ||
      (Math.abs(velocity) >= FLICK_VELOCITY && distance >= FLICK_MIN_DISTANCE && dirMatches)

    if (fired && onSwipe) {
      swipeFiredRef.current = true
      setRingSide(dxRef.current > 0 ? 'right' : 'left')
      setRingKey((k) => k + 1)
      onSwipe(cycle)
    }
    startRef.current = null
    dxRef.current = 0
    velocityTrackerRef.current = []
    setDragX(0)
  }
  const handleClick = (e) => {
    if (swipeFiredRef.current) {
      e.preventDefault(); e.stopPropagation()
      swipeFiredRef.current = false
      return
    }
    onTap(cycle)
  }
  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD)

  return (
    <>
    <style>{`
      @keyframes yy-pulse-left {
        0%, 100% { transform: translateX(0)   scale(1); }
        50%      { transform: translateX(7px) scale(1.06); }
      }
      @keyframes yy-pulse-right {
        0%, 100% { transform: translateX(0)    scale(1); }
        50%      { transform: translateX(-7px) scale(1.06); }
      }
      /* Onboarding: stencil rolls OFF the target on mount. Starts at the
         fused position (translateX(294)) and rolls back to idle (0), one
         full CCW revolution along the way. Teaches the inverse gesture. */
      @keyframes logo-roll-in {
        0%   { transform: translateX(294px) rotate(360deg); }
        100% { transform: translateX(0)     rotate(0deg);   }
      }
    `}</style>
    <button
      type="button"
      data-predictive-tap-target="activate"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { startRef.current = null; dxRef.current = 0; swipeFiredRef.current = false; velocityTrackerRef.current = []; setDragX(0) }}
      onClick={handleClick}
      className={`
        fixed z-50 group flex items-center justify-center
        font-display tracking-[0.25em] uppercase overflow-visible
        px-24 py-5 min-h-[56px]
        text-3xl text-gtl-paper
        transition-all duration-200 ease-out
        [@media(hover:hover)]:hover:scale-[1.04] active:scale-[0.98]
        bg-gtl-red [@media(hover:hover)]:hover:bg-gtl-red-bright
        shadow-[4px_4px_0_#070708]
        [@media(hover:hover)]:hover:shadow-[6px_6px_0_#070708]
        active:shadow-[2px_2px_0_#070708]
      `}
      style={{
        top: '479px',
        left: '12px',
        right: '12px',
        clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
        touchAction: 'pan-y',
        animation: 'activate-popup-rise 320ms cubic-bezier(0.18, 1, 0.36, 1) both',
      }}
    >
      {/* Subtle red wash that ramps up as the swipe progresses — supplements
          the yin-yang fusion as background feedback. */}
      <div
        className="absolute inset-0 pointer-events-none bg-gtl-red-bright"
        style={{
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          opacity: swipeProgress * 0.45,
          transition: dragX === 0 ? 'opacity 200ms' : 'none',
        }}
        aria-hidden="true"
      />
      <span
        className="relative inline-block leading-none tracking-tight"
        style={{ transform: `translateX(${dragX * 0.25}px)`, transition: dragX === 0 ? 'transform 200ms' : 'none' }}
      >
        {swipeProgress >= 1 ? 'LIFT NOW' : 'ACTIVATE'}
      </span>
    </button>

    {/* Red teardrop — pinned 100px left of viewport center. Travels RIGHT
        on a positive (rightward) swipe, all the way to where the ink half
        sits. Stays put on a leftward swipe. */}
    {(() => {
      // Rolling factor tuned so the bead completes EXACTLY one full rotation
      // over a full swipe and lands upright at fusion (logo readable at the
      // dock point). 360° / threshold = deg per px.
      const rollFactor = 360 / SWIPE_THRESHOLD
      const stencilTx = Math.max(0, dragX)
      const targetTx  = Math.min(0, dragX)
      return (
        <>
        <div
          className="fixed z-[52] pointer-events-none"
          style={{
            top: '486px',
            left: 'calc(50% - 175px)',
            width: '56px',
            height: '56px',
            transform: `translateX(${stencilTx}px) rotate(${stencilTx * rollFactor}deg)`,
            opacity: 0.85 + swipeProgress * 0.15,
            transition: dragX === 0 ? 'transform 220ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms' : 'opacity 100ms',
            animation: !entranceDone
              ? 'logo-roll-in 1300ms cubic-bezier(0.85, 0, 0.15, 1) forwards'
              : (dragX === 0 ? 'yy-pulse-left 1.5s ease-in-out infinite' : 'none'),
          }}
          aria-hidden="true"
        >
          <LogoStencil size={56} paused={!entranceDone || dragX !== 0} />
        </div>

        <div
          className="fixed z-[51] pointer-events-none"
          style={{
            top: '486px',
            right: 'calc(50% - 175px)',
            width: '56px',
            height: '56px',
            transform: `translateX(${targetTx}px) rotate(${targetTx * rollFactor}deg)`,
            opacity: 0.85 + swipeProgress * 0.15,
            transition: dragX === 0 ? 'transform 220ms cubic-bezier(0.2,0.8,0.3,1), opacity 200ms' : 'opacity 100ms',
            // Gated on entranceDone too — without this, the target pulse
            // starts at mount while the stencil pulse waits 1300ms for the
            // roll-in to finish. That 1300ms phase difference is what reads
            // as 'pulses are slightly off.' Both gate on entranceDone now,
            // so they begin pulsing in the same render and stay in sync.
            animation: (entranceDone && dragX === 0) ? 'yy-pulse-right 1.5s ease-in-out infinite' : 'none',
          }}
          aria-hidden="true"
        >
          <LogoTarget size={56} />
        </div>
        </>
      )
    })()}
    {/* Shockwave ring — radiates from the docked logo on a successful swipe.
        Reuses the global @keyframes shockwave (the same one fired by the
        muscle-target ALL button). Positioned at whichever bead stayed put
        (right side on a rightward swipe, left side on a leftward swipe). */}
    {ringKey > 0 && (
      <div
        key={ringKey}
        className="fixed z-[53] pointer-events-none rounded-full"
        style={{
          top: '486px',
          ...(ringSide === 'right'
            ? { right: 'calc(50% - 175px)' }
            : { left:  'calc(50% - 175px)' }),
          width: '56px',
          height: '56px',
          borderStyle: 'solid',
          borderColor: '#d4181f',
          animation: 'shockwave 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
        }}
        aria-hidden="true"
      />
    )}
    </>
  )
}

/* ── Subordinate control band — sits directly below ACTIVATE, matches its
   width (left/right 12px), and carries the gesture hint + REVIEW + DELETE
   as a single cohesive panel. ACTIVATE is the hero; this band hosts the
   secondary controls without competing visually. ── */
function BottomBar({ cycle, onReview, onDelete }) {
  const { play } = useSound()
  const [deleteStage, setDeleteStage] = useState(0) // 0 idle · 1 first confirm · 2 cancel confirm

  // Reset delete stage whenever the selected cycle changes
  useEffect(() => { setDeleteStage(0) }, [cycle?.id])

  if (!cycle) return null

  return (
    <div
      className="fixed z-50"
      style={{
        top: '549px',
        left: '12px',
        right: '12px',
        background: 'rgba(7,7,8,0.94)',
        border: '1px solid #d4181f',
        boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
      }}
    >
      <div className="px-7 py-3 flex flex-col gap-2.5">
        {/* Gesture hint — caption row at the top of the band, explaining the
            two interactions on the ACTIVATE slab above. */}
        <div className="flex items-center justify-center gap-3 font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-ash/85">
          <span>TAP TO ACTIVATE</span>
          <span className="text-gtl-red">·</span>
          <span>SWIPE TO LIFT NOW →</span>
        </div>

        {/* Thin red rule separating hint from secondary actions */}
        <div className="h-px bg-gtl-red/40" aria-hidden="true" />

        {/* Actions row — REVIEW + DELETE, both as text links so they read as
            a balanced pair instead of "primary slab + danger link." */}
        <div className="flex items-center justify-between min-h-[24px]">
          <button
            type="button"
            onClick={() => { play('option-select'); onReview(cycle) }}
            className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-paper hover:text-gtl-red transition-colors"
          >
            REVIEW / EDIT
          </button>

          {deleteStage === 0 && (
            <button
              type="button"
              onClick={() => { play('button-hover'); setDeleteStage(1) }}
              className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke hover:text-gtl-red transition-colors"
            >
              DELETE
            </button>
          )}

          {deleteStage === 1 && (
            <div className="flex flex-col gap-1 items-end">
              <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-red">
                ERASE THIS CYCLE?
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { play('menu-close'); onDelete(cycle.id) }}
                  className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red hover:text-gtl-red-bright transition-colors"
                >
                  YES, ERASE
                </button>
                <button
                  type="button"
                  onClick={() => { play('button-hover'); setDeleteStage(2) }}
                  className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash hover:text-gtl-chalk transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {deleteStage === 2 && (
            <div className="flex flex-col gap-1 items-end">
              <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-smoke">
                THUMB DIDN'T SLIP?
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { play('button-hover'); setDeleteStage(0) }}
                  className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash hover:text-gtl-chalk transition-colors"
                >
                  KEEP IT
                </button>
                <button
                  type="button"
                  onClick={() => { play('menu-close'); onDelete(cycle.id) }}
                  className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red hover:text-gtl-red-bright transition-colors"
                >
                  DELETE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoadCyclePage() {
  useProfileGuard()
  const router = useRouter()
  const { play } = useSound()
  const [cycles, setCycles]       = useState([])
  const [ready, setReady]         = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [fireActive, setFireActive] = useState(false)
  const [fireDest, setFireDest]     = useState('/fitness/new/summary')
  // Latches once skipAll fires so FireTransition.onComplete won't double-route.
  const skippedRef = useRef(false)
  // Synchronous flag — set on first ACTIVATE/REVIEW so a fast follow-up tap on
  // the same button skips even if React hasn't committed `fireActive` yet.
  const fireActiveRef = useRef(false)
  // Mount-time stamp for the iOS-leaked-click eat (150ms grace). Same
  // pattern as /fitness/hub: when the user predictive-taps from the
  // previous page, iOS can deliver the synthetic click AFTER navigation,
  // landing on this page's ACTIVATE button. We reject onClick-sourced
  // handleActivate calls within 150ms of mount; the consume's setTimeout
  // bypasses via { fromTimer: true }.
  const mountTimeRef = useRef(0)
  useEffect(() => { mountTimeRef.current = performance.now() }, [])
  // Stable ref for the destination so the pointerdown listener doesn't have to
  // re-bind each time fireDest changes.
  const fireDestRef = useRef(fireDest)
  useEffect(() => { fireDestRef.current = fireDest }, [fireDest])

  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    // inAnim stays open across the hop — next page's consumePrefire
    // re-asserts it.
    router.push(fireDestRef.current)
  }

  // Predictive-tap chain: clear stale transient state from any prior hop
  // on every mount. Manual ACTIVATE tap's onClick handler sets
  // currentStep correctly via setInAnimation('activate', true). Chain
  // arrivals consume the prefire below and eagerly open inAnim there.
  useEffect(() => {
    clearChainTransient('load-mount', 'activate')
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pk('cycles'))
      if (raw) {
        const parsed = JSON.parse(raw)
        setCycles(parsed)
        // Auto-select the most-recent cycle on landing so the ACTIVATE popup
        // appears immediately. "Most recent" = highest createdAt timestamp;
        // falls back to the first entry if any cycle is missing createdAt.
        if (parsed.length > 0) {
          const mostRecent = parsed.reduce((best, c) =>
            (!best || (c.createdAt || 0) > (best.createdAt || 0)) ? c : best, null)
          if (mostRecent) setSelectedId(mostRecent.id)
        }
        try { localStorage.removeItem('gtl-just-forged') } catch (_) {}
      }
    } catch (_) {}
    setReady(true)
  }, [])

  // Register skip-route for the 'activate' chain step. Module-level
  // listener in lib/predictiveTap.js calls this when a tap arrives past
  // SKIP_GRACE_MS during the activate HT. Retreat-button exclusion is
  // handled centrally.
  useEffect(() => registerChainStep('activate', () => skipNow()), [])

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

  const handleActivate = (cycle, { deepLaunch = false, fromTimer = false } = {}) => {
    // iOS-leaked-click eat: reject onClick-sourced calls within 150ms
    // of mount. fromTimer=true bypasses (consume's setTimeout still fires).
    if (!fromTimer && performance.now() - mountTimeRef.current < 150) return
    // Already firing → this rapid second tap is a skip.
    if (fireActiveRef.current) { skipNow(); return }
    fireActiveRef.current = true
    loadCycleIntoStorage(cycle)
    try { localStorage.removeItem(pk('editing-cycle-id')) } catch (_) {}
    // Deep-launch flag — only set on swipe-activate; tap-activate just lands
    // on /fitness/active normally. When set, the chain auto-progresses to
    // today → first muscle → first exercise S1 weight popup.
    if (deepLaunch) {
      try { localStorage.setItem('gtl-deep-launch', '1') } catch (_) {}
    }
    fireDestRef.current = '/fitness/active'  // sync for the listener
    setFireDest('/fitness/active')
    // Predictive-tap chain: ACTIVATE is the in-animation step that
    // hands off to TODAY on /fitness/active.
    setInAnimation('activate', true)
    setFireActive(true)
  }

  // Predictive-tap consume: mount-time only. The 'activate' intent is
  // always staged on the PRIOR page (/fitness/hub during its HeistTransition
  // → router.push → /fitness/load mounts → consume reads it). The stage
  // is therefore always present BEFORE this useEffect runs, so a single
  // mount-time check is sufficient.
  //
  // Do NOT add subscribeStaged or polling here. Both cause a double-fire
  // bug when the user taps ACTIVATE manually: pointerdown stages
  // 'activate' → notifyStaged → tryConsume → handleActivate (call 1) →
  // setFireActive=true → HeistTransition mounts. Click event → onTap →
  // handleActivate (call 2) → fireActiveRef.current=true → skipNow →
  // router.push immediately → HT bypassed before it can play.
  //
  // Manual taps only need ActivatePopup's own onTap. Predictive taps
  // are handled by mount-time consume. No third path needed.
  useEffect(() => {
    if (!ready) return
    if (!selectedId) return
    const cycle = cycles.find((c) => c.id === selectedId)
    if (!cycle) return
    const intent = consumePrefire('activate')
    if (intent) {
      // Open predictive window immediately (so taps during the wait
      // stage 'today'); delay the actual HT 500ms so the inbound HT
      // plays out fully first.
      setInAnimation('activate', true)
      setTimeout(() => handleActivate(cycle, { fromTimer: true }), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId])

  const handleReview = (cycle) => {
    if (fireActiveRef.current) { skipNow(); return }
    fireActiveRef.current = true
    // Edit-existing: clone the real cycle into the draft slot (NOT into
    // active-cycle-id — editing is distinct from activating). Clone its
    // attunement chips into draft-attunement so /attune sees them. Mark
    // editing-cycle-id so ETCH replaces in-place instead of appending.
    try {
      const draft = {
        id: cycle.id,
        name: cycle.name,
        muscles: Array.isArray(cycle.targets) ? [...cycle.targets] : [],
        days: Array.isArray(cycle.days) ? [...cycle.days] : [],
        dailyPlan: cycle.dailyPlan && typeof cycle.dailyPlan === 'object' ? { ...cycle.dailyPlan } : {},
        step: 'muscles',
      }
      localStorage.setItem(pk('draft-cycle'), JSON.stringify(draft))
      const att = localStorage.getItem(pk(`attunement-${cycle.id}`))
      if (att) localStorage.setItem(pk('draft-attunement'), att)
      else localStorage.removeItem(pk('draft-attunement'))
      localStorage.setItem(pk('editing-cycle-id'), cycle.id)
      // Pre-fill legacy keys so the Name page's editing-hydration sees
      // the pre-filled cycle-name and the other pages still work mid-edit.
      localStorage.setItem(pk('cycle-name'), cycle.name)
      localStorage.setItem(pk('muscle-targets'), JSON.stringify(cycle.targets || []))
      localStorage.setItem(pk('training-days'), JSON.stringify(cycle.days || []))
      localStorage.setItem(pk('daily-plan'), JSON.stringify(cycle.dailyPlan || {}))
    } catch (_) {}
    fireDestRef.current = '/fitness/new'
    setFireDest('/fitness/new')
    setFireActive(true)
  }

  const handleDelete = (id) => {
    const updated = cycles.filter((c) => c.id !== id)
    setCycles(updated)
    setSelectedId(null)
    try {
      localStorage.setItem(pk('cycles'), JSON.stringify(updated))
    } catch (_) {}
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gtl-void">

      {/* Atmospherics */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(122,14,20,0.18) 0%, transparent 45%, rgba(74,10,14,0.28) 100%)' }}
      />

      {/* Kanji watermark — 歴 (record/history). Top rooted at safe-area floor so it
          never clips into the iOS Dynamic Island camera area. */}
      <div
        className="absolute -right-24 pointer-events-none select-none"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 64px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '52rem', lineHeight: '0.8',
          color: '#d4181f', opacity: 0.045, fontWeight: 900,
        }}
      >
        歴
      </div>

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area). */}
      <div className="relative z-10 flex-1 flex flex-col">
      {/* Nav */}
      <nav
        className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-5"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <RetreatButton href="/fitness/hub" />      </nav>

      {/* Headline removed — cycle cards now sit just below the nav. */}

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
              href="/fitness/new"
              className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red hover:text-gtl-red-bright transition-colors"
            >
              FORGE YOUR FIRST CYCLE ▶︎
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

            {/* New cycle link */}
            <div className="mt-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gtl-edge" />
              <Link
                href="/fitness/new"
                onClick={() => { try { localStorage.removeItem('gtl-back-to-edit'); localStorage.removeItem(pk('editing-cycle-id')) } catch (_) {} }}
                className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-ash hover:text-gtl-red transition-colors"
              >
                + FORGE A NEW CYCLE
              </Link>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
          </div>
        )}
      </section>

      {/* Quick-nav ACTIVATE popup — sits at the same screen y as the profile chip
          on /fitness so the linear flow (profile chip → LOAD CYCLE card → ACTIVATE)
          all hits the same tap target. Slides up from below when a cycle is selected. */}
      <style>{`
        @keyframes activate-popup-rise {
          0%   { opacity: 0; transform: translateY(60px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      {selectedCycle && (
        <>
          <ActivatePopup
            key={selectedCycle.id}
            cycle={selectedCycle}
            onTap={(c) => handleActivate(c)}
            onSwipe={(c) => handleActivate(c, { deepLaunch: true })}
          />
        </>
      )}

      {/* Subordinate control band — sits below ACTIVATE, carries the
          gesture hint + REVIEW + DELETE in a unified panel. */}
      <BottomBar
        cycle={selectedCycle}
        onReview={handleReview}
        onDelete={handleDelete}
      />

      </div>
      {/* Outgoing transition on ACTIVATE / REVIEW EDIT — red diagonal slashes
          (matches the home-page exit cascade) instead of the fire-wall FireTransition. */}
      <HeistTransition
        active={fireActive}
        title={fireDest === '/fitness/edit' ? '' : 'GRIT'}
        onComplete={() => {
          if (skippedRef.current) return
          router.push(fireDest)
        }}
      />
    </main>
  )
}
