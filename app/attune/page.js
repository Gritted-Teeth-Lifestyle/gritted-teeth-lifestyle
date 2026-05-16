'use client'
/**
 * /attune — Attune Movements page.
 *
 * Renders the active cycle as a pinch-zoomable calendar of carved
 * day cells. Tap a day → picker. Long-press a chip → ChipActionMenu
 * (Copy / Delete / Replace). Drag a chip onto another day → move,
 * with consent prompts for rest-day or cross-muscle drops.
 *
 * Page-side polish (Unit 6): AutoAttuneButton (visible while every
 * day has 0 chips), ExitGuardDialog (intercepts back nav with empty
 * workout days), FirstTimeInstructionPopup (one-shot onboarding).
 *
 * Reads carved days + muscle assignments from the existing cycle
 * store (lib/storage.js → pk()-keyed localStorage). Attunement chips
 * read/write through lib/attunement.js.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { pk } from '../../lib/storage'
import RetreatButton from '../../components/RetreatButton'
import CycleCalendar from '../../components/attune/CycleCalendar'
import PickerSheet from '../../components/attune/PickerSheet'
import ReplaceCascadeModal from '../../components/attune/ReplaceCascadeModal'
import DropPromptModal from '../../components/attune/DropPromptModal'
import AutoAttuneButton from '../../components/attune/AutoAttuneButton'
import ExitGuardDialog from '../../components/attune/ExitGuardDialog'
import FirstTimeInstructionPopup from '../../components/attune/FirstTimeInstructionPopup'
import {
  addChip, replaceExercise, moveChip,
  convertRestDay, addMuscleToDay,
  setIsChipDragging, emptyDayCount,
} from '../../lib/attunement'

const RETREAT_HREF = '/fitness/new/branded'

function loadActiveCycle() {
  if (typeof window === 'undefined') return null
  try {
    const cycleId = localStorage.getItem(pk('active-cycle-id'))
    if (!cycleId) return null
    const raw = localStorage.getItem(pk('cycles'))
    const cycles = raw ? JSON.parse(raw) : []
    return cycles.find((c) => c.id === cycleId) || null
  } catch (_) {
    return null
  }
}

function persistCycleMuscleAssignment(cycle, dayId, muscle) {
  if (!cycle || !dayId || !muscle) return cycle
  const nextDailyPlan = { ...(cycle.dailyPlan || {}) }
  const existing = nextDailyPlan[dayId] || []
  if (!existing.includes(muscle)) {
    nextDailyPlan[dayId] = [...existing, muscle]
  }
  const nextCycle = { ...cycle, dailyPlan: nextDailyPlan }
  try {
    const raw = localStorage.getItem(pk('cycles'))
    const cycles = raw ? JSON.parse(raw) : []
    const updated = cycles.map(c => c.id === nextCycle.id ? nextCycle : c)
    localStorage.setItem(pk('cycles'), JSON.stringify(updated))
    localStorage.setItem(pk('daily-plan'), JSON.stringify(nextDailyPlan))
  } catch (_) {}
  return nextCycle
}

function muscleOfExercise(exerciseId, cycle, fromDayId) {
  return cycle?.dailyPlan?.[fromDayId]?.[0] || null
}

export default function AttunePage() {
  const router = useRouter()
  const [cycle, setCycle] = useState(null)
  // Lifted attune-target selection — calendar taps mutate this directly.
  // selectedDayIds[0] is the source (★); muscle-lock applies to subsequent
  // additions (taps on non-matching-muscle days are ignored).
  const [selectedDayIds, setSelectedDayIds] = useState([])
  const [replaceContext, setReplaceContext] = useState(null)
  const [dropPrompt, setDropPrompt] = useState(null)
  // Exit guard: { destination } when an attempted navigation is held.
  const [exitGuard, setExitGuard] = useState(null)
  // Latched true once the user confirms "Leave" so subsequent navigation
  // bypasses the guard for this session (avoids double-prompt loop).
  const bypassGuardRef = useRef(false)

  useEffect(() => {
    setCycle(loadActiveCycle())
  }, [])

  // Live count of empty workout days — drives both the guard's count
  // and the should-prompt decision.
  const workoutDayIds = cycle ? (cycle.days || []).filter(iso => (cycle.dailyPlan?.[iso] || []).length > 0) : []
  const emptyCount = cycle ? emptyDayCount(cycle.id, workoutDayIds) : 0
  const shouldGuard = emptyCount > 0

  // ── beforeunload guard for browser refresh / close / hard back ─────────
  useEffect(() => {
    if (!shouldGuard) return
    const handler = (e) => {
      if (bypassGuardRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [shouldGuard])

  // ── popstate guard for in-PWA back gesture / browser back ──────────────
  // Pushes a sentinel history entry on mount so the first back press fires
  // popstate without leaving the page; we then surface the dialog and
  // re-push the sentinel on cancel. Confirm calls router.back() with bypass.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!shouldGuard) return
    try { window.history.pushState({ _attuneGuardSentinel: true }, '') } catch (_) {}
    const onPop = () => {
      if (bypassGuardRef.current) return
      // Re-push the sentinel so we stay on the page until the user decides.
      try { window.history.pushState({ _attuneGuardSentinel: true }, '') } catch (_) {}
      setExitGuard({ destination: null })  // null = browser-back path
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [shouldGuard])

  // ── Picker (attune flow) ───────────────────────────────────────────────
  // Tap toggles selection on the calendar. Picker stays mounted for as
  // long as at least one day is selected. Muscle lock: additions must
  // share the source day's muscle.
  const sourceDayId = selectedDayIds[0] || null
  const sourceMuscle = sourceDayId
    ? (cycle?.dailyPlan?.[sourceDayId] || [])[0] || null
    : null

  const handleDayTap = (dayId) => {
    if (!cycle) return
    if (replaceContext) return
    const muscles = cycle.dailyPlan?.[dayId] || []
    if (muscles.length === 0) return  // rest day — no muscle to lock to
    setSelectedDayIds((prev) => {
      if (prev.includes(dayId)) {
        // Toggle off. If removing the source, the next entry promotes.
        return prev.filter((d) => d !== dayId)
      }
      if (prev.length === 0) return [dayId]
      // Muscle-lock: only add if this day shares the source's muscle.
      if (sourceMuscle && !muscles.includes(sourceMuscle)) return prev
      return [...prev, dayId]
    })
  }

  const handleAttuneConfirm = (exerciseId) => {
    if (!cycle || !exerciseId || selectedDayIds.length === 0) {
      setSelectedDayIds([])
      return
    }
    for (const dayId of selectedDayIds) {
      addChip(cycle.id, dayId, exerciseId)
    }
    setSelectedDayIds([])
  }
  const handlePickerClose = () => setSelectedDayIds([])

  // ── Chip → Replace ─────────────────────────────────────────────────────
  const handleChipReplace = ({ dayId, chipId, fromLabel }) =>
    setReplaceContext({ dayId, chipId, fromLabel })
  const handleReplacePick = (newExerciseId) => {
    if (!replaceContext || !newExerciseId) { setReplaceContext(null); return }
    setReplaceContext((prev) => prev ? { ...prev, newExerciseId } : null)
  }
  const handleCascadePick = (scope) => {
    if (!cycle || !replaceContext?.newExerciseId) { setReplaceContext(null); return }
    replaceExercise(cycle.id, scope, {
      dayId: replaceContext.dayId,
      chipId: replaceContext.chipId,
      newExerciseId: replaceContext.newExerciseId,
    })
    setReplaceContext(null)
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )
  const handleDragStart = () => setIsChipDragging(true)
  const handleDragEnd = (event) => {
    setIsChipDragging(false)
    if (!cycle) return
    const { active, over } = event
    if (!active || !over) return
    const fromDayId = active.data?.current?.fromDayId
    const exerciseId = active.data?.current?.exerciseId
    const chipId = active.id
    const toDayId = over.data?.current?.dayId
    const toIsLocked = !!over.data?.current?.isLocked
    const toMuscles = over.data?.current?.muscles || []
    const toIsRest = !!over.data?.current?.isRestDay
    if (!fromDayId || !toDayId) return
    if (fromDayId === toDayId) return
    if (toIsLocked) return
    const chipMuscle = muscleOfExercise(exerciseId, cycle, fromDayId)
    if (toIsRest) {
      setDropPrompt({ variant: 'rest', muscle: chipMuscle, fromDayId, chipId, toDayId })
      return
    }
    if (chipMuscle && !toMuscles.includes(chipMuscle)) {
      setDropPrompt({ variant: 'cross-muscle', muscle: chipMuscle, fromDayId, chipId, toDayId })
      return
    }
    moveChip(cycle.id, fromDayId, chipId, toDayId)
  }
  const handleDragCancel = () => setIsChipDragging(false)
  const handleDropPromptConfirm = () => {
    if (!cycle || !dropPrompt) { setDropPrompt(null); return }
    const { variant, muscle, fromDayId, chipId, toDayId } = dropPrompt
    if (variant === 'rest') {
      const next = persistCycleMuscleAssignment(cycle, toDayId, muscle)
      setCycle(next)
      convertRestDay(cycle.id, toDayId, muscle)
    } else if (variant === 'cross-muscle') {
      const next = persistCycleMuscleAssignment(cycle, toDayId, muscle)
      setCycle(next)
      addMuscleToDay(cycle.id, toDayId, muscle)
    }
    moveChip(cycle.id, fromDayId, chipId, toDayId)
    setDropPrompt(null)
  }
  const handleDropPromptCancel = () => setDropPrompt(null)

  // ── Exit guard for RetreatButton click ─────────────────────────────────
  const handleNavCaptureClick = (e) => {
    if (bypassGuardRef.current || !shouldGuard) return
    // Intercept clicks on anchors/buttons within the nav (RetreatButton is
    // the primary back path). Only intercept primary-button clicks without
    // modifier keys so cmd/ctrl-click fall through to default behavior.
    const target = e.target
    const a = target?.closest && target.closest('a, button')
    if (!a) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    e.stopPropagation()
    const href = a.getAttribute && a.getAttribute('href')
    setExitGuard({ destination: href || RETREAT_HREF })
  }

  const handleExitConfirm = () => {
    bypassGuardRef.current = true
    const dest = exitGuard?.destination
    setExitGuard(null)
    if (dest) {
      router.push(dest)
    } else {
      router.back()
    }
  }
  const handleExitCancel = () => setExitGuard(null)

  const replacePickerOpen = !!(replaceContext && !replaceContext.newExerciseId)
  const cascadeOpen       = !!(replaceContext && replaceContext.newExerciseId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <main
        className="relative bg-gtl-void"
        style={{
          minHeight: '100%', height: '100dvh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="absolute inset-0 gtl-noise pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(160deg, rgba(80,10,10,0.10) 0%, transparent 55%, rgba(20,20,20,0.32) 100%)' }} />

        <div className="relative z-10 flex flex-col" style={{ flex: 1, minHeight: 0 }}>
          <nav
            className="relative shrink-0 flex items-center gap-4 pl-0 pr-8 pb-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            onClickCapture={handleNavCaptureClick}
          >
            <RetreatButton href={RETREAT_HREF} />
            <div className="w-px self-stretch bg-gtl-edge" style={{ transform: 'skewX(-12deg)' }} />
            <div className="flex flex-col gap-0.5">
              <div className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red/60">
                ATTUNE MOVEMENTS
              </div>
              <h1
                className="font-display text-gtl-chalk leading-none"
                style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)' }}
              >
                {cycle?.name || 'NO CYCLE'}
              </h1>
            </div>
          </nav>

          <div className="relative z-10 mx-8 mb-2 h-[2px] shrink-0"
               style={{ background: '#d4181f', transform: 'skewX(-6deg)', transformOrigin: 'left center' }} />

          <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CycleCalendar
              cycle={cycle}
              onDayTap={handleDayTap}
              onChipReplace={handleChipReplace}
              selectedDayIds={selectedDayIds}
              sourceDayId={sourceDayId}
            />
            <AutoAttuneButton cycle={cycle} />
          </div>
        </div>

        {sourceDayId && !replaceContext && (
          <PickerSheet
            sourceDayId={sourceDayId}
            selectedDayIds={selectedDayIds}
            mode="attune"
            cycle={cycle}
            onConfirm={handleAttuneConfirm}
            onClose={handlePickerClose}
          />
        )}

        {replacePickerOpen && (
          <PickerSheet
            sourceDayId={replaceContext.dayId}
            mode="replace"
            cycle={cycle}
            onConfirm={handleReplacePick}
            onClose={() => setReplaceContext(null)}
          />
        )}

        {cascadeOpen && (
          <ReplaceCascadeModal
            fromLabel={replaceContext.fromLabel}
            toLabel={replaceContext.newExerciseId}
            onPick={handleCascadePick}
            onClose={() => setReplaceContext(null)}
          />
        )}

        {dropPrompt && (
          <DropPromptModal
            variant={dropPrompt.variant}
            muscle={dropPrompt.muscle}
            onConfirm={handleDropPromptConfirm}
            onCancel={handleDropPromptCancel}
          />
        )}

        {exitGuard && (
          <ExitGuardDialog
            count={emptyCount}
            onConfirm={handleExitConfirm}
            onCancel={handleExitCancel}
          />
        )}

        <FirstTimeInstructionPopup />
      </main>
    </DndContext>
  )
}
