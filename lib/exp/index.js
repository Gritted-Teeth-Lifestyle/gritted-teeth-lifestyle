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
export {
  getRegionStars,
  addRegionStars,
  resetRegionStars,
} from './regionStarStore'
export { computeDailyReckoning } from './dailyReckoning'
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
  groupDayStarsByExercise,
  hasSnapshots,
  dayXPWithFallback,
  computeProfileTotalXP,
  computeProfileStats,
} from './setLog'
export {
  est1RM,
  assessSet,
  assessSetForExercise,
  getProvenBest,
  readProvenBests,
  updateProvenBestsFromDay,
} from './statusQuo'
export { levelFromXP, profileSlotStats } from './profileSlot'
export {
  EXPERIENCE_TIERS,
  EXPERIENCE_BANDS,
  countTrainingDays,
  getClaimedExperience,
  setClaimedExperience,
  earnedExperienceTier,
  getEffectiveExperience,
  getExperienceBands,
} from './experience'
