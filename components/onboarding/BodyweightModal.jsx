'use client'
/**
 * BodyweightModal — non-dismissible blocking gate.
 *
 * Fires when the user attempts to log a set on a bw_coefficient exercise
 * but `pk('user-bodyweight')` is unset. Captures BW (60-500 lb integer)
 * and writes it to the profile-scoped key. No dismiss button — the
 * modal cannot close without a valid value.
 *
 * Mirrors components/attune/FirstTimeInstructionPopup.jsx layout idiom:
 * fixed inset, dimmed backdrop, centered card.
 */
import { useState } from 'react'
import { pk } from '../../lib/storage'

const MIN_BW = 60
const MAX_BW = 500

export default function BodyweightModal({ onSaved }) {
  const [text, setText] = useState('')
  const n = parseInt(text, 10)
  const valid = Number.isFinite(n) && n >= MIN_BW && n <= MAX_BW

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!valid) return
    try { localStorage.setItem(pk('user-bodyweight'), String(n)) } catch (_) {}
    onSaved?.(n)
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
      style={{ background: 'rgba(8,8,12,0.78)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Enter body weight"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gtl-surface border border-gtl-edge px-6 py-7"
        style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
        action="#"
        method="post"
      >
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk mb-4">
          ENTER BODY WEIGHT
        </p>
        <div className="flex items-center gap-3 mb-5">
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            value={text}
            onChange={(e) => setText(e.target.value)}
            min={MIN_BW}
            max={MAX_BW}
            step={1}
            placeholder="LBS"
            autoFocus
            className="flex-1 bg-gtl-void border border-gtl-edge px-3 py-2 text-right font-mono text-base tracking-[0.15em] text-gtl-paper focus:outline-none focus:border-gtl-red"
            aria-label="Body weight in pounds"
          />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash">LBS</span>
        </div>
        <button
          type="submit"
          disabled={!valid}
          className={`w-full py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold transition-colors duration-200 outline-none
            ${valid ? 'bg-gtl-red text-gtl-paper [@media(hover:hover)]:hover:opacity-90' : 'bg-gtl-void text-gtl-ash border border-gtl-edge'}`}
          style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
        >
          CONFIRM
        </button>
      </form>
    </div>
  )
}
