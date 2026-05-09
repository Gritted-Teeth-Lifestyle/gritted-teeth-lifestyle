'use client'
/**
 * NumberRow — settings-page numeric input row.
 *
 * Mirrors the existing Toggle / VolumeSlider clip-path / typography
 * vocabulary at app/settings/page.js so the WARRIOR DATA section sits
 * naturally between HAPTICS and DEFAULTS.
 *
 * Props:
 *   label, value, unit, onChange,
 *   min, max, step (default 1) — passed through to <input type="number">.
 *
 * onChange receives a parsed Number (or null if the input is empty /
 * invalid). The caller decides whether to persist null or coerce to a
 * default.
 */
import { useState, useEffect } from 'react'

export default function NumberRow({
  label,
  value,
  unit = '',
  onChange,
  min,
  max,
  step = 1,
  placeholder,
}) {
  // Local string mirror so the user can clear the field without flickering
  // back to the parsed number. Sync on external prop changes.
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])

  const handleChange = (e) => {
    const raw = e.target.value
    setText(raw)
    if (raw === '') { onChange(null); return }
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) { onChange(null); return }
    onChange(n)
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
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            value={text}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className="w-20 bg-gtl-void border border-gtl-edge px-2 py-1 text-right font-mono text-[12px] tracking-[0.15em] text-gtl-paper focus:outline-none focus:border-gtl-red"
            aria-label={label}
          />
          {unit && (
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
