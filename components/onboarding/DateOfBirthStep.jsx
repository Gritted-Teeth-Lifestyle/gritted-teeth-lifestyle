'use client'
/**
 * DateOfBirthStep — inline onboarding card for first-time profile creation.
 *
 * Mounted by app/fitness/page.js after BodyweightStep confirms. Captures
 * an optional birthday (ISO 'YYYY-MM-DD' string) for R16's birthday Tier-1
 * holiday. Skippable — birthday Tier-1 silently no-ops without DOB.
 *
 * autoComplete="bday" lets iOS / Chrome one-tap-fill from system profile
 * data. Native <input type="date"> renders the platform date picker.
 *
 * Props:
 *   onConfirm(iso) — called with the 'YYYY-MM-DD' string on submit.
 *   onSkip()       — called when the user dismisses without entering a date.
 */
import { useState } from 'react'

export default function DateOfBirthStep({ onConfirm, onSkip }) {
  const [text, setText] = useState('')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(text)

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!valid) return
    onConfirm?.(text)
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
        ENTER BIRTHDAY
      </p>
      <div className="flex items-center gap-3 mb-5">
        <input
          type="date"
          autoComplete="bday"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 bg-gtl-void border border-gtl-edge px-3 py-2 font-mono text-base tracking-[0.1em] text-gtl-paper focus:outline-none focus:border-gtl-red"
          aria-label="Date of birth"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSkip?.()}
          className="flex-1 py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold bg-gtl-void text-gtl-ash border border-gtl-edge [@media(hover:hover)]:hover:text-gtl-red [@media(hover:hover)]:hover:border-gtl-red transition-colors duration-200 outline-none"
          style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
        >
          SKIP
        </button>
        <button
          type="submit"
          disabled={!valid}
          className={`flex-1 py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold transition-colors duration-200 outline-none
            ${valid ? 'bg-gtl-red text-gtl-paper [@media(hover:hover)]:hover:opacity-90' : 'bg-gtl-void text-gtl-ash border border-gtl-edge'}`}
          style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
        >
          CONFIRM
        </button>
      </div>
    </form>
  )
}
