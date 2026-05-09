'use client'
/**
 * BodyweightStep — inline onboarding card for first-time profile creation.
 *
 * Mounted by app/fitness/page.js handleSubmit's isNew branch. Captures BW
 * (60-500 lb integer) before routing to the hub. Same plain copy as the
 * BW modal gate.
 *
 * Props:
 *   onConfirm(bw_lb) — called with the parsed integer when the user
 *                      submits a valid value.
 */
import { useState } from 'react'

const MIN_BW = 60
const MAX_BW = 500

export default function BodyweightStep({ onConfirm }) {
  const [text, setText] = useState('')
  const n = parseInt(text, 10)
  const valid = Number.isFinite(n) && n >= MIN_BW && n <= MAX_BW

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!valid) return
    onConfirm?.(n)
  }

  return (
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
  )
}
