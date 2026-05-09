// Re-exports for the GTL XP runtime (R1-R18a math + helpers).

export { repMult } from './repMult'
export {
  ipfGL,
  bodyweightNormFactor,
  IPF_GL_PARAMS,
  REFERENCE_BW,
  LB_TO_KG,
} from './ipfGL'
export {
  BODY_REGIONS,
  REGION_INDEX,
  MUSCLE_TO_REGION,
  regionWeights,
} from './regions'
export {
  TIER_NAMES,
  TIER_THRESHOLDS,
  TIER_MULTIPLIERS,
  getTierIndex,
  getTier,
  getTierMultiplier,
  getNextTierThreshold,
} from './tier'
export { getPrestigeMultiplier } from './prestige'
export {
  getTierCount,
  getRibbonCount,
  isPrestigeUnlocked,
  tickTier,
  awardRibbon,
  resetTierForAscend,
} from './tierStore'
export { getHolidayMultiplier } from './holidays'
export {
  calculateSetXP,
  classifyExercise,
  resolveRegionStars,
} from './setXP'
export {
  appendSetLog,
  upsertSetSnapshot,
  replaceConsistencyCredit,
  readSetLogForDay,
  sumDayXP,
  sumDayRegionXP,
  hasSnapshots,
  dayXPWithFallback,
  computeProfileTotalXP,
  computeProfileStats,
} from './setLog'
