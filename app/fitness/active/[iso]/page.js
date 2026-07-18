'use client'
/*
 * /fitness/active/[iso] — Day-focus route (Stage 1 of App Router refactor).
 *
 * The DayFocus modal that used to live as conditional state on
 * /fitness/active is now a real route. Mounting this page shows the day-
 * focus panel for `iso`; closing routes back. By moving the day-hop
 * onto a real route, HeistTransition runs naturally between /fitness/active
 * and the day view — so the chain's TODAY hop now plays `transition-slash`
 * and matches the sound profile of profile/LOAD CYCLE/ACTIVATE.
 *
 * Helpers below (DayFocus, ExercisePanel, etc.) are duplicated from the
 * parent page verbatim. Stage 2 will dedup them into shared modules.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSound } from '../../../../lib/useSound'
import { useProfileGuard } from '../../../../lib/useProfileGuard'
import { pk } from '../../../../lib/storage'
import PickerSheet from '../../../../components/attune/PickerSheet'
import DropPromptModal from '../../../../components/attune/DropPromptModal'
import HeistTransition from '../../../../components/HeistTransition'
import { chipsForDay, addChip } from '../../../../lib/attunement'
import { getExerciseById } from '../../../../lib/exerciseLibrary'
import { setInAnimation, disarmChain } from '../../../../lib/predictiveTap'
import { useChainPage } from '../../../../lib/useChainPage'
import {
  computeProfileTotalXP,
  computeDailyReckoning,
  replaceConsistencyCredit,
  groupDayStarsByExercise,
  tickTier,
  getTierCount,
  getTier,
} from '../../../../lib/exp'
import TierUpFlourish from '../../../../components/exp/TierUpFlourish'
import DayStarRecap from '../../../../components/exp/DayStarRecap'

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS',
  biceps: 'BICEPS', triceps: 'TRICEPS', forearms: 'FOREARMS',
  abs: 'ABS', glutes: 'GLUTES', quads: 'QUADS',
  hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}

// All 11 muscle IDs, used to scope the picker on a rest day where
// the day itself has no muscles assigned yet — gives the user every
// option until they pick exercises, which then drives the rest→
// workout-day conversion.
const ALL_MUSCLE_IDS = Object.keys(MUSCLE_LABELS)
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

/* ── isMuscleComplete: a muscle is "complete" when at least one logged rep
 *  exists in its `ex-${cycleId}-${iso}-${muscleId}` storage payload. The
 *  muscle rolodex auto-centers on the FIRST uncomplete muscle so the user
 *  is dropped on what they should work on next. Mirrors the data shape
 *  read by the parent's DayCard "lifts summary" + DayFocus's allReps. */
function isMuscleComplete(cycleId, iso, muscleId) {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(pk(`ex-${cycleId}-${iso}-${muscleId}`))
    if (!raw) return false
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return false
    for (const name of Object.keys(data)) {
      const v = data[name]
      if (Array.isArray(v) ? v.some(r => r > 0) : v > 0) return true
    }
    return false
  } catch (_) { return false }
}

/* ── Muscle button — mirrors DayButton's red-clip-path style verbatim.
 *  Used in the muscle rolodex to make every muscle visually consistent
 *  with the day-rolodex hero. ONLY the hero card carries the predictive-
 *  tap chain target attribute (matches the day rolodex's TODAY-only
 *  attribute). Done muscles dim to a dark surface bg with a strikethrough
 *  label so they read as past-completed. */
function MuscleButton({ muscleId, isHero, onClick, doneKey, cycleId, iso }) {
  const { play } = useSound()
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(isMuscleComplete(cycleId, iso, muscleId))
  }, [cycleId, iso, muscleId, doneKey])

  const label = MUSCLE_LABELS[muscleId] || muscleId.toUpperCase()
  const kanji = MUSCLE_KANJI[muscleId] || ''

  return (
    <button
      type="button"
      // Predictive-tap chain marker: ONLY the hero card carries this
      // attribute (other muscles in the rolodex are not the chain target).
      // Mirrors DayButton's TODAY-only `data-predictive-tap-target='today'`
      // pattern — the canonical y=479 hit-zone is shared by all chain hops.
      data-predictive-tap-target={isHero ? 'muscle' : undefined}
      onClick={() => {
        // Predictive-tap chain step 5 — onClick stages the muscle hop.
        // The page-level wrapper kicks off HeistTransition (TEETH slash)
        // and pushes /fitness/active/[iso]/[muscleId] on completion.
        onClick(muscleId)
      }}
      className="relative block w-full outline-none active:scale-[0.98] transition-transform"
      style={{ touchAction: 'pan-y' }}
      aria-label={`View exercises for ${label}`}
    >
      <div
        className={`absolute inset-0 transition-colors ${done ? 'bg-gtl-surface' : 'bg-gtl-red'}`}
        style={{
          // Match the ACTIVATE / DayButton clip-path slash exactly.
          clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)',
          // Match the ACTIVATE / DayButton offset-block shadow.
          boxShadow: done
            ? '2px 2px 0 #070708'
            : '4px 4px 0 #070708',
          border: done ? '1px solid #2a2a30' : 'none',
        }}
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between px-6 py-5 gap-3 min-h-[56px]">
        {/* Single-line label — matches canonical chain-button content shape
            (one line of text-3xl). Mirrors DayButton's date rendering. */}
        <span className={`font-display text-3xl leading-none whitespace-nowrap shrink-0 tracking-tight
          ${done ? 'text-gtl-chalk' : 'text-gtl-paper'}`}
          style={done ? { textDecoration: 'line-through', textDecorationColor: '#7a0e14' } : undefined}>
          {label}
        </span>
        {/* Right side: kanji glyph (analogue of REST pill on DayButton) */}
        {kanji && (
          <span className={`font-display text-2xl leading-none whitespace-nowrap shrink-0
            ${done ? 'text-gtl-smoke/60' : 'text-gtl-paper/70'}`}
            style={{ fontFamily: '"Noto Serif JP", "Yu Mincho", serif' }}>
            {kanji}
          </span>
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
function DayFocus({ iso, muscles, isLastDay, originRect, onClose, cycleId, onMuscleHop, onConvertRestDay }) {
  const { play } = useSound()
  const [closing, setClosing]           = useState(false)
  // Rest-day picker + conversion modal. Tapping ADD MOVEMENT on a
  // rest day opens the picker with full muscle scope; once the user
  // picks exercises, queue them and show a "Convert rest day to X
  // day?" prompt before mutating the cycle's muscle plan.
  const [restPickerOpen, setRestPickerOpen] = useState(false)
  const [restConversion, setRestConversion] = useState(null)
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

  // R17/R18 picker auto-open MOVED to /fitness/active/[iso]/[muscleId].
  // The day page no longer prompts; the prompt now lives on the muscle
  // exercise page (after tapping the muscle button), so the day overview
  // stays uncluttered.

  // Predictive-tap consume for the 'muscle' hop lives on the page-export
  // wrapper (single owner via useChainPage) — see the bottom of this file.
  // DayFocus only receives onMuscleHop for direct taps on the hero card.

  const [allReps, setAllReps]       = useState({})
  const [allWeights, setAllWeights] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [unlogOpen, setUnlogOpen]   = useState(false)
  // SSR-safe: server renders `false`; client populates from localStorage post-mount.
  const [stamped, setStamped]       = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(pk(`done-${cycleId}-${iso}`)) === 'true') setStamped(true)
    } catch (_) {}
  }, [cycleId, iso])

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
  // Day-star recap (roll call + stars flying to region vertices). Set to
  // the grouped per-exercise star entries when the stamped day earned at
  // least one star; the cinematic owns the close (onDone → handleClose).
  const [starRecap, setStarRecap] = useState(null)
  const handleStamp = () => {
    if (stamped) return
    play('option-select')
    try { localStorage.setItem(pk(`done-${cycleId}-${iso}`), 'true') } catch (_) {}
    // R8 / R8a: end-of-day reckoning. Append (or replace, idempotent) the
    // consistency-credit setLog entry, and tick the tier counter on 100%.
    // R7 trigger: detect tier crossing and write pk('tier-cross-pending')
    // for gtl3's TierUpFlourish to pick up.
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
    // Day-star recap: if any exercise earned stars today, play the roll
    // call instead of the plain 900ms dim-and-close. The recap calls
    // handleClose itself when it finishes (or is tap-skipped).
    let recapEntries = null
    try {
      const entries = groupDayStarsByExercise(cycleId, iso)
      if (entries.some(e => e.starred)) recapEntries = entries
    } catch (_) {}
    if (recapEntries) {
      setStarRecap(recapEntries)
    } else {
      stampCloseTimerRef.current = setTimeout(() => handleClose(), 900)
    }
  }
  // Tap during THIS session's post-stamp 900ms wait → close immediately.
  // Suspended while the star recap is up — the recap owns taps (skip).
  useEffect(() => {
    if (!justStamped || closing || starRecap) return
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
  }, [justStamped, closing, starRecap, handleClose])

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

  // ── MUSCLE ROLODEX ──
  // Mirrors the day rolodex on /fitness/active. Hero muscle = first
  // uncomplete muscle in the day's plan (fallback muscles[0]). The hero
  // card carries data-predictive-tap-target='muscle' and is the auto-
  // centered target on mount. Each card carries --rolodex-t (1 at the
  // active line y=479, 0 at the edges), driven by the scroll listener
  // below. ACTIVE_TOP_Y matches the parent's value verbatim.
  const rolodexRef = useRef(null)
  const ACTIVE_TOP_Y = 479
  const heroMuscle = (() => {
    // Rest-day rolodex: NO REST sits in the hero slot so the predictive-tap
    // chain hits the same canonical y=479 zone it would on a workout day.
    if (!hasWork) return 'norest'
    for (const id of muscles) {
      if (!isMuscleComplete(cycleId, iso, id)) return id
    }
    return muscles[0]
  })()

  // Scroll-driven prominence + aggressive snap-on-scroll-end. Tight
  // falloff (within 4px = full, 100px = zero) so only ONE card reads
  // as centered at any time. Snap-on-end kicks 80ms after the last
  // scroll event, pulling the closest card to y=479 — no settling
  // between cards. Mirrors the parent /fitness/active rolodex.
  useEffect(() => {
    const container = rolodexRef.current
    if (!container) return

    const update = () => {
      const cards = container.querySelectorAll('[data-rolodex-muscle]')
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect()
        const dist = Math.abs(rect.top - ACTIVE_TOP_Y)
        const t = Math.max(0, Math.min(1, 1 - Math.max(0, dist - 4) / 96))
        card.style.setProperty('--rolodex-t', String(t))
        if (t >= 0.94) card.setAttribute('data-rolodex-centered', '')
        else card.removeAttribute('data-rolodex-centered')
      })
    }
    let snapTimer = null
    const snapToNearest = () => {
      const cards = container.querySelectorAll('[data-rolodex-muscle]')
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
  }, [hasWork, muscles, heroMuscle])

  // Auto-center the hero muscle to viewport y=479 on mount + on hero
  // change. Direct scrollTop assignment with retries — mirrors the
  // parent's day-rolodex auto-center pattern verbatim. iOS PWA WebKit
  // intermittently no-ops scrollBy on a flex+overflow container, and
  // the retries cover the case where the first frame measures before
  // paddingTop:60vh has laid out fully.
  useEffect(() => {
    const container = rolodexRef.current
    if (!container || !heroMuscle) return
    let cancelled = false
    const place = () => {
      if (cancelled) return false
      const node = container.querySelector(`[data-rolodex-muscle="${heroMuscle}"]`)
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
  }, [hasWork, heroMuscle])

  // Compute transform-origin from the card rect (center of the clicked card)
  const originX = originRect
    ? `${originRect.left + originRect.width / 2}px`
    : '50vw'
  const originY = originRect
    ? `${originRect.top + originRect.height / 2}px`
    : '50vh'

  // Deep-launch: continue the auto-progression chain from /fitness/load ACTIVATE.
  // After zoom-in lands, auto-route to the first muscle's exercise route — which
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
      onMuscleHop(muscles[0])
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

          {/* Vertical layout: compact date header + muscle rolodex + exercise log.
              Outer wrapper uses overflow-hidden + flex column so the rolodex
              child can own its scroll behavior (mirrors /fitness/active where
              the rolodex is the only scroll surface in the page body). */}
          <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-5 py-2" style={{ touchAction: 'pan-y', overscrollBehaviorY: 'contain' }}>

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

            {/* ── MUSCLE ROLODEX ──
                Vertical free-scroll list of all the day's muscles. Mirrors
                the day rolodex on /fitness/active verbatim — same paddingTop/
                Bottom 60vh phantom space, same onClickCapture gating non-
                centered taps, same auto-center to y=479 driving the hero
                muscle into the canonical chain hit-zone. ONLY label text
                differs from the day rolodex (per user spec). The hero
                muscle is the first uncomplete one. */}
            {hasWork ? (
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
                  // Phantom space above + below so the first/last card can
                  // be scrolled to the active line. Mirrors the day-rolodex
                  // 60vh values verbatim.
                  paddingTop: '60vh',
                  paddingBottom: '60vh',
                }}
              >
                {muscles.map((id) => (
                  <div
                    key={id}
                    data-rolodex-muscle={id}
                    onClickCapture={(e) => {
                      // Tap-to-select-then-open behavior:
                      //   centered card → click bubbles → MuscleButton.onClick fires
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
                      minHeight: '56px',
                      // --rolodex-t is updated by the scroll listener.
                      // 1 at the active line, 0.7 floor at the edges.
                      // Mirrors the day-rolodex falloff verbatim.
                      opacity: 'calc(0.7 + 0.3 * var(--rolodex-t, 0))',
                      transition: 'opacity 100ms linear',
                    }}
                  >
                    <MuscleButton
                      muscleId={id}
                      isHero={id === heroMuscle}
                      onClick={onMuscleHop}
                      doneKey={refreshKey}
                      cycleId={cycleId}
                      iso={iso}
                    />
                  </div>
                ))}

                {/* Exercise log nested inside the rolodex's scroll content
                    so scrolling past the last card reveals already-logged
                    sets without competing with the rolodex for vertical
                    space. Placed BEFORE paddingBottom phantom so the last
                    card can still center at y=479. */}
                {hasWork && (
                  <div style={{ animation: 'focus-content-in 350ms 400ms ease-out both', marginTop: '24px' }}>
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
                              onClick={() => onMuscleHop(muscleId)}
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
            ) : (
              // Rest-day rolodex: mirrors the workout-day rolodex MECHANICS
              // exactly (scroll container, 60vh phantom space, --rolodex-t
              // opacity falloff, tap-to-center gating, auto-center hero).
              // Three options replace the muscle cards; NO REST is the hero
              // so the predictive-tap chain target lands at canonical y=479.
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
                  paddingTop: '60vh',
                  paddingBottom: '60vh',
                }}
              >
                {[
                  { id: 'norest', label: 'NO REST', kind: 'hero',     onClick: () => setRestPickerOpen(true) },
                  { id: 'eat',    label: 'EAT',    kind: 'secondary', onClick: () => router.push('/diet') },
                  { id: 'rest',   label: 'REST',   kind: 'muted',     onClick: null },
                ].map((opt) => {
                  const isHero = opt.id === 'norest'
                  return (
                    <div
                      key={opt.id}
                      data-rolodex-muscle={opt.id}
                      onClickCapture={(e) => {
                        // Tap-to-select-then-open: centered card → click
                        // bubbles to the button; non-centered card → block
                        // and scroll the tapped card to the active line.
                        const wrapper = e.currentTarget
                        if (!wrapper.hasAttribute('data-rolodex-centered')) {
                          e.preventDefault()
                          e.stopPropagation()
                          wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                      style={{
                        flexShrink: 0,
                        minHeight: '56px',
                        opacity: 'calc(0.7 + 0.3 * var(--rolodex-t, 0))',
                        transition: 'opacity 100ms linear',
                      }}
                    >
                      <button
                        type="button"
                        onClick={opt.onClick || (() => {})}
                        data-predictive-tap-target={isHero ? 'muscle' : undefined}
                        className={`flex items-center gap-3 w-full ${opt.kind === 'muted' ? 'cursor-default' : 'cursor-pointer'} ${opt.kind === 'hero' ? 'py-4 px-6' : 'py-3 px-6'}`}
                        style={
                          opt.kind === 'hero'
                            ? {
                                background: '#d4181f',
                                border: '1px solid rgba(212,24,31,0.9)',
                                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                                boxShadow: '0 0 24px rgba(212,24,31,0.4)',
                              }
                            : opt.kind === 'secondary'
                            ? {
                                background: 'transparent',
                                border: '1px solid rgba(212,24,31,0.6)',
                                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                              }
                            : {
                                background: 'transparent',
                                border: '1px solid rgba(212,24,31,0.3)',
                                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                              }
                        }
                      >
                        <span
                          className="font-display leading-none"
                          style={
                            opt.kind === 'hero'
                              ? { fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)', color: '#f5f0e8', textShadow: '2px 2px 0 #070708', letterSpacing: '0.04em', transform: 'rotate(-1deg)' }
                              : opt.kind === 'secondary'
                              ? { fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)', color: '#d4181f', letterSpacing: '0.04em' }
                              : { fontSize: 'clamp(1.2rem, 2.5vw, 1.7rem)', color: 'rgba(212,24,31,0.55)', letterSpacing: '0.04em' }
                          }
                        >
                          {opt.label}
                        </span>
                      </button>
                    </div>
                  )
                })}
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

        {/* BEGIN HERE muscle button removed — replaced by the muscle
            rolodex above. The hero card (first uncomplete muscle) carries
            data-predictive-tap-target='muscle' and lives inside the
            rolodex, occupying the canonical y=479 hit-zone. Direct taps
            on the hero card and predictive-tap during the inbound 'today'
            HT both converge on onMuscleHop. */}

        {/* Exercise panel now lives at /fitness/active/[iso]/[muscleId] —
            tapping a muscle (rolodex card or name chip) calls onMuscleHop,
            which fires HeistTransition + router.push. Returning from that
            route remounts DayFocus with fresh localStorage reads. */}

        {/* Rest-day picker — full muscle scope so the user has every
            option until they pick. On ATTUNE the picks queue into the
            DropPromptModal below for confirmation before the cycle's
            dailyPlan is mutated. */}
        {restPickerOpen && (
          <PickerSheet
            sourceDayId={iso}
            mode="in-the-moment"
            cycle={{ id: cycleId, dailyPlan: { [iso]: ALL_MUSCLE_IDS } }}
            onConfirm={(exerciseId) => {
              setRestConversion((prev) => ({
                exerciseIds: [...(prev?.exerciseIds || []), exerciseId],
              }))
              setRestPickerOpen(false)
            }}
            onClose={() => setRestPickerOpen(false)}
          />
        )}

        {restConversion && (() => {
          // Compute the union of primary muscles across all picked
          // library exercises (custom-typed ids contribute nothing
          // since the library can't map them to a muscle).
          const muscleSet = new Set()
          for (const id of restConversion.exerciseIds) {
            const ex = getExerciseById(id)
            if (ex && Array.isArray(ex.primaryMuscles)) {
              for (const m of ex.primaryMuscles) muscleSet.add(m)
            }
          }
          const musclesToAdd = [...muscleSet]
          const muscleLabel = musclesToAdd.map((m) => (MUSCLE_LABELS[m] || m).toUpperCase()).join(' + ') || 'WORKOUT'
          return (
            <DropPromptModal
              variant="rest"
              muscle={muscleLabel}
              onConfirm={() => {
                if (musclesToAdd.length > 0 && onConvertRestDay) {
                  onConvertRestDay(iso, musclesToAdd)
                }
                for (const id of restConversion.exerciseIds) {
                  addChip(cycleId, iso, id)
                }
                setRestConversion(null)
              }}
              onCancel={() => setRestConversion(null)}
            />
          )
        })()}

        {/* Day-star recap — roll call + stars flying to region vertices.
            Owns the post-stamp close (onDone → handleClose). */}
        {starRecap && (
          <DayStarRecap entries={starRecap} onDone={handleClose} />
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

export default function ActiveDayPage() {
  useProfileGuard()
  const params = useParams()
  const router = useRouter()
  const iso = decodeURIComponent(params.iso)

  const [cycleId, setCycleId]     = useState('')
  const [days,    setDays]        = useState([])
  const [dailyPlan, setDailyPlan] = useState({})
  const [ready, setReady]         = useState(false)

  // Muscle-hop transition: holds target muscleId while HeistTransition runs.
  // null = idle. When set, <HeistTransition active onComplete=push> mounts;
  // on cover phase, router.push('/fitness/active/[iso]/[muscleId]') navigates.
  // Mirrors the day-hop pattern on the parent /fitness/active page.
  const [fireMuscleHop, setFireMuscleHop] = useState(null)
  const fireMuscleHopRef = useRef(null)
  const skippedMuscleHopRef = useRef(false)
  // iOS-leaked-click eat stamp (150ms grace). Mirror pattern from earlier
  // chain pages — onClick-sourced handleMuscleHop calls within 150ms of
  // mount are rejected. The consume's setTimeout bypasses via fromTimer.
  const mountTimeRef = useRef(0)
  useEffect(() => { mountTimeRef.current = performance.now() }, [])

  // Cycle loading — same as the parent /fitness/active page.
  useEffect(() => {
    try {
      const cid  = localStorage.getItem(pk('active-cycle-id'))
      const rawD = localStorage.getItem(pk('training-days'))
      const rawP = localStorage.getItem(pk('daily-plan'))
      if (cid)  setCycleId(cid)
      if (rawD) setDays(JSON.parse(rawD).sort())
      if (rawP) setDailyPlan(JSON.parse(rawP))
    } catch (_) {}
    setReady(true)
  }, [])

  // Muscle-hop dispatch: fires HeistTransition then router.push to the
  // muscle exercise route. Mirrors handleDayHop on the parent active page —
  // synchronous skip flag so a fast follow-up tap routes immediately rather
  // than waiting for HT to complete.
  const handleMuscleHop = (muscleId, { fromTimer = false } = {}) => {
    // iOS-leaked-click eat — see mountTimeRef comment above.
    if (!fromTimer && performance.now() - mountTimeRef.current < 150) return
    if (skippedMuscleHopRef.current) return
    if (fireMuscleHopRef.current) {
      // Already firing → user wants to skip the slash. Route now.
      skippedMuscleHopRef.current = true
      router.push('/fitness/active/' + iso + '/' + fireMuscleHopRef.current)
      return
    }
    fireMuscleHopRef.current = muscleId
    // Mark the 'muscle' HT as active so the module's grace timer starts
    // fresh for this hop. Without this, activeHTStep stayed at 'today'
    // (from the [iso] mount effect) and the stale grace caused leaked
    // pointer events to fire the wrong step's routeForward — skipping
    // the muscle slash entirely. Even though 'muscle' is the chain end
    // and has no further step to stage, the grace timer still needs to
    // start so the HT can play through.
    setInAnimation('muscle', true)
    setFireMuscleHop(muscleId)
  }

  // Predictive-tap chain wiring — the wrapper is the SINGLE consumer of the
  // 'muscle' intent (lib/useChainPage.js owns mount-clear + consume +
  // skip-route ordering). On a consumed intent: rest day (no muscles for
  // this iso) means the chain has nowhere to go — disarm and let the user
  // pick NO REST / EAT / REST manually. Work day: hop to the first
  // incomplete muscle (matches what the rolodex auto-centers on).
  useChainPage({
    step: 'muscle',
    clearTag: 'iso-mount',
    ready,
    onArrive: () => {
      const ms = dailyPlan[iso] || []
      if (ms.length === 0) {
        disarmChain('rest-day-terminal')
        return
      }
      const target = ms.find((id) => !isMuscleComplete(cycleId, iso, id)) || ms[0]
      if (target) setTimeout(() => handleMuscleHop(target, { fromTimer: true }), 100)
    },
    routeForward: () => {
      if (skippedMuscleHopRef.current) return
      if (!fireMuscleHopRef.current) return
      skippedMuscleHopRef.current = true
      router.push('/fitness/active/' + iso + '/' + fireMuscleHopRef.current)
    },
  })

  // Rest-day conversion handler — merges new muscles into dailyPlan[iso]
  // for this cycle, then persists to both pk('daily-plan') (legacy
  // surface) and pk('cycles')[cycleId].dailyPlan (canonical source).
  // Local state update propagates to DayFocus's muscles prop so the
  // page re-renders with the new muscles + a muscle slab to tap into.
  const handleConvertRestDay = useCallback((dayIso, musclesToAdd) => {
    if (!dayIso || !Array.isArray(musclesToAdd) || musclesToAdd.length === 0) return
    setDailyPlan((prev) => {
      const existing = Array.isArray(prev[dayIso]) ? prev[dayIso] : []
      const merged = [...new Set([...existing, ...musclesToAdd])]
      const next = { ...prev, [dayIso]: merged }
      try { localStorage.setItem(pk('daily-plan'), JSON.stringify(next)) } catch (_) {}
      try {
        const raw = localStorage.getItem(pk('cycles'))
        const cycles = raw ? JSON.parse(raw) : []
        if (Array.isArray(cycles) && cycleId) {
          const updated = cycles.map((c) => c.id === cycleId ? { ...c, dailyPlan: next } : c)
          localStorage.setItem(pk('cycles'), JSON.stringify(updated))
        }
      } catch (_) {}
      return next
    })
  }, [cycleId])

  if (!ready) return null

  const sortedDays = [...days].sort()
  const muscles    = dailyPlan[iso] || []
  const isLastDay  = sortedDays.length > 0 && iso === sortedDays[sortedDays.length - 1]

  return (
    <>
      <DayFocus
        iso={iso}
        muscles={muscles}
        isLastDay={isLastDay}
        originRect={null}
        onClose={() => router.back()}
        cycleId={cycleId}
        onMuscleHop={handleMuscleHop}
        onConvertRestDay={handleConvertRestDay}
      />
      {/* Muscle-hop transition — fires on BEGIN HERE / muscle slab tap.
          HT plays transition-slash, then router.push lands on
          /fitness/active/[iso]/[muscleId] which mounts ExercisePanel on
          its own route. */}
      <HeistTransition
        active={!!fireMuscleHop}
        title="TEETH"
        onComplete={() => {
          if (skippedMuscleHopRef.current) return
          if (fireMuscleHopRef.current) router.push('/fitness/active/' + iso + '/' + fireMuscleHopRef.current)
        }}
      />
      <TierUpFlourish />
    </>
  )
}
