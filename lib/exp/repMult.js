// R1 rep-multiplier curve (verbatim move from the 4 in-app duplicates):
//   r ∈ [5, 15] → 1.0 (flat plateau)
//   r < 5      → exp(-(r-5)² / 8)  (fast bell tail)
//   r > 15     → exp(-(r-15)² / 32) (slower bell tail)

export function repMult(r) {
  if (r >= 5 && r <= 15) return 1.0
  if (r < 5) return Math.exp(-Math.pow(r - 5, 2) / 8)
  return Math.exp(-Math.pow(r - 15, 2) / 32)
}
