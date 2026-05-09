// R9 — prestige multiplier.
//
// Each Galaxy-Spiral ribbon contributes +0.10× to prestige_mult (additive).
// 5 ribbons → 0.50; 10 ribbons → 1.00.

export function getPrestigeMultiplier(ribbonCount) {
  if (!Number.isFinite(ribbonCount) || ribbonCount <= 0) return 0
  return 0.10 * ribbonCount
}
