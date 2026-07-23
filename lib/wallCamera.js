// Wall camera — moves the persistent WallBackdrop between sections
// (Persona-menu entry flow, Jordan 2026-07-23). Section 0 = gate,
// section 1 = profiles. The var lives on <html> so the transition
// SURVIVES route changes — that's the whole camera-move illusion.
//
// setWallCamera(1)                → 700ms pan to profiles
// setWallCamera(1, {instant:true}) → snap (direct visits, back-nav)

export const WALL_PAN_MS = 700

export function setWallCamera(section, { instant = false } = {}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--gtl-wall-t', instant ? '0ms' : `${WALL_PAN_MS}ms`)
  root.style.setProperty('--gtl-wall-x', String(section))
}
