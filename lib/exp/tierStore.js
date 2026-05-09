// R5a / R9 — tier counter + ribbon persistence per profile.
//
// Storage keys (profile-scoped via pk()):
//   pk('tier-count')         number, default 0   — cumulative 100% sessions
//   pk('ribbon-count')       number, default 0   — Galaxy-Spiral ribbons earned
//   pk('prestige-unlocked')  '1' | '0', default 0 — set when count crosses 120
//
// Per R5a, tier counter never decays — only ticks +1 on a 100%-completion
// session. Per R9, prestige is unlocked at count >= 120 (GRITTED 100 + 20
// hold). Ascending awards a ribbon and resets the counter to 0.

import { pk } from '../storage'

const KEY_TIER     = 'tier-count'
const KEY_RIBBON   = 'ribbon-count'
const KEY_UNLOCKED = 'prestige-unlocked'

// R9 trigger: counter >= 120 (100 to peak + 20 hold).
const PRESTIGE_THRESHOLD = 120

function readNumber(key, fallback = 0) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(pk(key))
    if (raw == null) return fallback
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : fallback
  } catch (_) { return fallback }
}

function writeNumber(key, value) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(pk(key), String(value)) } catch (_) {}
}

function writeFlag(key, value) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(pk(key), value ? '1' : '0') } catch (_) {}
}

export function getTierCount() {
  return readNumber(KEY_TIER, 0)
}

export function getRibbonCount() {
  return readNumber(KEY_RIBBON, 0)
}

export function isPrestigeUnlocked() {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(pk(KEY_UNLOCKED)) === '1' } catch (_) { return false }
}

// Tick the counter +1. R5a: no decay; only ticks on 100%-completion days.
// Returns the new count. If the new count crosses the prestige threshold
// (120), sets pk('prestige-unlocked') = '1'.
export function tickTier() {
  const current = getTierCount()
  const next = current + 1
  writeNumber(KEY_TIER, next)
  if (next >= PRESTIGE_THRESHOLD && !isPrestigeUnlocked()) {
    writeFlag(KEY_UNLOCKED, true)
  }
  return next
}

// R9 ascend: ribbon-count += 1, tier-count = 0, prestige-unlocked = false.
// Blocks if prestige is not currently unlocked — caller must check
// isPrestigeUnlocked() first (or rely on this guard).
export function awardRibbon() {
  if (!isPrestigeUnlocked()) return null
  const ribbons = getRibbonCount() + 1
  writeNumber(KEY_RIBBON, ribbons)
  writeNumber(KEY_TIER, 0)
  writeFlag(KEY_UNLOCKED, false)
  return ribbons
}

// Reset tier without awarding a ribbon — used as a recovery escape hatch.
// Not part of the normal R9 ascend flow (which always awards a ribbon).
export function resetTierForAscend() {
  writeNumber(KEY_TIER, 0)
  writeFlag(KEY_UNLOCKED, false)
}
