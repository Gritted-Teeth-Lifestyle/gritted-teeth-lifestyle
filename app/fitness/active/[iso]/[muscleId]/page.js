'use client'
/*
 * /fitness/active/[iso]/[muscleId] — Muscle exercise route (Stage 2 of
 * App Router refactor).
 *
 * The ExercisePanel that used to live as conditional state on the
 * day-focus view is now a real route. Mounting this page shows the
 * exercise panel for (iso, muscleId); closing routes back to the day
 * view. By moving the muscle hop onto a real route, HeistTransition
 * fires naturally between /fitness/active/[iso] and the muscle view —
 * making the 5th and final chain hop consistent with steps 1–4.
 *
 * Helpers below (ExercisePanel, popups, etc.) are duplicated from the
 * day route verbatim. Stage 3 will dedup them into shared modules.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSound } from '../../../../../lib/useSound'
import { useProfileGuard } from '../../../../../lib/useProfileGuard'
import { pk } from '../../../../../lib/storage'
import { getUserDOB } from '../../../../../lib/userPrefs'
import PickerSheet from '../../../../../components/attune/PickerSheet'
import HeistTransition from '../../../../../components/HeistTransition'
import { chipsForDay, addChip, useChipsForDay, replaceExercise } from '../../../../../lib/attunement'
import { disarmChain } from '../../../../../lib/predictiveTap'
import { useChainPage } from '../../../../../lib/useChainPage'
import {
  calculateSetXP,
  upsertSetSnapshot,
  computeProfileTotalXP,
  readSetLogForDay,
  getHolidayMultiplier,
  getPrestigeMultiplier,
  getTierMultiplier,
  getTierCount,
  getRibbonCount,
  getTier,
  tickTier,
  addRegionStars,
  computeDailyReckoning,
  replaceConsistencyCredit,
  assessSetForExercise,
  getProvenBest,
} from '../../../../../lib/exp'
import { getExerciseById, exercisesByMuscle } from '../../../../../lib/exerciseLibrary'
import { byNotoriety } from '../../../../../lib/exerciseNotoriety'
import BodyweightModal from '../../../../../components/onboarding/BodyweightModal'
import SetXPCinematic from '../../../../../components/exp/SetXPCinematic'

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS',
  biceps: 'BICEPS', triceps: 'TRICEPS', forearms: 'FOREARMS',
  abs: 'ABS', glutes: 'GLUTES', quads: 'QUADS',
  hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}
// Canonical kanji-per-muscle map. Mirrors app/fitness/new/branded/page.js
// SHEET_MUSCLES list verbatim (11 muscles). Used by the rolodex DayButton
// to render glyph-only on non-TODAY cards.
const MUSCLE_KANJI = {
  chest:      '胸',
  shoulders:  '肩',
  back:       '背',
  forearms:   '腕',
  quads:      '腿',
  hamstrings: '裏',
  calves:     '脛',
  biceps:     '二',
  triceps:    '三',
  glutes:     '尻',
  abs:        '腹',
}
const DAY_FULL   = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY']
const DAY_SHORT  = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_FULL  = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']

const SLAB_ROTATIONS = ['-1.5deg','1deg','-0.8deg','1.5deg','-1.2deg','0.8deg','-1.8deg','1.2deg','-0.6deg','1.4deg','-1deg']
const CARD_ROTATIONS = ['-0.8deg','0.6deg','-0.5deg','0.9deg','-0.7deg','0.4deg','-1deg','0.7deg','-0.6deg','0.8deg']

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

/* ── Day button — matches the TODAY hero's red-clip-path style. Used in the
 *  vertical rolodex to make every day visually consistent with the hero
 *  button. Done days dim to a dark surface bg with a strikethrough date so
 *  they read as past-completed without standing out as much as live days.
 */
function DayButton({ iso, muscles, todayIso, onClick, doneKey, cycleId }) {
  const { play } = useSound()
  const [done, setDone] = useState(false)

  useEffect(() => {
    try { setDone(localStorage.getItem(pk(`done-${cycleId}-${iso}`)) === 'true') } catch {}
  }, [iso, doneKey, cycleId])

  const date    = parseDate(iso)
  const dayName = DAY_SHORT[date.getDay()]
  const dayNum  = date.getDate()
  const mon     = MONTH_SHORT[date.getMonth()]

  const isToday = iso === todayIso
  const isPast  = iso < todayIso
  const label   = isToday ? 'TODAY' : done ? 'DONE' : isPast ? 'MISSED' : 'UPCOMING'

  return (
    <button
      type="button"
      // Predictive-tap chain marker: ONLY the TODAY card carries this
      // attribute (other days in the rolodex are not the chain target).
      // Aligns with the y=479 ACTIVE_TOP_Y pinning that mirrors ACTIVATE's
      // screen rect on /fitness/load — predictive-tap module reads bbox
      // from this element to match the chain hop.
      data-predictive-tap-target={isToday ? 'today' : undefined}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        play('card-confirm')
        onClick(iso, rect)
      }}
      className="relative block w-full outline-none active:scale-[0.98] transition-transform"
      style={{ touchAction: 'pan-y' }}
      aria-label={`${label} — ${DAY_FULL[date.getDay()]} ${dayNum} ${MONTH_FULL[date.getMonth()]}`}
    >
      <div
        className={`absolute inset-0 transition-colors ${done ? 'bg-gtl-surface' : 'bg-gtl-red'}`}
        style={{
          // Match the ACTIVATE button's clip-path slash exactly.
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          // Match the ACTIVATE button's offset-block shadow (4px 4px sharp
          // black) instead of the soft red glow we had before.
          boxShadow: done
            ? '2px 2px 0 #070708'
            : '4px 4px 0 #070708',
          border: done ? '1px solid #2a2a30' : 'none',
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between px-6 py-5 gap-3 min-h-[56px]">
        {/* Single-line date — matches canonical chain-button content shape
            (one line of text-3xl). Status label + small muscle text removed
            so TODAY card height equals ACTIVATE / ProfileChip / MUSCLE
            (~70px); the centered active line is what tells the user this
            is today, no separate label needed. */}
        <span className={`font-display text-3xl leading-none whitespace-nowrap shrink-0 tracking-tight
          ${done ? 'text-gtl-chalk' : 'text-gtl-paper'}`}
          style={done ? { textDecoration: 'line-through', textDecorationColor: '#7a0e14' } : undefined}>
          {dayName} · {mon} {dayNum}
        </span>
        {/* Right side: REST pill only on no-muscles days. Kanji rendering
            removed for now — was overflowing and pushing the date off-screen. */}
        {muscles.length === 0 && (
          <span className={`font-mono text-[10px] tracking-[0.3em] uppercase shrink-0 leading-none
            ${done ? 'text-gtl-smoke/60' : 'text-gtl-paper/50'}`}>
            REST
          </span>
        )}
      </div>
    </button>
  )
}

/* ── Overview day card — clickable, zooms into focus view ── */
function DayCard({ iso, muscles, index, onClick, doneKey, cycleId }) {
  const { play } = useSound()
  const [hovered, setHovered] = useState(false)
  const [done, setDone]       = useState(false)
  const [lifts, setLifts]     = useState([]) // [{ muscle, exercises: [{ name, sets: [{reps,weight}] }] }]
  const [cardH, setCardH]     = useState(120)
  const [cardW, setCardW]     = useState(200)
  const cardRef = useRef(null)

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

  useEffect(() => {
    try { setDone(localStorage.getItem(pk(`done-${cycleId}-${iso}`)) === 'true') } catch (_) {}
  }, [iso, doneKey])

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

  // Scale factor: base calibrated at 120px card height
  const scale = Math.max(0.6, Math.min(2.5, cardH / 120))
  const isLandscape = cardW / cardH > 1.4

  const handleClick = () => {
    play('card-confirm')
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
      {/* Date + lifts: row when landscape, column when portrait */}
      <div className={`${isLandscape ? 'flex flex-row' : 'flex flex-col'} gap-2 px-3 pt-2 pb-1 overflow-hidden`}>
        {/* Date block */}
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

        {/* Lifts summary — right of date, only on completed days */}
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
        {/* Muscles — right of date (landscape) or below (portrait), only on incomplete days */}
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


      {/* Done X stamp overlay */}
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
    console.log('[GTL] MuscleSlab button click fired:', id)
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
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return
        setPressed(true)
        const rect = e.currentTarget.getBoundingClientRect()
        console.log('[GTL] MuscleSlab pointerdown (touch):', id)
        onClick(rect)
      }}
      onPointerUp={(e) => { if (e.pointerType === 'touch') setPressed(false) }}
      onPointerCancel={(e) => { if (e.pointerType === 'touch') setPressed(false) }}
      className="relative cursor-pointer select-none outline-none shrink-0
        focus-visible:outline-2 focus-visible:outline-gtl-paper focus-visible:outline-offset-4"
      style={{
        '--slab-rot': rot,
        transform: `rotate(${rot})`,
        animation: `slab-in 300ms ${delay}ms ease-out both`,
        overflow: 'visible',
        touchAction: 'manipulation',
      }}
      aria-label={`View exercises for ${MUSCLE_LABELS[id] || id}`}
    >
      {/* Shadow */}
      <div
        className="absolute inset-0 bg-gtl-red-deep"
        style={{
          clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          transform: pressed ? 'translate(0,0)' : 'translate(6px, 6px)',
          transition: 'transform 80ms ease-out',
        }}
        aria-hidden="true"
      />
      {/* Face */}
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
  const [numKey, setNumKey]       = useState(0)   // re-key to replay number pulse
  const [numDir, setNumDir]       = useState('up')
  const [slamming, setSlamming]   = useState(false)
  const [setPressed, setSetPressed] = useState(false)
  // Entrance skip — first tap snaps the popup zoom-in to settled.
  const [entranceSkipped, setEntranceSkipped] = useState(false)
  useEffect(() => {
    if (entranceSkipped || slamming) return
    const handler = () => setEntranceSkipped(true)
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [entranceSkipped, slamming])

  const POPUP_WIDTH  = 380
  const POPUP_HEIGHT = 560 // estimated

  // Vertically align popup with the clicked row, clamped to viewport
  const popupTop = rowRect
    ? Math.max(20, Math.min(rowRect.top - POPUP_HEIGHT / 2 + rowRect.height / 2, window.innerHeight - POPUP_HEIGHT - 20))
    : Math.max(20, (window.innerHeight - POPUP_HEIGHT) / 2)

  // Translation for slam-exit: move popup center → row center
  const slamDX = rowRect
    ? (rowRect.left + rowRect.width / 2) - (window.innerWidth / 2)
    : 0
  const slamDY = rowRect
    ? (rowRect.top + rowRect.height / 2) - (popupTop + POPUP_HEIGHT / 2)
    : 200

  // Flame grows with reps: scale 0 at 0 reps, full at ~20 reps
  const flameScale  = Math.min(0.25 + reps * 0.13, 3.0)
  const flameOpacity = Math.min(0.3 + reps * 0.07, 1.0)

  const increment = () => {
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

  const slamTimerRef = useRef(null)
  const handleSetReps = () => {
    play('stamp')
    onSave(reps)
    setSlamming(true)
    slamTimerRef.current = setTimeout(onClose, 550)
  }
  // Tap during slam-exit → close immediately, clear the auto-close timer.
  useEffect(() => {
    if (!slamming) return
    const handler = () => {
      if (slamTimerRef.current) clearTimeout(slamTimerRef.current)
      onClose()
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [slamming, onClose])

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

      {/* Skip the reps-in entrance animation on first tap — collapses
          animation duration/delay so reps-in snaps to settled. */}
      {entranceSkipped && !slamming && (
        <style>{`
          [data-reps-popup-skip-target], [data-reps-popup-skip-target] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        `}</style>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{ background: 'rgba(7,7,8,0.80)', backdropFilter: 'blur(3px)' }}
        onClick={() => { onSave(reps); onClose() }}
      />

      {/* Outer — position only, zero animation so centering never shifts */}
      <div
        data-reps-popup-skip-target
        className="fixed z-[10000]"
        style={{
          width: '380px',
          left: '50%',
          marginLeft: '-190px',          /* half of 380px — no transform needed */
          top: popupTop != null ? `${popupTop}px` : '50%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Inner — animation only, separate element so parent centering is untouched */}
        <div style={{ animation: slamming ? 'reps-slam-exit 500ms cubic-bezier(0.4,0,1,1) forwards' : 'reps-in 500ms cubic-bezier(0.18,1.2,0.35,1) forwards' }}>
        <div
          className="relative w-full flex flex-col items-center px-12 py-10 bg-gtl-ink"
          style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}
        >
          {/* Atmospherics */}
          <div className="absolute inset-0 gtl-noise pointer-events-none opacity-60" />

          {/* Hard shadow */}
          <div
            className="absolute inset-0 bg-gtl-red-deep -z-10"
            style={{
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              transform: 'translate(10px, 10px)',
            }}
            aria-hidden="true"
          />

          {/* REPS label */}
          <div className="relative font-mono text-[13px] tracking-[0.7em] uppercase text-gtl-red mb-1">
            REPS
          </div>

          {/* Exercise name */}
          <div
            className="relative font-display text-gtl-smoke leading-none mb-6 text-center"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', transform: 'rotate(0.4deg)' }}
          >
            {exerciseName}
          </div>

          {/* ── UP BUTTON + FLAME ── */}
          <div className="relative flex flex-col items-center mb-2">

            {/* Flame — lives above the arrow, scales with reps */}
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
              {/* Outer flame — orange */}
              <div className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse 55% 80% at 50% 90%, #ff6a00 0%, #ff2a00 40%, transparent 100%)',
                  borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%',
                  animation: 'flame-core 0.9s ease-in-out infinite',
                  transformOrigin: 'center bottom',
                }} />
              {/* Mid flame — red/yellow */}
              <div className="absolute inset-x-2 inset-y-0"
                style={{
                  background: 'radial-gradient(ellipse 50% 75% at 50% 90%, #ffd200 0%, #ff4500 50%, transparent 100%)',
                  borderRadius: '50% 50% 30% 30% / 55% 55% 45% 45%',
                  animation: 'flame-mid 0.65s ease-in-out infinite',
                  transformOrigin: 'center bottom',
                }} />
              {/* Tip — white/yellow */}
              <div className="absolute inset-x-4 top-0"
                style={{
                  height: '50%',
                  background: 'radial-gradient(ellipse 40% 60% at 50% 90%, #fff7a0 0%, #ffe000 50%, transparent 100%)',
                  borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%',
                  animation: 'flame-tip 0.5s ease-in-out infinite',
                  transformOrigin: 'center bottom',
                }} />
            </div>

            {/* ▲ button */}
            <button
              type="button"
              onMouseDown={() => setPressUp(true)}
              onMouseUp={() => { setPressUp(false); increment() }}
              onMouseLeave={() => setPressUp(false)}
              onMouseEnter={() => play('button-hover')}
              className="relative cursor-pointer select-none outline-none
                focus-visible:outline-2 focus-visible:outline-gtl-red"
              aria-label="Increase reps"
            >
              {/* Shadow */}
              <div className="absolute inset-0 bg-gtl-red-deep"
                style={{
                  clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
                  transform: pressUp ? 'translate(0,0)' : 'translate(4px, 4px)',
                  transition: 'transform 60ms ease-out',
                }} aria-hidden="true" />
              {/* Face */}
              <div
                className="relative px-10 py-3"
                style={{
                  clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)',
                  background: pressUp ? '#ff2a36' : '#d4181f',
                  transform: pressUp ? 'translate(4px, 4px)' : 'translate(0,0)',
                  transition: 'transform 60ms ease-out, background 60ms',
                }}
              >
                <div className="font-display text-gtl-paper leading-none"
                     style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>▲</div>
              </div>
            </button>
          </div>

          {/* Number */}
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

          {/* ▼ button */}
          <button
            type="button"
            onMouseDown={() => setPressDown(true)}
            onMouseUp={() => { setPressDown(false); decrement() }}
            onMouseLeave={() => setPressDown(false)}
            onMouseEnter={() => reps > 0 && play('button-hover')}
            className="relative cursor-pointer select-none outline-none mt-2
              focus-visible:outline-2 focus-visible:outline-gtl-red"
            aria-label="Decrease reps"
            disabled={reps === 0}
          >
            {/* Shadow */}
            <div className="absolute inset-0"
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)',
                background: reps === 0 ? '#1a1a1e' : '#8a0e13',
                transform: pressDown ? 'translate(0,0)' : 'translate(4px, 4px)',
                transition: 'transform 60ms ease-out',
              }} aria-hidden="true" />
            {/* Face */}
            <div
              className="relative px-10 py-3"
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)',
                background: reps === 0 ? '#1a1a1e' : pressDown ? '#ff2a36' : '#d4181f',
                transform: pressDown ? 'translate(4px, 4px)' : 'translate(0,0)',
                transition: 'transform 60ms ease-out, background 60ms',
              }}
            >
              <div
                className="font-display leading-none"
                style={{
                  fontSize: 'clamp(1.8rem, 4vw, 3rem)',
                  color: reps === 0 ? '#3a3a42' : '#ffffff',
                }}
              >▼</div>
            </div>
          </button>

          {/* SET REPS — the big dramatic confirm */}
          <div className="relative w-full mt-8">
            {/* Spinning ring animation when reps > 0 */}
            {reps > 0 && (
              <div
                className="absolute -inset-1 pointer-events-none"
                style={{
                  clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
                  animation: 'set-reps-glow 1.8s ease-in-out infinite',
                }}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onMouseDown={() => setSetPressed(true)}
              onMouseUp={() => { setSetPressed(false); handleSetReps() }}
              onMouseLeave={() => setSetPressed(false)}
              onMouseEnter={() => play('button-hover')}
              className="relative w-full cursor-pointer select-none outline-none
                focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ transform: 'rotate(-1deg)' }}
            >
              {/* Shadow slab */}
              <div
                className="absolute inset-0 bg-gtl-red-deep"
                style={{
                  clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
                  transform: setPressed ? 'translate(0,0)' : 'translate(8px, 8px)',
                  transition: 'transform 80ms ease-out',
                }}
                aria-hidden="true"
              />
              {/* Face */}
              <div
                className="relative flex items-center justify-between px-8 py-5"
                style={{
                  clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
                  background: setPressed ? '#ff2a36' : reps > 0 ? '#d4181f' : '#3a1014',
                  transform: setPressed ? 'translate(8px, 8px)' : 'translate(0,0)',
                  transition: 'transform 80ms ease-out, background 100ms',
                }}
              >
                <div>
                  <div
                    className="font-display text-gtl-paper leading-none tracking-tight"
                    style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
                  >
                    SET REPS
                  </div>
                  <div className="font-mono text-[8px] tracking-[0.4em] uppercase text-gtl-paper/50 mt-1">
                    {reps > 0 ? `${reps} REP${reps !== 1 ? 'S' : ''} / LOCK IT IN` : 'SET A REP COUNT FIRST'}
                  </div>
                </div>
                <div className="font-display text-gtl-paper/40 leading-none"
                     style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)' }}>
                  ▸
                </div>
              </div>
            </button>
          </div>

        </div>{/* card */}
        </div>{/* animation wrapper */}
      </div>{/* positioning wrapper */}
    </>
  )
}

/* ── Weight setter popup — same drama as RepsPopup, opens first ── */
const PLATE_QUICK_PICKS = [45, 95, 135, 185, 225, 275, 315]

function WeightPopup({ exerciseName, initialWeight, rowRect, onClose, onSave }) {
  const { play } = useSound()
  const [weight, setWeight]         = useState(initialWeight)
  const [pressUp, setPressUp]       = useState(false)
  const [pressDown, setPressDown]   = useState(false)
  const [numKey, setNumKey]         = useState(0)
  const [numDir, setNumDir]         = useState('up')
  const [slamming, setSlamming]     = useState(false)
  const [setPressed, setSetPressed] = useState(false)
  const [flashChip, setFlashChip]   = useState(null)
  // Entrance skip — first tap snaps the popup zoom-in to settled.
  const [entranceSkipped, setEntranceSkipped] = useState(false)
  useEffect(() => {
    if (entranceSkipped || slamming) return
    const handler = () => setEntranceSkipped(true)
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [entranceSkipped, slamming])

  const POPUP_WIDTH  = 380
  // Chips moved to a side rail — main column is back to its original ~560 height.
  const POPUP_HEIGHT = 560

  // Viewport-centered (with a 10px upward bias) — independent of the tapped
  // row, so first / second / Nth set popups all open from the same position.
  // The slam-back-to-row animation still uses rowRect for slamDX/slamDY so
  // the close transition flies back to the row that was tapped.
  const TOP_BIAS = 10
  const popupTop = Math.max(20, Math.min((window.innerHeight - POPUP_HEIGHT) / 2 - TOP_BIAS, window.innerHeight - POPUP_HEIGHT - 20))

  const slamDX = rowRect ? (rowRect.left + rowRect.width / 2) - (window.innerWidth / 2) : 0
  const slamDY = rowRect ? (rowRect.top + rowRect.height / 2) - (popupTop + POPUP_HEIGHT / 2) : 200

  const flameScale   = Math.min(0.25 + weight * 0.013, 3.0)
  const flameOpacity = Math.min(0.3 + weight * 0.007, 1.0)

  // Functional setters so timer-driven calls don't see a stale `weight` closure.
  const bumpUp = (step = 5) => {
    setWeight((n) => n + step)
    setNumDir('up')
    setNumKey((k) => k + 1)
  }
  const bumpDown = (step = 5) => {
    setWeight((n) => Math.max(0, n - step))
    setNumDir('down')
    setNumKey((k) => k + 1)
  }

  // Long-press auto-repeat with acceleration.
  // Tap = +5/-5. Hold for >400ms starts a repeat at 80ms. After 1.5s the step
  // grows to 10; after 3s to 25 — so a long hold ramps from +5 to +10 to +25
  // every 80ms, taking 0→315 in roughly 4 seconds without any tapping.
  const holdTimerRef = useRef(null)
  const repeatIntervalRef = useRef(null)
  const holdStartRef = useRef(0)

  const stopHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
    if (repeatIntervalRef.current) { clearInterval(repeatIntervalRef.current); repeatIntervalRef.current = null }
  }
  const startHold = (dir) => {
    stopHold()
    const fn = dir === 'up' ? bumpUp : bumpDown
    fn(5)
    holdStartRef.current = performance.now()
    holdTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        const held = performance.now() - holdStartRef.current
        let step = 5
        if (held > 3000) step = 25
        else if (held > 1500) step = 10
        fn(step)
      }, 80)
    }, 400)
  }
  useEffect(() => () => stopHold(), [])

  const setQuick = (val) => {
    play('option-select')
    setNumDir(val >= weight ? 'up' : 'down')
    setNumKey((k) => k + 1)
    setWeight(val)
    setFlashChip(val)
    setTimeout(() => setFlashChip(null), 220)
  }

  const slamTimerRef = useRef(null)
  const handleSetWeight = () => {
    play('stamp')
    onSave(weight)
    setSlamming(true)
    slamTimerRef.current = setTimeout(onClose, 550)
  }
  // Tap during slam-exit → close immediately, clear the auto-close timer.
  useEffect(() => {
    if (!slamming) return
    const handler = () => {
      if (slamTimerRef.current) clearTimeout(slamTimerRef.current)
      onClose()
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [slamming, onClose])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape')    { onSave(weight); onClose() }
      if (e.key === 'ArrowUp')   { e.preventDefault(); bumpUp(5) }
      if (e.key === 'ArrowDown') { e.preventDefault(); bumpDown(5) }
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

      {/* Skip the weight-popup zoom entrance on first tap. */}
      {entranceSkipped && !slamming && (
        <style>{`
          [data-weight-popup-skip-target], [data-weight-popup-skip-target] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        `}</style>
      )}

      <div className="fixed inset-0 z-[9999]"
        style={{ background: 'rgba(7,7,8,0.80)', backdropFilter: 'blur(3px)' }}
        onClick={() => { onSave(weight); onClose() }}
      />

      <div data-weight-popup-skip-target className="fixed z-[10000]"
        style={{ width: '380px', left: '50%', marginLeft: '-190px', top: `${popupTop}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ animation: slamming ? 'weight-slam-exit 500ms cubic-bezier(0.4,0,1,1) forwards' : 'weight-in 500ms cubic-bezier(0.18,1.2,0.35,1) forwards' }}>
        <div className="relative w-full flex flex-col items-center pl-12 pr-24 py-10 bg-gtl-ink"
          style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}>
          <div className="absolute inset-0 gtl-noise pointer-events-none opacity-60" />
          <div className="absolute inset-0 bg-gtl-red-deep -z-10"
            style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', transform: 'translate(10px, 10px)' }}
            aria-hidden="true" />

          {/* Plate-math vertical rail — ascending bottom→top so heaviest sits
              at the top of the column. Absolutely positioned in the right
              padding gutter so it doesn't push the main column around. Inline
              styles (not Tailwind utilities) so the absolute + flex-col-reverse
              can't get nuked by a stale purge. */}
          <div
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '10px',
              zIndex: 10,
            }}
          >
            {PLATE_QUICK_PICKS.map((w) => {
              const active = weight === w
              const flashing = flashChip === w
              return (
                <button key={w} type="button"
                  onPointerDown={() => setQuick(w)}
                  className="relative outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
                  style={{ touchAction: 'manipulation' }}
                  aria-label={`Set weight to ${w} pounds`}>
                  <div className="absolute inset-0 bg-gtl-red-deep"
                    style={{ clipPath: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)', transform: 'translate(3px, 3px)' }}
                    aria-hidden="true" />
                  <div
                    className="relative font-display tracking-tight px-3 py-2 text-xl leading-none transition-all duration-100"
                    style={{
                      clipPath: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)',
                      background: flashing ? '#ff2a36' : active ? '#d4181f' : '#1a1a1e',
                      color: active || flashing ? '#ffffff' : '#c8c8c8',
                      border: '1px solid ' + (active ? '#ff2a36' : '#3a3a42'),
                      minWidth: '4rem',
                      textAlign: 'center',
                    }}
                  >
                    {w === 45 ? 'BAR' : w}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="relative font-mono text-[13px] tracking-[0.7em] uppercase text-gtl-red mb-1">WEIGHT</div>
          <div className="relative font-display text-gtl-smoke leading-none mb-1 text-center"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', transform: 'rotate(0.4deg)' }}>
            {exerciseName}
          </div>
          {/* STATUS QUO guidance, working-set terms per Jordan: the stored
              record is an est-1RM, so convert it back to a 10-rep working
              weight (÷ Epley factor 1.333) and suggest one plate-nudge up.
              No 1RM numbers shown anywhere. */}
          {(() => {
            let proven = null
            try { proven = getProvenBest(exerciseName) } catch (_) {}
            if (!proven) return <div className="mb-5" />
            const rec = Math.max(5, Math.round((proven / (1 + 10 / 30)) / 5) * 5)
            return (
              <div className="relative font-mono mb-5 text-center"
                style={{ fontSize: '0.6rem', letterSpacing: '0.22em', color: '#e4b022' }}>
                RECORD ≈ {rec}×10 · TRY {rec + 5}×10
              </div>
            )
          })()}

          {/* UP + FLAME */}
          <div className="relative flex flex-col items-center mb-2">
            <div className="pointer-events-none select-none"
              style={{
                height: '80px', width: '60px', position: 'relative',
                opacity: flameOpacity,
                transform: `scale(${flameScale})`, transformOrigin: 'center bottom',
                transition: 'transform 200ms ease-out, opacity 200ms ease-out',
                marginBottom: weight > 0 ? `${Math.min(weight * 0.12, 24)}px` : '0px',
              }}
              aria-hidden="true">
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 80% at 50% 90%, #ff6a00 0%, #ff2a00 40%, transparent 100%)', borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%', animation: 'flame-core 0.9s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-2 inset-y-0" style={{ background: 'radial-gradient(ellipse 50% 75% at 50% 90%, #ffd200 0%, #ff4500 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 55% 55% 45% 45%', animation: 'flame-mid 0.65s ease-in-out infinite', transformOrigin: 'center bottom' }} />
              <div className="absolute inset-x-4 top-0" style={{ height: '50%', background: 'radial-gradient(ellipse 40% 60% at 50% 90%, #fff7a0 0%, #ffe000 50%, transparent 100%)', borderRadius: '50% 50% 30% 30% / 60% 60% 40% 40%', animation: 'flame-tip 0.5s ease-in-out infinite', transformOrigin: 'center bottom' }} />
            </div>
            <button type="button"
              onPointerDown={() => { setPressUp(true); startHold('up') }}
              onPointerUp={() => { setPressUp(false); stopHold() }}
              onPointerCancel={() => { setPressUp(false); stopHold() }}
              onPointerLeave={() => { setPressUp(false); stopHold() }}
              onMouseEnter={() => play('button-hover')}
              className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ touchAction: 'manipulation' }}
              aria-label="Increase weight (hold for fast)">
              <div className="absolute inset-0 bg-gtl-red-deep" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', transform: pressUp ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
              <div className="relative px-10 py-3" style={{ clipPath: 'polygon(12% 0%, 88% 0%, 100% 100%, 0% 100%)', background: pressUp ? '#ff2a36' : '#d4181f', transform: pressUp ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}>
                <div className="font-display text-gtl-paper leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>▲</div>
              </div>
            </button>
          </div>

          {/* Number */}
          <div key={numKey} className="relative font-display leading-none my-2"
            style={{
              fontSize: 'clamp(6rem, 16vw, 12rem)',
              color: weight > 0 ? '#e4b022' : '#c8c8c8',
              textShadow: weight > 0 ? '5px 5px 0 #8a6612, 10px 10px 0 #070708' : '4px 4px 0 #070708',
              lineHeight: '1',
              animation: numKey > 0 ? `${numDir === 'up' ? 'num-up' : 'num-down'} 300ms ease-out forwards` : 'none',
            }}>
            {weight}
          </div>
          <div className="relative font-mono text-[11px] tracking-[0.5em] uppercase text-gtl-smoke/60 mb-2">LBS</div>

          {/* DOWN */}
          <button type="button"
            onPointerDown={() => { if (weight === 0) return; setPressDown(true); startHold('down') }}
            onPointerUp={() => { setPressDown(false); stopHold() }}
            onPointerCancel={() => { setPressDown(false); stopHold() }}
            onPointerLeave={() => { setPressDown(false); stopHold() }}
            onMouseEnter={() => weight > 0 && play('button-hover')}
            className="relative cursor-pointer select-none outline-none mt-2 focus-visible:outline-2 focus-visible:outline-gtl-red"
            style={{ touchAction: 'manipulation' }}
            aria-label="Decrease weight (hold for fast)" disabled={weight === 0}>
            <div className="absolute inset-0" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: weight === 0 ? '#1a1a1e' : '#8a0e13', transform: pressDown ? 'translate(0,0)' : 'translate(4px, 4px)', transition: 'transform 60ms ease-out' }} aria-hidden="true" />
            <div className="relative px-10 py-3" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 88% 100%, 12% 100%)', background: weight === 0 ? '#1a1a1e' : pressDown ? '#ff2a36' : '#d4181f', transform: pressDown ? 'translate(4px, 4px)' : 'translate(0,0)', transition: 'transform 60ms ease-out, background 60ms' }}>
              <div className="font-display leading-none" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: weight === 0 ? '#3a3a42' : '#ffffff' }}>▼</div>
            </div>
          </button>

          {/* SET WEIGHT */}
          <div className="relative w-full mt-8">
            {weight > 0 && (
              <div className="absolute -inset-1 pointer-events-none"
                style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)', animation: 'set-reps-glow 1.8s ease-in-out infinite' }}
                aria-hidden="true" />
            )}
            <button type="button"
              onMouseDown={() => setSetPressed(true)}
              onMouseUp={() => { setSetPressed(false); handleSetWeight() }}
              onMouseLeave={() => setSetPressed(false)}
              onMouseEnter={() => play('button-hover')}
              className="relative w-full cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ transform: 'rotate(-1deg)' }}>
              <div className="absolute inset-0 bg-gtl-red-deep" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', transform: setPressed ? 'translate(0,0)' : 'translate(8px, 8px)', transition: 'transform 80ms ease-out' }} aria-hidden="true" />
              <div className="relative flex items-center justify-between px-8 py-5"
                style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)', background: setPressed ? '#ff2a36' : weight > 0 ? '#d4181f' : '#3a1014', transform: setPressed ? 'translate(8px, 8px)' : 'translate(0,0)', transition: 'transform 80ms ease-out, background 100ms' }}>
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

        </div>{/* card */}
        </div>{/* animation wrapper */}
      </div>{/* positioning wrapper */}
    </>
  )
}

/* ── Individual set chip inside an exercise row ── */
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
      aria-label={`${hasData ? 'Edit' : 'Log'} set ${setIndex + 1}${set.weight > 0 ? ` (${set.weight}lbs` : ''}${set.reps > 0 ? ` × ${set.reps})` : set.weight > 0 ? ')' : ''}`}
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
              <span className="font-display leading-none"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8', textShadow: '1px 1px 0 #8a0e13' }}>
                {set.weight}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>lb</span>
              </span>
            )}
            {set.weight > 0 && set.reps > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.5)' }}>×</span>
            )}
            {set.reps > 0 && (
              <span className="font-display leading-none"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8', textShadow: '1px 1px 0 #8a0e13' }}>
                {set.reps}
              </span>
            )}
          </div>
        ) : hasGhost ? (
          <div className="flex items-baseline gap-1" style={{ opacity: 0.35 }}>
            {ghostSet.weight > 0 && (
              <span className="font-display leading-none"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8' }}>
                {ghostSet.weight}<span style={{ fontSize: '0.6em', opacity: 0.7 }}>lb</span>
              </span>
            )}
            {ghostSet.weight > 0 && ghostSet.reps > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'rgba(245,240,232,0.5)' }}>×</span>
            )}
            {ghostSet.reps > 0 && (
              <span className="font-display leading-none"
                style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#f5f0e8' }}>
                {ghostSet.reps}
              </span>
            )}
          </div>
        ) : (
          <span className="font-display leading-none" style={{ fontSize: '1.1rem', color: '#3a3a42' }}>—</span>
        )}
      </div>
    </button>
  )
}

/* ── Single exercise row — dynamic set chips + ADD SET ── */
function ExerciseRow({ name, index, sets, ghostSets, onOpen, onAddSet, onDeleteSet, onReplace }) {
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
        {/* Index number */}
        <span
          className="font-display shrink-0 leading-none"
          style={{
            fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
            color: selected ? '#ff2a36' : '#e4b022',
            textShadow: selected ? '2px 2px 0 #8a0e13' : '2px 2px 0 #8a6612',
            minWidth: '2.5rem',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Exercise name */}
        <span
          className="font-display leading-none flex-1"
          style={{
            fontSize: 'clamp(1.4rem, 3.5vw, 2.8rem)',
            color: selected ? '#ffffff' : '#c8c8c8',
            transform: index % 2 === 0 ? 'rotate(-0.3deg)' : 'rotate(0.2deg)',
          }}
        >
          {name}
        </span>

        {/* Set chips + ADD SET */}
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
            <div
              className="flex flex-col items-center px-3 py-2"
              style={{
                clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                background: '#0d0d10',
                border: '1px dashed #3a3a42',
                minWidth: '64px',
              }}
            >
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
              <div
                className="flex flex-col items-center px-3 py-2"
                style={{
                  clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                  background: '#0d0d10',
                  border: '1px dashed #3a1014',
                  minWidth: '64px',
                }}
              >
                <span className="font-display leading-none" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', color: '#8a0e13' }}>−</span>
                <span className="font-mono text-[7px] tracking-[0.3em] uppercase leading-none mt-0.5" style={{ color: '#8a0e13' }}>DEL SET</span>
              </div>
            </button>
          )}
          {onReplace && (
            <button
              type="button"
              onClick={() => { play('button-hover'); onReplace() }}
              onMouseEnter={() => play('button-hover')}
              className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red shrink-0"
            >
              <div
                className="flex flex-col items-center px-3 py-2"
                style={{
                  clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                  background: '#0d0d10',
                  border: '1px dashed #3a3a42',
                  minWidth: '64px',
                }}
              >
                <span className="font-display leading-none" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)', color: '#c8c8c8' }}>⇄</span>
                <span className="font-mono text-[7px] tracking-[0.3em] uppercase leading-none mt-0.5" style={{ color: '#c8c8c8' }}>REPLACE</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

/* ── Replace-exercise modal: scrollable list of exercises for this muscle ── */
function ReplaceExerciseModal({ muscleId, currentExerciseId, onPick, onClose }) {
  const options = useMemo(() => {
    return exercisesByMuscle(muscleId).slice().sort(byNotoriety)
  }, [muscleId])
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(7,7,8,0.85)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '80vh',
          background: '#0d0d10',
          border: '2px solid #d4181f',
          borderBottom: 'none',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #2a2a30',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.3em', color: '#c8c8c8' }}>REPLACE EXERCISE</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#c8c8c8', fontSize: '18px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {options.map((ex) => {
            const isCurrent = ex.id === currentExerciseId
            return (
              <button
                key={ex.id}
                type="button"
                disabled={isCurrent}
                onClick={() => onPick(ex.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #1a1a20',
                  background: isCurrent ? 'rgba(212,24,31,0.12)' : 'transparent',
                  color: isCurrent ? '#3a3a42' : '#e8e8e8',
                  fontFamily: 'var(--font-display, Anton, sans-serif)',
                  fontSize: '1rem',
                  cursor: isCurrent ? 'default' : 'pointer',
                }}
              >
                {ex.label}{isCurrent ? '  (current)' : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Stamped name input — mirrors the Name Your Cycle page style ── */
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

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

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
    <div
      className="flex-1 relative cursor-text select-none"
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={24}
        className="sr-only"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
      <div className="flex flex-wrap items-baseline gap-y-1 min-h-[3rem]" style={{ overflow: 'visible' }}>
        {value.split('').map((char, i) => (
          <span
            key={charKeysRef.current[i]}
            className="inline-block font-display leading-none animate-char-stamp text-gtl-chalk"
            style={{
              fontSize: 'clamp(1.8rem, 4vw, 3.2rem)',
              animationDelay: '0ms',
              transformOrigin: 'center center',
              position: 'relative', zIndex: 50,
            }}
          >
            {char === ' ' ? '\u00a0' : char}
          </span>
        ))}
        <span
          className="inline-block bg-gtl-red-bright animate-cursor-blink self-center"
          style={{ width: '3px', height: '2.4rem', marginLeft: '2px' }}
          aria-hidden="true"
        />
      </div>
      {value.length === 0 && (
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <span className="font-display text-gtl-smoke"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)' }}>
            NAME YOUR MOVE
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Exercise list panel — zooms from the tapped muscle slab ── */
function ExercisePanel({ muscleId, dayIso, originRect, onClose, cycleId, onAddMove }) {
  const { play } = useSound()
  const [closing, setClosing]           = useState(false)
  // Entrance skip — first tap snaps the panel zoom-in + cascade to settled.
  const [entranceSkipped, setEntranceSkipped] = useState(false)
  useEffect(() => {
    if (entranceSkipped || closing) return
    const handler = (e) => {
      if (e.target?.closest?.('[data-retreat]')) return
      setEntranceSkipped(true)
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [entranceSkipped, closing])
  const [reps, setReps]                 = useState({})
  const [weights, setWeights]           = useState({})
  const [setCounts, setSetCounts]       = useState({}) // exerciseName → number of sets (default 2)
  const [priorData, setPriorData]       = useState({}) // exerciseName → { weight: [], reps: [] } from prior days
  const [replaceTargetId, setReplaceTargetId] = useState(null) // exerciseId of chip being replaced
  // shaking — used to wobble the panel briefly on certain events.
  const [shaking, setShaking]             = useState(false)
  const [activeExercise, setActiveExercise] = useState(null)
  const [activeExerciseRect, setActiveExerciseRect] = useState(null)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [phase, setPhase]               = useState(null) // 'weight' | 'reps'
  // Read the attune-picked chips for this (cycle, day) via the React
  // subscription hook so the list re-renders when the in-the-moment
  // picker adds a chip mid-session. Filter to chips whose library
  // entry's primaryMuscles include the route's muscleId. Library-
  // unknown ids (custom typed names) pass through unfiltered.
  const dayChips = useChipsForDay(cycleId, dayIso)
  const exercises = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const chip of dayChips) {
      if (!chip?.exerciseId || seen.has(chip.exerciseId)) continue
      const ex = getExerciseById(chip.exerciseId)
      if (ex && !(ex.primaryMuscles || []).includes(muscleId)) continue
      seen.add(chip.exerciseId)
      out.push(chip.exerciseId)
    }
    return out
  }, [dayChips, muscleId])
  const label        = MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()
  const storageKey   = pk(`ex-${cycleId}-${dayIso}-${muscleId}`)
  const weightKey    = pk(`wt-${cycleId}-${dayIso}-${muscleId}`)
  const setCountKey  = pk(`setcounts-${muscleId}`)

  // Honed muscles (those checked on the targets/Goku page for this cycle)
  // default to 3 sets instead of 2.
  const defaultSetCount = useMemo(() => {
    if (typeof window === 'undefined') return 2
    try {
      const raw = localStorage.getItem(pk('cycles'))
      const cycles = raw ? JSON.parse(raw) : []
      const cycle = cycles.find((c) => c.id === cycleId)
      return (cycle?.targets || []).includes(muscleId) ? 3 : 2
    } catch (_) { return 2 }
  }, [cycleId, muscleId])

  const originX = originRect ? `${originRect.left + originRect.width / 2}px` : '50vw'
  const originY = originRect ? `${originRect.top + originRect.height / 2}px` : '50vh'

  // Load prior data for ghost display — reads the most recently saved session
  // for this muscle across any cycle, so predictions always reflect real history.
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

  // Find the last logged value for an exercise across all previous days (used by popups)
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

  // Load persisted reps, weights, and set counts on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setReps(JSON.parse(raw))
    } catch (_) {}
    try {
      const raw = localStorage.getItem(weightKey)
      if (raw) setWeights(JSON.parse(raw))
    } catch (_) {}
    try {
      const raw = localStorage.getItem(setCountKey)
      if (raw) setSetCounts(JSON.parse(raw))
    } catch (_) {}
  }, [storageKey, weightKey, setCountKey, muscleId])

  // R1a BW gate: when the user attempts to save a set on a bw_coefficient
  // exercise but pk('user-bodyweight') is unset, defer the save and mount
  // BodyweightModal. Modal is non-dismissible without a valid value;
  // on confirm we replay the deferred save.
  const [pendingBWGate, setPendingBWGate] = useState(null)

  // R18 cinematic state — set to {snapshot, tierName} when a set save
  // produces a new XP snapshot. Cleared on the cinematic's onComplete.
  const [activeCinematic, setActiveCinematic] = useState(null)

  // STATUS QUO banners: impossible-weight reject + TOO LIGHT nudge.
  // {kind: 'reject'|'light', text} — auto-clears. TOO LIGHT fires at
  // most once per exercise per visit (lightNudgedRef).
  const [sqBanner, setSqBanner] = useState(null)
  const sqBannerTimer = useRef(null)
  const lightNudgedRef = useRef(new Set())
  const showSqBanner = (kind, text, ms) => {
    setSqBanner({ kind, text })
    if (sqBannerTimer.current) clearTimeout(sqBannerTimer.current)
    sqBannerTimer.current = setTimeout(() => setSqBanner(null), ms)
  }

  const readBodyweight = () => {
    try {
      const n = parseInt(localStorage.getItem(pk('user-bodyweight')), 10)
      return Number.isFinite(n) ? n : null
    } catch (_) { return null }
  }

  // Impossible-weight gate: claim ≥ 2× the advanced standard is beyond
  // any recorded human — treat as a typo and refuse the save entirely.
  const isImpossible = (name, repsForSet, weightForSet) => {
    try {
      const exercise = getExerciseById(name)
      const bw = readBodyweight()
      if (!exercise || !bw) return false
      const a = assessSetForExercise(exercise, weightForSet || 0, repsForSet || 1, bw)
      if (a.kind === 'reject') {
        play('menu-close')
        showSqBanner('reject', 'IMPOSSIBLE WEIGHT — RE-ENTER', 2400)
        return true
      }
    } catch (_) {}
    return false
  }

  // Returns true and queues the save when BW is required but unset.
  const needsBWGate = (name) => {
    let bw = null
    try { bw = localStorage.getItem(pk('user-bodyweight')) } catch (_) {}
    if (bw != null && bw !== '') return false
    const ex = getExerciseById(name)
    return !!(ex && ex.equipment === 'bodyweight')
  }

  // Compute the snapshot for a set and upsert into the day's setLog.
  // Best-effort: snapshot computation is wrapped in try/catch so a missing
  // exercise lookup or numeric edge case never blocks the raw set save.
  // Re-edits replace the prior snapshot for (exerciseName, setIndex), so
  // computeTotalXP doesn't double-credit.
  const writeSnapshot = (name, repsForSet, weightForSet, setIndex) => {
    try {
      const exercise = getExerciseById(name)
      if (!exercise) return
      let bodyweight = null, sex = 'm'
      try {
        const rawBW = localStorage.getItem(pk('user-bodyweight'))
        const n = rawBW != null ? parseInt(rawBW, 10) : NaN
        if (Number.isFinite(n)) bodyweight = n
        sex = (localStorage.getItem(pk('user-sex')) === 'f') ? 'f' : 'm'
      } catch (_) {}
      // DOB is app-level (not profile-scoped) — see lib/userPrefs.js.
      const dob = getUserDOB()
      const tierMult     = getTierMultiplier(getTierCount())
      const prestigeMult = getPrestigeMultiplier(getRibbonCount())
      const holidayMult  = getHolidayMultiplier(new Date(), dob)

      // STATUS QUO assessment: CLIMB bonus / plausibility tax on the
      // multiplier stack, TOO LIGHT nudge (once per exercise per visit).
      // 'reject' can't reach here — saveReps/saveWeight gate it.
      const sq = assessSetForExercise(exercise, weightForSet || 0, repsForSet || 0, bodyweight)
      if (sq.light && !lightNudgedRef.current.has(name)) {
        lightNudgedRef.current.add(name)
        showSqBanner('light', "IS THAT ALL YOU'VE GOT?", 2000)
      }

      const snapshot = calculateSetXP(
        { reps: repsForSet || 0, weight: weightForSet || 0 },
        exercise,
        { bodyweight, sex },
        { tierMult, prestigeMult, holidayMult, statusQuoMult: sq.mult, statusQuoKind: sq.kind },
      )
      // Annotate so we can dedup re-edits.
      snapshot.exerciseName = name
      snapshot.setIndex     = setIndex

      // R12/R12b/R13 region stars: idempotent delta. Re-edits of a set
      // shouldn't double-credit stars. Read prior snapshot for the same
      // (exerciseName, setIndex), subtract its regionStars, add the new
      // ones. Net: only the change since last save lands in the store.
      const prior = readSetLogForDay(cycleId, dayIso).find(e =>
        e?.type === 'set' &&
        e?.exerciseName === name &&
        e?.setIndex === setIndex,
      )
      const priorStars = Array.isArray(prior?.regionStars) ? prior.regionStars : [0,0,0,0,0]
      const newStars   = Array.isArray(snapshot.regionStars) ? snapshot.regionStars : [0,0,0,0,0]
      const delta = newStars.map((v, i) => v - (priorStars[i] || 0))
      const hasChange = delta.some(d => d !== 0)
      if (hasChange) addRegionStars(delta)

      upsertSetSnapshot(cycleId, dayIso, snapshot)

      // R18 cinematic: present the snapshot stack to the user. tierName
      // is captured here at save time so a later tier-cross via
      // handleStamp doesn't relabel the line. Re-edits also re-trigger
      // (the user re-saved, they should see the updated math).
      const tierName = getTier(getTierCount())
      setActiveCinematic({ snapshot, tierName })
    } catch (_) {}
  }

  const saveReps = (name, value, setIndex) => {
    if (needsBWGate(name)) {
      setPendingBWGate({ kind: 'reps', name, value, setIndex })
      return
    }
    {
      const wArr = weights[name]
      const w = Array.isArray(wArr) ? wArr[setIndex] : 0
      if (value > 0 && isImpossible(name, value, w || 0)) return
    }
    setReps((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      const next = { ...prev, [name]: arr }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        localStorage.setItem(pk(`latest-ex-${muscleId}`), JSON.stringify(next))
      } catch (_) {}
      // Compute snapshot using the new reps value + current weight for the
      // same set. value === 0 is a clear/undo; only write a snapshot when
      // the set has positive reps.
      if (value > 0) {
        const wArr = weights[name]
        const w = Array.isArray(wArr) ? wArr[setIndex] : 0
        writeSnapshot(name, value, w || 0, setIndex)
      }
      return next
    })
  }

  const saveWeight = (name, value, setIndex) => {
    if (needsBWGate(name)) {
      setPendingBWGate({ kind: 'weight', name, value, setIndex })
      return
    }
    {
      const rArr = reps[name]
      const r = Array.isArray(rArr) ? rArr[setIndex] : 0
      if ((value || 0) > 0 && isImpossible(name, r || 1, value)) return
    }
    setWeights((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      const next = { ...prev, [name]: arr }
      try {
        localStorage.setItem(weightKey, JSON.stringify(next))
        localStorage.setItem(pk(`latest-wt-${muscleId}`), JSON.stringify(next))
      } catch (_) {}
      // Snapshot only fires when reps for this set are already positive
      // (a weight without reps doesn't earn XP).
      const rArr = reps[name]
      const r = Array.isArray(rArr) ? rArr[setIndex] : 0
      if ((r || 0) > 0) writeSnapshot(name, r, value || 0, setIndex)
      return next
    })
  }

  // BW captured → replay the deferred save with BW now set.
  const handleBodyweightSaved = () => {
    const pending = pendingBWGate
    setPendingBWGate(null)
    if (!pending) return
    if (pending.kind === 'reps') {
      saveReps(pending.name, pending.value, pending.setIndex)
    } else {
      saveWeight(pending.name, pending.value, pending.setIndex)
    }
  }

  const openExercise = (name, rect, setIndex) => {
    play('option-select')
    setActiveExercise(name)
    setActiveExerciseRect(rect)
    setActiveSetIndex(setIndex)
    setPhase('weight')
  }

  // Quick-nav: when the muscle's panel opens, jump straight into entering the
  // first set's weight for the first exercise. Continues the tap-tap-tap chain
  // (chip → LOAD → ACTIVATE → TODAY → BEGIN HERE muscle → here, weight popup).
  // Delayed so the panel's zoom-in animation gets to land first.
  useEffect(() => {
    if (!exercises.length) return
    const t = setTimeout(() => {
      setActiveExercise(exercises[0])
      setActiveExerciseRect(null)
      setActiveSetIndex(0)
      setPhase('weight')
    }, 450)
    return () => clearTimeout(t)
  // Mount-only auto-open; deliberately ignoring exercises identity churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closePopup = () => {
    setActiveExercise(null)
    setActiveExerciseRect(null)
    setPhase(null)
  }

  const handleClose = useCallback(() => {
    play('menu-close')
    setClosing(true)
  }, [play])

  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(onClose, 320)
    return () => clearTimeout(timer)
  }, [closing, onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  return (
    <>
    {/* Skip ExercisePanel entrance cascade on first tap. */}
    {entranceSkipped && !closing && (
      <style>{`
        [data-exercise-panel-skip-target], [data-exercise-panel-skip-target] * {
          animation-duration: 1ms !important;
          animation-delay: 0ms !important;
        }
      `}</style>
    )}
    <div
      data-exercise-panel-skip-target
      className="fixed inset-0 z-[9995] bg-gtl-void overflow-hidden"
      style={{
        transformOrigin: `${originX} ${originY}`,
        animation: closing
          ? 'day-focus-out 320ms cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'day-focus-in 380ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
      }}
    >
    <div className={`w-full h-full${shaking ? ' animate-screen-shake' : ''}`}>
      {/* Atmospherics */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.25) 0%, transparent 50%, rgba(74,10,14,0.35) 100%)' }} />

      {/* Muscle name watermark */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="font-display text-gtl-red leading-none"
          style={{
            fontSize: 'clamp(10rem, 22vw, 22rem)',
            opacity: 0.06,
            transform: 'rotate(8deg)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>

      {/* ExercisePanel back — fixed top-left, same anchor as RetreatButton +
          DayFocus back so navigating from active → day-focus → exercise-panel
          keeps the back button in the exact same on-screen position the whole
          way down (visual continuity across the whole nav stack). */}
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

      <div
        className="relative z-10 h-full flex flex-col px-10 pb-8 overflow-y-auto"
        style={{ animation: 'focus-content-in 280ms 250ms ease-out both', paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
      >
        {/* Muscle name header */}
        <div className="shrink-0 mb-2">
          <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red mb-3">
            EXERCISES / {label}
          </div>
          <div
            className="font-display text-gtl-chalk leading-none"
            style={{
              fontSize: 'clamp(4rem, 12vw, 10rem)',
              textShadow: '5px 5px 0 #070708',
              transform: 'rotate(-1.5deg)',
              transformOrigin: 'left center',
            }}
          >
            {label}
          </div>
        </div>

        {/* Red slash */}
        <div className="my-8 h-[3px] bg-gtl-red shrink-0"
             style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center', maxWidth: '700px' }} />

        {/* Logged count */}
        {Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length > 0 && (
          <div className="mb-4 shrink-0 font-mono text-[9px] tracking-[0.35em] uppercase text-gtl-red">
            {Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length} EXERCISE{Object.values(reps).filter(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0).length !== 1 ? 'S' : ''} LOGGED
          </div>
        )}

        {/* Exercise list */}
        <ol className="flex flex-col gap-0 shrink-0">
          {exercises.map((name, i) => (
            <ExerciseRow
              key={name}
              name={name}
              index={i}
              sets={Array.from({ length: setCounts[name] ?? defaultSetCount }, (_, si) => ({
                reps: (reps[name] || [])[si] ?? 0,
                weight: (weights[name] || [])[si] ?? 0,
              }))}
              ghostSets={Array.from({ length: setCounts[name] ?? defaultSetCount }, (_, si) => ({
                weight: (priorData[name]?.weight || [])[si] ?? 0,
                reps:   (priorData[name]?.reps   || [])[si] ?? 0,
              }))}
              onOpen={(rect, setIndex) => openExercise(name, rect, setIndex)}
              onAddSet={() => setSetCounts((prev) => {
                const next = { ...prev, [name]: (prev[name] ?? defaultSetCount) + 1 }
                try { localStorage.setItem(setCountKey, JSON.stringify(next)) } catch (_) {}
                return next
              })}
              onDeleteSet={() => {
                const current = setCounts[name] ?? defaultSetCount
                if (current <= 1) return
                const next = current - 1
                setSetCounts((prev) => {
                  const updated = { ...prev, [name]: next }
                  try { localStorage.setItem(setCountKey, JSON.stringify(updated)) } catch (_) {}
                  return updated
                })
                setReps((prev) => {
                  const arr = [...(prev[name] || [])].slice(0, next)
                  const updated = { ...prev, [name]: arr }
                  try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch (_) {}
                  return updated
                })
                setWeights((prev) => {
                  const arr = [...(prev[name] || [])].slice(0, next)
                  const updated = { ...prev, [name]: arr }
                  try { localStorage.setItem(weightKey, JSON.stringify(updated)) } catch (_) {}
                  return updated
                })
              }}
              onReplace={() => setReplaceTargetId(name)}
            />
          ))}

          {/* + ADD MOVE — opens the PickerSheet so the user can pick
              additional exercises mid-session. No more bespoke custom-
              move text input; the picker's own custom-exercise input
              handles user-typed names. */}
          <li style={{ listStyle: 'none', animation: 'focus-content-in 250ms 470ms ease-out both' }}>
            <button
              type="button"
              onClick={() => onAddMove && onAddMove()}
              className="flex items-center gap-4 py-4 border-b cursor-pointer w-full text-left"
              style={{ borderColor: 'rgba(58,58,66,0.3)', paddingLeft: '8px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(58,58,66,0.3)' }}
            >
              <span className="font-display shrink-0 leading-none"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', color: '#d4181f', textShadow: '2px 2px 0 #8a0e14', minWidth: '2.5rem' }}>
                +
              </span>
              <span className="font-display leading-none"
                style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2.8rem)', color: '#d4181f' }}>
                ADD MOVE
              </span>
            </button>
          </li>
        </ol>

        {/* Weight popup — opens first */}
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

        {/* Reps popup — opens after weight */}
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

        {/* Bottom breadcrumb */}
        <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke mt-10 shrink-0">
          PALACE / FITNESS / ACTIVE CYCLE / {label} / EXERCISES
        </div>
      </div>
    </div>
    </div>
    {pendingBWGate && <BodyweightModal onSaved={handleBodyweightSaved} />}
    {/* STATUS QUO banner — impossible-weight reject / TOO LIGHT nudge.
        z 9996: above the cinematic so a reject is readable mid-flow. */}
    {sqBanner && (
      <div
        className="fixed left-1/2 font-display uppercase px-6 py-2"
        style={{
          top: 'max(3.5rem, env(safe-area-inset-top))',
          zIndex: 9996,
          transform: 'translateX(-50%) rotate(-1.5deg)',
          background: sqBanner.kind === 'reject' ? '#d4181f' : '#1c1c1f',
          color: sqBanner.kind === 'reject' ? '#f4ede0' : '#8a8a92',
          border: sqBanner.kind === 'reject' ? 'none' : '1px solid #3a3a42',
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.55)',
          fontSize: '0.95rem',
          letterSpacing: '0.14em',
          whiteSpace: 'nowrap',
        }}
      >
        {sqBanner.text}
      </div>
    )}
    {activeCinematic && (
      <SetXPCinematic
        snapshot={activeCinematic.snapshot}
        tierName={activeCinematic.tierName}
        onComplete={() => setActiveCinematic(null)}
      />
    )}
    {replaceTargetId && (
      <ReplaceExerciseModal
        muscleId={muscleId}
        currentExerciseId={replaceTargetId}
        onClose={() => setReplaceTargetId(null)}
        onPick={(newExerciseId) => {
          const targetChip = (dayChips || []).find((c) => c.exerciseId === replaceTargetId)
          if (targetChip) {
            replaceExercise(cycleId, 'chip', {
              dayId: dayIso,
              chipId: targetChip.id,
              newExerciseId,
            })
          }
          setReplaceTargetId(null)
        }}
      />
    )}
    </>
  )
}

// DayFocus removed 2026-07-22 — dead copy from the route migration; the live DayFocus is in app/fitness/active/[iso]/page.js

function StatBlock({ number, label }) {
  return (
    <div className="flex flex-col items-start">
      <div
        className="font-display leading-none"
        style={{
          fontSize: 'clamp(2rem, 4vw, 3.5rem)',
          color: '#e4b022',
          textShadow: '3px 3px 0 #8a6612, 5px 5px 0 #070708',
        }}
      >
        {String(number).padStart(2, '0')}
      </div>
      <div className="font-mono text-[10px] tracking-[0.35em] uppercase text-gtl-ash mt-1">
        {label}
      </div>
    </div>
  )
}

function StatMini({ number, label }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-display leading-none" style={{ fontSize: '1.3rem', color: '#e4b022', textShadow: '1px 1px 0 #8a6612' }}>
        {String(number).padStart(2, '0')}
      </span>
      <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gtl-ash">{label}</span>
    </div>
  )
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

// Sums setLog snapshots when populated per day; falls back to legacy
// raw-reps recompute for days without snapshots.
function computeTotalXP() {
  return computeProfileTotalXP()
}

export default function ActiveMuscleExercisePage() {
  useProfileGuard()
  const params = useParams()
  const router = useRouter()
  const iso = decodeURIComponent(params.iso)
  const muscleId = decodeURIComponent(params.muscleId)

  const [cycleId, setCycleId]     = useState('')
  const [dailyPlan, setDailyPlan] = useState({})
  const [ready,   setReady]       = useState(false)

  // R17/R18 in-the-moment picker — moved here from the day route so the
  // day overview stays uncluttered. Auto-opens on mount when the day has
  // muscles assigned but zero attuned chips.
  const [pickerOpen, setPickerOpen]           = useState(false)
  const [pickerDismissed, setPickerDismissed] = useState(false)

  // Cycle id + daily plan loading. ExercisePanel does its own per-set
  // reps/weights reads internally. dailyPlan is needed for the picker.
  useEffect(() => {
    try {
      const cid  = localStorage.getItem(pk('active-cycle-id'))
      const rawP = localStorage.getItem(pk('daily-plan'))
      if (cid)  setCycleId(cid)
      if (rawP) setDailyPlan(JSON.parse(rawP))
    } catch (_) {}
    setReady(true)
  }, [])

  // Predictive-tap chain: this is the chain END. Terminal disarm — release
  // the transient HT state AND the prefire queue on arrival. Nothing
  // consumes past this page; the old guarded clear ("skip if consume owns
  // 'muscle'") left inAnim=true/currentStep='muscle' alive on this page and
  // on retreat back to [iso], because the [iso] hop's state matched the
  // guard's shape forever.
  useChainPage({ step: 'muscle', clearTag: 'muscle-terminal', terminal: true })

  // The picker is opened only when the user taps ADD MOVE — no
  // auto-open even on an empty-chip day. Empty days simply render
  // the set-log shell with just the + ADD MOVE row.

  if (!ready) return null

  const muscles = dailyPlan[iso] || []

  return (
    <>
      <ExercisePanel
        muscleId={muscleId}
        dayIso={iso}
        originRect={null}
        cycleId={cycleId}
        onClose={() => router.back()}
        onAddMove={() => { setPickerDismissed(false); setPickerOpen(true) }}
      />
      {pickerOpen && (
        <PickerSheet
          sourceDayId={iso}
          mode="in-the-moment"
          // Scope the picker to JUST the route's muscle. The user is
          // on /fitness/active/[iso]/[muscleId] — picking a back
          // exercise while on chest's set-log doesn't make sense, and
          // group titles (UPPER / LOWER / ARMS / FULL BODY) shouldn't
          // fire here. Passing [muscleId] gives a single-muscle picker.
          cycle={{ id: cycleId, dailyPlan: { [iso]: [muscleId] } }}
          onConfirm={(exerciseId) => {
            addChip(cycleId, iso, exerciseId)
            setPickerOpen(false)
          }}
          onClose={() => {
            setPickerDismissed(true)
            setPickerOpen(false)
          }}
        />
      )}
    </>
  )
}
