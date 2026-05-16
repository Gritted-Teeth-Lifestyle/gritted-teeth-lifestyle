'use client'
/*
 * useSound — central audio hook for Gritted Teeth Lifestyle.
 *
 * Plays through Web Audio API's GainNode rather than HTMLAudioElement.volume
 * because iOS Safari / iOS PWA standalone mode hardware-locks volume on media
 * elements (audio.volume = 0.5 is silently ignored). GainNode is honoured on
 * iOS, so the SFX volume slider in /settings actually does something.
 *
 * Public API: useSound() → { play }. play(name) is fire-and-forget.
 */
import { useRef, useCallback } from 'react'
import { pushDebugLog } from './predictiveTap'

const SOUND_MAP = {
  'card-hover':       '/sounds/select-chime.wav',
  'card-tap':         '/sounds/card-tap.wav',
  'card-confirm':     '/sounds/alt-option.wav',
  'transition-slash': '/sounds/confirm-chime-menu.wav',
  'button-hover':     '/sounds/button-hover.wav',
  'button-confirm':   '/sounds/button-confirm.wav',
  'menu-open':        '/sounds/menu-open.wav',
  'menu-close':       '/sounds/return-retreat.wav',
  'option-select':    '/sounds/all-select.wav',
  'stamp':            '/sounds/all-select.wav',
  'char-stamp':       '/sounds/nier-clips.wav',
  'char-erase':       '/sounds/option-return.wav',
  'mega-transition':  '/sounds/confirm-chime-menu.wav',
  'brand-confirm':    '/sounds/alt-option.wav',
  'camera-swoosh':    '/sounds/camera-swoosh.wav',
  'slash':            '/sounds/slash.mp3',
  'slash-alt':        '/sounds/slash-alt.mp3',
}

// Per-sound base volumes — tuned to P5 philosophy: hover near-silent, tap/select
// decisive, confirm/stamp punchy, transition full weight. The user's SFX volume
// slider multiplies into these.
const SOUND_VOLUME = {
  'card-hover':       0.12,
  'card-tap':         0.55,
  'card-confirm':     0.75,
  'transition-slash': 0.80,
  'button-hover':     0.10,
  'button-confirm':   0.70,
  'menu-open':        0.55,
  'menu-close':       0.35,
  'option-select':    0.60,
  'stamp':            0.65,
  'char-stamp':       0.07,
  'char-erase':       0.05,
  'mega-transition':  0.70,
  'brand-confirm':    0.85,
  'camera-swoosh':    0.82,
  'slash':            0.9,
  'slash-alt':        0.9,
}

// Lazy AudioContext singleton. Created on first user gesture so iOS doesn't
// auto-suspend it. Reused across all plays.
let audioCtx = null
function getAudioCtx() {
  if (audioCtx) return audioCtx
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  try { audioCtx = new Ctor() } catch { return null }
  return audioCtx
}

// src → Promise<AudioBuffer> cache. Decoded once, reused thereafter.
const bufferCache = new Map()
function getBuffer(src) {
  if (bufferCache.has(src)) return bufferCache.get(src)
  const promise = (async () => {
    const ctx = getAudioCtx()
    if (!ctx) return null
    try {
      const res = await fetch(src)
      const arr = await res.arrayBuffer()
      return await ctx.decodeAudioData(arr)
    } catch {
      return null
    }
  })()
  bufferCache.set(src, promise)
  return promise
}

// Prime on first user gesture: create + resume the context so iOS unlocks
// playback, and pre-fetch every SFX so first-tap latency is zero.
if (typeof window !== 'undefined') {
  const primeAudio = () => {
    const ctx = getAudioCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    // Warm the buffer cache for every registered sound.
    for (const src of new Set(Object.values(SOUND_MAP))) getBuffer(src)
  }
  window.addEventListener('pointerdown', primeAudio, { once: true })
}

// Read mute flag from localStorage (defaults unmuted).
function isMuted() {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem('gtl-muted') === '1'
  } catch {
    return false
  }
}

// User-controlled SFX volume multiplier (0..1, default 1). Stored value is
// the slider's linear position; we square it before returning so the gain
// follows a quadratic curve. Quadratic feels closer to perceived loudness
// (linear sliders feel mostly-flat in the audible top half) and gives the
// drag a wider effective range — same physical movement, more audible
// volume change.
function getSfxMultiplier() {
  if (typeof window === 'undefined') return 1
  try {
    const raw = window.localStorage.getItem('gtl-sfx-volume')
    if (raw == null) return 1
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) return 1
    const v = Math.max(0, Math.min(1, n))
    return v * v
  } catch {
    return 1
  }
}

// Commit-sound throttle is MODULE-LEVEL on purpose. The button-press double-tap
// (commit-then-skip) can land on the same button across React re-renders and —
// in dev StrictMode — across mount/unmount/remount cycles, which would reset a
// per-instance ref. Module scope guarantees the second tap within 400ms of any
// commit sound is silenced regardless of component lifecycle.
const COMMIT_SOUNDS = new Set([
  'option-select', 'brand-confirm', 'button-confirm', 'card-tap', 'menu-close',
])
const lastCommitPlayedAt = {}

export function useSound() {
  const lastPlayedRef = useRef({})

  const play = useCallback((name) => {
    if (typeof window === 'undefined') return
    if (isMuted()) return

    const src = SOUND_MAP[name]
    pushDebugLog('[sound]', name, '→', src ? src.split('/').pop() : 'UNKNOWN')
    if (!src) {
      console.warn(`[useSound] unknown sound name: ${name}`)
      return
    }

    // Throttle the same sound from firing too rapidly.
    //  - Commit / button-press sounds: 400ms via a module-level map so the
    //    throttle survives component re-render / remount.
    //  - 'char-stamp' fires per-keystroke during fast typing, 80ms throttle.
    //  - Everything else: per-instance 40ms throttle (hover etc).
    const now = performance.now()
    if (COMMIT_SOUNDS.has(name)) {
      const last = lastCommitPlayedAt[name] || 0
      if (now - last < 400) return
      lastCommitPlayedAt[name] = now
    } else {
      const minGap = name === 'char-stamp' ? 80 : 40
      const last = lastPlayedRef.current[name] || 0
      if (now - last < minGap) return
      lastPlayedRef.current[name] = now
    }

    const ctx = getAudioCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    // Resolve the buffer (cached or in-flight). Once decoded, build a one-shot
    // BufferSource → GainNode → destination chain. Per-play GainNode means the
    // slider's value at *play time* is what's heard, no in-flight retargeting.
    Promise.resolve(getBuffer(src)).then((buffer) => {
      if (!buffer) return
      try {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        const gain = ctx.createGain()
        const baseVol = SOUND_VOLUME[name] ?? 0.5
        gain.gain.value = Math.max(0, Math.min(1, baseVol * getSfxMultiplier()))
        source.connect(gain).connect(ctx.destination)
        source.start(0)
      } catch {
        // Silently ignore — sound is non-essential.
      }
    }).catch(() => {})
  }, [])

  return { play }
}

export function setMuted(muted) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('gtl-muted', muted ? '1' : '0')
  } catch {}
}
export function getMuted() {
  return isMuted()
}
