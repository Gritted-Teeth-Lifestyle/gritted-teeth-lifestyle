// R10a — dual-semantics muscle→region map + 60/40 region weights.
//
// Five regions: CORE / ARMS / LEGS / FRONT / BACK. Indices match the
// canonical BODY_REGIONS order used by the stats-page transmutation chart.
//
// Dual semantics:
//   - Upper-body uses torso-only meaning. FRONT = chest. BACK = lats/traps/
//     erector. ARMS = all delts (anterior/medial/posterior) + biceps +
//     triceps + forearms. CORE = abs.
//   - Lower-body uses position-of-leg meaning. FRONT = quads. BACK = hams.
//     LEGS = catch-all (glutes + calves + adductors + abductors).
//
// regionWeights(exercise) returns [c, a, l, f, b] (sums to 1.0) using the
// 60/40 primary/secondary split from exercise.primaryMuscles +
// exercise.secondaryMuscles. If secondaryMuscles is empty, primary owns
// 100%.

export const BODY_REGIONS = [
  { id: 'core',  label: 'CORE',  muscles: ['abs'] },
  { id: 'arms',  label: 'ARMS',  muscles: ['shoulders', 'biceps', 'triceps', 'forearms'] },
  { id: 'legs',  label: 'LEGS',  muscles: ['glutes', 'calves'] },
  { id: 'front', label: 'FRONT', muscles: ['chest', 'quads'] },
  { id: 'back',  label: 'BACK',  muscles: ['back', 'hamstrings'] },
]

export const REGION_INDEX = { core: 0, arms: 1, legs: 2, front: 3, back: 4 }

export const MUSCLE_TO_REGION = {}
BODY_REGIONS.forEach((r, i) => {
  for (const m of r.muscles) MUSCLE_TO_REGION[m] = i
})

export function regionWeights(exercise) {
  const out = [0, 0, 0, 0, 0]
  if (!exercise) return out
  const primary = exercise.primaryMuscles || []
  const secondary = exercise.secondaryMuscles || []

  if (primary.length === 0 && secondary.length === 0) return out

  // Primary owns 100% if no secondaries; otherwise 60/40 split.
  const primaryShare = secondary.length === 0 ? 1.0 : 0.6
  const secondaryShare = secondary.length === 0 ? 0 : 0.4

  if (primary.length > 0) {
    const per = primaryShare / primary.length
    for (const m of primary) {
      const ri = MUSCLE_TO_REGION[m]
      if (ri !== undefined) out[ri] += per
    }
  }
  if (secondary.length > 0) {
    const per = secondaryShare / secondary.length
    for (const m of secondary) {
      const ri = MUSCLE_TO_REGION[m]
      if (ri !== undefined) out[ri] += per
    }
  }
  return out
}
