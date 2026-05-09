'use client'
/*
 * /fitness/active — The live cycle view.
 *
 * Shows the loaded cycle: name hero band, gold stats, and a grid of
 * day cards. Clicking a day triggers a camera-zoom transition: a fullscreen
 * panel expands from the card's position, taking over the entire viewport
 * and showing just that day's muscles. ESC or BACK collapses it.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSound } from '../../../lib/useSound'
import { useProfileGuard } from '../../../lib/useProfileGuard'
import { pk } from '../../../lib/storage'
import RetreatButton from '../../../components/RetreatButton'
import HeistTransition from '../../../components/HeistTransition'
import PickerSheet from '../../../components/attune/PickerSheet'
import { chipsForDay, addChip } from '../../../lib/attunement'
import {
  computeProfileTotalXP,
  dayXPWithFallback,
  computeDailyReckoning,
  replaceConsistencyCredit,
  tickTier,
  getTierCount,
  getTier,
} from '../../../lib/exp'
import { consumePrefire, setInAnimation, disarmChain, subscribeStaged } from '../../../lib/predictiveTap'
import TierUpFlourish from '../../../components/exp/TierUpFlourish'
// Day-hop and BEGIN HERE muscle-hop now navigate to /fitness/active/[iso]
// (Stage 1 of App Router refactor) so HeistTransition fires naturally and
// plays transition-slash — matching the sound profile of the chain's first
// three hops (profile → LOAD CYCLE → ACTIVATE).

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
      onClick={() => {
        // Predictive-tap chain step 4 — onClick stages the day hop. The
        // parent kicks off HeistTransition (transition-slash sound) and
        // pushes /fitness/active/[iso] on completion. No rect needed —
        // the new route mounts DayFocus full-screen, so no zoom-from-rect
        // animation. Card-confirm sound is replaced by HT's slash sound.
        onClick(iso)
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
    // Day-hop now goes via /fitness/active/[iso] — HT slash plays in the
    // parent on navigation. See DayButton for the same pattern.
    onClick(iso)
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
          <div className="relative font-display text-gtl-smoke leading-none mb-6 text-center"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', transform: 'rotate(0.4deg)' }}>
            {exerciseName}
          </div>

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
        </div>
      </div>
    </li>
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
function ExercisePanel({ muscleId, dayIso, originRect, onClose, cycleId }) {
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
  const [customName, setCustomName]       = useState('') // user-defined 5th exercise
  const [editingCustom, setEditingCustom] = useState(false)
  const [draftName, setDraftName]         = useState('')
  const [shaking, setShaking]             = useState(false)
  const [activeExercise, setActiveExercise] = useState(null)
  const [activeExerciseRect, setActiveExerciseRect] = useState(null)
  const [activeSetIndex, setActiveSetIndex] = useState(0)
  const [phase, setPhase]               = useState(null) // 'weight' | 'reps'
  const exercises    = EXERCISES[muscleId] || []
  const label        = MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()
  const storageKey   = pk(`ex-${cycleId}-${dayIso}-${muscleId}`)
  const weightKey    = pk(`wt-${cycleId}-${dayIso}-${muscleId}`)
  const setCountKey  = pk(`setcounts-${muscleId}`)

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
    try {
      const name = localStorage.getItem(pk(`custom-${muscleId}`))
      if (name) setCustomName(name)
    } catch (_) {}
  }, [storageKey, weightKey, setCountKey, muscleId])

  const saveReps = (name, value, setIndex) => {
    setReps((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      const next = { ...prev, [name]: arr }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        localStorage.setItem(pk(`latest-ex-${muscleId}`), JSON.stringify(next))
      } catch (_) {}
      return next
    })
  }

  const saveWeight = (name, value, setIndex) => {
    setWeights((prev) => {
      const arr = Array.isArray(prev[name]) ? [...prev[name]] : [0, 0]
      arr[setIndex] = value
      const next = { ...prev, [name]: arr }
      try {
        localStorage.setItem(weightKey, JSON.stringify(next))
        localStorage.setItem(pk(`latest-wt-${muscleId}`), JSON.stringify(next))
      } catch (_) {}
      return next
    })
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
                const next = { ...prev, [name]: (prev[name] ?? 2) + 1 }
                try { localStorage.setItem(setCountKey, JSON.stringify(next)) } catch (_) {}
                return next
              })}
              onDeleteSet={() => {
                const current = setCounts[name] ?? 2
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
            />
          ))}

          {/* Custom exercise slot */}
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
                onAddSet={() => setSetCounts((prev) => {
                  const next = { ...prev, [customName]: (prev[customName] ?? 2) + 1 }
                  try { localStorage.setItem(setCountKey, JSON.stringify(next)) } catch (_) {}
                  return next
                })}
                onDeleteSet={() => {
                  const current = setCounts[customName] ?? 2
                  if (current <= 1) return
                  const next = current - 1
                  setSetCounts((prev) => {
                    const updated = { ...prev, [customName]: next }
                    try { localStorage.setItem(setCountKey, JSON.stringify(updated)) } catch (_) {}
                    return updated
                  })
                  setReps((prev) => {
                    const arr = [...(prev[customName] || [])].slice(0, next)
                    const updated = { ...prev, [customName]: arr }
                    try { localStorage.setItem(storageKey, JSON.stringify(updated)) } catch (_) {}
                    return updated
                  })
                  setWeights((prev) => {
                    const arr = [...(prev[customName] || [])].slice(0, next)
                    const updated = { ...prev, [customName]: arr }
                    try { localStorage.setItem(weightKey, JSON.stringify(updated)) } catch (_) {}
                    return updated
                  })
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
                      try { localStorage.setItem(pk(`custom-${muscleId}`), val) } catch (_) {}
                    }
                    setEditingCustom(false)
                  }}
                  onCancel={() => setEditingCustom(false)}
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-4 py-4 border-b cursor-pointer"
                style={{ borderColor: 'rgba(58,58,66,0.3)', paddingLeft: '8px' }}
                onClick={() => { setDraftName(customName); setEditingCustom(true) }}
              >
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
              <button
                type="button"
                onClick={() => { setDraftName(customName); setEditingCustom(true) }}
                className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-smoke hover:text-gtl-red transition-colors mt-1 ml-2"
              >
                ✎ RENAME
              </button>
            )}
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
    </>
  )
}

/* ── Full-screen day focus — zooms in from the card's position ── */
function DayFocus({ iso, muscles, isLastDay, originRect, onClose, cycleId }) {
  const { play } = useSound()
  const [closing, setClosing]           = useState(false)
  const [focusMuscle, setFocusMuscle]   = useState(null)
  const [focusMuscleRect, setFocusMuscleRect] = useState(null)
  // R17/R18 — empty-day picker. When the user lands on a workout day with
  // zero attuned chips AND at least one assigned muscle, surface the
  // in-the-moment picker so they can pick an exercise on the spot. If the
  // day has no muscles, fall through to the existing empty-state UI (don't
  // open). If the user dismisses without picking, don't re-summon on the
  // same visit (component-local flag); navigating away + back gets a fresh
  // re-evaluation since DayFocus remounts.
  const [pickerOpen, setPickerOpen]           = useState(false)
  const [pickerDismissed, setPickerDismissed] = useState(false)
  // Entrance skip: first pointerdown/touchstart anywhere during the open
  // animation snaps the day-focus + all child animations to settled state.
  // The injected <style> block re-targets every running animation on the
  // panel to 1ms duration / 0ms delay via a scoped attribute selector.
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
  const date    = parseDate(iso)
  const dayName = DAY_FULL[date.getDay()]
  const dayNum  = date.getDate()
  const month   = MONTH_FULL[date.getMonth()]
  const year    = date.getFullYear()
  const hasWork = muscles.length > 0

  // R17/R18 mount-check: open the in-the-moment picker if this day has
  // muscles assigned but no chips attuned yet. Skipped if the user
  // already dismissed the picker on this visit, or if the day has no
  // muscles (fall back to existing empty-state UI), or if chips already
  // exist for this day.
  useEffect(() => {
    if (pickerDismissed) return
    if (!hasWork) return
    if (chipsForDay(cycleId, iso).length > 0) return
    setPickerOpen(true)
  }, [cycleId, iso, hasWork, pickerDismissed])

  // Predictive-tap chain — final hop. The 'muscle' intent gets staged
  // DURING the day-focus zoom-in animation, which begins as DayFocus
  // mounts. So the user's hit-zone tap usually lands AFTER this
  // component is already on screen. Try consume immediately (in case
  // the intent was already staged) AND subscribe to staging events so
  // a tap mid-animation re-attempts consume.
  useEffect(() => {
    if (!hasWork) return
    if (focusMuscle) return
    const tryConsume = () => {
      if (focusMuscle) return
      const intent = consumePrefire('muscle')
      if (intent && muscles[0]) {
        play('card-confirm')
        setFocusMuscle(muscles[0])
        disarmChain('muscle-fired')
      }
    }
    tryConsume()
    return subscribeStaged((stepName) => {
      if (stepName === 'muscle') tryConsume()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWork, focusMuscle])

  const [allReps, setAllReps]       = useState({})
  const [allWeights, setAllWeights] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [unlogOpen, setUnlogOpen]   = useState(false)
  const [stamped, setStamped]       = useState(() => {
    try { return localStorage.getItem(pk(`done-${cycleId}-${iso}`)) === 'true' } catch { return false }
  })

  const handleClose = useCallback(() => {
    play('menu-close')
    setClosing(true)
    setTimeout(onClose, 350)
  }, [onClose, play])

  const stampCloseTimerRef = useRef(null)
  // `justStamped` only flips on this session's handleStamp call — separate
  // from `stamped` (which initializes true for already-completed days from
  // localStorage). Without this, the post-stamp skip listener would install
  // on mount for any already-done day and close DayFocus on the user's first
  // tap (e.g. tapping a muscle to open ExercisePanel).
  const [justStamped, setJustStamped] = useState(false)
  const handleStamp = () => {
    if (stamped) return
    play('option-select')
    try { localStorage.setItem(pk(`done-${cycleId}-${iso}`), 'true') } catch (_) {}
    // R8 / R8a + R7 trigger — same wiring as the canonical handleStamp at
    // /fitness/active/[iso]/page.js. See that file for full annotation.
    try {
      const reckoning = computeDailyReckoning(cycleId, iso, { [iso]: muscles })
      replaceConsistencyCredit(cycleId, iso, {
        type: 'consistency-credit',
        ts: Date.now(),
        value: reckoning.consistency_credit,
        completion_pct: reckoning.completion_pct,
        sets_planned: reckoning.sets_planned,
        sets_logged: reckoning.sets_logged,
      })
      if (reckoning.shouldTick) {
        const before = getTier(getTierCount())
        tickTier()
        const after = getTier(getTierCount())
        if (after !== before) {
          try {
            localStorage.setItem(pk('tier-cross-pending'), after)
            localStorage.setItem(pk('last-seen-tier'), after)
          } catch (_) {}
        }
      }
    } catch (_) {}
    setStamped(true)
    setJustStamped(true)
    stampCloseTimerRef.current = setTimeout(() => handleClose(), 900)
  }
  // Tap during THIS session's post-stamp 900ms wait → close immediately.
  useEffect(() => {
    if (!justStamped || closing) return
    const handler = () => {
      if (stampCloseTimerRef.current) clearTimeout(stampCloseTimerRef.current)
      handleClose()
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [justStamped, closing, handleClose])

  const handleUnlogMuscle = (muscleId) => {
    play('menu-close')
    try {
      localStorage.removeItem(pk(`ex-${cycleId}-${iso}-${muscleId}`))
      localStorage.removeItem(pk(`wt-${cycleId}-${iso}-${muscleId}`))
    } catch (_) {}
    setAllReps(prev  => { const n = { ...prev };  delete n[muscleId]; return n })
    setAllWeights(prev => { const n = { ...prev }; delete n[muscleId]; return n })
    setRefreshKey(k => k + 1)
  }

  // Load all exercise reps + weights for this day's muscles from localStorage
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
  }, [iso, muscles, refreshKey])

  // Compute transform-origin from the card rect (center of the clicked card)
  const originX = originRect
    ? `${originRect.left + originRect.width / 2}px`
    : '50vw'
  const originY = originRect
    ? `${originRect.top + originRect.height / 2}px`
    : '50vh'

  // Deep-launch: continue the auto-progression chain from /fitness/load ACTIVATE.
  // After zoom-in lands, auto-open the first muscle's exercise panel — which
  // in turn auto-opens the first set's weight popup. Flag is cleared INSIDE the
  // timer callback (after success) so React StrictMode's mount/unmount/remount
  // doesn't consume the flag before the timer can fire.
  useEffect(() => {
    if (!hasWork) return
    let isDeepLaunch = false
    try { isDeepLaunch = localStorage.getItem('gtl-deep-launch') === '1' } catch (_) {}
    if (!isDeepLaunch) return
    const t = setTimeout(() => {
      try { localStorage.removeItem('gtl-deep-launch') } catch (_) {}
      setFocusMuscle(muscles[0])
      setFocusMuscleRect(null)
    }, 500)
    return () => clearTimeout(t)
  // Mount-only auto-progress.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lock body scroll while open
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

  // ESC to close
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
          0%   { transform: translateY(20px); }
          100% { transform: translateY(0); }
        }
        @keyframes stamp-slam {
          0%   { transform: scale(3) rotate(-8deg); opacity: 0; }
          25%  { opacity: 1; }
          55%  { transform: scale(0.93) rotate(-6deg); }
          70%  { transform: scale(1.04) rotate(-5.5deg); }
          85%  { transform: scale(0.98) rotate(-6deg); }
          100% { transform: scale(1) rotate(-6deg); opacity: 1; }
        }
        @keyframes slab-in {
          0%   { transform: translateY(20px) rotate(var(--slab-rot, 0deg)); }
          100% { transform: translateY(0) rotate(var(--slab-rot, 0deg)); }
        }
        @keyframes activate-popup-rise {
          0%   { opacity: 0; transform: translateY(60px) scale(0.96); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      {/* When the user taps to skip the entrance, this stylesheet collapses
          every running animation inside the day-focus panel to ~instant so
          everything snaps to its settled state. Targeted at the wrapper via
          data-day-focus-skip-target so it only affects this tree. */}
      {entranceSkipped && (
        <style>{`
          [data-day-focus-skip-target], [data-day-focus-skip-target] * {
            animation-duration: 1ms !important;
            animation-delay: 0ms !important;
          }
        `}</style>
      )}
      <div
        data-day-focus-skip-target
        className="fixed inset-0 z-[9990] bg-gtl-void overflow-hidden"
        style={{
          transformOrigin: `${originX} ${originY}`,
          animation: closing
            ? 'day-focus-out 350ms cubic-bezier(0.4, 0, 1, 1) forwards'
            : 'day-focus-in 420ms cubic-bezier(0.0, 0.0, 0.2, 1) forwards',
        }}
      >
        {/* Atmospherics */}
        <div className="absolute inset-0 gtl-noise pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.22) 0%, transparent 50%, rgba(74,10,14,0.32) 100%)' }} />

        {/* Giant day name watermark */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="font-display text-gtl-red leading-none"
            style={{
              fontSize: 'clamp(12rem, 28vw, 26rem)',
              opacity: 0.06,
              transform: 'rotate(-8deg)',
              whiteSpace: 'nowrap',
            }}
          >
            {dayName}
          </div>
        </div>

        {/* Content — delayed fade in after zoom lands */}
        <div
          className="relative z-10 h-full flex flex-col px-10 pb-8 overflow-hidden"
          style={{ animation: 'focus-content-in 300ms 280ms ease-out both', paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
        >
          {/* X stamp overlay — inside content div so it can't escape overflow bounds */}
          {stamped && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              style={{ zIndex: 0 }}
            >
              <div
                className="font-display leading-none pointer-events-none"
                style={{
                  fontSize: 'clamp(40vw, 60vw, 90vh)',
                  color: 'rgba(212,24,31,0.18)',
                  textShadow: '0 0 80px rgba(212,24,31,0.12)',
                  transform: 'rotate(-6deg)',
                  animation: 'stamp-slam 500ms cubic-bezier(0.2, 0, 0.4, 1) both',
                  lineHeight: 1,
                  letterSpacing: '-0.05em',
                }}
              >
                X
              </div>
            </div>
          )}

          {/* Day-focus back — fixed top-left, same anchor as RetreatButton on
              every other page (fixed left-0 + safe-area-inset-top + scale-95
              origin-left + px-3 py-3). */}
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
            {/* UNLOG SETS — only when sets are logged and day not stamped */}
            {!stamped && Object.keys(allReps).some(m => Object.values(allReps[m] || {}).flat().some(v => v > 0)) && (
              <div className="flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => { play('button-hover'); setUnlogOpen(o => !o) }}
                  className="group relative inline-flex items-center outline-none focus-visible:outline-2 focus-visible:outline-gtl-red"
                >
                  <div
                    className="absolute inset-0 -inset-x-2 transition-all duration-300"
                    style={{
                      clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
                      background: unlogOpen ? '#d4181f' : '#1a1a1e',
                      border: `1px solid ${unlogOpen ? '#ff2a36' : '#3a3a42'}`,
                    }}
                    aria-hidden="true"
                  />
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
                              style={{
                                fontSize: '13px',
                                background: '#7a0e14',
                                clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                                padding: '4px 14px',
                                letterSpacing: '0.08em',
                              }}>
                              {MUSCLE_LABELS[muscleId] || muscleId}
                            </span>
                            <span className="font-display text-lg leading-none text-gtl-red whitespace-nowrap">
                              {setCount} SET{setCount !== 1 ? 'S' : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlogMuscle(muscleId)}
                            className="group relative inline-flex items-center outline-none"
                          >
                            <div
                              className="absolute inset-0 -inset-x-1 bg-gtl-red/20 group-hover:bg-gtl-red transition-colors duration-150"
                              style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}
                              aria-hidden="true"
                            />
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
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-5 py-2" style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}>

            {/* Compact date header */}
            <div>
              <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red/60 mb-1">
                {month} · {year}
              </div>
              <div className="flex items-baseline gap-4">
                <div
                  className="font-display text-gtl-chalk leading-none"
                  style={{
                    fontSize: 'clamp(3.5rem, 12vw, 7rem)',
                    textShadow: '4px 4px 0 #070708, 8px 8px 0 rgba(0,0,0,0.4)',
                    lineHeight: '0.85',
                  }}
                >
                  {String(dayNum).padStart(2, '0')}
                </div>
                <div
                  className="font-display text-gtl-red leading-none"
                  style={{
                    fontSize: 'clamp(1.5rem, 5vw, 3rem)',
                    textShadow: '2px 2px 0 #070708',
                    transform: 'rotate(-1deg)',
                  }}
                >
                  {dayName}
                </div>
              </div>
            </div>

            {/* Red slash divider */}
            <div
              className="h-[3px] bg-gtl-red shrink-0"
              style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center' }}
            />

            {/* Muscle slabs or REST. muscles[0] is rendered separately as the
                BEGIN HERE quick-nav hero at y=466, so skip index 0 here. */}
            {hasWork ? (
              <div className="flex flex-wrap gap-x-4 gap-y-3">
                {muscles.slice(1).map((id, i) => {
                  const rot = SLAB_ROTATIONS[i % SLAB_ROTATIONS.length]
                  return (
                    <MuscleSlab
                      key={id}
                      id={id}
                      rot={rot}
                      delay={320 + i * 60}
                      onClick={(rect) => { console.log('[GTL] slab clicked:', id, 'focusMuscle before:', focusMuscle); play('card-confirm'); setFocusMuscle(id); setFocusMuscleRect(rect) }}
                    />
                  )
                })}
              </div>
            ) : (
              <div
                className="font-display text-gtl-smoke leading-none"
                style={{ fontSize: 'clamp(3rem, 7vw, 6rem)', transform: 'rotate(-1deg)' }}
              >
                REST DAY
              </div>
            )}

            {/* Exercise log — full width, one block per muscle group */}
            {hasWork && (
              <div style={{ animation: 'focus-content-in 350ms 400ms ease-out both' }}>
                {muscles.every(id => !Object.values(allReps[id] || {}).some(v => Array.isArray(v) ? v.some(r => r > 0) : v > 0)) ? (
                  <div style={{ transform: 'rotate(-1deg)' }}>
                    <div
                      className="font-display text-gtl-smoke/20 leading-none"
                      style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', textShadow: '3px 3px 0 #070708' }}
                    >
                      NO REPS
                    </div>
                    <div
                      className="font-display text-gtl-smoke/10 leading-none"
                      style={{ fontSize: 'clamp(1rem, 2vw, 1.6rem)', marginTop: '0.4em' }}
                    >
                      SET LOGGED YET
                    </div>
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
                        <div
                          key={muscleId}
                          style={{ animation: `focus-content-in 300ms ${si * 90}ms ease-out both` }}
                        >
                          {/* Muscle name slab — clickable, reopens ExercisePanel */}
                          <div style={{ display: 'block', marginBottom: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                play('card-confirm')
                                setFocusMuscle(muscleId)
                                setFocusMuscleRect(rect)
                              }}
                              style={{
                                display: 'inline-flex',
                                position: 'relative',
                                transform: `rotate(${rot})`,
                                transformOrigin: 'left center',
                                cursor: 'pointer',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                              }}
                            >
                              <div
                                style={{
                                  position: 'absolute', inset: 0,
                                  background: '#8a0e13',
                                  clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                                  transform: 'translate(4px,4px)',
                                }}
                                aria-hidden="true"
                              />
                              <div
                                style={{
                                  position: 'relative',
                                  padding: '2px 16px',
                                  background: '#d4181f',
                                  clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                                }}
                              >
                                <span
                                  className="font-display text-gtl-paper leading-none whitespace-nowrap"
                                  style={{ fontSize: 'clamp(0.85rem, 1.8vw, 1.3rem)' }}
                                >
                                  {MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()}
                                </span>
                              </div>
                            </button>
                          </div>

                          {/* Exercise entries */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: '0.4rem 1.5rem' }}>
                            {logged.map(([name, repsVal], ei) => {
                              const wVal = (allWeights[muscleId] || {})[name]
                              const allSets = Array.isArray(repsVal)
                                ? repsVal.map((r, i) => ({ reps: r, weight: Array.isArray(wVal) ? (wVal[i] ?? 0) : (i === 0 ? (wVal ?? 0) : 0) }))
                                : [{ reps: repsVal, weight: wVal ?? 0 }, { reps: 0, weight: 0 }]
                              return (
                                <div
                                  key={name}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '0.15rem',
                                    animation: `focus-content-in 220ms ${si * 90 + ei * 50 + 80}ms ease-out both`,
                                    transform: ei % 2 === 0 ? 'rotate(-0.4deg)' : 'rotate(0.3deg)',
                                    transformOrigin: 'left center',
                                  }}
                                >
                                  <div className="font-display text-gtl-chalk leading-none"
                                    style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
                                    {name}
                                  </div>
                                  {allSets.map((s, si) => {
                                    if (si === 1 && s.reps === 0) return null
                                    return (
                                      <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="font-display leading-none shrink-0"
                                          style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.9rem)', color: '#d4181f', minWidth: '2rem' }}>
                                          {si === 0 ? '1ST' : '2ND'}
                                        </span>
                                        <div className="font-display leading-none shrink-0"
                                          style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)', color: '#e4b022', textShadow: '2px 2px 0 #8a6612, 4px 4px 0 #070708' }}>
                                          {s.reps > 0 ? `${s.reps}×` : '—'}
                                        </div>
                                        {s.weight > 0 && (
                                          <div className="font-display leading-none"
                                            style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.3rem)', color: '#e4b022', opacity: 0.85 }}>
                                            {s.weight}<span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: '0.15em' }}>lbs</span>
                                          </div>
                                        )}
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

          {/* Bottom row: breadcrumb + stamp button */}
          <div className="mt-auto pt-6 flex items-end justify-between gap-4" style={{ position: 'relative', zIndex: 10 }}>
            <div>
              <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
                PALACE / FITNESS / ACTIVE CYCLE / {dayName}
              </div>
            </div>

            {/* BRING ON TOMORROW button */}
            <button
              type="button"
              onClick={handleStamp}
              disabled={stamped}
              className="group relative inline-flex items-center shrink-0 outline-none
                focus-visible:outline-2 focus-visible:outline-gtl-red"
              style={{ opacity: stamped ? 0.4 : 1, transition: 'opacity 200ms' }}
            >
              <div
                className="absolute inset-0 -inset-x-2 transition-all duration-300"
                style={{
                  clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
                  background: stamped ? '#3a3a42' : '#d4181f',
                  boxShadow: stamped ? 'none' : '0 0 24px rgba(212,24,31,0.5)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3 px-6 py-3">
                <span
                  className="font-display leading-none"
                  style={{ fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', color: '#f5f0e8', textShadow: '2px 2px 0 #070708' }}
                >
                  {stamped ? 'TOMORROW WILL COME' : isLastDay ? 'ASCEND TO THE NEXT LEVEL' : 'BRING ON TOMORROW'}
                </span>
                {!stamped && (
                  <span className="font-display text-gtl-paper leading-none" style={{ fontSize: '1.2rem' }}>▶︎</span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Quick-nav BEGIN HERE muscle — chain step 5. Same canonical
            geometry as ProfileChip / ActivatePopup so the predictive-tap
            chain can use one shared hit-zone (px-24 py-5 min-h-[56px],
            polygon(3%/97%) clipPath, 4px offset corner shadow, text-3xl).
            Hidden once a muscle is focused (so it doesn't overlay the
            next zoom). */}
        {hasWork && !focusMuscle && (
          <button
            type="button"
            data-predictive-tap-target="muscle"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              // BEGIN HERE muscle is chain step 5 — committal sound to
              // match ACTIVATE (chain step 3) and TODAY (chain step 4).
              play('card-confirm')
              setFocusMuscle(muscles[0])
              setFocusMuscleRect(rect)
              // Chain ends here — disarm so subsequent taps (like a
              // non-today day card) don't accidentally stage 'muscle'
              // because currentStep got stuck at 'today' from this run.
              // User re-arms by tapping a profile chip on /fitness.
              disarmChain('muscle-fired')
            }}
            className={`
              fixed z-[9991] flex items-center justify-center
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
              top: '466px',
              left: '12px',
              right: '12px',
              clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
              animation: 'activate-popup-rise 320ms cubic-bezier(0.18, 1, 0.36, 1) 380ms both',
            }}
          >
            <span className="relative inline-block leading-none tracking-tight">
              {MUSCLE_LABELS[muscles[0]] || muscles[0].toUpperCase()}
            </span>
          </button>
        )}

        {/* Exercise panel — zooms from the tapped muscle slab */}
        {focusMuscle && (
          <ExercisePanel
            key={focusMuscle}
            muscleId={focusMuscle}
            dayIso={iso}
            originRect={focusMuscleRect}
            cycleId={cycleId}
            onClose={() => { setFocusMuscle(null); setFocusMuscleRect(null); setRefreshKey(k => k + 1) }}
          />
        )}

        {/* R17/R18 — empty-day in-the-moment picker. Opens automatically on
            mount when the day has muscles assigned but zero attuned chips.
            Picking confirms a single chip via attunementStore.addChip and
            closes; dismissing without picking sets the visit-local flag so
            it doesn't re-summon. Read-only consumer of attunementStore +
            PickerSheet — neither module is modified here. */}
        {pickerOpen && (
          <PickerSheet
            sourceDayId={iso}
            mode="in-the-moment"
            cycle={{ id: cycleId, dailyPlan: { [iso]: muscles } }}
            onConfirm={(_targetDayIds, exerciseId) => {
              addChip(cycleId, iso, exerciseId)
              setPickerOpen(false)
            }}
            onClose={() => {
              setPickerDismissed(true)
              setPickerOpen(false)
            }}
          />
        )}
      </div>
    </>
  )
}

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

function getLevelInfo(totalXP) {
  let level = 0
  let xpUsed = 0
  while (true) {
    const threshold = 15000 + level * 1000
    if (xpUsed + threshold > totalXP) {
      return { level, progress: totalXP - xpUsed, threshold }
    }
    xpUsed += threshold
    level++
  }
}

// Sums setLog snapshots when populated per day; falls back to legacy
// raw-reps recompute for days without snapshots.
function computeTotalXP() {
  return computeProfileTotalXP()
}

export default function ActiveCyclePage() {
  useProfileGuard()
  const router = useRouter()
  const { play } = useSound()

  const [cycleId,    setCycleId]    = useState('')
  const [cycleName,  setCycleName]  = useState('ACTIVE CYCLE')
  const [targets,    setTargets]    = useState([])
  const [days,       setDays]       = useState([])
  const [dailyPlan,  setDailyPlan]  = useState({})
  const [ready,      setReady]      = useState(false)
  // Day-hop transition: holds the target ISO while HeistTransition runs.
  // null = idle. When set, <HeistTransition active onComplete=push> mounts;
  // on cover phase, router.push('/fitness/active/' + iso) navigates.
  const [fireDayHop, setFireDayHop] = useState(null)
  // Synchronous skip flag — first pointer/touch during the day-hop slash
  // routes immediately, mirroring the fast-forward behavior on /fitness/load.
  const fireDayHopRef = useRef(null)
  const skippedDayHopRef = useRef(false)
  // iOS-leaked-click eat stamp (150ms grace). Mirror pattern from
  // /fitness/hub and /fitness/load — onClick-sourced handleDayHop
  // calls within 150ms of mount are rejected. The consume's setTimeout
  // bypasses via { fromTimer: true }.
  const mountTimeRef = useRef(0)
  const [cardRefreshKey, setCardRefreshKey] = useState(0)
  const [completedDays, setCompletedDays]   = useState(0)
  const [barXP, setBarXP]                   = useState(0)
  const [allCyclesDays, setAllCyclesDays]   = useState(0)
  const [xpAnim, setXpAnim]                 = useState(null) // null | { phase, particles, total, barRect }
  const [levelUpAnim, setLevelUpAnim]       = useState(null) // null | { phase, newLevel, sparkles, barRect }
  const xpBarRef                            = useRef(null)
  const barXPRef                            = useRef(0)
  const rolodexRef                          = useRef(null)

  useEffect(() => { barXPRef.current = barXP }, [barXP])
  useEffect(() => { mountTimeRef.current = performance.now() }, [])

  // Predictive-tap chain: reset currentStep to 'activate' on every mount.
  // Handles back-and-forth navigation where stale currentStep from a
  // later hop (e.g., 'today' or 'muscle' from a prior round in DayFocus)
  // would cause a manual TODAY tap's pointerdown to stage the wrong
  // intent. With this reset, manual taps on /fitness/active always stage
  // the correct 'today' intent. No-op if chain isn't armed. The consume
  // useEffect's eager-inAnim later overrides currentStep to 'today' if
  // the prior hop's intent matched, which is correct.
  useEffect(() => {
    setInAnimation('activate', true)
  }, [])

  useEffect(() => {
    // Page-level scroll lock — prevents iOS PWA viewport-pan in any direction.
    // overflow alone isn't enough on WKWebView; position:fixed + inset:0 +
    // touch-action:none on the body makes the body a non-scrollable surface.
    // Children (the rolodex) opt back in via data-scroll-passthrough.
    const prevHtml = {
      overflow: document.documentElement.style.overflow,
    }
    const prevBody = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      inset: document.body.style.inset,
      width: document.body.style.width,
      height: document.body.style.height,
      touchAction: document.body.style.touchAction,
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.inset = '0'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    document.body.style.touchAction = 'none'
    return () => {
      document.documentElement.style.overflow = prevHtml.overflow
      document.body.style.overflow = prevBody.overflow
      document.body.style.position = prevBody.position
      document.body.style.inset = prevBody.inset
      document.body.style.width = prevBody.width
      document.body.style.height = prevBody.height
      document.body.style.touchAction = prevBody.touchAction
    }
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

  // ── Rolodex: scroll-driven prominence + auto-scroll today to y=479 ──
  // The "active line" matches the ACTIVATE button's exact top position
  // (top:479 on /fitness/load). Today's card lands in the same screen
  // slot ACTIVATE occupies — same x, same y, same width/height. Each
  // card carries --rolodex-t (1 at the active line, 0 at the edges).
  // Tracked by the card's TOP edge so prominence is stable across
  // varying card heights (TODAY card is taller than non-TODAY).
  const ACTIVE_TOP_Y = 479
  useEffect(() => {
    if (!ready) return
    const container = rolodexRef.current
    if (!container) return

    const update = () => {
      const cards = container.querySelectorAll('[data-rolodex-iso]')
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect()
        // Distance from the card's top edge to the active y=479 line.
        const dist = Math.abs(rect.top - ACTIVE_TOP_Y)
        // Tight falloff — within 4px of active line = full prominence,
        // 100px out = dim, beyond that pegged at zero. Sharp dropoff so
        // neighbor cards dim quickly and only ONE card reads as centered.
        const t = Math.max(0, Math.min(1, 1 - Math.max(0, dist - 4) / 96))
        card.style.setProperty('--rolodex-t', String(t))
        // Centered window is now ~6px wide (t >= 0.94 ≈ within 10px of
        // active line). No more ambiguous "two cards both highlighted".
        if (t >= 0.94) card.setAttribute('data-rolodex-centered', '')
        else card.removeAttribute('data-rolodex-centered')
      })
    }
    // Snap-on-scroll-end: after the user stops scrolling, snap the
    // closest card precisely to y=479. Aggressive snap so the rolodex
    // never settles between cards. 80ms debounce — long enough for
    // momentum to subside, short enough to feel snappy.
    let snapTimer = null
    const snapToNearest = () => {
      const cards = container.querySelectorAll('[data-rolodex-iso]')
      let bestNode = null
      let bestDist = Infinity
      cards.forEach((card) => {
        const dist = Math.abs(card.getBoundingClientRect().top - ACTIVE_TOP_Y)
        if (dist < bestDist) { bestDist = dist; bestNode = card }
      })
      if (!bestNode) return
      const delta = bestNode.getBoundingClientRect().top - ACTIVE_TOP_Y
      if (Math.abs(delta) < 1) return
      container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' })
    }
    const onScroll = () => {
      update()
      if (snapTimer) clearTimeout(snapTimer)
      snapTimer = setTimeout(snapToNearest, 80)
    }
    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => {
      container.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (snapTimer) clearTimeout(snapTimer)
    }
  }, [ready, days])

  useEffect(() => {
    // Re-center on every "page open" — initial mount, plus every remount
    // after a router.back() from /fitness/active/[iso]. The day-focus is
    // a separate route now, so we don't need to gate on a focusDay flag.
    if (!ready) return
    const container = rolodexRef.current
    if (!container || days.length === 0) return
    const todayD = new Date()
    const m = String(todayD.getMonth() + 1).padStart(2, '0')
    const dd = String(todayD.getDate()).padStart(2, '0')
    const todayStr = `${todayD.getFullYear()}-${m}-${dd}`
    const target = days.reduce((closest, iso) => {
      const dC = Math.abs(parseDate(closest) - parseDate(todayStr))
      const dI = Math.abs(parseDate(iso) - parseDate(todayStr))
      return dI < dC ? iso : closest
    }, days[0])
    // Land today's TOP edge at viewport y=479 — the same y ACTIVATE uses.
    // Direct scrollTop assignment instead of scrollBy: iOS PWA WebKit
    // intermittently no-ops scrollBy on a flex+overflow container, and
    // scrollTop= is the only reliable cross-engine path.
    // Retries on a short cadence cover the common iOS PWA case where the
    // first frame measures before paddingTop:60vh has laid out fully.
    let cancelled = false
    const place = () => {
      if (cancelled) return false
      const node = container.querySelector(`[data-rolodex-iso="${target}"]`)
      if (!node) return false
      const rect = node.getBoundingClientRect()
      const delta = rect.top - ACTIVE_TOP_Y
      if (Math.abs(delta) < 1) return true
      container.scrollTop = container.scrollTop + delta
      return true
    }
    const handles = []
    handles.push(requestAnimationFrame(() => {
      handles.push(requestAnimationFrame(place))
    }))
    handles.push(setTimeout(place, 60))
    handles.push(setTimeout(place, 160))
    handles.push(setTimeout(place, 320))
    return () => {
      cancelled = true
      handles.forEach(h => { try { cancelAnimationFrame(h) } catch (_) {} ; try { clearTimeout(h) } catch (_) {} })
    }
  }, [ready, days])

  useEffect(() => {
    if (!days.length) return
    let count = 0
    for (const iso of days) {
      try { if (localStorage.getItem(pk(`done-${cycleId}-${iso}`)) === 'true') count++ } catch (_) {}
    }
    setCompletedDays(count)
  }, [days, cardRefreshKey])

  // Deep-launch: when the user came from ACTIVATE on /fitness/load, skip the
  // schedule view and jump straight into today's day-focus route. DayFocus
  // then continues the auto-progression into ExercisePanel, which auto-opens
  // the first set's weight popup. The 'gtl-deep-launch' flag is consumed
  // inside DayFocus (so it survives the cross-page hop).
  useEffect(() => {
    if (!days.length) return
    let isDeepLaunch = false
    try { isDeepLaunch = localStorage.getItem('gtl-deep-launch') === '1' } catch (_) {}
    if (!isDeepLaunch) return
    const todayD = new Date()
    const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`
    const target = days.reduce((closest, iso) => {
      const dC = Math.abs(parseDate(closest) - parseDate(todayStr))
      const dI = Math.abs(parseDate(iso) - parseDate(todayStr))
      return dI < dC ? iso : closest
    }, days[0])
    const t = setTimeout(() => {
      router.push('/fitness/active/' + target)
    }, 100)
    return () => clearTimeout(t)
  }, [days, router])


  // Day-hop dispatch: fires HeistTransition then router.push to the day
  // route. Mirrors handleActivate on /fitness/load — synchronous skip flag
  // so a fast follow-up tap routes immediately rather than waiting for HT
  // to complete. setInAnimation('today', true) opens the chain window so a
  // predictive tap during the slash stages 'muscle' for DayFocus to consume
  // on mount.
  const handleDayHop = (iso, { fromTimer = false } = {}) => {
    // iOS-leaked-click eat — see mountTimeRef comment above.
    if (!fromTimer && performance.now() - mountTimeRef.current < 150) return
    if (skippedDayHopRef.current) return
    if (fireDayHopRef.current) {
      // Already firing → user wants to skip the slash. Route now.
      skippedDayHopRef.current = true
      router.push('/fitness/active/' + fireDayHopRef.current)
      return
    }
    fireDayHopRef.current = iso
    setInAnimation('today', true)
    setFireDayHop(iso)
  }

  // Skip-the-fire-transition: once the day-hop HT is running, the next
  // pointer/touch anywhere routes immediately. Mirrors the same listener
  // on /fitness/load (RetreatButton excluded so back-nav still works).
  // Guard with a 150ms grace window — iOS PWA can fire a follow-up
  // touchstart/pointerdown for the SAME physical tap that triggered the
  // hop, which would otherwise short-circuit HT before it renders.
  useEffect(() => {
    if (!fireDayHop) return
    const armedAt = performance.now()
    const handler = (e) => {
      if (performance.now() - armedAt < 150) return
      if (e.target?.closest?.('[data-retreat]')) return
      if (skippedDayHopRef.current) return
      skippedDayHopRef.current = true
      router.push('/fitness/active/' + fireDayHopRef.current)
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [fireDayHop, router])

  // Predictive-tap consume: when the page is ready, check for a 'today'
  // prefire intent staged on the prior page's HT (e.g., user tapped during
  // ACTIVATE's slash). If matched, auto-fire handleDayHop(target) as if the
  // user tapped the TODAY card. Falls back to the closest-day hero if
  // today isn't in the cycle's training days.
  useEffect(() => {
    if (!ready) return
    if (!days || days.length === 0) return
    if (fireDayHop) return
    const target = days.includes(todayIsoStr)
      ? todayIsoStr
      : days.reduce((closest, iso) => {
          const dC = Math.abs(parseDate(closest) - parseDate(todayIsoStr))
          const dI = Math.abs(parseDate(iso) - parseDate(todayIsoStr))
          return dI < dC ? iso : closest
        }, days[0])
    // Mount-time consume only — catches the cross-page hop where the
    // user predictive-tapped 'today' during the previous page's HT
    // (intent staged before this page mounted). Direct taps on the
    // TODAY card are handled by DayButton's onClick → handleDayHop.
    // No subscribeStaged or polling: those caught direct-tap pointerdowns
    // and double-fired with the click event for the same physical tap.
    const intent = consumePrefire('today')
    if (intent) {
      setInAnimation('today', true)
      setTimeout(() => handleDayHop(target, { fromTimer: true }), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, days, fireDayHop])

  const triggerXPAnimation = useCallback((closingDay) => {
    // Build particles: one per completed day, positioned at each card
    const sortedDays = [...days].sort()
    const particles = []
    let total = 0
    for (const iso of sortedDays) {
      try {
        if (localStorage.getItem(pk(`done-${cycleId}-${iso}`)) !== 'true') continue
        const el = document.querySelector(`[data-day-iso="${iso}"]`)
        const rect = el?.getBoundingClientRect()
        const dayVolume = dayXPWithFallback({ id: cycleId, dailyPlan }, iso)
        if (dayVolume > 0 && rect) {
          particles.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, value: dayVolume })
          total += dayVolume
        }
      } catch (_) {}
    }
    if (!total) return
    const levelBefore = getLevelInfo(barXPRef.current).level
    const barRect = xpBarRef.current?.getBoundingClientRect()
    setXpAnim({ phase: 'expand', particles, total, barRect })
    setTimeout(() => setXpAnim(p => p ? { ...p, phase: 'converge' } : null), 700)
    setTimeout(() => setXpAnim(p => p ? { ...p, phase: 'combine' } : null), 1500)
    setTimeout(() => setXpAnim(p => p ? { ...p, phase: 'fly' } : null), 2400)
    setTimeout(() => {
      setXpAnim(p => p ? { ...p, phase: 'fill' } : null)
      const newXP = computeTotalXP().xp
      const levelAfter = getLevelInfo(newXP).level
      setBarXP(newXP)
      if (levelAfter > levelBefore) {
        setTimeout(() => {
          const rect = xpBarRef.current?.getBoundingClientRect()
          const rnd = (a, b) => a + Math.random() * (b - a)
          const sparkles = Array.from({ length: 36 }, () => ({
            x: rnd(3, 97), y: rnd(5, 90),
            size: rnd(6, 22), delay: rnd(0, 900),
            rot: rnd(0, 45), color: Math.random() > 0.3 ? '#e4b022' : '#fff',
          }))
          // Continuous stream particles — staggered so they always appear to be flowing
          const streamParticles = Array.from({ length: 60 }, (_, i) => {
            const angle = rnd(-32, 32)
            const dist  = rnd(200, window.innerWidth - (rect?.right || 0) - 20)
            const size  = rnd(4, 18)
            const delay = rnd(0, 650) // spread across full shatter phase
            return { angle, dist, size, delay, i }
          })
          setLevelUpAnim({ phase: 'shatter', newLevel: levelAfter, sparkles, streamParticles, barRect: rect })
          play('stamp')
          setTimeout(() => setLevelUpAnim(p => p ? { ...p, phase: 'flood'   } : null),  750)
          setTimeout(() => setLevelUpAnim(p => p ? { ...p, phase: 'sparkle' } : null), 1300)
          setTimeout(() => setLevelUpAnim(p => p ? { ...p, phase: 'fade'    } : null), 3600)
          setTimeout(() => { setLevelUpAnim(null); setBarXP(0) },                       5000)
        }, 1900)
      }
    }, 3100)
    setTimeout(() => setXpAnim(null), 5000)
  }, [days, dailyPlan, play])

  // handleCloseFocus removed — DayFocus is now its own route, so closing
  // it is router.back() rather than a state reset on this page. The
  // last-day XP-celebration animation is deferred to Stage 2 (needs to be
  // triggered on /fitness/active mount when localStorage shows the last
  // day was just completed).

  const plannedSessions = days.filter((iso) => (dailyPlan[iso] || []).length > 0).length

  // Quick-nav TODAY hero: closest day to today's date — sits at y=466 to continue
  // the muscle-memory tap chain (chip → LOAD card → ACTIVATE → TODAY hero).
  const todayIsoStr = (() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${dd}`
  })()
  const heroIso = days.length
    ? days.reduce((closest, iso) => {
        const dC = Math.abs(parseDate(closest) - parseDate(todayIsoStr))
        const dI = Math.abs(parseDate(iso) - parseDate(todayIsoStr))
        return dI < dC ? iso : closest
      }, days[0])
    : null
  const heroIsToday = heroIso === todayIsoStr
  const heroIsPast = heroIso && heroIso < todayIsoStr
  const heroDate = heroIso ? parseDate(heroIso) : null
  const heroDayName = heroDate ? DAY_FULL[heroDate.getDay()] : ''
  const heroDayNum = heroDate ? heroDate.getDate() : ''
  const heroMon = heroDate ? MONTH_SHORT[heroDate.getMonth()] : ''
  const heroMuscles = heroIso ? (dailyPlan[heroIso] || []) : []
  const heroLabel = heroIsToday ? 'TODAY' : heroIsPast ? 'LAST TRAINING' : 'NEXT TRAINING'

  // Day grid below the hero shows the OTHER days only (heroIso is filtered out).
  const gridCount = heroIso ? Math.max(0, days.length - 1) : days.length
  const cols = gridCount <= 4 ? Math.max(1, gridCount)
             : gridCount <= 8 ? Math.ceil(gridCount / 2)
             : Math.ceil(gridCount / 3)
  const rows = Math.max(1, Math.ceil(gridCount / cols))

  return (
    <main className="relative h-[100dvh] flex flex-col overflow-hidden bg-gtl-void">

      {/* Atmospherics */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.18) 0%, transparent 45%, rgba(74,10,14,0.28) 100%)' }} />

      {/* Kanji watermark — 動 (motion/active). Top rooted at safe-area floor so it
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
        動
      </div>

      {/* Cycle name watermark — floats above grid */}
      <div className="absolute inset-0 flex items-center justify-start pointer-events-none select-none overflow-hidden" style={{ zIndex: 20 }}>
        <div
          className="font-display leading-none"
          style={{
            fontSize: 'clamp(5rem, 16vw, 18rem)',
            color: '#e8e0d0',
            opacity: 0.03,
            transform: 'rotate(-4deg) translateY(10%)',
            transformOrigin: 'left center',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            paddingLeft: '2rem',
          }}
        >
          {cycleName}
        </div>
      </div>

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area).
          min-h-0 is critical: without it, flex-1's min-height: auto sizes the
          wrapper to its content (~1689px), overflowing main and breaking the
          flex chain that the rolodex depends on. */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
      {/* Nav */}
      <nav
        className="relative shrink-0 flex items-center gap-4 pl-28 pr-8 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {/* RetreatButton is fixed left-0 — pl-28 above keeps the divider + XP
            bar from painting underneath it. */}
        <RetreatButton href="/fitness/load" />
        <div className="w-px self-stretch bg-gtl-edge" style={{ transform: 'skewX(-12deg)' }} />
        {/* XP Bar inline in nav */}
        {days.length > 0 && (() => {
          const { level, progress, threshold } = getLevelInfo(barXP)
          const fillPct = Math.min(100, (progress / threshold) * 100)
          const isFull = progress >= threshold
          return (
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <span className="font-display text-base uppercase text-white leading-none" style={{ textShadow: '1px 1px 0 #d4181f' }}>EXP</span>
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash leading-none mt-0.5">LV.{level}</span>
              </div>
              <div
                ref={xpBarRef}
                className="relative flex-1 min-w-0 overflow-hidden"
                style={{
                  height: '18px',
                  background: '#1a1a1e',
                  clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 2% 100%)',
                  border: '1px solid #2a2a30',
                  animation: xpAnim?.phase === 'fill' ? 'xp-bar-wobble 900ms cubic-bezier(0.2, 0.9, 0.3, 1) 1800ms both' : 'none',
                  transformOrigin: 'left center',
                }}
              >
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    width: `${fillPct}%`,
                    background: (isFull || xpAnim?.phase === 'fill')
                      ? 'linear-gradient(90deg, #8a6612, #e4b022, #f5d060, #e4b022)'
                      : 'linear-gradient(90deg, #8a6612, #e4b022)',
                    clipPath: 'polygon(0% 0%, 100% 0%, 98% 100%, 2% 100%)',
                    transition: xpAnim?.phase === 'fill'
                      ? 'width 1800ms cubic-bezier(0.1, 0.7, 0.2, 1)'
                      : 'width 600ms cubic-bezier(0.2, 1, 0.3, 1)',
                    boxShadow: xpAnim?.phase === 'fill'
                      ? '0 0 30px rgba(228,176,34,0.9), 0 0 60px rgba(228,176,34,0.4)'
                      : isFull ? '0 0 16px rgba(228,176,34,0.6)' : '0 0 8px rgba(228,176,34,0.3)',
                    animation: xpAnim?.phase === 'fill' ? 'xp-bar-pulse 1s ease-in-out 3' : 'none',
                  }}
                />
                {days.map((_, i) => i > 0 && (
                  <div key={i} style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${(i / days.length) * 100}%`,
                    width: '1px',
                    background: 'rgba(7,7,8,0.5)',
                  }} />
                ))}
              </div>
            </div>
          )
        })()}

      </nav>

      {/* Thin red accent line under nav */}
      <div className="relative z-10 mx-8 mb-1 h-[2px] bg-gtl-red shrink-0"
           style={{ transform: 'skewX(-6deg)', transformOrigin: 'left center' }} />

      {/* ── DAY ROLODEX ──
          Vertical free-scroll list of all non-hero days. TODAY hero stays
          where it is above (rendered separately); this section gives the
          past + future days room to breathe without cramming them into a
          packed grid. No scroll-snap — user free-scrolls and taps any
          card to enter that day. */}
      <section
        className="relative z-10 px-3 pb-2"
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        <div className="shrink-0 font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-ash mb-3 flex items-center gap-4">
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
            ref={rolodexRef}
            data-rolodex-container
            data-scroll-passthrough
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorY: 'contain',
              touchAction: 'pan-y',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              // Phantom space above + below so the first/last card can be
              // scrolled to the active line.
              // Bumped 40vh -> 60vh: with the rolodex container starting
              // ~82px below viewport top (after nav + battle-schedule
              // header), 40vh of phantom = ~337px = card naturally lands
              // at ~420 with scrollTop=0, can't scroll BACK to reach
              // y=479. 60vh gives enough phantom room for the auto-center
              // scrollBy(top: rect.top - ACTIVE_TOP_Y) to actually
              // resolve at every common viewport.
              paddingTop: '60vh',
              paddingBottom: '60vh',
              // Snap removed: 'y mandatory' + 'center' was re-aligning
              // today's card to the SCROLLPORT center independently of
              // the auto-center math. The prominence listener already
              // handles "what counts as centered" via the
              // data-rolodex-centered attribute (within 47px of
              // ACTIVE_TOP_Y), so snap was redundant.
            }}
          >
            {days.map((iso) => (
              <div
                key={iso}
                data-rolodex-iso={iso}
                onClickCapture={(e) => {
                  // Tap-to-select-then-open behavior:
                  //   centered card → click bubbles → DayButton.onClick fires
                  //   non-centered card → block, scroll to center it
                  const wrapper = e.currentTarget
                  if (!wrapper.hasAttribute('data-rolodex-centered')) {
                    e.preventDefault()
                    e.stopPropagation()
                    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }}
                style={{
                  flexShrink: 0,
                  // Match ACTIVATE's min-h-[56px]. The button's interior py-5
                  // adds 40px so total minimum is ~70px, which matches the
                  // ACTIVATE button's rendered height.
                  minHeight: '56px',
                  // --rolodex-t is updated by the scroll listener.
                  // 1 at the active line, 0.7 floor at the edges. Bumped
                  // from 0.45 -> 0.7 so dates on far cards stay legible
                  // (kanji is text-3xl + serif and reads through low
                  // opacity, but the date text was getting hard to read).
                  opacity: 'calc(0.7 + 0.3 * var(--rolodex-t, 0))',
                  transition: 'opacity 100ms linear',
                }}
              >
                <DayButton
                  iso={iso}
                  muscles={dailyPlan[iso] || []}
                  todayIso={todayIsoStr}
                  onClick={handleDayHop}
                  doneKey={cardRefreshKey}
                  cycleId={cycleId}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Day-hop transition — fires on TODAY/day-card tap. HT plays
          transition-slash, then router.push lands on /fitness/active/[iso]
          which mounts DayFocus on its own route. */}
      <HeistTransition
        active={!!fireDayHop}
        title="THOSE"
        onComplete={() => {
          if (skippedDayHopRef.current) return
          if (fireDayHopRef.current) router.push('/fitness/active/' + fireDayHopRef.current)
        }}
      />

      {/* ── XP ANIMATION OVERLAY ── */}
      {xpAnim && (() => {
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        const { phase, particles, total, barRect } = xpAnim
        const barCx = barRect ? barRect.left + barRect.width / 2 : cx
        const barCy = barRect ? barRect.top + barRect.height / 2 : 80
        const fmt = (n) => {
          const w = Math.round(n)
          return w >= 1000 ? `${Math.round(w / 1000)}K` : w.toLocaleString()
        }

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
            <style>{`
              ${particles.map((p, i) => `
                @keyframes xp-p-${i} {
                  0%   { transform: translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(0.2); opacity: 0; }
                  10%  { opacity: 1; }
                  42%  { transform: translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(1.6); opacity: 1; }
                  100% { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(0.05); opacity: 0; }
                }
              `).join('')}
              @keyframes xp-combine-in {
                0%   { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(0.08) rotate(-4deg); opacity: 0; filter: blur(10px); }
                35%  { filter: blur(0); opacity: 1; }
                65%  { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(1.18) rotate(1deg); }
                82%  { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(0.96) rotate(-0.5deg); }
                100% { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes xp-fly {
                0%   { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(1); opacity: 1; }
                25%  { transform: translate(${cx}px, ${cy}px) translate(-50%,-50%) scale(1.25); }
                100% { transform: translate(${barCx}px, ${barCy}px) translate(-50%,-50%) scale(0.1); opacity: 0; }
              }
              @keyframes xp-bar-pulse {
                0%   { box-shadow: 0 0 30px rgba(228,176,34,0.9), 0 0 60px rgba(228,176,34,0.4); }
                50%  { box-shadow: 0 0 60px rgba(228,176,34,1), 0 0 120px rgba(228,176,34,0.7), 0 0 200px rgba(228,176,34,0.3); }
                100% { box-shadow: 0 0 30px rgba(228,176,34,0.9), 0 0 60px rgba(228,176,34,0.4); }
              }
              @keyframes xp-bar-wobble {
                0%   { transform: scaleY(1)    scaleX(1); }
                8%   { transform: scaleY(1.5)  scaleX(0.96); }
                18%  { transform: scaleY(0.75) scaleX(1.04); }
                30%  { transform: scaleY(1.3)  scaleX(0.97); }
                42%  { transform: scaleY(0.85) scaleX(1.02); }
                55%  { transform: scaleY(1.15) scaleX(0.99); }
                68%  { transform: scaleY(0.92) scaleX(1.01); }
                80%  { transform: scaleY(1.06) scaleX(1); }
                90%  { transform: scaleY(0.97) scaleX(1); }
                100% { transform: scaleY(1)    scaleX(1); }
              }
            `}</style>

            {/* Particles: expand at card positions then converge to center */}
            {(phase === 'expand' || phase === 'converge') && particles.map((p, i) => (
              <div key={i} style={{
                position: 'fixed', left: 0, top: 0,
                fontFamily: 'Anton, Impact, sans-serif',
                fontSize: 'clamp(1.8rem, 3.5vw, 3rem)',
                color: '#e4b022',
                textShadow: '2px 2px 0 #8a6612, 0 0 24px rgba(228,176,34,0.9)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                animation: `xp-p-${i} 1500ms cubic-bezier(0.4, 0, 0.6, 1) both`,
              }}>
                {fmt(p.value)}
              </div>
            ))}

            {/* Combined number: slams in at center */}
            {phase === 'combine' && (
              <div style={{
                position: 'fixed', left: 0, top: 0,
                fontFamily: 'Anton, Impact, sans-serif',
                fontSize: 'clamp(5rem, 12vw, 10rem)',
                color: '#e4b022',
                textShadow: '4px 4px 0 #8a6612, 0 0 50px rgba(228,176,34,1), 0 0 100px rgba(228,176,34,0.5)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                animation: 'xp-combine-in 900ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
              }}>
                {fmt(total)}
              </div>
            )}

            {/* Combined number flying into bar */}
            {phase === 'fly' && (
              <div style={{
                position: 'fixed', left: 0, top: 0,
                fontFamily: 'Anton, Impact, sans-serif',
                fontSize: 'clamp(5rem, 12vw, 10rem)',
                color: '#e4b022',
                textShadow: '4px 4px 0 #8a6612, 0 0 50px rgba(228,176,34,1)',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                animation: 'xp-fly 700ms cubic-bezier(0.4, 0, 1, 1) both',
              }}>
                {fmt(total)}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── LEVEL UP OVERLAY ── */}
      {levelUpAnim && (() => {
        const { phase, newLevel, sparkles, streamParticles, barRect } = levelUpAnim
        const bx = barRect ? barRect.right : window.innerWidth * 0.7
        const by = barRect ? barRect.top + barRect.height / 2 : 50
        const coneW = window.innerWidth - bx + 40
        const isFlood   = phase === 'flood' || phase === 'sparkle' || phase === 'fade'
        const isSparkle = phase === 'sparkle' || phase === 'fade'
        const isFade    = phase === 'fade'

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
            <style>{`
              @keyframes lvlup-cone-in {
                0%   { transform: scaleX(0); opacity: 0.9; }
                8%   { transform: scaleX(1); opacity: 0.85; }
                85%  { opacity: 0.7; }
                100% { opacity: 0; }
              }
              @keyframes lvlup-stream {
                0%   { transform: rotate(var(--sa)) translateX(0px) scale(1); opacity: 1; }
                70%  { opacity: 0.8; }
                100% { transform: rotate(var(--sa)) translateX(var(--sd)) scale(0.15); opacity: 0; }
              }
              @keyframes lvlup-flood-in {
                0%   { clip-path: polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%); }
                100% { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
              }
              @keyframes lvlup-flood-out {
                0%   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); opacity: 1; }
                100% { clip-path: polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%); opacity: 0; }
              }
              @keyframes lvlup-sparkle-in {
                0%   { transform: translate(-50%, -50%) rotate(var(--sr)) scale(0); opacity: 0; }
                40%  { opacity: 1; transform: translate(-50%, -50%) rotate(var(--sr)) scale(1.2); }
                100% { transform: translate(-50%, -50%) rotate(var(--sr)) scale(1); opacity: 0.9; }
              }
              @keyframes lvlup-sparkle-out {
                0%   { opacity: 0.9; transform: translate(-50%, -50%) rotate(var(--sr)) scale(1); }
                100% { opacity: 0;   transform: translate(-50%, -50%) rotate(var(--sr)) scale(0.2); }
              }
              @keyframes lvlup-label {
                0%   { transform: translate(-50%, -50%) rotate(-3deg) scale(3); opacity: 0; filter: blur(12px); }
                50%  { transform: translate(-50%, -50%) rotate(-3deg) scale(0.95); opacity: 1; filter: blur(0); }
                65%  { transform: translate(-50%, -50%) rotate(-3deg) scale(1.05); }
                100% { transform: translate(-50%, -50%) rotate(-3deg) scale(1); opacity: 1; }
              }
              @keyframes lvlup-num {
                0%   { transform: translate(-50%, -50%) rotate(2deg) scale(4); opacity: 0; filter: blur(16px); }
                55%  { transform: translate(-50%, -50%) rotate(2deg) scale(0.92); opacity: 1; filter: blur(0); }
                70%  { transform: translate(-50%, -50%) rotate(2deg) scale(1.08); }
                100% { transform: translate(-50%, -50%) rotate(2deg) scale(1); opacity: 1; }
              }
            `}</style>

            {/* Firehose — cone body */}
            {phase === 'shatter' && (
              <div style={{
                position: 'fixed',
                left: bx,
                top: by - 80,
                width: coneW,
                height: 160,
                transformOrigin: 'left center',
                background: 'linear-gradient(90deg, rgba(255,248,180,0.95) 0%, rgba(228,176,34,0.75) 20%, rgba(228,176,34,0.3) 60%, transparent 100%)',
                clipPath: 'polygon(0 48%, 100% 0%, 100% 100%, 0 52%)',
                animation: `lvlup-cone-in 750ms ease-out both`,
                boxShadow: '0 0 40px rgba(228,176,34,0.6)',
              }} />
            )}

            {/* Firehose — streaming particles flowing through the cone */}
            {phase === 'shatter' && streamParticles && streamParticles.map((p) => (
              <div key={p.i} style={{
                position: 'fixed',
                left: bx,
                top: by,
                width: p.size * 2.5,
                height: p.size,
                borderRadius: '50%',
                background: p.i % 5 === 0
                  ? 'radial-gradient(ellipse, #ffffff 0%, #f5d060 50%, transparent 100%)'
                  : 'radial-gradient(ellipse, #f5d060 0%, #e4b022 60%, transparent 100%)',
                transformOrigin: 'left center',
                '--sa': `${p.angle}deg`,
                '--sd': `${p.dist}px`,
                animation: `lvlup-stream 380ms cubic-bezier(0.1, 0.6, 0.4, 1) ${p.delay}ms both`,
                filter: 'blur(1px)',
                boxShadow: '0 0 8px rgba(228,176,34,0.8)',
              }} />
            ))}

            {/* Gold flood */}
            {isFlood && (
              <div style={{
                position: 'fixed', inset: 0,
                background: 'linear-gradient(135deg, #b8860b 0%, #e4b022 35%, #f5d060 60%, #e4b022 100%)',
                animation: isFade
                  ? 'lvlup-flood-out 1400ms cubic-bezier(0.4, 0, 1, 1) both'
                  : 'lvlup-flood-in 550ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
              }} />
            )}

            {/* Sparkles */}
            {isSparkle && sparkles.map((s, i) => (
              <div key={i} style={{
                position: 'fixed',
                left: `${s.x}vw`,
                top:  `${s.y}vh`,
                width: s.size,
                height: s.size,
                background: s.color,
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                '--sr': `${s.rot}deg`,
                animation: isFade
                  ? `lvlup-sparkle-out 1200ms ease-in ${s.delay * 0.3}ms both`
                  : `lvlup-sparkle-in 600ms cubic-bezier(0.2, 0.9, 0.3, 1.3) ${s.delay}ms both`,
                filter: s.color === '#fff' ? 'drop-shadow(0 0 6px #fff)' : 'drop-shadow(0 0 8px #e4b022)',
              }} />
            ))}

            {/* LEVEL UP label */}
            {isSparkle && !isFade && (
              <>
                <div style={{
                  position: 'fixed',
                  left: '50%', top: '38%',
                  fontFamily: 'var(--font-display, Anton, sans-serif)',
                  fontSize: 'clamp(3rem, 8vw, 6rem)',
                  color: '#070708',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
                  animation: 'lvlup-label 700ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 200ms both',
                }}>
                  LEVEL UP
                </div>
                <div style={{
                  position: 'fixed',
                  left: '50%', top: '58%',
                  fontFamily: 'var(--font-display, Anton, sans-serif)',
                  fontSize: 'clamp(6rem, 20vw, 16rem)',
                  color: '#070708',
                  lineHeight: 1,
                  opacity: 0.85,
                  textShadow: '6px 6px 0 rgba(0,0,0,0.25)',
                  animation: 'lvlup-num 800ms cubic-bezier(0.2, 0.9, 0.3, 1.2) 500ms both',
                }}>
                  {newLevel}
                </div>
              </>
            )}
          </div>
        )
      })()}

      </div>

      {/* Floating TODAY hero retired — every day now lives inside the rolodex
          and the visually-centered card at y=466 is the "active" one (see
          scroll-driven --rolodex-t logic in the rolodex section above). */}

      <TierUpFlourish />
    </main>
  )
}
