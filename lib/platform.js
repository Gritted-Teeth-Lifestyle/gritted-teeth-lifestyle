'use client'
/**
 * Platform detection helpers.
 *
 * Prefer feature detection (`if (navigator.vibrate)`) over UA sniffing
 * wherever possible. The one place we can't: APIs that exist on iOS but
 * silently no-op (e.g. `navigator.vibrate`). For those, we have to look at
 * the user agent.
 *
 * Cached at module level so we don't re-parse navigator.userAgent on every
 * call.
 */

let _isIOS = null

export function isIOS() {
  if (_isIOS !== null) return _isIOS
  if (typeof navigator === 'undefined') return false
  // iPadOS 13+ reports as MacIntel with maxTouchPoints > 1 — check that too.
  const ua = navigator.userAgent || ''
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1
  _isIOS = /iPad|iPhone|iPod/.test(ua) || iPadOS
  return _isIOS
}

export function canVibrate() {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.vibrate !== 'function') return false
  // iOS Safari exposes the API but it's a no-op. Treat as unsupported so
  // we don't pretend to vibrate.
  if (isIOS()) return false
  return true
}
