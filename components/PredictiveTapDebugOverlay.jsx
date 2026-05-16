'use client'
/**
 * PredictiveTapDebugOverlay — tiny floating panel showing the last few
 * [prefire] decisions. Lets us read what the chain is doing on iOS PWA
 * where the dev console isn't reachable.
 *
 * Visibility: ON by default during this debugging period. Set
 * localStorage 'gtl-prefire-debug' to '0' to disable. 5-tap pattern
 * inside an 80×80 box at the top-RIGHT corner (offset below the iOS
 * status-bar / safe-area-inset-top so taps register) toggles the flag.
 *
 * Mounted once in the root layout. Pointer-events:none on the panel so
 * it never blocks taps.
 */
import { useEffect, useRef, useState } from 'react'
import { subscribeLogs, getRecentLogs } from '../lib/predictiveTap'

const FLAG_KEY = 'gtl-prefire-debug'
const TOGGLE_TAPS = 5
const TOGGLE_WINDOW_MS = 2000
const TOGGLE_BOX_SIZE = 80
// Top inset to clear the iOS status-bar / dynamic-island area where
// taps don't reach the page. Re-checked at runtime via safe-area-inset.
const TOGGLE_TOP_INSET_FALLBACK = 50

function getSafeAreaTop() {
  if (typeof window === 'undefined') return TOGGLE_TOP_INSET_FALLBACK
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--sat') ||
              getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')
    const n = parseInt(v, 10)
    if (Number.isFinite(n) && n > 0) return n
  } catch (_) {}
  return TOGGLE_TOP_INSET_FALLBACK
}

export default function PredictiveTapDebugOverlay() {
  // Default: enabled UNLESS the flag is explicitly '0'. So out of the box,
  // the overlay shows up — handy during the active debug period.
  const [enabled, setEnabled] = useState(true)
  const [, force] = useState(0)
  const tapTimesRef = useRef([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem(FLAG_KEY)
      setEnabled(v !== '0')
    } catch (_) {}
  }, [])

  // Top-right-corner toggle. Tap the corner box 5 times within 2s to
  // flip the flag. Box is offset down from the very top to clear the
  // iOS PWA status-bar / dynamic-island where taps don't register.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e) => {
      const safeTop = getSafeAreaTop()
      const w = window.innerWidth || 0
      const inBox =
        e.clientX >= w - TOGGLE_BOX_SIZE &&
        e.clientY >= safeTop &&
        e.clientY <= safeTop + TOGGLE_BOX_SIZE
      if (!inBox) {
        tapTimesRef.current = []
        return
      }
      const now = Date.now()
      tapTimesRef.current = tapTimesRef.current.filter(t => now - t < TOGGLE_WINDOW_MS)
      tapTimesRef.current.push(now)
      if (tapTimesRef.current.length >= TOGGLE_TAPS) {
        tapTimesRef.current = []
        const next = !enabled
        try { localStorage.setItem(FLAG_KEY, next ? '1' : '0') } catch (_) {}
        setEnabled(next)
      }
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    return () => window.removeEventListener('pointerdown', handler, { capture: true })
  }, [enabled])

  // Subscribe to log pushes so the panel re-renders on each new entry.
  useEffect(() => {
    if (!enabled) return
    return subscribeLogs(() => force((n) => n + 1))
  }, [enabled])

  if (!enabled) return null

  const logs = getRecentLogs()

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
        right: 4,
        zIndex: 99999,
        maxWidth: 280,
        background: 'rgba(7,7,8,0.85)',
        border: '1px solid rgba(212,24,31,0.5)',
        padding: '4px 6px',
        fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        fontSize: 9,
        lineHeight: 1.25,
        color: '#a8a39a',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <div style={{ color: '#d4181f', fontWeight: 700 }}>[prefire]</div>
      {logs.map((entry, i) => {
        const t = new Date(entry.ts)
        const stamp = `${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}.${String(t.getMilliseconds()).padStart(3,'0')}`
        return (
          <div key={i} style={{ color: i === logs.length - 1 ? '#f1eee5' : '#a8a39a' }}>
            <span style={{ color: '#5a5a5e' }}>{stamp}</span> {entry.line}
          </div>
        )
      })}
    </div>
  )
}
