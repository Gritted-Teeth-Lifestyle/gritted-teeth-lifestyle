'use client'
/**
 * DateRow — settings-page date input row.
 *
 * Mirrors NumberRow's clip-path / typography vocabulary. Uses the native
 * `<input type="date">` picker (Apple/Chrome render their own UIs). The
 * `autoComplete="bday"` hint lets iOS / Chrome one-tap-fill from system
 * profile data.
 *
 * Value contract is the ISO `YYYY-MM-DD` string the input emits natively
 * (matches the shape `getHolidayMultiplier(date, userDOB)` parses in
 * `lib/exp/holidays.js`). Clearing the field passes null to onChange.
 *
 * Props:
 *   label, value (ISO 'YYYY-MM-DD' | null), onChange, optional (default
 *   true — when true, a CLEAR affordance is shown next to the input).
 */
import { useState, useEffect } from 'react'

export default function DateRow({
  label,
  value,
  onChange,
  optional = true,
}) {
  // Local mirror so clearing doesn't flicker.
  const [text, setText] = useState(value ?? '')
  useEffect(() => { setText(value ?? '') }, [value])

  const handleChange = (e) => {
    const raw = e.target.value  // 'YYYY-MM-DD' or '' from native picker
    setText(raw)
    onChange(raw === '' ? null : raw)
  }

  const handleClear = () => {
    setText('')
    onChange(null)
  }

  return (
    <div
      className="bg-gtl-surface border border-gtl-edge px-5 py-4"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            autoComplete="bday"
            value={text}
            onChange={handleChange}
            className="bg-gtl-void border border-gtl-edge px-2 py-1 font-mono text-[12px] tracking-[0.1em] text-gtl-paper focus:outline-none focus:border-gtl-red"
            aria-label={label}
          />
          {optional && text !== '' && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={`Clear ${label}`}
              className="font-mono text-[10px] tracking-[0.2em] uppercase text-gtl-ash hover:text-gtl-red transition-colors duration-150 px-2 py-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
