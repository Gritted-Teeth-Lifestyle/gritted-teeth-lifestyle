'use client'
import { autoAttuneAll, useAttunement } from '../../lib/attunement'
import { randomCommonExerciseFor } from '../../lib/exerciseLibrary'

/**
 * AutoAttuneButton — always visible. Each tap fills only days that are
 * currently empty (zero chips). Existing chips are never overwritten.
 */
export default function AutoAttuneButton({ cycle }) {
  const state = useAttunement(cycle?.id)
  if (!cycle || !Array.isArray(cycle.days)) return null

  const workoutDays = cycle.days.filter(iso => (cycle.dailyPlan?.[iso] || []).length > 0)
  if (workoutDays.length === 0) return null

  const handleClick = () => {
    const dayMuscleMap = {}
    for (const iso of workoutDays) {
      const existing = state?.[iso]?.chips?.length || 0
      if (existing > 0) continue  // skip already-attuned days, fill only the gaps
      const muscles = cycle.dailyPlan?.[iso] || []
      if (muscles.length === 0) continue
      dayMuscleMap[iso] = muscles
    }
    if (Object.keys(dayMuscleMap).length === 0) return
    autoAttuneAll(cycle.id, dayMuscleMap, randomCommonExerciseFor)
  }

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
      display: 'flex', justifyContent: 'center', zIndex: 20,
      pointerEvents: 'none',
    }}>
      <button
        type="button"
        onClick={handleClick}
        style={{
          pointerEvents: 'auto',
          background: '#d4181f',
          border: '2px solid #ff2a36',
          color: '#fff',
          padding: '0.85rem 1.5rem',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          fontSize: '0.9rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 900,
          cursor: 'pointer',
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          boxShadow: '4px 4px 0 #070708',
        }}
      >
        Auto-attune all
      </button>
    </div>
  )
}
