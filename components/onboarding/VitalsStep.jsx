'use client'
/**
 * VitalsStep — single onboarding card for first-time profile creation:
 * body weight (60-500 lb integer, required) + birthday (optional) in one
 * card. Replaces the old BodyweightStep → DateOfBirthStep two-card chain
 * (Jordan 2026-07-22: "one card not 2 different ones").
 *
 * Birthday is three snap-scroll wheels — MONTH / DAY / YEAR — not the
 * native calendar input. Every wheel starts on '—' (unset); the birthday
 * only saves when all three are set, so skipping = just not touching the
 * wheels. Day wheel length follows the chosen month/year (leap-aware;
 * unset year assumes leap so FEB 29 stays reachable).
 *
 * iOS PWA note: wheel positioning uses direct scrollTop assignment —
 * scrollBy({behavior:'instant'}) no-ops on flex+overflow containers
 * there (see memory feedback_ios_pwa_scrollby_unreliable).
 *
 * Props:
 *   onConfirm(bw_lb, isoOrNull) — parsed weight integer + 'YYYY-MM-DD'
 *                                 when the wheels are fully set, else null.
 */
import { useEffect, useRef, useState } from 'react'

const MIN_BW = 60
const MAX_BW = 500

const ITEM_H = 36           // px per wheel entry
const WHEEL_H = ITEM_H * 5  // 5 visible rows, selection in the middle
const PAD = ITEM_H * 2      // top/bottom padding so row 0 can center

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
// Year wheel tops out at a 13-year-old, not a newborn — the first year
// off '—' should be a plausible lifter (Jordan 2026-07-23).
const YEAR_MAX = new Date().getFullYear() - 13
const YEAR_MIN = 1920

function daysInMonth(month1, year) {
  if (!month1) return 31
  return new Date(year || 2000, month1, 0).getDate()
}

// One snap-scroll column. `index` is controlled: external changes (day
// clamping) re-position the wheel; user scrolls emit onChange. idxRef
// breaks the scroll→state→scroll feedback loop mid-drag.
function Wheel({ items, index, onChange, ariaLabel }) {
  const ref = useRef(null)
  const idxRef = useRef(index)

  useEffect(() => {
    const el = ref.current
    if (!el || index === idxRef.current) return
    idxRef.current = index
    el.scrollTop = index * ITEM_H
  }, [index])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
    if (i !== idxRef.current) {
      idxRef.current = i
      onChange(i)
    }
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="gtl-wheel flex-1 overflow-y-auto overscroll-contain"
      style={{
        height: WHEEL_H,
        scrollSnapType: 'y mandatory',
        paddingTop: PAD,
        paddingBottom: PAD,
        scrollbarWidth: 'none',
      }}
      role="listbox"
      aria-label={ariaLabel}
      data-scroll-passthrough
    >
      {items.map((label, i) => (
        <div
          key={`${label}-${i}`}
          className={`flex items-center justify-center font-mono tracking-[0.2em] uppercase select-none transition-colors duration-100
            ${i === index ? 'text-[13px] font-bold text-gtl-chalk' : 'text-[11px] text-gtl-ash'}`}
          style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
          role="option"
          aria-selected={i === index}
        >
          {label}
        </div>
      ))}
    </div>
  )
}

export default function VitalsStep({ onConfirm }) {
  const [text, setText] = useState('')
  const [mIdx, setMIdx] = useState(0) // 0 = '—', 1-12 = month
  const [dIdx, setDIdx] = useState(0) // 0 = '—', 1-31 = day
  const [yIdx, setYIdx] = useState(0) // 0 = '—', 1+ = YEAR_MAX downward

  const n = parseInt(text, 10)
  const validBW = Number.isFinite(n) && n >= MIN_BW && n <= MAX_BW

  const year = yIdx > 0 ? YEAR_MAX - (yIdx - 1) : null
  const dayCount = daysInMonth(mIdx, year)

  // Month/year change can shrink the day wheel (MAR 31 → FEB): clamp.
  useEffect(() => {
    if (dIdx > dayCount) setDIdx(dayCount)
  }, [dayCount, dIdx])

  const monthItems = ['—', ...MONTHS]
  const dayItems = ['—', ...Array.from({ length: dayCount }, (_, i) => String(i + 1))]
  const yearItems = ['—', ...Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => String(YEAR_MAX - i))]

  const dobSet = mIdx > 0 && dIdx > 0 && yIdx > 0
  const iso = dobSet
    ? `${year}-${String(mIdx).padStart(2, '0')}-${String(dIdx).padStart(2, '0')}`
    : null

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    if (!validBW) return
    onConfirm?.(n, iso)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-gtl-surface border border-gtl-edge px-6 py-7"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
      action="#"
      method="post"
    >
      <style>{`.gtl-wheel::-webkit-scrollbar { display: none; }`}</style>

      <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk mb-4">
        ENTER BODY WEIGHT
      </p>
      <div className="flex items-center gap-3 mb-6">
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

      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">
          BIRTHDAY
        </p>
        <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-gtl-ash">
          OPTIONAL — LEAVE ON —
        </span>
      </div>
      <div className="relative bg-gtl-void border border-gtl-edge mb-6">
        {/* Selection band — hairlines framing the center row. */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: PAD, height: 1, background: '#d4181f', opacity: 0.7 }}
          aria-hidden="true"
        />
        <div
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: PAD + ITEM_H, height: 1, background: '#d4181f', opacity: 0.7 }}
          aria-hidden="true"
        />
        {/* Edge fades so the wheels read as cylinders. */}
        <div
          className="absolute left-0 right-0 top-0 pointer-events-none z-10"
          style={{ height: PAD, background: 'linear-gradient(to bottom, #111115 15%, transparent)' }}
          aria-hidden="true"
        />
        <div
          className="absolute left-0 right-0 bottom-0 pointer-events-none z-10"
          style={{ height: PAD, background: 'linear-gradient(to top, #111115 15%, transparent)' }}
          aria-hidden="true"
        />
        <div className="flex">
          <Wheel items={monthItems} index={mIdx} onChange={setMIdx} ariaLabel="Birth month" />
          <Wheel items={dayItems} index={dIdx} onChange={setDIdx} ariaLabel="Birth day" />
          <Wheel items={yearItems} index={yIdx} onChange={setYIdx} ariaLabel="Birth year" />
        </div>
      </div>

      <button
        type="submit"
        disabled={!validBW}
        className={`w-full py-3 font-mono text-[11px] tracking-[0.3em] uppercase font-bold transition-colors duration-200 outline-none
          ${validBW ? 'bg-gtl-red text-gtl-paper [@media(hover:hover)]:hover:opacity-90' : 'bg-gtl-void text-gtl-ash border border-gtl-edge'}`}
        style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
      >
        CONFIRM
      </button>
    </form>
  )
}
