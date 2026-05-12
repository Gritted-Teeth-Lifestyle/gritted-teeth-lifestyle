'use client'
/*
 * /fitness/ghost/active — Ghost Train session.
 *
 * Visually identical to /fitness/active but ALL localStorage writes are
 * disabled. No done flags, no exercise data, no weights, no XP — nothing
 * is saved permanently. Sets logged here exist only for the duration of
 * this page visit.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useSound } from '../../../../lib/useSound'
import { useProfileGuard } from '../../../../lib/useProfileGuard'
import { pk } from '../../../../lib/storage'
import RetreatButton from '../../../../components/RetreatButton'

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS',
  biceps: 'BICEPS', triceps: 'TRICEPS', forearms: 'FOREARMS',
  abs: 'ABS', glutes: 'GLUTES', quads: 'QUADS',
  hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}
const DAY_FULL   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const DAY_SHORT  = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_FULL  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']

const SLAB_ROTATIONS = ['-1.5deg','1deg','-0.8deg','1.5deg','-1.2deg','0.8deg','-1.8deg','1.2deg','-0.6deg','1.4deg','-1deg']
const CARD_ROTATIONS = ['-0.8deg','0.6deg','-0.5deg','0.9deg','-0.7deg','0.4deg','-1deg','0.7deg','-0.6deg','0.8deg']

const EXERCISES = {
  chest:      ['BARBELL BENCH PRESS','INCLINE DUMBBELL PRESS','DUMBBELL FLY','CABLE CROSSOVER'],
  back:       ['DEADLIFT','PULL-UP','BARBELL ROW','LAT PULLDOWN'],
  shoulders:  ['OVERHEAD PRESS','LATERAL RAISE','REAR DELT FLY','ARNOLD PRESS'],
  biceps:     ['BARBELL CURL','DUMBBELL CURL','HAMMER CURL','PREACHER CURL'],
  triceps:    ['CLOSE-GRIP BENCH PRESS','SKULL CRUSHER','TRICEP PUSHDOWN','OVERHEAD EXTENSION'],
  forearms:   ['WRIST CURL','REVERSE WRIST CURL','HAMMER CURL','FARMER CARRY'],
  abs:        ['CRUNCH','PLANK','HANGING LEG RAISE','AB WHEEL ROLLOUT'],
  glutes:     ['HIP THRUST','SQUAT','ROMANIAN DEADLIFT','BULGARIAN SPLIT SQUAT'],
  quads:      ['SQUAT','LEG PRESS','LEG EXTENSION','HACK SQUAT'],
  hamstrings: ['ROMANIAN DEADLIFT','LEG CURL','NORDIC CURL','GLUTE-HAM RAISE'],
  calves:     ['STANDING CALF RAISE','SEATED CALF RAISE','DONKEY CALF RAISE','LEG PRESS CALF RAISE'],
}

function parseDate(iso) {
  return new Date(iso + 'T12:00:00')
}

function MuscleChip({ id, index, total }) {
  const rot = SLAB_ROTATIONS[index % SLAB_ROTATIONS.length]
  const fontSize = total <= 3 ? '0.8rem' : total <= 5 ? '0.65rem' : total <= 7 ? '0.52rem' : '0.42rem'
  const px = total <= 3 ? '8px' : total <= 5 ? '6px' : '4px'
  const py = total <= 3 ? '4px' : '3px'
  return (
    <div
      className="bg-gtl-red border border-gtl-red-bright shadow-red-glow shrink-0"
      style={{
        clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
        transform: `rotate(${rot})`,
        padding: `${py} ${px}`,
      }}
    >
      <div className="font-display text-gtl-paper leading-none whitespace-nowrap" style={{ fontSize }}>
        {MUSCLE_LABELS[id] || id.toUpperCase()}
      </div>
    </div>
  )
}

/* ── Overview day card — reads done state from local prop, never from storage in ghost mode ── */
function DayCard({ iso, muscles, index, onClick, ghostDoneDays, cycleId }) {
  const { play } = useSound()
  const [hovered, setHovered]   = useState(false)
  const [lifts, setLifts]       = useState([])
  const [cardH, setCardH]       = useState(120)
  const [cardW, setCardW]       = useState(200)
  const cardRef = useRef(null)

  const done = ghostDoneDays?.[iso] ?? false

  useEffect(() => {
    if (!cardRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCardH(e.contentRect.height)
        setCardW(e.contentRect.width)
      }
    })
    ro.observe(cardRef.current)
    return () => ro.disconnect()
  }, [])

  // Read exercise data — in ghost mode these keys were never written, so this is always empty
  useEffect(() => {
    if (!done) return
    const result = []
    for (const muscleId of muscles) {
      try {
        const rRaw = localStorage.getItem(pk(`ex-${cycleId}-${iso}-${muscleId}`))
        const wRaw = localStorage.getItem(pk(`wt-${cycleId}-${iso}-${muscleId}`))
        const rData = rRaw ? JSON.parse(rRaw) : {}
        const wData = wRaw ? JSON.parse(wRaw) : {}
        const names = Object.keys(rData).filter(n => {
          const arr = rData[n]
          return Array.isArray(arr) ? arr.some(r => r > 0) : rData[n] > 0
        })
        if (!names.length) continue
        const exercises = names.map(name => {
          const rArr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
          const wArr = Array.isArray(wData[name]) ? wData[name] : [wData[name] || 0]
          const sets = rArr.map((r, i) => ({ reps: r || 0, weight: wArr[i] || 0 })).filter(s => s.reps > 0)
          return { name, sets }
        })
        result.push({ muscle: muscleId, exercises })
      } catch (_) {}
    }
    setLifts(result)
  }, [done, iso, muscles])

  const date    = parseDate(iso)
  const dayName = DAY_SHORT[date.getDay()]
  const dayNum  = date.getDate()
  const mon     = MONTH_SHORT[date.getMonth()]
  const hasWork = muscles.length > 0
  const rot     = CARD_ROTATIONS[index % CARD_ROTATIONS.length]
  const scale   = Math.max(0.6, Math.min(2.5, cardH / 120))
  const isLandscape = cardW / cardH > 1.4

  const handleClick = () => {
    play('option-select')
    const rect = cardRef.current?.getBoundingClientRect() ?? null
    onClick(iso, rect)
  }

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`View ${DAY_FULL[date.getDay()]} ${dayNum} ${MONTH_FULL[date.getMonth()]}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      onMouseEnter={() => { setHovered(true); play('button-hover') }}
      onMouseLeave={() => setHovered(false)}
      data-day-iso={iso}
      className="relative flex flex-col cursor-pointer select-none outline-none h-full
        focus-visible:outline-2 focus-visible:outline-gtl-red focus-visible:outline-offset-4
        transition-all duration-200"
      style={{
        transform: hovered
          ? `rotate(${rot}) translateY(-6px) scale(1.03)`
          : `rotate(${rot})`,
        transformOrigin: 'center top',
        overflow: 'hidden',
        borderLeft: hasWork ? '4px solid #d4181f' : '4px solid #3a3a42',
        border: hovered ? '1px solid #d4181f' : '1px solid #2a2a30',
        background: hovered ? '#111115' : '#0d0d10',
        boxShadow: hovered ? '0 0 28px rgba(212,24,31,0.2)' : 'none',
      }}
    >
      <div className={`${isLandscape ? 'flex flex-row' : 'flex flex-col'} gap-2 px-3 pt-2 pb-1 overflow-hidden`}>
        <div className="shrink-0">
          <div className={`font-display leading-none tracking-widest transition-colors duration-200
            ${hasWork ? (hovered ? 'text-gtl-red-bright' : 'text-gtl-red') : 'text-gtl-smoke'}`}
            style={{ fontSize: `${(done && lifts.length > 0 ? 0.7 : 1.25) * scale}rem` }}>
            {dayName}
          </div>
          <div className="flex items-baseline gap-1 mt-0">
            <span className={`font-display leading-none transition-colors duration-200
              ${hasWork ? 'text-gtl-chalk' : 'text-gtl-ash'}`}
                  style={{ fontSize: `${(done && lifts.length > 0 ? 1.1 : 2) * scale}rem` }}>
              {dayNum}
            </span>
            <span className="font-mono tracking-[0.3em] uppercase text-gtl-smoke"
                  style={{ fontSize: `${(done && lifts.length > 0 ? 7 : 10) * scale}px` }}>{mon}</span>
          </div>
        </div>

        {done && lifts.length > 0 && (() => {
          const totalSets = lifts.reduce((a, { exercises }) => a + exercises.reduce((b, { sets }) => b + sets.length, 0), 0)
          const numSize = `${Math.max(0.65, Math.min(3, 4 / Math.sqrt(Math.max(1, totalSets))) * scale).toFixed(2)}rem`
          const chipSize = `${Math.max(7, Math.min(28, 11 * scale)).toFixed(1)}px`
          const chipPad = `${Math.max(2, 3 * scale).toFixed(1)}px ${Math.max(4, 8 * scale).toFixed(1)}px`
          return (
            <div className={`flex flex-col gap-1 min-w-0 overflow-hidden ${isLandscape ? 'flex-1 justify-center' : ''}`}>
              {lifts.map(({ muscle, exercises }) => (
                <div key={muscle} className="flex flex-col gap-0.5">
                  <span className="font-mono uppercase leading-none font-bold text-white self-start"
                    style={{
                      fontSize: chipSize,
                      background: '#7a0e14',
                      clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                      padding: chipPad,
                      letterSpacing: '0.08em',
                    }}>
                    {MUSCLE_LABELS[muscle] || muscle.toUpperCase()}
                  </span>
                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                    {exercises.map(({ name, sets }) =>
                      sets.map((s, si) => (
                        <span key={`${name}-${si}`} className="font-display leading-none"
                              style={{ fontSize: numSize, color: '#e4b022', textShadow: '1px 1px 0 #8a6612' }}>
                          {s.weight > 0 ? `${s.weight}×${s.reps}` : `${s.reps}r`}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {!done && hasWork && (
          <div className={`${isLandscape ? 'flex-1' : ''} flex flex-wrap gap-x-2 gap-y-2 content-start overflow-hidden min-w-0`}>
            {muscles.map((id, i, arr) => <MuscleChip key={id} id={id} index={i} total={arr.length} />)}
          </div>
        )}
        {!done && !hasWork && (
          <div className="flex-1 flex items-center overflow-hidden">
            <span className="font-mono tracking-[0.2em] uppercase text-gtl-smoke"
              style={{ fontSize: `${8 * scale}px` }}>REST</span>
          </div>
        )}
      </div>

      {done && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 2 }}
        >
          <div
            className="font-display leading-none select-none"
            style={{
              fontSize: `${cardH * 0.9}px`,
              color: 'rgba(212,24,31,0.35)',
              textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
              transform: 'rotate(-6deg)',
              lineHeight: 1,
            }}
          >
            X
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Interactive muscle slab in the day focus view ── */
function MuscleSlab({ id, rot, delay, onClick }) {
  const { play } = useSound()
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onClick(rect)
  }

  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={handleClick}
      onMouseLeave={() => { setPressed(false); setHovered(false) }}
      onMouseEnter={() => { setHovered(true); play('button-hover') }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e) } }}
      className="relative cursor-pointer select-none outline-none shrink-0
        focus-visible:outline-2 focus-visible:outline-gtl-paper focus-visible:outline-offset-4"
      style={{
        transform: `rotate(${rot})`,
        animation: `focus-content-in 300ms ${delay}ms ease-out both`,
        overflow: 'visible',
      }}
      aria-label={`View exercises for ${MUSCLE_LABELS[id] || id}`}
    >
      <div
        className="absolute inset-0 bg-gtl-red-deep"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          transform: pressed ? 'translate(0,0)' : 'translate(6px, 6px)',
          transition: 'transform 80ms ease-out',
        }}
        aria-hidden="true"
      />
      <div
        className="relative px-8 py-4"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          background: pressed ? '#ff2a36' : hovered ? '#e01e25' : '#d4181f',
          border: hovered ? '2px solid #ff6b6b' : '2px solid #ff2a36',
          transform: pressed ? 'translate(6px, 6px)' : 'translate(0,0)',
          transition: 'transform 80ms ease-out, background 80ms ease-out',
        }}
      >
        <div className="font-display text-gtl-paper leading-none tracking-wide whitespace-nowrap"
             style={{ fontSize: 'clamp(1.8rem, 4vw, 3.5rem)' }}>
          {MUSCLE_LABELS[id] || id.toUpperCase()}
        </div>
        {hovered && (
          <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-paper/60 mt-1">
            TAP FOR EXERCISES ▸
          </div>
        )}
      </div>
    </button>
  )
}

/* ── Reps counter popup ── */
function RepsPopup({ exerciseName, initialReps, rowRect, onClose, onSave }) {
  const { play } = useSound()
  const [reps, setReps]           = useState(initialReps)
  const [pressUp, setPressUp]     = useState(false)
  const [pressDown, setPressDown] = useState(false)
  const [numKey, setNumKey]       = useState(0)
  const [numDir, setNumDir]       = useState('up')
  const [slamming, setSlamming]   = useState(false)
  const [setPressed, setSetPressed] = useState(false)

  const POPUP_WIDTH  = 380
  const POPUP_HEIGHT = 560

  const popupTop = rowRect
    ? Math.max(20, Math.min(rowRect.top - POPUP_HEIGHT / 2 + rowRect.height / 2, window.innerHeight - POPUP_HEIGHT - 20))
    : Math.max(20, (window.innerHeight - POPUP_HEIGHT) / 2)

  const slamDX = rowRect
    ? (rowRect.left + rowRect.width / 2) - (window.innerWidth / 2)
    : 0
  const slamDY = rowRect
    ? (rowRect.top + rowRect.height / 2) - (popupTop + POPUP_HEIGHT / 2)
    : 200

  const flameScale  = Math.min(0.25 + reps * 0.13, 3.0)
  const flameOpacity = Math.min(0.3 + reps * 0.07, 1.0)

  const increment = () => {
    play('option-select')
    setReps((n) => n + 1)
    setNumDir('up')
    setNumKey((k) => k + 1)
  }

  const decrement = () => {
    if (reps <= 0) return
    play('button-hover')
    setReps((n) => n - 1)
    setNumDir('down')
    setNumKey((k) => k + 1)
  }

  const handleSetReps = () => {
    play('stamp')
    setTimeout(() => play('stamp'), 120)
    onSave(reps)
    setSlamming(true)
    setTimeout(onClose, 550)
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape')    { onSave(reps); onClose() }
      if (e.key === 'ArrowUp')   { e.preventDefault(); increment() }
      if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [reps])

  return (
    <>
      <style>{`
        @keyframes reps-in {
          0%   { transform: scale(0.06); opacity: 0; filter: blur(14px); }
          50%  { opacity: 1; filter: blur(2px); }
          70%  { transform: scale(1.06) rotate(-2deg); filter: blur(0); }
          85%  { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(-1.5deg); opacity: 1; }
        }
        @keyframes reps-slam-exit {
          0%   { transform: scale(1); opacity: 1; }
          12%  { transform: scale(1.06) rotate(-1deg); opacity: 1; }
          100% { transform: translate(${slamDX}px, ${slamDY}px) scale(0.08) rotate(-6deg); opacity: 0; }
        }
        @keyframes num-up {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.22) translateY(-8px); filter: brightness(1.5); }
          60%  { transform: scale(1.05) translateY(-2px); }
          100% { transform: scale(1) translateY(0); filter: brightness(1); }
        }
        @keyframes num-down {
          0%   { transform: scale(1); }
          20%  { transform: scale(0.82) translateY(6px); filter: brightness(0.7); }
          60%  { transform: scale(0.96) translateY(1px); }
          100% { transform: scale(1) translateY(0); filter: brightness(1); }
        }
        @keyframes flame-core {
          0%,100% { transform: scaleY(1)    scaleX(1)    rotate(-1deg); }
          30%     { transform: scaleY(1.18) scaleX(0.84) rotate(2deg);  }
          65%     { transform: scaleY(0.88) scaleX(1.12) rotate(-3deg); }
        }
        @keyframes flame-mid {
          0%,100% { transform: scaleY(1)    scaleX(1)   rotate(1deg);  }
          40%     { transform: scaleY(1.22) scaleX(0.8) rotate(-2deg); }
          70%     { transform: scaleY(0.9)  scaleX(1.1) rotate(3deg);  }
        }
        @keyframes flame-tip {
          0%,100% { transform: translateY(0)   scaleX(1)    rotate(0deg); opacity: 0.8; }
          50%     { transform: translateY(-10px) scaleX(0.6) rotate(5deg); opacity: 0.5; }
        }
        @keyframes set-reps-glow {
          0%,100% { box-shadow: 0 0 12px rgba(212,24,31,0.3); }
          50%     { box-shadow: 0 0 32px rgba(212,24,31,0.7), 0 0 60px rgba(212,24,31,0.3); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9999]"
        style={{ background: 'rgba(7,7,8,0.80)', backdropFilter: 'blur(3px)' }}
        onClick={() => { onSave(reps); onClose() }}
      />

      <div
        className="fixed z-[10000]"
        style={{
          width: '380px',
          left: '50%',
          marginLeft: '-190px',
          top: popupTop != null ? `${popupTop}px` : '50%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ animation: slamming ? 'reps-slam-exit 500ms cubic-bezier(0.4,0,1,1) forwards' : 'reps-in 500ms cubic-bezier(0.18,1.2,0.35,1) forwards' }}>
        <div
          className="relative w-full flex flex-col items-center px-12 py-10 bg-gtl-ink"
          style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}
        >
          <div className="absolute inset-0 gtl-noise pointer-events-none opacity-60" />
          <div
            className="absolute inset-0 bg-gtl-red-deep -z-10"
            style={{
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              transform: 'translate(10px, 10px)',
            }}
            aria-hidden="true"
          />

          <div className="relative font-mono text-[13px] tracking-[0.7em] uppercase text-gtl-red mb-1">
            REPS
          </div>
          <div
            className="relative font-display text-gtl-smoke leading-none mb-6 text-center"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', transform: 'rotate(0.4deg)' }}
          >
            {exerciseName}
          </div>

          <div className="relative flex flex-col items-center mb-2">
            <div
              className="pointer-events-none select-none"
              style={{
                height: '80px',
                width: '60px',
                position: 'relative',
                opacity: flameOpacity,
                transform: `scale(${flameScale})`,
                transformOrigin: 'center bottom',
                transition: 'transform 200ms ease-out, opacity 200ms ease-out',
                marginBottom: reps > 0 ? `${Math.min(reps * 4, 60)}px` : '0px',
              }}
              aria-hidden="true"
            >
              <div className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse 55% 80% at 50% 90%, #ff6a00 0%, #ff2a00 40%, transparent 100%)', borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%', animation: 'flame-core 0.9s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-2 inset-y-0"
                style={{ background: 'radial-gradient(ellipse 50% 75% at 50% 90%, #ffd200 0%, #ff4500 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 55% 55% 45% 45%', animation: 'flame-mid 0.65s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-4 top-0"
                style={{ height: '50%', background: 'radial-gradient(ellipse 40% 60% at 50% 90%, #fff7a0 0%, #ffe000 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%', animation: 'flame-tip 0.5s ease-in-out infinite', transformOrigin: 'center bottom' }} />
            </div>

            <button
              type="button"
              onMouseDown={() => setPressUp(true)}
              onMouseUp={() => { setPressUp(false); increment() }}
              onMouseLeave={() => setPressUp(false)}
              onMouseEnter={() => play('button-hover')}
              className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
              aria-label="Increase reps"
            >
              <div className="absolute inset-0 bg-gtl-red-deep"
                style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', transform: pressUp ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
              <div
                className="relative px-10 py-3"
                style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', background: pressUp ? '#ff2a36' : '#d4181f', transform: pressUp ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}
              >
                <div className="font-display text-gtl-paper leading-none"
                     style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>▲</div>
              </div>
            </button>
          </div>

          <div
            key={numKey}
            className="relative font-display leading-none my-2"
            style={{
              fontSize: 'clamp(6rem, 16vw, 12rem)',
              color: reps > 0 ? '#e4b022' : '#c8c8c8',
              textShadow: reps > 0
                ? '5px 5px 0 #8a6612, 10px 10px 0 #070708'
                : '4px 4px 0 #070708',
              lineHeight: '1',
              animation: numKey > 0
                ? `${numDir === 'up' ? 'num-up' : 'num-down'} 300ms ease-out forwards`
                : 'none',
            }}
          >
            {String(reps).padStart(2, '0')}
          </div>

          <button
            type="button"
            onMouseDown={() => setPressDown(true)}
            onMouseUp={() => { setPressDown(false); decrement() }}
            onMouseLeave={() => setPressDown(false)}
            onMouseEnter={() => reps > 0 && play('button-hover')}
            className="relative cursor-pointer select-none outline-none mt-2 focus-visible:outline-2 focus-visible:outline-gtl-red"
            aria-label="Decrease reps"
            disabled={reps === 0}
          >
            <div className="absolute inset-0"
              style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: reps === 0 ? '#1a1a1e' : '#8a0e13', transform: pressDown ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
            <div
              className="relative px-10 py-3"
              style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: reps === 0 ? '#1a1a1e' : pressDown ? '#ff2a36' : '#d4181f', transform: pressDown ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}
            >
              <div className="font-display leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: reps === 0 ? '#3a3a42' : '#ffffff' }}>▼</div>
            </div>
          </button>

          <div className="relative w-full mt-8">
            {reps > 0 && (
              <div className="absolute -inset-1 pointer-events-none"
                style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', animation: 'set-reps-glow 1.8s ease-in-out infinite' }}
                aria-hidden="true" />
            )}
            <button
              type="button"
              onMouseDown={() => setSetPressed(true)}
              onMouseUp={() => { setSetPressed(false); handleSetReps() }}
              onMouseLeave={() => setSetPressed(false)}
              onMouseEnter={() => play('button-hover')}
              className="relative w-full cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ transform: 'rotate(-1deg)' }}
            >
              <div className="absolute inset-0 bg-gtl-red-deep"
                style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', transform: setPressed ? 'translate(0,0)' : 'translate(8px, 8px)', transition: 'transform 80ms ease-out' }} aria-hidden="true" />
              <div className="relative flex items-center justify-between px-8 py-5"
                style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', background: setPressed ? '#ff2a36' : reps > 0 ? '#d4181f' : '#3a1014', transform: setPressed ? 'translate(8px, 8px)' : 'translate(0,0)', transition: 'transform 80ms ease-out, background 100ms' }}>
                <div>
                  <div className="font-display text-gtl-paper leading-none tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>SET REPS</div>
                  <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-gtl-paper/50 mt-1">
                    {reps > 0 ? `${reps} REP${reps !== 1 ? 'S' : ''} / LOCK IT IN` : 'SET A REP COUNT FIRST'}
                  </div>
                </div>
                <div className="font-display text-gtl-paper/40 leading-none" style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}>▸</div>
              </div>
            </button>
          </div>

        </div>
        </div>
      </div>
    </>
  )
}

/* ── Weight setter popup ── */
function WeightPopup({ exerciseName, initialWeight, rowRect, onClose, onSave }) {
  const { play } = useSound()
  const [weight, setWeight]         = useState(initialWeight)
  const [pressUp, setPressUp]       = useState(false)
  const [pressDown, setPressDown]   = useState(false)
  const [numKey, setNumKey]         = useState(0)
  const [numDir, setNumDir]         = useState('up')
  const [slamming, setSlamming]     = useState(false)
  const [setPressed, setSetPressed] = useState(false)

  const POPUP_WIDTH  = 380
  const POPUP_HEIGHT = 560

  const popupTop = rowRect
    ? Math.max(20, Math.min(rowRect.top - POPUP_HEIGHT / 2 + rowRect.height / 2, window.innerHeight - POPUP_HEIGHT - 20))
    : Math.max(20, (window.innerHeight - POPUP_HEIGHT) / 2)

  const slamDX = rowRect ? (rowRect.left + rowRect.width / 2) - (window.innerWidth / 2) : 0
  const slamDY = rowRect ? (rowRect.top + rowRect.height / 2) - (popupTop + POPUP_HEIGHT / 2) : 200

  const flameScale   = Math.min(0.25 + weight * 0.013, 3.0)
  const flameOpacity = Math.min(0.3 + weight * 0.007, 1.0)

  const increment = () => {
    play('option-select')
    setWeight((n) => n + 5)
    setNumDir('up')
    setNumKey((k) => k + 1)
  }

  const decrement = () => {
    if (weight <= 0) return
    play('button-hover')
    setWeight((n) => Math.max(0, n - 5))
    setNumDir('down')
    setNumKey((k) => k + 1)
  }

  const handleSetWeight = () => {
    play('stamp')
    setTimeout(() => play('stamp'), 120)
    onSave(weight)
    setSlamming(true)
    setTimeout(onClose, 550)
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape')    { onSave(weight); onClose() }
      if (e.key === 'ArrowUp')   { e.preventDefault(); increment() }
      if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [weight])

  return (
    <>
      <style>{`
        @keyframes weight-in {
          0%   { transform: scale(0.06); opacity: 0; filter: blur(14px); }
          50%  { opacity: 1; filter: blur(2px); }
          70%  { transform: scale(1.06) rotate(-2deg); filter: blur(0); }
          85%  { transform: scale(0.97) rotate(-1deg); }
          100% { transform: scale(1) rotate(-1.5deg); opacity: 1; }
        }
        @keyframes weight-slam-exit {
          0%   { transform: scale(1); opacity: 1; }
          12%  { transform: scale(1.06) rotate(-1deg); opacity: 1; }
          100% { transform: translate(${slamDX}px, ${slamDY}px) scale(0.08) rotate(-6deg); opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 z-[9999]"
        style={{ background: 'rgba(7,7,8,0.80)', backdropFilter: 'blur(3px)' }}
        onClick={() => { onSave(weight); onClose() }} />

      <div className="fixed z-[10000]"
        style={{ width: '380px', left: '50%', marginLeft: '-190px', top: `${popupTop}px` }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ animation: slamming ? 'weight-slam-exit 500ms cubic-bezier(0.4,0,1,1) forwards' : 'weight-in 500ms cubic-bezier(0.18,1.2,0.35,1) forwards' }}>
        <div className="relative w-full flex flex-col items-center px-12 py-10 bg-gtl-ink"
          style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}>
          <div className="absolute inset-0 gtl-noise pointer-events-none opacity-60" />
          <div className="absolute inset-0 bg-gtl-red-deep -z-10"
            style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', transform: 'translate(10px, 10px)' }}
            aria-hidden="true" />

          <div className="relative font-mono text-[13px] tracking-[0.7em] uppercase text-gtl-red mb-1">WEIGHT</div>
          <div className="relative font-display text-gtl-smoke leading-none mb-6 text-center"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', transform: 'rotate(0.4deg)' }}>
            {exerciseName}
          </div>

          <div className="relative flex flex-col items-center mb-2">
            <div className="pointer-events-none select-none"
              style={{ height: '80px', width: '60px', position: 'relative', opacity: flameOpacity, transform: `scale(${flameScale})`, transformOrigin: 'center bottom', transition: 'transform 200ms ease-out, opacity 200ms ease-out', marginBottom: weight > 0 ? `${Math.min(weight * 0.3, 60)}px` : '0px' }}
              aria-hidden="true">
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 80% at 50% 90%, #ff6a00 0%, #ff2a00 40%, transparent 100%)', borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%', animation: 'flame-core 0.9s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-2 inset-y-0" style={{ background: 'radial-gradient(ellipse 50% 75% at 50% 90%, #ffd200 0%, #ff4500 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 55% 55% 45% 45%', animation: 'flame-mid 0.65s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-4 top-0" style={{ height: '50%', background: 'radial-gradient(ellipse 40% 60% at 50% 90%, #fff7a0 0%, #ffe000 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%', animation: 'flame-tip 0.5s ease-in-out infinite', transformOrigin: 'center bottom' }} />
            </div>
            <button type="button" onMouseDown={() => setPressUp(true)} onMouseUp={() => { setPressUp(false); increment() }} onMouseLeave={() => setPressUp(false)} onMouseEnter={() => play('button-hover')} className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red" aria-label="Increase weight">
              <div className="absolute inset-0 bg-gtl-red-deep" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', transform: pressUp ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
              <div className="relative px-10 py-3" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', background: pressUp ? '#ff2a36' : '#d4181f', transform: pressUp ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}>
                <div className="font-display text-gtl-paper leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>▲</div>
              </div>
            </button>
          </div>

          <div key={numKey} className="relative font-display leading-none my-2"
            style={{ fontSize: 'clamp(6rem, 16vw, 12rem)', color: weight > 0 ? '#e4b022' : '#c8c8c8', textShadow: weight > 0 ? '5px 5px 0 #8a6612, 10px 10px 0 #070708' : '4px 4px 0 #070708', lineHeight: '1', animation: numKey > 0 ? `${numDir === 'up' ? 'num-up' : 'num-down'} 300ms ease-out forwards` : 'none' }}>
            {weight}
          </div>
          <div className="relative font-mono text-[11px] tracking-[0.5em] uppercase text-gtl-smoke/60 mb-2">LBS</div>

          <button type="button" onMouseDown={() => setPressDown(true)} onMouseUp={() => { setPressDown(false); decrement() }} onMouseLeave={() => setPressDown(false)} onMouseEnter={() => weight > 0 && play('button-hover')} className="relative cursor-pointer select-none outline-none mt-2 focus-visible:outline-2 focus-visible:outline-gtl-red" aria-label="Decrease weight" disabled={weight === 0}>
            <div className="absolute inset-0" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: weight === 0 ? '#1a1a1e' : '#8a0e13', transform: pressDown ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
            <div className="relative px-10 py-3" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: weight === 0 ? '#1a1a1e' : pressDown ? '#ff2a36' : '#d4181f', transform: pressDown ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}>
              <div className="font-display leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: weight === 0 ? '#3a3a42' : '#ffffff' }}>▼</div>
            </div>
          </button>

          <div className="relative w-full mt-8">
            {weight > 0 && (
              <div className="absolute -inset-1 pointer-events-none"
                style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', animation: 'set-reps-glow 1.8s ease-in-out infinite' }}
                aria-hidden="true" />
            )}
            <button type="button" onMouseDown={() => setSetPressed(true)} onMouseUp={() => { setSetPressed(false); handleSetWeight() }} onMouseLeave={() => setSetPressed(false)} onMouseEnter={() => play('button-hover')} className="relative w-full cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red" style={{ transform: 'rotate(-1deg)' }}>
              <div className="absolute inset-0 bg-gtl-red-deep" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', transform: setPressed ? 'translate(0,0)' : 'translate(8px, 8px)', transition: 'transform 80ms ease-out' }} aria-hidden="true" />
              <div className="relative flex items-center justify-between px-8 py-5" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', background: setPressed ? '#ff2a36' : weight > 0 ? '#d4181f' : '#3a1014', transform: setPressed ? 'translate(8px, 8px)' : 'translate(0,0)', transition: 'transform 80ms ease-out, background 100ms' }}>
                <div>
                  <div className="font-display text-gtl-paper leading-none tracking-tight" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>SET WEIGHT</div>
                  <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-gtl-paper/50 mt-1">
                    {weight > 0 ? `${weight} LBS / LOCK IT IN` : 'SET A WEIGHT FIRST'}
                  </div>
                </div>
                <div className="font-display text-gtl-paper/40 leading-none" style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}>▸</div>
              </div>
            </button>
          </div>

        </div>
        </div>
      </div>
    </>
  )
}

/* ── Individual set chip ── */
function SetChip({ setIndex, set, hasData, ghostSet, onOpen, play }) {
  const [pressed, setPressed] = useState(false)
  const suffixes = ['TH','ST','ND','RD']
  const n = setIndex + 1
  const suffix = n <= 3 ? suffixes[n] : suffixes[0]
  const label = `${n}${suffix} SET`
  const hasGhost = !hasData && ghostSet && (ghostSet.weight > 0 || ghostSet.reps > 0)

  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onOpen() }}
      onMouseLeave={() => setPressed(false)}
      onMouseEnter={() => play('button-hover')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
      style={{ transform: pressed ? 'translateY(2px)' : 'translateY(0)', transition: 'transform 60ms ease-out' }}
      aria-label={`${hasData ? 'Edit' : 'Log'} set ${setIndex + 1}`}
    >
      <div
        className="flex flex-col items-center px-3 py-2"
        style={{
          clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
          background: hasData ? '#d4181f' : '#1a1a1e',
          border: `1px solid ${hasData ? '#ff2a36' : hasGhost ? 'rgba(212,24,31,0.25)' : '#3a3a42'}`,
          minWidth: '72px',
          transition: 'background 100ms',
        }}
      >
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase leading-none mb-1 font-bold"
          style={{ color: hasData ? 'rgba(245,240,232,0.9)' : hasGhost ? 'rgba(212,24,31,0.6)' : '#6a6a72' }}>
          {label}
        </span>
        {hasData ? (
          <div className="flex items-baseline gap-1">
            {set.weight > 0 && (
              <span className="font-display leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8', textShadow: '1px 1px 0 #8a0e13' }}>
                {set.weight}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>lb</span>
              </span>
            )}
            {set.weight > 0 && set.reps > 0 && <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.5)' }}>×</span>}
            {set.reps > 0 && (
              <span className="font-display leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8', textShadow: '1px 1px 0 #8a0e13' }}>
                {set.reps}
              </span>
            )}
          </div>
        ) : hasGhost ? (
          <div className="flex items-baseline gap-1" style={{ opacity: 0.35 }}>
            {ghostSet.weight > 0 && <span className="font-display leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8' }}>{ghostSet.weight}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>lb</span></span>}
            {ghostSet.weight > 0 && ghostSet.reps > 0 && <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.5)' }}>×</span>}
            {ghostSet.reps > 0 && <span className="font-display leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8' }}>{ghostSet.reps}</span>}
          </div>
        ) : (
          <span className="font-display leading-none" style={{ fontSize: '1.1rem', color: '#3a3a42' }}>—</span>
        )}
      </div>
    </button>
  )
}

/* ── Single exercise row ── */
function ExerciseRow({ name, index, sets, ghostSets, onOpen, onAddSet, onDeleteSet }) {
  const { play } = useSound()
  const rowRef = useRef(null)
  const selected = sets.some((s) => s.reps > 0)

  return (
    <li ref={rowRef} style={{ animation: `focus-content-in 250ms ${200 + index * 45}ms ease-out both`, listStyle: 'none' }}>
      <div
        className="flex items-center gap-4 py-4 border-b"
        style={{
          borderColor: selected ? 'rgba(212,24,31,0.6)' : 'rgba(58,58,66,0.5)',
          background: selected ? 'rgba(212,24,31,0.08)' : 'transparent',
          borderLeft: selected ? '3px solid #d4181f' : '3px solid transparent',
          paddingLeft: '8px',
          transition: 'background 100ms, border-color 100ms',
        }}
      >
        <span className="font-display shrink-0 leading-none"
          style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: selected ? '#ff2a36' : '#e4b022', textShadow: selected ? '2px 2px 0 #8a0e13' : '2px 2px 0 #8a6612', minWidth: '2.5rem' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="font-display leading-none flex-1"
          style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.8rem)', color: selected ? '#ffffff' : '#c8c8c8', transform: index % 2 === 0 ? 'rotate(-0.3deg)' : 'rotate(0.2deg)' }}>
          {name}
        </span>
        <div className="shrink-0 flex items-center gap-2">
          {sets.map((s, si) => {
            const hasData = s.reps > 0 || s.weight > 0
            return (
              <SetChip
                key={si}
                setIndex={si}
                set={s}
                hasData={hasData}
                ghostSet={ghostSets?.[si]}
                onOpen={() => {
                  const rect = rowRef.current?.getBoundingClientRect() ?? null
                  onOpen(rect, si)
                }}
                play={play}
              />
            )
          })}
          <button
            type="button"
            onClick={() => { play('button-hover'); onAddSet() }}
            onMouseEnter={() => play('button-hover')}
            className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red shrink-0"
          >
            <div className="flex flex-col items-center px-3 py-2"
              style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)', background: '#0d0d10', border: '1px dashed #3a3a42', minWidth: '64px' }}>
              <span className="font-display leading-none" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', color: '#3a3a42' }}>+</span>
              <span className="font-mono text-[7px] tracking-[0.3em] uppercase leading-none mt-0.5" style={{ color: '#3a3a42' }}>ADD SET</span>
            </div>
          </button>
          {sets.length > 1 && (
            <button
              type="button"
              onClick={() => { play('menu-close'); onDeleteSet() }}
              onMouseEnter={() => play('button-hover')}
              className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red shrink-0"
            >
              <div className="flex flex-col items-center px-3 py-2"
                style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)', background: '#0d0d10', border: '1px dashed #3a1014', minWidth: '64px' }}>
                <span className="font-display leading-none" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', color: '#8a0e13' }}>−</span>
                <span className="font-mono text-[7px] tracking-[0.3em] uppercase leading-none mt-0.5" style={{ color: '#8a0e13' }}>DEL SET</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/* ── Custom exercise name input ── */
function CustomMoveInput({ value, onChange, onConfirm, onCancel, onCharAdded }) {
  const inputRef = useRef(null)
  const charKeysRef = useRef([])
  const { play } = useSound()
  const prevLenRef = useRef(0)

  if (value.length !== prevLenRef.current) {
    if (value.length > prevLenRef.current) {
      while (charKeysRef.current.length < value.length) {
        charKeysRef.current.push(`k-${Date.now()}-${Math.random()}`)
      }
    } else {
      charKeysRef.current = charKeysRef.current.slice(0, value.length)
    }
    prevLenRef.current = value.length
  }

  useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [])

  const handleChange = (e) => {
    const next = e.target.value.toUpperCase().slice(0, 24)
    if (next.length > value.length) { play('option-select'); onCharAdded && onCharAdded() }
    else if (next.length < value.length) play('char-erase')
    onChange(next)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.trim().length > 0) { e.preventDefault(); onConfirm() }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="flex-1 relative cursor-text select-none" onClick={() => inputRef.current?.focus()}>
      <input ref={inputRef} type="text" value={value} onChange={handleChange} onKeyDown={handleKeyDown}
        maxLength={24} className="sr-only" inputMode="text" enterKeyHint="done" autoComplete="off" autoCorrect="off" spellCheck="false" />
      <div className="flex flex-wrap items-baseline gap-y-1 min-h-[3rem]" style={{ overflow: 'visible' }}>
        {value.split('').map((char, i) => (
          <span key={charKeysRef.current[i]} className="inline-block font-display leading-none animate-char-stamp text-gtl-chalk"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', animationDelay: '0ms', transformOrigin: 'center center', position: 'relative', zIndex: 50 }}>
            {char === ' ' ? '\u00a0' : char}
          </span>
        ))}
        <span className="inline-block bg-gtl-red-bright animate-cursor-blink self-center"
          style={{ width: '3px', height: '2.4rem', marginLeft: '2px' }} aria-hidden="true" />
      </div>
      {value.length === 0 && (
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <span className="font-display text-gtl-smoke" style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}>NAME YOUR MOVE</span>
        </div>
      )}
    </div>
  )
}

/* ── Exercise panel — GHOST MODE: no localStorage writes ── */
function ExercisePanel({ muscleId, dayIso, originRect, onClose }) {
  const { play } = useSound()
  const [closing, setClosing]             = useState(false)
  const [reps, setReps]                   = useState({})
  const [weights, setWeights]             = useState({})
  const [setCounts, setSetCounts]         = useState({})
  const [priorData, setPriorData]         = useState({})
  const [customName, setCustomName]       = useState('')
  const [editingCustom, setEditingCustom] = useState(false)
  const [draftName, setDraftName]         = useState('')
  const [shaking, setShaking]             = useState(false)
  const [activeExercise, setActiveExercise]         = useState(null)
  const [activeExerciseRect, setActiveExerciseRect] = useState(null)
  const [activeSetIndex, setActiveSetIndex]         = useState(0)
  const [phase, setPhase]                 = useState(null)
  const exercises = EXERCISES[muscleId] || []
  const label     = MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()

  const originX = originRect ? `${originRect.left + originRect.width / 2}px` : '50vw'
  const originY = originRect ? `${originRect.top + originRect.height / 2}px` : '50vh'

  // Load prior data for ghost predictions — reads from real history, never writes
  useEffect(() => {
    try {
      const result = {}
      const wRaw = localStorage.getItem(pk(`latest-wt-${muscleId}`))
      const rRaw = localStorage.getItem(pk(`latest-ex-${muscleId}`))
      const wData = wRaw ? JSON.parse(wRaw) : {}
      const rData = rRaw ? JSON.parse(rRaw) : {}
      const names = new Set([...Object.keys(wData), ...Object.keys(rData)])
      for (const n of names) {
        result[n] = {
          weight: Array.isArray(wData[n]) ? wData[n] : typeof wData[n] === 'number' ? [wData[n]] : [],
          reps:   Array.isArray(rData[n]) ? rData[n] : typeof rData[n] === 'number' ? [rData[n]] : [],
        }
      }
      setPriorData(result)
    } catch (_) {}
  }, [dayIso, muscleId])

  const getPriorValue = (name, kind, setIndex) => {
    const pd = priorData[name]
    if (!pd) return 0
    const arr = kind === 'weight' ? pd.weight : pd.reps
    if (!arr) return 0
    if ((arr[setIndex] ?? 0) !== 0) return arr[setIndex]
    for (let s = arr.length - 1; s >= 0; s--) {
      if ((arr[s] ?? 0) !== 0) return arr[s]
    }
    return 0
  }

  // Load set counts from storage (read-only — shared with real sessions)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(pk(`setcounts-${muscleId}`))
      if (raw) setSetCounts(JSON.parse(raw))
    } catch (_) {}
    try {
      const name = localStorage.getItem(pk(`custom-${muscleId}`))
      if (name) setCustomName(name)
    } catch (_) {}
  }, [muscleId])

  // GHOST MODE saveReps — updates state only, never writes to localStorage
  const saveReps = (name, value, setIndex) => {
    setReps((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      return { ...prev, [name]: arr }
    })
  }

  // GHOST MODE saveWeight — updates state only, never writes to localStorage
  const saveWeight = (name, value, setIndex) => {
    setWeights((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      return { ...prev, [name]: arr }
    })
  }

  const openExercise = (name, rect, setIndex) => {
    play('option-select')
    setActiveExercise(name)
    setActiveExerciseRect(rect)
    setActiveSetIndex(setIndex)
    setPhase('weight')
  }

  const closePopup = () => {
    setActiveExercise(null)
    setActiveExerciseRect(null)
    setPhase(null)
  }

  const handleClose = useCallback(() => {
    play('menu-close')
    setClosing(true)
    setTimeout(onClose, 320)
  }, [onClose, play])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  return (
    <div
      className="fixed inset-0 z-[9995] bg-gtl-void overflow-hidden"
      style={{
        transformOrigin: `${originX} ${originY}`,
        animation: closing
          ? 'day-focus-out 320ms cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'day-focus-in 380ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
      }}
    >
    <div className={`w-full h-full${shaking ? ' animate-screen-shake' : ''}`}>
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.25) 0%, transparent 50%, rgba(74,10,14,0.35) 100%)' }} />

      <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <div className="font-display text-gtl-red leading-none"
          style={{ fontSize: 'clamp(10rem, 22vw, 22rem)', opacity: 0.06, transform: 'rotate(8deg)', whiteSpace: 'nowrap' }}>
          {label}
        </div>
      </div>

      {/* ExercisePanel back — fixed top-left, same anchor as RetreatButton +
          DayFocus back so the back button stays in the same on-screen
          position the entire active → day → exercise navigation chain. */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Back"
        className="group fixed left-0 z-40 inline-flex items-center px-3 py-3 outline-none scale-95 origin-left
          focus-visible:outline-2 focus-visible:outline-gtl-red"
        style={{ top: 'env(safe-area-inset-top, 0px)', touchAction: 'manipulation' }}
      >
        <span className="flex items-center gap-0.5 leading-none font-display text-2xl select-none">
          <span aria-hidden="true" className="text-gtl-red opacity-40 transition-colors duration-200 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
          <span aria-hidden="true" className="text-gtl-red opacity-70 transition-colors duration-200 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
          <span aria-hidden="true" className="text-gtl-red transition-colors duration-200 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
        </span>
      </button>

      <div className="relative z-10 h-full flex flex-col px-10 py-8 overflow-y-auto"
        style={{ animation: 'focus-content-in 280ms 250ms ease-out both' }}>

        <div className="shrink-0 mb-2">
          <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red mb-3">
            EXERCISES / {label}
          </div>
          <div className="font-display text-gtl-chalk leading-none"
            style={{ fontSize: 'clamp(4rem, 12vw, 10rem)', textShadow: '5px 5px 0 #070708', transform: 'rotate(-1.5deg)', transformOrigin: 'left center' }}>
            {label}
          </div>
        </div>

        <div className="my-8 h-[3px] bg-gtl-red shrink-0"
             style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center', maxWidth: '700px' }} />

        {Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length > 0 && (
          <div className="mb-4 shrink-0 font-mono text-[9px] tracking-[0.35em] uppercase text-gtl-red">
            {Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length} EXERCISE{Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length !== 1 ? 'S' : ''} LOGGED
          </div>
        )}

        <ol className="flex flex-col gap-0 shrink-0">
          {exercises.map((name, i) => (
            <ExerciseRow
              key={name}
              name={name}
              index={i}
              sets={Array.from({ length: setCounts[name] ?? 2 }, (_, si) => ({
                reps: (reps[name] || [])[si] ?? 0,
                weight: (weights[name] || [])[si] ?? 0,
              }))}
              ghostSets={Array.from({ length: setCounts[name] ?? 2 }, (_, si) => ({
                weight: (priorData[name]?.weight || [])[si] ?? 0,
                reps:   (priorData[name]?.reps   || [])[si] ?? 0,
              }))}
              onOpen={(rect, setIndex) => openExercise(name, rect, setIndex)}
              onAddSet={() => setSetCounts((prev) => {
                // GHOST MODE: update state only, do not persist set counts
                return { ...prev, [name]: (prev[name] ?? 2) + 1 }
              })}
              onDeleteSet={() => {
                const current = setCounts[name] ?? 2
                if (current <= 1) return
                const next = current - 1
                // GHOST MODE: update state only, no localStorage writes
                setSetCounts((prev) => ({ ...prev, [name]: next }))
                setReps((prev) => ({ ...prev, [name]: [...(prev[name] || [])].slice(0, next) }))
                setWeights((prev) => ({ ...prev, [name]: [...(prev[name] || [])].slice(0, next) }))
              }}
            />
          ))}

          <li style={{ listStyle: 'none', animation: 'focus-content-in 250ms 470ms ease-out both' }}>
            {customName && !editingCustom ? (
              <ExerciseRow
                key={customName}
                name={customName}
                index={4}
                sets={Array.from({ length: setCounts[customName] ?? 2 }, (_, si) => ({
                  reps: (reps[customName] || [])[si] ?? 0,
                  weight: (weights[customName] || [])[si] ?? 0,
                }))}
                ghostSets={Array.from({ length: setCounts[customName] ?? 2 }, (_, si) => ({
                  weight: (priorData[customName]?.weight || [])[si] ?? 0,
                  reps:   (priorData[customName]?.reps   || [])[si] ?? 0,
                }))}
                onOpen={(rect, setIndex) => openExercise(customName, rect, setIndex)}
                onAddSet={() => setSetCounts((prev) => ({ ...prev, [customName]: (prev[customName] ?? 2) + 1 }))}
                onDeleteSet={() => {
                  const current = setCounts[customName] ?? 2
                  if (current <= 1) return
                  const next = current - 1
                  setSetCounts((prev) => ({ ...prev, [customName]: next }))
                  setReps((prev) => ({ ...prev, [customName]: [...(prev[customName] || [])].slice(0, next) }))
                  setWeights((prev) => ({ ...prev, [customName]: [...(prev[customName] || [])].slice(0, next) }))
                }}
              />
            ) : editingCustom ? (
              <div className="flex items-center gap-4 py-4 border-b" style={{ borderColor: 'rgba(212,24,31,0.6)', paddingLeft: '8px' }}>
                <span className="font-display shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: '#e4b022', textShadow: '2px 2px 0 #8a6612', minWidth: '2.5rem' }}>
                  05
                </span>
                <CustomMoveInput
                  value={draftName}
                  onChange={setDraftName}
                  onCharAdded={() => {
                    setShaking(false)
                    requestAnimationFrame(() => setShaking(true))
                    setTimeout(() => setShaking(false), 300)
                  }}
                  onConfirm={() => {
                    const val = draftName.trim()
                    if (val) {
                      setCustomName(val)
                      // GHOST MODE: do not persist custom exercise name
                    }
                    setEditingCustom(false)
                  }}
                  onCancel={() => setEditingCustom(false)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 py-4 border-b cursor-pointer"
                style={{ borderColor: 'rgba(58,58,66,0.3)', paddingLeft: '8px' }}
                onClick={() => { setDraftName(customName); setEditingCustom(true) }}>
                <span className="font-display shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: '#3a3a42', minWidth: '2.5rem' }}>
                  05
                </span>
                <span className="font-display leading-none"
                  style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.8rem)', color: '#3a3a42' }}>
                  + CUSTOM MOVE
                </span>
              </div>
            )}
            {customName && !editingCustom && (
              <button type="button" onClick={() => { setDraftName(customName); setEditingCustom(true) }}
                className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke hover:text-gtl-red transition-colors mt-1 ml-2">
                ✎ RENAME
              </button>
            )}
          </li>
        </ol>

        {activeExercise && phase === 'weight' && (
          <WeightPopup
            key={`weight-${activeExercise}-${activeSetIndex}`}
            exerciseName={`${activeExercise} · S${activeSetIndex + 1}`}
            initialWeight={(() => {
              const arr = weights[activeExercise] || []
              const cur = arr[activeSetIndex] ?? 0
              if (cur !== 0) return cur
              for (let i = activeSetIndex - 1; i >= 0; i--) {
                if ((arr[i] ?? 0) !== 0) return arr[i]
              }
              return getPriorValue(activeExercise, 'weight', activeSetIndex)
            })()}
            rowRect={activeExerciseRect}
            onSave={(val) => saveWeight(activeExercise, val, activeSetIndex)}
            onClose={() => setPhase('reps')}
          />
        )}

        {activeExercise && phase === 'reps' && (
          <RepsPopup
            key={`reps-${activeExercise}-${activeSetIndex}`}
            exerciseName={`${activeExercise} · S${activeSetIndex + 1}`}
            initialReps={(() => {
              const arr = reps[activeExercise] || []
              const cur = arr[activeSetIndex] ?? 0
              if (cur !== 0) return cur
              for (let i = activeSetIndex - 1; i >= 0; i--) {
                if ((arr[i] ?? 0) !== 0) return arr[i]
              }
              return getPriorValue(activeExercise, 'reps', activeSetIndex)
            })()}
            rowRect={activeExerciseRect}
            onSave={(val) => saveReps(activeExercise, val, activeSetIndex)}
            onClose={closePopup}
          />
        )}

        <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke mt-10 shrink-0">
          PALACE / FITNESS / GHOST CYCLE / {label} / EXERCISES
        </div>
      </div>
    </div>
    </div>
  )
}

/* ── Day focus — GHOST MODE: stamp is local state only, no localStorage write ── */
function DayFocus({ iso, muscles, isLastDay, originRect, onClose, cycleId, onStamp }) {
  const { play } = useSound()
  const [closing, setClosing]                 = useState(false)
  const [focusMuscle, setFocusMuscle]         = useState(null)
  const [focusMuscleRect, setFocusMuscleRect] = useState(null)
  const date    = parseDate(iso)
  const dayName = DAY_FULL[date.getDay()]
  const dayNum  = date.getDate()
  const month   = MONTH_FULL[date.getMonth()]
  const year    = date.getFullYear()
  const hasWork = muscles.length > 0

  const [allReps, setAllReps]       = useState({})
  const [allWeights, setAllWeights] = useState({})
  const [unlogOpen, setUnlogOpen]   = useState(false)
  // GHOST MODE: stamped is local state only — never persisted
  const [stamped, setStamped] = useState(false)

  const handleStamp = () => {
    if (stamped) return
    play('option-select')
    // GHOST MODE: do NOT write done flag to localStorage
    setStamped(true)
    onStamp(iso)
    setTimeout(() => handleClose(), 900)
  }

  // In ghost mode, unlog just clears local state (nothing was ever written)
  const handleUnlogMuscle = (muscleId) => {
    play('menu-close')
    setAllReps(prev  => { const n = { ...prev };  delete n[muscleId]; return n })
    setAllWeights(prev => { const n = { ...prev }; delete n[muscleId]; return n })
  }

  // In ghost mode exercise data doesn't persist to storage, so allReps is always empty on open
  useEffect(() => {
    if (!hasWork) return
    const loadedReps = {}, loadedWeights = {}
    for (const muscleId of muscles) {
      try {
        const raw = localStorage.getItem(pk(`ex-${cycleId}-${iso}-${muscleId}`))
        if (raw) loadedReps[muscleId] = JSON.parse(raw)
      } catch (_) {}
      try {
        const raw = localStorage.getItem(pk(`wt-${cycleId}-${iso}-${muscleId}`))
        if (raw) loadedWeights[muscleId] = JSON.parse(raw)
      } catch (_) {}
    }
    setAllReps(loadedReps)
    setAllWeights(loadedWeights)
  }, [iso, muscles])

  const originX = originRect ? `${originRect.left + originRect.width / 2}px` : '50vw'
  const originY = originRect ? `${originRect.top + originRect.height / 2}px` : '50vh'

  const handleClose = useCallback(() => {
    play('menu-close')
    setClosing(true)
    setTimeout(onClose, 350)
  }, [onClose, play])

  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  return (
    <>
      <style>{`
        @keyframes day-focus-in {
          0%   { transform: scale(0.08); opacity: 0; filter: blur(12px); }
          40%  { opacity: 1; filter: blur(2px); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes day-focus-out {
          0%   { transform: scale(1); opacity: 1; filter: blur(0); }
          100% { transform: scale(0.08); opacity: 0; filter: blur(12px); }
        }
        @keyframes focus-content-in {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes stamp-slam {
          0%   { transform: scale(3) rotate(-8deg); opacity: 0; }
          25%  { opacity: 1; }
          55%  { transform: scale(0.93) rotate(-6deg); }
          70%  { transform: scale(1.04) rotate(-5.5deg); }
          85%  { transform: scale(0.98) rotate(-6deg); }
          100% { transform: scale(1) rotate(-6deg); opacity: 1; }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[9990] bg-gtl-void overflow-hidden"
        style={{
          transformOrigin: `${originX} ${originY}`,
          animation: closing
            ? 'day-focus-out 350ms cubic-bezier(0.4, 0, 1, 1) forwards'
            : 'day-focus-in 420ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
        }}
      >
        <div className="absolute inset-0 gtl-noise pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.22) 0%, transparent 50%, rgba(74,10,14,0.32) 100%)' }} />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden" aria-hidden="true">
          <div className="font-display text-gtl-red leading-none"
            style={{ fontSize: 'clamp(12rem, 28vw, 26rem)', opacity: 0.06, transform: 'rotate(-8deg)', whiteSpace: 'nowrap' }}>
            {dayName}
          </div>
        </div>

        <div className="relative z-10 h-full flex flex-col px-10 py-8 overflow-hidden"
          style={{ animation: 'focus-content-in 300ms 280ms ease-out both' }}>

          {stamped && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 0 }}>
              <div className="font-display leading-none pointer-events-none"
                style={{ fontSize: 'clamp(40vw, 60vw, 90vh)', color: 'rgba(212,24,31,0.18)', textShadow: '0 0 80px rgba(212,24,31,0.12)', transform: 'rotate(-6deg)', animation: 'stamp-slam 500ms cubic-bezier(0.2, 0, 0.4, 1) both', lineHeight: 1, letterSpacing: '-0.05em' }}>
                X
              </div>
            </div>
          )}

          {/* DayFocus back — fixed top-left, same anchor as RetreatButton. */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Back"
            className="group fixed left-0 z-40 inline-flex items-center px-3 py-3 outline-none scale-95 origin-left
              focus-visible:outline-2 focus-visible:outline-gtl-red"
            style={{ top: 'env(safe-area-inset-top, 0px)', touchAction: 'manipulation' }}
          >
            <span className="flex items-center gap-0.5 leading-none font-display text-2xl select-none">
              <span aria-hidden="true" className="text-gtl-red opacity-40 transition-colors duration-200 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
              <span aria-hidden="true" className="text-gtl-red opacity-70 transition-colors duration-200 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
              <span aria-hidden="true" className="text-gtl-red transition-colors duration-200 [@media(hover:hover)]:group-hover:text-gtl-red-bright">◀︎</span>
            </span>
          </button>

          {/* Top nav row — UNLOG on right (BACK is now fixed top-left, above) */}
          <div className="flex items-start justify-end mb-auto" style={{ zIndex: 10 }}>
            {!stamped && Object.keys(allReps).some(m => Object.values(allReps[m] || {}).flat().some(v => v > 0)) && (
              <div className="flex flex-col items-end gap-1.5">
                <button type="button" onClick={() => { play('button-hover'); setUnlogOpen(o => !o) }}
                  className="group relative inline-flex items-center outline-none focus-visible:outline-2 focus-visible:outline-gtl-red">
                  <div className="absolute inset-0 -inset-x-2 transition-all duration-300"
                    style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)', background: unlogOpen ? '#d4181f' : '#1a1a1e', border: `1px solid ${unlogOpen ? '#ff2a36' : '#3a3a42'}` }} aria-hidden="true" />
                  <div className="relative flex items-center gap-2 px-5 py-3">
                    <span className={`font-mono text-xs tracking-[0.3em] uppercase font-bold transition-colors duration-300 ${unlogOpen ? 'text-gtl-paper' : 'text-gtl-ash group-hover:text-gtl-chalk'}`}>
                      {unlogOpen ? 'CANCEL' : 'UNLOG SETS'}
                    </span>
                    <span className={`font-display text-base leading-none transition-colors duration-300 ${unlogOpen ? 'text-gtl-paper' : 'text-gtl-red'}`}>
                      {unlogOpen ? '✕' : '▼'}
                    </span>
                  </div>
                </button>
                {unlogOpen && (
                  <div className="flex flex-col gap-2 items-end">
                    {Object.keys(allReps).map(muscleId => {
                      const setCount = Object.values(allReps[muscleId] || {}).flat().filter(v => v > 0).length
                      if (!setCount) return null
                      return (
                        <div key={muscleId} className="flex items-center gap-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono uppercase font-bold text-white leading-none whitespace-nowrap"
                              style={{ fontSize: '13px', background: '#7a0e14', clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)', padding: '4px 14px', letterSpacing: '0.08em' }}>
                              {MUSCLE_LABELS[muscleId] || muscleId}
                            </span>
                            <span className="font-display text-lg leading-none text-gtl-red whitespace-nowrap">
                              {setCount} SET{setCount !== 1 ? 'S' : ''}
                            </span>
                          </div>
                          <button type="button" onClick={() => handleUnlogMuscle(muscleId)}
                            className="group relative inline-flex items-center outline-none">
                            <div className="absolute inset-0 -inset-x-1 bg-gtl-red/20 group-hover:bg-gtl-red transition-colors duration-150"
                              style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }} aria-hidden="true" />
                            <span className="relative font-mono text-[11px] tracking-[0.2em] uppercase text-gtl-red group-hover:text-gtl-paper transition-colors duration-150 px-4 py-1.5">
                              CLEAR
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vertical layout: compact date header + muscle slabs + exercise log */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-5 py-2">

            {/* Compact date header */}
            <div>
              <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red/60 mb-1">
                {month} · {year}
              </div>
              <div className="flex items-baseline gap-4">
                <div className="font-display text-gtl-chalk leading-none"
                  style={{ fontSize: 'clamp(3.5rem, 12vw, 7rem)', textShadow: '4px 4px 0 #070708, 8px 8px 0 rgba(0,0,0,0.4)', lineHeight: '0.85' }}>
                  {String(dayNum).padStart(2, '0')}
                </div>
                <div className="font-display text-gtl-red leading-none"
                  style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', textShadow: '2px 2px 0 #070708', transform: 'rotate(-1deg)' }}>
                  {dayName}
                </div>
              </div>
            </div>

            {/* Red slash divider */}
            <div className="h-[3px] bg-gtl-red shrink-0"
              style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center' }} />

            {/* Muscle slabs or REST */}
            {hasWork ? (
              <div className="flex flex-wrap gap-x-4 gap-y-3">
                {muscles.map((id, i) => {
                  const rot = SLAB_ROTATIONS[i % SLAB_ROTATIONS.length]
                  return (
                    <MuscleSlab key={id} id={id} rot={rot} delay={320 + i * 60}
                      onClick={(rect) => { play('option-select'); setFocusMuscle(id); setFocusMuscleRect(rect) }} />
                  )
                })}
              </div>
            ) : (
              <div className="font-display text-gtl-smoke leading-none"
                style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', transform: 'rotate(-1deg)' }}>
                REST DAY
              </div>
            )}

            {/* Exercise log — full width, one block per muscle group */}
            {hasWork && (
              <div style={{ animation: 'focus-content-in 350ms 400ms ease-out both' }}>
                {muscles.every(id => !Object.values(allReps[id] || {}).some(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0)) ? (
                  <div style={{ transform: 'rotate(-1deg)' }}>
                    <div className="font-display text-gtl-smoke/20 leading-none" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', textShadow: '3px 3px 0 #070708' }}>NO REPS</div>
                    <div className="font-display text-gtl-smoke/10 leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', marginTop: '0.4em' }}>SET LOGGED YET</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div className="font-display leading-none"
                      style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: '#d4181f', textShadow: '2px 2px 0 #8a0e13' }}>
                      Sets
                    </div>
                    {muscles.map((muscleId, si) => {
                      const muscleReps = allReps[muscleId] || {}
                      const logged = Object.entries(muscleReps).filter(([, v]) => Array.isArray(v) ? v.some(r => r > 0) : v > 0)
                      if (logged.length === 0) return null
                      const rot = SLAB_ROTATIONS[si % SLAB_ROTATIONS.length]
                      return (
                        <div key={muscleId} style={{ animation: `focus-content-in 300ms ${si * 90}ms ease-out both` }}>
                          <div style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'inline-flex', position: 'relative', transform: `rotate(${rot})`, transformOrigin: 'left center' }}>
                              <div style={{ position: 'absolute', inset: 0, background: '#8a0e13', clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', transform: 'translate(4px,4px)' }} aria-hidden="true" />
                              <div style={{ position: 'relative', padding: '2px 16px', background: '#d4181f', clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }}>
                                <span className="font-display text-gtl-paper leading-none whitespace-nowrap" style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.3rem)' }}>
                                  {MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: '0.4rem 1.5rem' }}>
                            {logged.map(([name, repsVal], ei) => {
                              const wVal = (allWeights[muscleId] || {})[name]
                              const allSets = Array.isArray(repsVal)
                                ? repsVal.map((r, i) => ({ reps: r, weight: Array.isArray(wVal) ? (wVal[i] ?? 0) : (i === 0 ? (wVal ?? 0) : 0) }))
                                : [{ reps: repsVal, weight: wVal ?? 0 }, { reps: 0, weight: 0 }]
                              return (
                                <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem', animation: `focus-content-in 220ms ${si * 90 + ei * 50 + 80}ms ease-out both`, transform: ei % 2 === 0 ? 'rotate(-0.4deg)' : 'rotate(0.3deg)', transformOrigin: 'left center' }}>
                                  <div className="font-display text-gtl-chalk leading-none" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>{name}</div>
                                  {allSets.map((s, si) => {
                                    if (si === 1 && s.reps === 0) return null
                                    return (
                                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="font-display leading-none shrink-0" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.9rem)', color: '#d4181f', minWidth: '2rem' }}>{si === 0 ? '1ST' : '2ND'}</span>
                                        <div className="font-display leading-none shrink-0" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', color: '#e4b022', textShadow: '2px 2px 0 #8a6612, 4px 4px 0 #070708' }}>{s.reps > 0 ? `${s.reps}×` : '—'}</div>
                                        {s.weight > 0 && <div className="font-display leading-none" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.3rem)', color: '#e4b022', opacity: 0.85 }}>{s.weight}<span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: '0.15em' }}>lbs</span></div>}
                                      </div>
                                    )
                                  })}
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
            )}
          </div>

          <div className="mt-auto pt-6 flex items-end justify-between gap-4" style={{ position: 'relative', zIndex: 10 }}>
            <div>
              <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
                PALACE / FITNESS / GHOST CYCLE / {dayName}
              </div>
            </div>

            <button type="button" onClick={handleStamp} disabled={stamped}
              className="group relative inline-flex items-center shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ opacity: stamped ? 0.4 : 1, transition: 'opacity 200ms' }}>
              <div className="absolute inset-0 -inset-x-2 transition-all duration-300"
                style={{ clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)', background: stamped ? '#3a3a42' : '#d4181f', boxShadow: stamped ? 'none' : '0 0 24px rgba(212,24,31,0.5)' }} aria-hidden="true" />
              <div className="relative flex items-center gap-3 px-6 py-3">
                <span className="font-display leading-none"
                  style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', color: '#f5f0e8', textShadow: '2px 2px 0 #070708' }}>
                  {stamped ? 'TOMORROW WILL COME' : isLastDay ? 'ASCEND TO THE NEXT LEVEL' : 'BRING ON TOMORROW'}
                </span>
                {!stamped && <span className="font-display text-gtl-paper leading-none" style={{ fontSize: '1.2rem' }}>▶︎</span>}
              </div>
            </button>
          </div>
        </div>

        {focusMuscle && (
          <ExercisePanel
            key={focusMuscle}
            muscleId={focusMuscle}
            dayIso={iso}
            originRect={focusMuscleRect}
            onClose={() => { setFocusMuscle(null); setFocusMuscleRect(null) }}
          />
        )}
      </div>
    </>
  )
}

function StatBlock({ number, label }) {
  return (
    <div className="flex flex-col items-start">
      <div className="font-display leading-none" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: '#e4b022', textShadow: '3px 3px 0 #8a6612, 5px 5px 0 #070708' }}>
        {String(number).padStart(2, '0')}
      </div>
      <div className="font-mono text-[10px] tracking-[0.35em] uppercase text-gtl-ash mt-1">{label}</div>
    </div>
  )
}

function getLevelInfo(totalXP) {
  let level = 0
  let xpUsed = 0
  while (true) {
    const threshold = 150 + level * 10
    if (xpUsed + threshold > totalXP) return { level, progress: totalXP - xpUsed, threshold }
    xpUsed += threshold
    level++
  }
}

function computeTotalXP() {
  try {
    const raw = localStorage.getItem(pk('cycles'))
    if (!raw) return { xp: 0, totalDays: 0 }
    const allCycles = JSON.parse(raw)
    let xp = 0, totalDays = 0
    for (const cycle of allCycles) {
      if (!cycle.days || !cycle.dailyPlan) continue
      totalDays += cycle.days.length
      for (const iso of cycle.days) {
        if (localStorage.getItem(pk(`done-${cycle.id}-${iso}`)) !== 'true') continue
        for (const muscleId of (cycle.dailyPlan[iso] || [])) {
          const rRaw = localStorage.getItem(pk(`ex-${cycle.id}-${iso}-${muscleId}`))
          const wRaw = localStorage.getItem(pk(`wt-${cycle.id}-${iso}-${muscleId}`))
          const rData = rRaw ? JSON.parse(rRaw) : {}
          const wData = wRaw ? JSON.parse(wRaw) : {}
          for (const name of Object.keys(rData)) {
            const rArr = Array.isArray(rData[name]) ? rData[name] : [rData[name]]
            const wArr = Array.isArray(wData[name]) ? wData[name] : [wData[name] || 0]
            for (let i = 0; i < rArr.length; i++) {
              const reps = rArr[i] || 0
              const weight = wArr[i] || 0
              if (reps === 0) continue
              const mult = reps >= 5 && reps <= 15 ? 1.0 : reps < 5 ? Math.exp(-Math.pow(reps - 5, 2) / 8) : Math.exp(-Math.pow(reps - 15, 2) / 32)
              xp += weight > 0 ? weight * mult * reps : reps * mult
            }
          }
        }
      }
    }
    return { xp, totalDays }
  } catch (_) { return { xp: 0, totalDays: 0 } }
}

export default function GhostActivePage() {
  useProfileGuard()
  const { play } = useSound()

  const [cycleId,    setCycleId]    = useState('')
  const [cycleName,  setCycleName]  = useState('GHOST CYCLE')
  const [targets,    setTargets]    = useState([])
  const [days,       setDays]       = useState([])
  const [dailyPlan,  setDailyPlan]  = useState({})
  const [ready,      setReady]      = useState(false)
  const [focusDay,   setFocusDay]   = useState(null)
  const [focusRect,  setFocusRect]  = useState(null)
  const [cardRefreshKey, setCardRefreshKey] = useState(0)
  const [completedDays, setCompletedDays]   = useState(0)
  const [barXP, setBarXP]                   = useState(0)
  const [allCyclesDays, setAllCyclesDays]   = useState(0)
  // GHOST MODE: track locally which days were stamped (never persisted)
  const [ghostDoneDays, setGhostDoneDays]   = useState({})

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    try {
      const cid  = localStorage.getItem(pk('active-cycle-id'))
      const name = localStorage.getItem(pk('cycle-name'))
      const rawT = localStorage.getItem(pk('muscle-targets'))
      const rawD = localStorage.getItem(pk('training-days'))
      const rawP = localStorage.getItem(pk('daily-plan'))
      if (cid)  setCycleId(cid)
      if (name) setCycleName(name)
      if (rawT) setTargets(JSON.parse(rawT))
      if (rawD) setDays(JSON.parse(rawD).sort())
      if (rawP) setDailyPlan(JSON.parse(rawP))
      const { xp, totalDays } = computeTotalXP()
      setBarXP(xp)
      setAllCyclesDays(totalDays)
    } catch (_) {}
    setReady(true)
  }, [])

  useEffect(() => {
    if (!days.length) return
    let count = 0
    for (const iso of days) {
      if (ghostDoneDays[iso]) count++
    }
    setCompletedDays(count)
  }, [days, ghostDoneDays])

  const handleDayClick = (iso, rect) => {
    setFocusRect(rect)
    setFocusDay(iso)
  }

  const handleStampDay = (iso) => {
    setGhostDoneDays(prev => ({ ...prev, [iso]: true }))
  }

  const handleCloseFocus = () => {
    setFocusDay(null)
    setFocusRect(null)
    setCardRefreshKey((k) => k + 1)
    // GHOST MODE: no XP animation — nothing was saved
  }

  const plannedSessions = days.filter((iso) => (dailyPlan[iso] || []).length > 0).length

  const cols = days.length <= 4 ? days.length
             : days.length <= 8 ? Math.ceil(days.length / 2)
             : Math.ceil(days.length / 3)
  const rows = Math.ceil(days.length / cols)

  return (
    <main className="relative h-screen overflow-hidden flex flex-col bg-gtl-void">

      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(30,30,80,0.18) 0%, transparent 45%, rgba(20,20,60,0.28) 100%)' }} />

      {/* Kanji watermark — 幽 (ghost/spirit). Top rooted at safe-area floor so it
          never clips into the iOS Dynamic Island camera area. */}
      <div className="absolute -right-24 pointer-events-none select-none" aria-hidden="true"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) - 64px)', fontFamily: '"Noto Serif JP", "Yu Mincho", serif', fontSize: '52rem', lineHeight: '0.8', color: '#6060a0', opacity: 0.045, fontWeight: 900 }}>
        幽
      </div>

      {/* Cycle name watermark */}
      <div className="absolute inset-0 flex items-center justify-start pointer-events-none select-none overflow-hidden" style={{ zIndex: 20 }}>
        <div className="font-display leading-none"
          style={{ fontSize: 'clamp(5rem, 16vw, 18rem)', color: '#e8e0d0', opacity: 0.03, transform: 'rotate(-4deg) translateY(10%)', transformOrigin: 'left center', letterSpacing: '-0.02em', whiteSpace: 'nowrap', paddingLeft: '2rem' }}>
          {cycleName}
        </div>
      </div>

      {/* Nav */}
      <nav className="relative z-10 shrink-0 flex items-center gap-4 pl-0 pr-8 py-3">
        <RetreatButton href="/fitness/ghost" />
        <div className="w-px self-stretch bg-gtl-edge" style={{ transform: 'skewX(-12deg)' }} />

        {/* Ghost mode indicator in nav */}
        <div className="flex items-center gap-2 px-4 py-1"
          style={{ background: 'rgba(30,30,60,0.5)', border: '1px solid #3a3a52', clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}>
          <span className="font-display text-sm leading-none" style={{ color: '#6060a0' }}>◈</span>
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase font-bold" style={{ color: '#6060a0' }}>
            GHOST MODE
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] uppercase" style={{ color: '#3a3a5a' }}>
            · NOTHING SAVED
          </span>
        </div>

        {/* XP bar — read-only display of current real XP */}
        {days.length > 0 && (() => {
          const { level, progress, threshold } = getLevelInfo(barXP)
          const fillPct = Math.min(100, (progress / threshold) * 100)
          return (
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <span className="font-display text-base uppercase text-white leading-none" style={{ textShadow: '1px 1px 0 #d4181f' }}>EXP</span>
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash leading-none mt-0.5">LV.{level}</span>
              </div>
              <div className="relative flex-1 min-w-0 overflow-hidden"
                style={{ height: '18px', background: '#1a1a1e', clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 2% 100%)', border: '1px solid #2a2a30', opacity: 0.5 }}>
                <div style={{ position: 'absolute', inset: 0, width: `${fillPct}%`, background: 'linear-gradient(90deg, #8a6612, #e4b022)', clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 2% 100%)', boxShadow: '0 0 8px rgba(228,176,34,0.3)' }} />
              </div>
            </div>
          )
        })()}
      </nav>

      <div className="relative z-10 mx-8 mb-1 h-[2px] shrink-0"
           style={{ background: '#3a3a52', transform: 'skewX(-6deg)', transformOrigin: 'left center' }} />

      {/* Day grid */}
      <section className="relative z-10 flex-1 min-h-0 overflow-hidden flex flex-col px-8 pb-2">
        <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-ash mb-3 flex items-center gap-4">
          <span>BATTLE SCHEDULE</span>
          <div className="h-px flex-1 bg-gtl-edge" />
          <span className="text-gtl-red">{days.length} DAY{days.length !== 1 ? 'S' : ''}</span>
        </div>

        {ready && days.length === 0 ? (
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-gtl-smoke py-20">
            NO DAYS SCHEDULED
          </div>
        ) : (
          <div
            className="grid gap-2 flex-1 min-h-0"
            style={{
              gridTemplateColumns: `repeat(${Math.min(cols, days.length)}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {days.map((iso, i) => (
              <DayCard
                key={iso}
                iso={iso}
                muscles={dailyPlan[iso] || []}
                index={i}
                onClick={handleDayClick}
                ghostDoneDays={ghostDoneDays}
                cycleId={cycleId}
              />
            ))}
          </div>
        )}
      </section>

      {focusDay && (
        <DayFocus
          key={focusDay}
          iso={focusDay}
          muscles={dailyPlan[focusDay] || []}
          cycleId={cycleId}
          isLastDay={(() => {
            const undoneDays = days.filter(d => !ghostDoneDays[d])
            return undoneDays.length === 1 && undoneDays[0] === focusDay
          })()}
          originRect={focusRect}
          onClose={handleCloseFocus}
          onStamp={handleStampDay}
        />
      )}

    </main>
  )
}
