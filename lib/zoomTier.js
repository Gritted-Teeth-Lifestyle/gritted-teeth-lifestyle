/**
 * Zoom tier helper for the Attune calendar.
 *
 * Maps a numeric zoom level (from react-zoom-pan-pinch's TransformWrapper
 * scale value) to one of three rendering tiers:
 *   far  — kanji + numeric chip-count badge only
 *   mid  — first 2 chips truncated + "+N more"
 *   near — full sortable chip stack with drag handles
 *
 * Thresholds tuned for a fit-to-viewport min zoom of ~0.5 (whole cycle
 * visible on a 390-wide viewport when the carved cycle has 5–14 days).
 */
export function zoomTier(scale) {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return 'far'
  if (scale >= 1.6) return 'near'
  if (scale >= 0.95) return 'mid'
  return 'far'
}
