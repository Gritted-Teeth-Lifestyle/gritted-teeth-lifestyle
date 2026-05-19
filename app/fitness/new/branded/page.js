'use client'
/*
 * /fitness/new/branded — Schedule + Muscle Assignment (mobile).
 *
 * Always 5 calendar rows (overflow days wrap into row 1's empty slots).
 * Multi-day batch editing with swipe-to-select. Additive-first muscle
 * toggles. Date numbers as watermarks, kanji overlays in 2-col grid.
 * CARVE shows total days with muscles assigned.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSound } from '../../../../lib/useSound'
import { useProfileGuard } from '../../../../lib/useProfileGuard'
import { pk, getDraft, setDraft, getDraftAttunement, setDraftAttunement } from '../../../../lib/storage'
import { getExerciseById } from '../../../../lib/exerciseLibrary'
import FireTransition from '../../../../components/FireTransition'
import SlashWipe from '../../../../components/SlashWipe'
import SpeedLines from '../../../../components/SpeedLines'
import RetreatButton from '../../../../components/RetreatButton'

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const SHEET_MUSCLES = [
  { id: 'chest',      kanji: '胸', label: 'CHEST' },
  { id: 'shoulders',  kanji: '肩', label: 'SHOULDERS' },
  { id: 'back',       kanji: '背', label: 'BACK' },
  { id: 'forearms',   kanji: '腕', label: 'FOREARMS' },
  { id: 'quads',      kanji: '腿', label: 'QUADS' },
  { id: 'hamstrings', kanji: '裏', label: 'HAMSTRINGS' },
  { id: 'calves',     kanji: '脛', label: 'CALVES' },
  { id: 'biceps',     kanji: '二', label: 'BICEPS' },
  { id: 'triceps',    kanji: '三', label: 'TRICEPS' },
  { id: 'glutes',     kanji: '尻', label: 'GLUTES' },
  { id: 'abs',        kanji: '腹', label: 'ABS' },
]
const MUSCLE_ORDER = SHEET_MUSCLES.map((m) => m.id)
const MUSCLE_KANJI = Object.fromEntries(SHEET_MUSCLES.map((m) => [m.id, m.kanji]))

// Japanese month names for decorative empty slots
const MONTH_KANJI = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
]

const CELL_CLIP = 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)'
const PARA_CLIP = 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)'
const ROW_H = 75

// Build a 5-row × 7-col grid. Overflow days from would-be row 6 wrap into
// row 1's leading empty slots.
function buildGrid(year, month) {
  const firstDow  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Standard cells: leading nulls + days + trailing nulls to fill 7-col rows
  const raw = []
  for (let i = 0; i < firstDow; i++) raw.push(null)
  for (let d = 1; d <= daysInMonth; d++) raw.push(d)
  while (raw.length % 7 !== 0) raw.push(null)

  if (raw.length <= 35) {
    // Already 5 rows — return as-is
    return { grid: raw.slice(0, 35), wrapped: new Set() }
  }

  // 6 rows — wrap overflow (row 6 days) into row 1's nulls
  const row1 = raw.slice(0, 7)
  const overflow = raw.slice(35)
  const wrappedDays = new Set()
  for (let col = 0; col < 7; col++) {
    if (row1[col] === null && overflow[col] !== null) {
      row1[col] = overflow[col]
      wrappedDays.add(overflow[col])
    }
  }
  return { grid: [...row1, ...raw.slice(7, 35)], wrapped: wrappedDays }
}


function MonthNavButton({ dir, onClick }) {
  const { play } = useSound()
  const clip = dir === 'prev'
    ? 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)'
    : 'polygon(0% 0%, 88% 0%, 100% 100%, 12% 100%)'
  return (
    <button
      type="button"
      onClick={() => { play('option-select'); onClick() }}
      className="relative px-3 py-1.5 border bg-gtl-ink border-gtl-edge active:bg-gtl-red active:border-gtl-red-bright transition-colors duration-100 shrink-0"
      style={{ clipPath: clip }}
      aria-label={dir === 'prev' ? 'Previous month' : 'Next month'}
    >
      <span className="font-display text-base leading-none text-gtl-red">
        {dir === 'prev' ? '◀︎' : '▶︎'}
      </span>
    </button>
  )
}

function SheetMuscleButton({ kanji, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-between px-3 py-1.5 min-h-[46px] border transition-colors duration-150
        ${active
          ? 'bg-gtl-red border-gtl-red-bright shadow-red-glow'
          : 'bg-gtl-ink border-gtl-edge'}`}
      style={{ clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)', transform: 'skewX(-2deg)' }}
    >
      <span
        className={`font-mono text-[12px] tracking-[0.08em] uppercase leading-none font-bold
          ${active ? 'text-gtl-paper' : 'text-gtl-chalk'}`}
        style={{ transform: 'skewX(2deg)' }}
      >
        {label}
      </span>
      <span
        className={`leading-none ${active ? 'text-gtl-paper' : 'text-gtl-chalk/70'}`}
        style={{
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '1.25rem',
          fontWeight: 400,
          textShadow: active ? '1px 1px 0 #070708' : 'none',
          transform: 'skewX(2deg)',
        }}
      >
        {kanji}
      </span>
    </button>
  )
}

function CarveContent({ enabled }) {
  const dayColor = enabled ? '#070708' : '#e4b022'
  return (
    <div className="flex items-center" style={{ transform: 'skewX(2deg)' }}>
      <span className="font-display leading-none tracking-wide"
        style={{ fontSize: '1.1rem', fontWeight: 900, color: dayColor }}>
        CARVE
      </span>
    </div>
  )
}

/**
 * AttuneMovementsButton — entry point to the Attune Movements page.
 * Visually mirrors SheetCarveButton's gold-on-dim P5/Gurren palette and
 * skewed clip-path slash. Day-selection-gated (CARVE-button parity) but
 * does NOT require muscle assignments — the user discovers the empty
 * state inside the Attune page if they entered without muscles.
 *
 * No slash-cut animation here — this is a navigation entry, not the
 * commit/forge moment that SheetCarveButton's blade-swing earns.
 */
// Single SVG-text spec shared by the visible button text and the
// AttuneFlameLayer mask. Centralizing here means both elements use
// identical font/size/position/stroke — pixel-perfect alignment
// between the visible letters and the flame windows.
const ATTUNE_TEXT_FONT = '"Yuji Syuku", "Shippori Mincho", serif'
const ATTUNE_TEXT_SIZE = '0.85rem'
const ATTUNE_TEXT_WEIGHT = 400
const ATTUNE_TEXT_LETTER_SPACING = '0.04em'
// Y position of each row's text-anchor point (dominantBaseline=central),
// expressed as a fraction of the button's height. Matches where the
// flexbox-equivalent layout would center the rows.
const ATTUNE_Y_FRAC = 0.40
const MOVEMENTS_Y_FRAC = 0.60
// Homescreen GateScreen palette — copied so the button reads as a
// mini-homescreen tile.
const GTL_BG_BLACK   = '#070708'
const GTL_RED        = '#d4181f'
const GTL_RED_BRIGHT = '#ff2a36'
const GTL_RED_DEEP   = '#7a0e14'
const GTL_PAPER      = '#f1eee5'
// Red text + mix-blend-mode: difference (applied at the text SVG)
// gives the same negative-photo flip the homescreen uses on its
// "GRITTED TEETH LIFESTYLE" / "PRESS START" labels — red on the
// black base, flipping to black where it crosses the red bands.
const ATTUNE_TEXT_COLOR  = GTL_RED

// Renders both ATTUNE and MOVEMENTS as SVG <text> at percentage-based
// (50% x) positions. Reused by the visible button text (fill=red,
// stroke=red for fake-bold) and the flame mask (fill=white,
// stroke=white). Same element type + coords in both places guarantees
// alignment.
function AttuneTextRows({ fill, strokeColor, strokeWidth = 0.5 }) {
  const sharedProps = {
    textAnchor: 'middle',
    dominantBaseline: 'central',
    style: {
      fontFamily: ATTUNE_TEXT_FONT,
      fontSize: ATTUNE_TEXT_SIZE,
      fontWeight: ATTUNE_TEXT_WEIGHT,
      letterSpacing: ATTUNE_TEXT_LETTER_SPACING,
      fill,
      stroke: strokeColor,
      strokeWidth,
      paintOrder: 'stroke fill',
    },
  }
  return (
    <>
      <text x="50%" y={`${ATTUNE_Y_FRAC * 100}%`} {...sharedProps}>ATTUNE</text>
      <text x="50%" y={`${MOVEMENTS_Y_FRAC * 100}%`} {...sharedProps}>MOVEMENTS</text>
    </>
  )
}

function AttuneMovementsButton({ enabled, monthKanji = '', onTap, onHover }) {
  // CRITICAL: no transform, no opacity, no z-index on the button itself.
  // Each of those creates a stacking context that isolates the text's
  // mix-blend-mode from the kanji backdrop. The wrapper around this
  // component (in the grid render) must also avoid stacking context
  // creators for the same reason.
  //
  // Border + text color stay constant regardless of `enabled`. The
  // flame layer is the only visual indicator that a day is selected
  // — the button itself doesn't shift between dim/bright.
  //
  // Visible text is rendered as SVG <text> (not HTML span) so it
  // shares the AttuneFlameLayer mask's coordinate system exactly,
  // eliminating any HTML-vs-SVG layout drift between the visible
  // letters and the flame windows.
  return (
    <button
      type="button"
      aria-label="Attune Movements"
      onClick={enabled ? onTap : undefined}
      onMouseEnter={enabled ? onHover : undefined}
      disabled={!enabled}
      className={`relative ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'} w-full h-full block`}
      style={{
        background: 'transparent',
        border: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        padding: 0,
      }}
    >
      {/* Homescreen-palette background — black base + radial red bloom +
          two skewed diagonal red bands + noise grain. Mirrors GateScreen's
          atmospheric stack so the button reads as a mini-homescreen tile.
          overflow:hidden contains the band overflow within the button
          rect (the wrapper's slash clipPath handles the slash silhouette
          itself).
          Dark base = #280609 (the same dark-red-tinted shade the
          page main bg uses). Reads as 'reddish black' to match the
          rest of the button + page chrome instead of pure-cold-black. */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ background: '#280609' }}
        aria-hidden="true"
      >
        {/* Bands at alpha 0.9 — letters/kanji still flip to near-black
            via mix-blend-difference (close enough to pure black to read
            as black) but a faint amount of the underlying calendar +
            cell kanji bleeds through the band, so the entire button
            doesn't read as a fully opaque tile. */}
        <div
          className="absolute"
          style={{
            top: '-25%', bottom: '-25%', left: '-15%', width: '32%',
            background: 'rgba(212, 24, 31, 0.85)',
            transform: 'skewX(-12deg)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '-25%', bottom: '-25%', right: '-10%', width: '55%',
            background: 'rgba(212, 24, 31, 0.9)',
            transform: 'skewX(-12deg)',
          }}
        />
        {/* Noise grain — same gtl-noise texture the homescreen uses */}
        <div className="absolute inset-0 gtl-noise" />
      </div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{ filter: 'drop-shadow(0 0 1.5px rgba(212,24,31,0.45))' }}
      >
        {/* Softened slash border: semi-transparent red + drop-shadow
            outer glow so the edge fades into the bg instead of sitting
            as a hard line. */}
        <polygon
          points="4,0 100,0 96,100 0,100"
          fill="none"
          stroke="rgba(212,24,31,0.55)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Kanji watermark INSIDE the button — same negative-photo
          treatment as the ATTUNE/MOVEMENTS text. Lets the month
          kanji read through the solid red bands as black silhouette
          (red - red = 0,0,0) and as red over the dark center gap
          (red - dark = red). The original cell-rendered kanji sits
          underneath but gets covered by the bands; this in-button
          copy is the visible one. */}
      {monthKanji && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ mixBlendMode: 'difference' }}
          aria-hidden="true"
        >
          <span
            style={{
              fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
              fontSize: '3rem',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: GTL_RED,
            }}
          >
            {monthKanji}
          </span>
        </div>
      )}
      <svg
        width="100%"
        height="100%"
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'difference' }}
        aria-hidden="true"
      >
        <AttuneTextRows
          fill={ATTUNE_TEXT_COLOR}
          strokeColor={ATTUNE_TEXT_COLOR}
        />
      </svg>
    </button>
  )
}

// Yakiire flame engulf overlay for the Attune button. Sibling layer to
// the mix-blend wrapper (NOT mix-blended itself) so flames render in
// their natural orange color over the kanji + button. Particles are
// clipped to ATTUNE/MOVEMENTS letter silhouettes via SVG mask — the
// same pattern as weekday-flame-engulf on /fitness/new/summary.
//
// Mounts whenever the button is enabled (any day selected); unmounts
// when all days deselected. Animation loops infinitely; the flames
// keep burning until the user navigates away (CARVE press cuts to the
// next page) or clears their selection.
function AttuneFlameLayer({ rect }) {
  if (!rect) return null
  const W = rect.width
  const H = rect.height

  // Deterministic per-particle pseudorandom: sin-fract hash means
  // adjacent seeds produce uncorrelated values without server/client
  // mismatch. Same seed → same value across SSR → CSR.
  const hash01 = (n) => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
    return x - Math.floor(x)
  }

  // Y positions match the HTML flex-col layout: container H, two
  // 0.85rem rows (~13.6px each) with leading-none + 2px gap, centered
  // → row centers land at ~H*0.40 and H*0.60 (was 0.36/0.64, which
  // pushed the flame mask further from center than the visible text
  // and caused a vertical misalignment between the windows and the
  // letters).
  const ATTUNE_Y = H * 0.40
  const MOVEMENTS_Y = H * 0.60
  // Approx text widths so particle spawn x's stay within the letter
  // band (mask clips the rest, but tighter spread = fewer wasted
  // particles). MOVEMENTS is ~1.5× the ATTUNE width.
  const ATTUNE_HALF_W = W * 0.32
  const MOVEMENTS_HALF_W = W * 0.45

  // Per-letter particle distribution. Each row's letter band is
  // divided into N_LETTERS evenly-spaced slots, and PARTS_PER_LETTER
  // particles spawn within each slot's x-range (with jitter). The
  // mask clips final positions to actual glyph shapes — slot widths
  // are an approximation of glyph advance, so every letter gets ≥1
  // particle landing inside its silhouette regardless of glyph
  // width variation. Avoids the previous random-uniform distribution
  // where some letters lucked into 0-1 particles by chance.
  const PARTS_PER_LETTER = 4
  const ROWS = [
    { letters: 6, baseY: ATTUNE_Y,    halfW: ATTUNE_HALF_W,    seedBase: 0 },
    { letters: 9, baseY: MOVEMENTS_Y, halfW: MOVEMENTS_HALF_W, seedBase: 100 },
  ]
  const particles = []
  let pkey = 0
  for (const row of ROWS) {
    const slotWidth = (row.halfW * 2) / row.letters
    for (let L = 0; L < row.letters; L++) {
      const slotCenterX = (W / 2) - row.halfW + (L + 0.5) * slotWidth
      for (let i = 0; i < PARTS_PER_LETTER; i++) {
        const k = row.seedBase + L * 11 + i + 1
        const rX      = hash01(k * 1)
        const rDly    = hash01(k * 3 + 11)
        const rDur    = hash01(k * 5 + 17)
        const rRise   = hash01(k * 7 + 19)
        const rSize   = hash01(k * 11 + 23)
        const rPeak   = hash01(k * 13 + 29)
        const rDrft   = hash01(k * 17 + 31)
        const rStartJ = hash01(k * 19 + 37)
        const rEndR   = hash01(k * 23 + 41)

        // Spawn x: anywhere within the slot, slight expansion so
        // particles can spill into neighbouring slot edges (mask
        // clips to actual letter shape regardless).
        const cx     = slotCenterX + (rX - 0.5) * slotWidth * 1.15
        const delay  = (rDly * 540 + row.seedBase) % 600
        const dur    = 130 + rDur * 150                     // 130-280ms
        const rise   = 9 + rRise * 7                        // 9-16
        const size   = 2.2 + rSize * 3.5                    // 2.2-5.7
        const peakA  = 0.5 + rPeak * 0.5                    // 0.5-1.0
        const driftX = (rDrft - 0.5) * 8                    // ±4
        const startY = 6 + (rStartJ - 0.5) * 5              // ±2.5
        const endR   = 0.5 + rEndR * 1.0                    // 0.5-1.5

        particles.push({
          cx,
          cy: row.baseY + startY,
          r: size,
          endR, dur, delay, peakA, driftX, rise,
          key: pkey++,
        })
      }
    }
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${W}px`,
        height: `${H}px`,
        pointerEvents: 'none',
        overflow: 'visible',
        animation: 'attune-flame-flicker 1100ms ease-in-out infinite',
      }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Mask shares its <text> coords with the visible button text
            via AttuneTextRows. White on black = reveal only inside
            letter shapes. */}
        <mask id="attune-flame-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect x="0" y="0" width={W} height={H} fill="black" />
          <AttuneTextRows fill="white" strokeColor="white" />
        </mask>
      </defs>
      {/* Masked group — letters become "windows into the void with
          flames behind." Mirror of /fitness/new/summary's inscription
          pattern:
            1. Dark underlay rect fills each letter silhouette with
               near-black void, hiding the red HTML text underneath.
            2. Orange particles flow upward inside the same mask,
               clipped to letter shape — flames visible through the
               letter-shaped windows.
          Outside the mask, the flame layer is transparent: the
          underlying button content (red ATTUNE/MOVEMENTS text + slash
          outline) shows through, kanji watermark still visible. */}
      <g mask="url(#attune-flame-mask)">
        <rect x="0" y="0" width={W} height={H} fill="#0a0a0a" />
        {particles.map(p => (
          <circle
            key={p.key}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="#ff5000"
            opacity={0}
          >
            {/* 3-point translate path — curved rise, not straight up. */}
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0 0; ${(p.driftX * 0.4).toFixed(2)} -${(p.rise * 0.5).toFixed(2)}; ${p.driftX.toFixed(2)} -${p.rise.toFixed(2)}`}
              dur={`${p.dur.toFixed(0)}ms`}
              begin={`${p.delay.toFixed(0)}ms`}
              repeatCount="indefinite"
            />
            {/* Trapezoidal opacity: ignite in 4%, hold peak till 75%, fade. */}
            <animate
              attributeName="opacity"
              values={`0; ${p.peakA.toFixed(2)}; ${p.peakA.toFixed(2)}; 0`}
              keyTimes="0; 0.04; 0.75; 1"
              dur={`${p.dur.toFixed(0)}ms`}
              begin={`${p.delay.toFixed(0)}ms`}
              repeatCount="indefinite"
            />
            {/* r holds at full size for first half, shrinks to a wisp by end. */}
            <animate
              attributeName="r"
              values={`${p.r.toFixed(2)}; ${p.r.toFixed(2)}; ${p.endR.toFixed(2)}`}
              dur={`${p.dur.toFixed(0)}ms`}
              begin={`${p.delay.toFixed(0)}ms`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
    </svg>
  )
}

function SheetCarveButton({ count, enabled, onFire, onHover, onSlash }) {
  // 0=idle, 1=slash-sweep, 2=slash-fade, 3=render-halves, 4=separate
  const [phase, setPhase] = useState(0)
  const mountedRef = useRef(true)
  const dayLabel = count === 1 ? '1 DAY' : count > 1 ? `${count} DAYS` : '—'

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // Phase 3→4: one-frame delay so halves render at initial position before transition
  useEffect(() => {
    if (phase !== 3) return
    const id = setTimeout(() => { if (mountedRef.current) setPhase(4) }, 16)
    return () => clearTimeout(id)
  }, [phase])

  // Timeline:
  //   0ms      phase 1  slash sweep starts (108ms)
  //   108ms    phase 2  slash begins fading (70ms)
  //   178ms             slash fully gone
  //   228ms    phase 3  halves render at initial position (50ms gap after slash gone)
  //   ~244ms   phase 4  halves start separating (via 16ms setTimeout)
  //   ~660ms            navigate
  const timersRef = useRef([])
  const firedRef = useRef(false)
  const fire = () => {
    if (!enabled || phase > 0) return
    setPhase(1)
    if (onSlash) onSlash()
    timersRef.current.push(setTimeout(() => { if (mountedRef.current) setPhase(2) }, 108))
    timersRef.current.push(setTimeout(() => { if (mountedRef.current) setPhase(3) }, 228))
    timersRef.current.push(setTimeout(() => {
      if (mountedRef.current && !firedRef.current) { firedRef.current = true; onFire() }
    }, 530))
  }
  // Tap during the slash sequence → clear all pending timers and navigate
  // immediately. Once phase > 0 we're committed; a follow-up tap should not
  // re-fire — just collapse the visual tail.
  useEffect(() => {
    if (phase === 0) return
    const handler = () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
      if (!firedRef.current) { firedRef.current = true; onFire() }
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [phase, onFire])

  const goldBg = enabled ? '#e4b022' : '#3a2f12'
  const active = phase > 0

  return (
    <button
      type="button"
      aria-label="Carve cycle"
      data-carve=""
      onClick={fire}
      onMouseEnter={enabled && !active ? onHover : undefined}
      disabled={!enabled}
      className={`relative ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      style={{
        transform: 'skewX(-2deg)',
        clipPath: active ? 'none' : 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
        overflow: active ? 'visible' : 'hidden',
        background: 'transparent',
        border: 'none',
        animation: enabled && !active ? 'carve-pulse 3s ease-in-out infinite' : 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        transition: 'none',
      }}
    >
      {/* Red glow between halves */}
      {phase >= 3 && (
        <div className="absolute inset-0 z-0" style={{
          background: '#d4181f', filter: 'blur(8px)', opacity: 0.95,
        }} />
      )}

      {/* Gold face — full during idle + slash, splits at phase 3+ */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center px-2 ${active ? 'z-50' : 'z-10'}`}
        style={{
          clipPath: phase >= 4 ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
          background: goldBg,
          transform: phase >= 4 ? 'translate(-156px,-85px) rotate(-48deg)' : 'none',
          opacity: phase >= 4 ? 0 : 1,
          transition: phase >= 4
            ? 'transform 248ms cubic-bezier(0.7,0,1,1), opacity 245ms 137ms ease-out'
            : 'none',
        }}>
        <CarveContent enabled={enabled} />
        {phase < 1 && (
          <span className="font-mono leading-none mt-0.5"
            style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: enabled ? '#070708' : '#e4b022', opacity: enabled ? 0.85 : 1, transform: 'skewX(2deg)' }}>
            {dayLabel}
          </span>
        )}
      </div>

      {/* Bottom-right half */}
      {phase >= 3 && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-2"
          style={{
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
            background: goldBg,
            transform: phase >= 4 ? 'translate(650px,221px) rotate(36deg) scale(0.95)' : 'none',
            opacity: phase >= 4 ? 0 : 1,
            transition: phase >= 4
              ? 'transform 212ms 25ms cubic-bezier(0.7,0,1,1), opacity 245ms 162ms ease-out'
              : 'none',
          }}>
          <CarveContent enabled={enabled} />
        </div>
      )}

      {/* Slash line — sweeps (phase 1), fades (phase 2), gone before phase 3 */}
      {phase >= 1 && phase < 3 && (
        <div className="absolute inset-0 z-50 pointer-events-none"
          style={{
            opacity: phase >= 2 ? 0 : 1,
            transition: 'opacity 70ms ease-out',
          }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom right, transparent calc(50% - 5px), #ff2a36 calc(50% - 3px), #ffffff 50%, #ff2a36 calc(50% + 3px), transparent calc(50% + 5px))',
            animation: 'carve-blade 108ms linear forwards',
            boxShadow: '0 0 8px rgba(255,42,54,0.6)',
          }} />
        </div>
      )}

      {/* Invisible spacer */}
      <div className="invisible flex flex-col items-center justify-center px-2" style={{ height: '100%' }}>
        <CarveContent enabled={enabled} />
        <span className="font-mono leading-none mt-0.5" style={{ fontSize: '12px', fontWeight: 700 }}>{dayLabel}</span>
      </div>
    </button>
  )
}

export default function SchedulePage() {
  useProfileGuard()
  const router = useRouter()
  const { play } = useSound()
  let backHref = '/fitness/new/muscles'
  try {
    if (localStorage.getItem('gtl-back-to-edit') === '1') backHref = '/fitness/edit'
    else if (localStorage.getItem('gtl-quick-forge') === '1') backHref = '/fitness/new'
  } catch (_) {}

  const [today] = useState(() => new Date())
  const [displayDate, setDisplayDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  const [selectedDays, setSelectedDays] = useState(new Set())
  const [assignments,  setAssignments]  = useState({})
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from the draft cycle on mount, unconditionally. Back-nav from
  // ATTUNE re-enters this page and must see the days + assignments the
  // user already carved. Falls back to legacy training-days / daily-plan
  // keys if no draft exists (e.g. older in-progress flows that pre-date
  // the draft-cycle model).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draft = getDraft()
      const days = (draft && Array.isArray(draft.days)) ? draft.days : null
      const plan = (draft && draft.dailyPlan && typeof draft.dailyPlan === 'object') ? draft.dailyPlan : null

      const fallbackDays = days ? null : (() => {
        try { return JSON.parse(localStorage.getItem(pk('training-days')) || 'null') } catch (_) { return null }
      })()
      const fallbackPlan = plan ? null : (() => {
        try { return JSON.parse(localStorage.getItem(pk('daily-plan')) || 'null') } catch (_) { return null }
      })()

      const dayArr = days || fallbackDays
      if (Array.isArray(dayArr) && dayArr.length > 0) {
        setSelectedDays(new Set(dayArr))
        const first = dayArr[0]
        if (typeof first === 'string') {
          const [y, m] = first.split('-').map(Number)
          if (y && m) setDisplayDate(new Date(y, m - 1, 1))
        }
      }
      const planObj = plan || fallbackPlan
      if (planObj && typeof planObj === 'object') {
        const next = {}
        for (const [iso, arr] of Object.entries(planObj)) {
          if (Array.isArray(arr)) next[iso] = new Set(arr)
        }
        setAssignments(next)
      }
    } catch (_) {}
    setHydrated(true)
  }, [])

  // Persist days + dailyPlan into the draft on every change so back-nav
  // (e.g. Attune → Retreat → Carve) and orphan-chip cleanup always see
  // current state. Gated on `hydrated` so the empty initial state never
  // clobbers a freshly-loaded draft (matters in StrictMode where the
  // effect double-invokes on mount).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hydrated) return
    if (!getDraft()) return
    const trainingDays = [...selectedDays].sort()
    const dailyPlan = {}
    Object.entries(assignments).forEach(([iso, set]) => {
      if (set && set.size > 0) dailyPlan[iso] = [...set]
    })
    // Use the same contiguous-span derivation as persistScheduleDraft so
    // /attune sees the rest-day-filled timeline the moment the user makes
    // their first pick.
    const first = trainingDays[0]
    const last  = trainingDays[trainingDays.length - 1]
    let days = []
    if (first && last) {
      let cur = new Date(first + 'T00:00:00Z')
      const end = new Date(last + 'T00:00:00Z')
      while (cur <= end) {
        days.push(cur.toISOString().slice(0, 10))
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    }
    setDraft({ days, dailyPlan })
  }, [selectedDays, assignments, hydrated])

  const [fireActive,   setFireActive]   = useState(false)
  const [quickHeistActive, setQuickHeistActive] = useState(false)
  const [quickForgeRunning, setQuickForgeRunning] = useState(false)
  // Measured rect (top/left/width/height) for the Attune Movements button
  // overlay. Computed from the kanji cells' DOMRect so the button sits
  // exactly over the watermark without claiming any grid track space.
  const [attuneRect, setAttuneRect] = useState(null)
  const dragRef = useRef(false) // true during swipe-select
  const gridRef = useRef(null)
  const NEXT_TARGET = '/fitness/new/summary'
  const skippedRef = useRef(false)
  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    router.push(NEXT_TARGET)
  }
  // Window pointerdown+touchstart listener while transitions are active —
  // tap anywhere routes immediately. data-retreat excluded for back nav.
  useEffect(() => {
    if (!fireActive && !quickHeistActive) return
    const handler = (e) => {
      if (e.target?.closest?.('[data-retreat]')) return
      skipNow()
    }
    window.addEventListener('pointerdown', handler, { capture: true })
    window.addEventListener('touchstart',  handler, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handler, { capture: true })
      window.removeEventListener('touchstart',  handler, { capture: true })
    }
  }, [fireActive, quickHeistActive])

  // Enter-key nav for edit mode
  useEffect(() => {
    try { if (localStorage.getItem('gtl-back-to-edit') !== '1') return } catch (_) { return }
    const handleKey = (e) => {
      if (e.key === 'Enter' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName))
        router.push('/fitness/edit')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])

  // Stamp sound + Attune button yakiire ignite on first sheet open.
  // attuneIgniteKey bumps each time we transition from 0→positive days
  // selected so the button's per-letter cascade restarts cleanly. Resets
  // back to 0 once all days are deselected so the next first-pick fires
  // a fresh ignite instead of re-running the same key.
  const prevOpenRef = useRef(false)
  const [attuneIgniteKey, setAttuneIgniteKey] = useState(0)
  useEffect(() => {
    const open = selectedDays.size > 0
    if (open && !prevOpenRef.current) {
      play('stamp')
      setAttuneIgniteKey((k) => k + 1)
    } else if (!open && prevOpenRef.current) {
      setAttuneIgniteKey(0)
    }
    prevOpenRef.current = open
  }, [selectedDays.size, play])

  // ── Calendar math ──────────────────────────────────────────────────────
  const year  = displayDate.getFullYear()
  const month = displayDate.getMonth()

  const { grid: cells, wrapped: wrappedDays } = buildGrid(year, month)

  const isoKey = (d) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const isPast = (d) => {
    const cellDate  = new Date(year, month, d)
    const todayFlat = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return cellDate < todayFlat
  }

  // Tap: toggle in/out of selection batch. Unselecting clears that day's muscles.
  const tapDay = useCallback((d) => {
    if (isPast(d)) return
    play('option-select')
    const key = isoKey(d)
    const wasSelected = selectedDays.has(key)
    setSelectedDays((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
    if (wasSelected) {
      setAssignments((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }, [year, month, today, play, selectedDays])

  // Swipe helpers: add or remove based on mode. Removing clears assigned muscles.
  const swipeApply = useCallback((d, mode) => {
    if (isPast(d)) return
    const key = isoKey(d)
    setSelectedDays((prev) => {
      const n = new Set(prev)
      if (mode === 'add') n.add(key)
      else n.delete(key)
      return n
    })
    if (mode === 'remove') {
      setAssignments((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }, [year, month, today])

  // Touch handlers for swipe-to-select/deselect.
  // Mode determined by first tile: start on unselected = add, start on selected = remove.
  const touchOriginRef = useRef(null)
  const swipeModeRef = useRef(null) // 'add' | 'remove'

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchOriginRef.current = { x: touch.clientX, y: touch.clientY }
    dragRef.current = false
    swipeModeRef.current = null
  }, [])

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0]
    const origin = touchOriginRef.current
    if (!dragRef.current && origin) {
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (dx * dx + dy * dy < 64) return // 8px threshold
      dragRef.current = true
      // Determine mode from origin tile
      const startEl = document.elementFromPoint(origin.x, origin.y)?.closest('[data-day]')
      if (startEl) {
        const dayNum = Number(startEl.dataset.day)
        const key = isoKey(dayNum)
        swipeModeRef.current = selectedDays.has(key) ? 'remove' : 'add'
        swipeApply(dayNum, swipeModeRef.current)
      }
    }
    if (!dragRef.current) return
    e.preventDefault()
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const dayEl = el?.closest('[data-day]')
    if (dayEl && swipeModeRef.current) {
      swipeApply(Number(dayEl.dataset.day), swipeModeRef.current)
    }
  }, [swipeApply, selectedDays, isoKey])

  const handleTouchEnd = useCallback(() => {
    dragRef.current = false
    touchOriginRef.current = null
    swipeModeRef.current = null
  }, [])

  // Additive-first toggle
  const toggleMuscle = (muscleId) => {
    if (selectedDays.size === 0) return
    const keys = [...selectedDays]
    const allHave = keys.every((k) => (assignments[k] || new Set()).has(muscleId))
    play(allHave ? 'option-select' : 'stamp')
    setAssignments((prev) => {
      const next = { ...prev }
      keys.forEach((k) => {
        const s = new Set(next[k] || [])
        if (allHave) s.delete(muscleId)
        else s.add(muscleId)
        next[k] = s
      })
      return next
    })
    // Orphan-chip cleanup: when a muscle is REMOVED from a day, drop any
    // chip on that day whose exercise's primaryMuscles no longer overlap
    // with the day's remaining muscles. Custom (library-unknown) chips
    // pass through untouched.
    if (allHave && getDraft()) {
      const draftAtt = getDraftAttunement()
      let changed = false
      const nextAtt = { ...draftAtt }
      for (const k of keys) {
        const remaining = new Set([...(assignments[k] || new Set())])
        remaining.delete(muscleId)
        const dayState = nextAtt[k]
        if (!dayState || !Array.isArray(dayState.chips) || dayState.chips.length === 0) continue
        const filtered = dayState.chips.filter((chip) => {
          const ex = getExerciseById(chip.exerciseId)
          if (!ex) return true  // unknown / custom — keep
          const primaries = ex.primaryMuscles || []
          if (primaries.length === 0) return true  // no claim — keep
          return primaries.some((p) => remaining.has(p))
        })
        if (filtered.length !== dayState.chips.length) {
          nextAtt[k] = { ...dayState, chips: filtered }
          changed = true
        }
      }
      if (changed) setDraftAttunement(nextAtt)
    }
  }

  const prevMonth = () => {
    setDisplayDate((prev) => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d })
  }
  const nextMonth = () => {
    setDisplayDate((prev) => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d })
  }

  const sheetOpen = selectedDays.size > 0

  // Wrap-continuity pulse — bumps on month change so the paired (last-flow + wrapped) cells
  // re-trigger their CSS animation. Used as part of the cell key so React re-mounts the
  // wrap-continuity overlay when the month changes.
  const [pulseKey, setPulseKey] = useState(0)
  useEffect(() => {
    setPulseKey((k) => k + 1)
  }, [year, month])

  // Sorted selection drives the auto-rest gap fill: any unpicked day between the first
  // and last user-picked ISO date renders with a ✕ overlay (no red highlight) so it reads
  // as part of the cycle. P1 persistence: gap days are NOT saved, only user-picks are.
  const sortedSelected = useMemo(() => {
    if (selectedDays.size === 0) return []
    return [...selectedDays].sort()
  }, [selectedDays])
  const firstSelectedKey = sortedSelected[0]
  const lastSelectedKey  = sortedSelected[sortedSelected.length - 1]

  // Wrap-continuity: pair the last chronological cell that wasn't wrapped (e.g., May 30 in
  // a layout where May 31 wrapped into row 1) with the EARLIEST wrapped cell (firstWrapDay)
  // so the eye reads them as the connected endpoints. Static glyphs/edge accent live only on
  // the pair; the synchronized pulse spans flowEndDay + ALL wrap cells (group flash).
  const wrapActive = wrappedDays.size > 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let flowEndDay = null
  if (wrapActive) {
    for (let d = daysInMonth; d >= 1; d--) {
      if (!wrappedDays.has(d)) { flowEndDay = d; break }
    }
  }
  const firstWrapDay = wrapActive ? Math.min(...wrappedDays) : null
  const daysWithMuscles = Object.values(assignments).filter((s) => s.size > 0).length
  // CARVE activates on any day selection — muscle assignment is no longer
  // a prerequisite. (Used to require daysWithMuscles > 0; now mirrors the
  // Attune button's gating so both light up together when at least one
  // day is picked.)
  const carveEnabled = selectedDays.size > 0
  // Total cycle days = contiguous span from first to last user-pick (inclusive of any
  // auto-rest gap days). What the carve button surfaces — "5 DAYS" of cycle, not "3
  // muscle-assigned days". 0 when no picks.
  const cycleDays = (firstSelectedKey && lastSelectedKey)
    ? Math.round((new Date(lastSelectedKey + 'T00:00:00Z') - new Date(firstSelectedKey + 'T00:00:00Z')) / 86400000) + 1
    : 0

  // Quick-forge auto-progression: build 6-day cycle (today + 5 future, last is
  // rest), all training days assigned all muscles, then auto-press CARVE.
  useEffect(() => {
    let isQuickForge = false
    try { isQuickForge = localStorage.getItem('gtl-quick-forge') === '1' } catch (_) {}
    if (!isQuickForge) return
    setQuickForgeRunning(true)
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      const allMuscles = MUSCLE_ORDER
      const today = new Date()
      const days = []
      for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        days.push(iso)
      }
      const newSelected = new Set(days)
      const newAssignments = {}
      // First 5 days = all muscles; last day = rest (no muscles).
      for (let i = 0; i < days.length - 1; i++) {
        newAssignments[days[i]] = new Set(allMuscles)
      }
      newAssignments[days[days.length - 1]] = new Set()
      setSelectedDays(newSelected)
      setAssignments(newAssignments)
      // Persist + HeistTransition (red slash) to summary. No FireTransition.
      const t2 = setTimeout(() => {
        if (cancelled) return
        try {
          localStorage.setItem(pk('training-days'), JSON.stringify(days))
          const serialized = {}
          for (const [iso, set] of Object.entries(newAssignments)) {
            if (set.size > 0) serialized[iso] = [...set]
          }
          localStorage.setItem(pk('daily-plan'), JSON.stringify(serialized))
        } catch (_) {}
        setQuickHeistActive(true)
      }, 600)
      return () => clearTimeout(t2)
    }, 700)
    return () => { cancelled = true; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Serialize current selection state to the draft keys. Returns the
  // serialized payload so callers can reuse it for the active-cycle sync.
  const serializeSchedule = () => {
    const trainingDays = [...selectedDays].sort()
    const dailyPlan = {}
    Object.entries(assignments).forEach(([iso, set]) => {
      if (set.size > 0) dailyPlan[iso] = [...set]
    })
    return { trainingDays, dailyPlan }
  }

  // Auto-rest gap fill: span from min..max of user-picked days, inclusive.
  // Mirrors the contiguous-span derivation in /fitness/new/summary so the
  // shape Attune renders matches what Summary would commit.
  const contiguousSpan = (trainingDays) => {
    if (!trainingDays.length) return []
    const first = trainingDays[0]
    const last  = trainingDays[trainingDays.length - 1]
    const out = []
    let cur = new Date(first + 'T00:00:00Z')
    const end = new Date(last + 'T00:00:00Z')
    while (cur <= end) {
      out.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return out
  }

  const persistScheduleDraft = () => {
    try {
      const { trainingDays, dailyPlan } = serializeSchedule()
      localStorage.setItem(pk('training-days'), JSON.stringify(trainingDays))
      localStorage.setItem(pk('daily-plan'),    JSON.stringify(dailyPlan))
      // Draft is the source of truth for FORGE/HONE/CARVE/ATTUNE/ETCH.
      // Mirror days + dailyPlan into draft on every commit-worthy write.
      if (getDraft()) {
        setDraft({ days: contiguousSpan(trainingDays), dailyPlan })
      }
      return { trainingDays, dailyPlan }
    } catch (_) {
      return { trainingDays: [], dailyPlan: {} }
    }
  }

  const handleCarve = () => {
    if (!carveEnabled) return
    play('card-confirm')
    persistScheduleDraft()
    if (getDraft()) setDraft({ step: 'summary' })
    setFireActive(true)
  }

  // ATTUNE MOVEMENTS routes to /attune. The draft is the source of truth
  // — no syncActiveCycle, no active-cycle-id mutation. Attune reads draft
  // directly via loadDraftOrActive.
  const handleAttuneHandoff = () => {
    play('option-select')
    persistScheduleDraft()
    if (getDraft()) setDraft({ step: 'attune' })
    router.push('/attune')
  }

  const batchMuscleState = (muscleId) => {
    if (selectedDays.size === 0) return false
    return [...selectedDays].every((k) => (assignments[k] || new Set()).has(muscleId))
  }

  const badgeMuscles = (key) => {
    const set = assignments[key]
    if (!set || set.size === 0) return []
    return MUSCLE_ORDER.filter((m) => set.has(m))
  }

  // Decorative month kanji — row 1 if ≥2 empty slots, else row 5
  const monthChars = [...MONTH_KANJI[month]]
  const row1Empty = cells.slice(0, 7).map((c, i) => c === null ? i : -1).filter((i) => i >= 0)
  const row5Empty = cells.slice(28, 35).map((c, i) => c === null ? i + 28 : -1).filter((i) => i >= 0)
  const targetSlots = row1Empty.length >= 2 ? row1Empty : row5Empty
  const startOffset = Math.max(0, Math.floor((targetSlots.length - monthChars.length) / 2))
  const emptyKanji = {}
  // The cell indices where the month kanji renders. The Attune Movements
  // button is positioned absolutely over these same cells (out of grid
  // flow, so calendar cells lay out exactly as production).
  const kanjiCells = []
  monthChars.forEach((ch, ci) => {
    const slotIdx = startOffset + ci
    if (slotIdx < targetSlots.length) {
      emptyKanji[targetSlots[slotIdx]] = ch
      kanjiCells.push(targetSlots[slotIdx])
    }
  })
  // Stable cache key so the measurement effect only re-runs on month change.
  const kanjiCellsKey = kanjiCells.join(',')

  // Measure the kanji cells' bounding box and write the result to
  // `attuneRect`. Position-absolute overlay below reads this; keeps the
  // Attune button out of the CSS grid's auto-placement so the calendar
  // cells lay out exactly as if no button existed.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid || kanjiCells.length === 0) {
      setAttuneRect(null)
      return
    }
    const measure = () => {
      const cellEls = grid.children
      const firstIdx = Math.min(...kanjiCells)
      const lastIdx = Math.max(...kanjiCells)
      const firstEl = cellEls[firstIdx]
      const lastEl = cellEls[lastIdx]
      if (!firstEl || !lastEl) {
        setAttuneRect(null)
        return
      }
      const gridRect = grid.getBoundingClientRect()
      const firstCellRect = firstEl.getBoundingClientRect()
      const lastCellRect = lastEl.getBoundingClientRect()
      setAttuneRect({
        top: firstCellRect.top - gridRect.top,
        left: firstCellRect.left - gridRect.left,
        width: lastCellRect.right - firstCellRect.left,
        height: firstCellRect.height,
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(grid)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [kanjiCellsKey])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="relative h-[100dvh] flex flex-col overflow-hidden bg-gtl-void">
      {/* Kanji stamp animation */}
      <style>{`
        @keyframes kanji-stamp {
          0%   { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .kanji-stamp { animation: kanji-stamp 150ms ease-out both; }
        @keyframes carve-blade {
          0%   { clip-path: inset(0 0 100% 100%); opacity: 0; }
          5%   { opacity: 1; }
          100% { clip-path: inset(0 0 0 0); opacity: 1; }
        }
        button[data-carve]:active,
        button[data-carve]:focus {
          transform: skewX(-2deg) !important;
        }
        @keyframes carve-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(228,176,34,0.4); }
          50%      { box-shadow: 0 0 20px rgba(228,176,34,0.8), 0 0 40px rgba(228,176,34,0.3); }
        }
        @keyframes wrap-continuity-pulse {
          0%   { box-shadow: inset 0 0 0 0 rgba(212, 24, 31, 0); }
          20%  { box-shadow: inset 0 0 0 3px rgba(212, 24, 31, 0.85); }
          100% { box-shadow: inset 0 0 0 0 rgba(212, 24, 31, 0); }
        }
        .wrap-continuity-pulse { animation: wrap-continuity-pulse 1000ms ease-out 200ms both; }
      `}</style>
      {/* Atmospherics */}
      <div className="absolute inset-0 gtl-noise" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(122,14,20,0.25) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.35) 100%)' }} />

      {/* Content wrapper — atmospheric layers paint full-bleed (incl. safe area). */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <nav
        className="relative flex items-center justify-center gap-4 px-4 pb-1 border-b border-gtl-edge/40 shrink-0"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        {/* RetreatButton self-positions fixed top-left (canonical component);
            the prev/label/next centered group below is naturally symmetric. */}
        <RetreatButton href={backHref} />
        <MonthNavButton dir="prev" onClick={prevMonth} />
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl leading-none text-gtl-chalk tracking-tight">
            {MONTH_NAMES[month]}
          </span>
          <span className="font-mono text-[10px] tracking-[0.3em] text-gtl-red font-bold">
            {year}
          </span>
        </div>
        <MonthNavButton dir="next" onClick={nextMonth} />
      </nav>

      {/* ── Calendar ────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-3 pt-0 pb-0 shrink-0">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-0.5 text-center font-mono text-[14px] tracking-wide font-bold uppercase
                ${i === 0 || i === 6 ? 'text-gtl-red/80' : 'text-gtl-ash'}`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 5-row day grid — fixed 75px rows. relative positioning context
            for the Attune Movements absolute overlay rendered below.
            isolation:isolate scopes the Attune button's mix-blend-difference
            to this subtree (kanji backdrop + Attune text), which Safari/iOS
            WebKit needs to apply the blend correctly. */}
        <div
          ref={gridRef}
          className="relative grid grid-cols-7 grid-rows-5 gap-1"
          style={{ height: `${ROW_H * 5 + 4 * 4}px`, isolation: 'isolate' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {cells.map((d, i) => {
            if (d === null) {
              const ch = emptyKanji[i]
              return (
                <div key={`pad-${i}`} className="relative overflow-hidden border border-transparent" style={{ clipPath: CELL_CLIP, height: `${ROW_H}px` }}>
                  {/* Cell-rendered kanji intentionally omitted — the
                      AttuneMovementsButton overlay renders its own
                      mix-blend-difference copy of the month kanji.
                      Letting both render produced a doubled image
                      visible through the wrapper's semi-transparent
                      background. */}
                </div>
              )
            }

            const key        = isoKey(d)
            const selected   = selectedDays.has(key)
            const autoRest   = !selected
                              && firstSelectedKey
                              && key > firstSelectedKey
                              && key < lastSelectedKey
            const todayCell  = isToday(d)
            const past       = isPast(d)
            const isWrapped   = wrappedDays.has(d)
            const isFlowEnd   = wrapActive && d === flowEndDay
            const isFirstWrap = wrapActive && d === firstWrapDay
            // Pulse fires for the full group (flow-end + every wrap cell). Static glyphs +
            // edge accents stay restricted to the pair (flow-end + first wrap).
            const pulseGroup  = isFlowEnd || isWrapped
            const badges     = badgeMuscles(key)
            const hasMuscles = badges.length > 0

            return (
              <button
                key={`${key}-${i}`}
                type="button"
                data-day={d}
                onClick={() => tapDay(d)}
                disabled={past}
                className={`
                  relative overflow-hidden border transition-colors duration-150
                  ${past ? 'opacity-25 cursor-not-allowed' : ''}
                  ${selected
                    ? 'bg-gtl-red/30 border-gtl-red-bright'
                    : todayCell
                    ? 'bg-gtl-ink border-gtl-gold'
                    : 'bg-gtl-ink border-gtl-edge'}
                  ${pulseGroup ? 'wrap-continuity-pulse' : ''}
                `}
                style={{ clipPath: CELL_CLIP, height: `${ROW_H}px` }}
              >
                {todayCell && !hasMuscles && !selected && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gtl-gold" aria-hidden="true" />
                )}

                {/* Wrap-continuity cues — only on the paired flow-end / wrapped cells.
                    GTL red (#d4181f) so they read with the rest of the palette
                    instead of fighting today's gold border. */}
                {isFlowEnd && (
                  <>
                    <div className="absolute top-0 right-0 bottom-0 w-[2px] pointer-events-none"
                         style={{ background: '#d4181f', boxShadow: '0 0 6px rgba(212,24,31,0.7)' }}
                         aria-hidden="true" />
                    <span className="absolute top-1 right-1 font-mono text-[12px] font-semibold leading-none pointer-events-none select-none"
                          style={{ color: '#d4181f' }}
                          aria-hidden="true">↗</span>
                  </>
                )}
                {isFirstWrap && (
                  <>
                    <div className="absolute top-0 left-0 bottom-0 w-[2px] pointer-events-none"
                         style={{ background: '#d4181f', boxShadow: '0 0 6px rgba(212,24,31,0.7)' }}
                         aria-hidden="true" />
                    <span className="absolute bottom-1 left-1 font-mono text-[12px] font-semibold leading-none pointer-events-none select-none"
                          style={{ color: '#d4181f' }}
                          aria-hidden="true">↙</span>
                  </>
                )}

                {/* Date watermark */}
                <span
                  className="absolute inset-0 flex items-center justify-center font-display leading-none select-none pointer-events-none"
                  style={{
                    fontSize: '2.5rem',
                    opacity: isWrapped ? 0.12 : (hasMuscles ? 0.15 : (selected ? 0.25 : 0.18)),
                    color: selected ? '#f5f0e8' : todayCell ? '#e4b022' : '#c8c0b0',
                  }}
                  aria-hidden="true"
                >
                  {d}
                </span>

                {/* Kanji overlay — progressive sizing based on count */}
                {hasMuscles && (() => {
                  const count = badges.length
                  const kanjiColor = selected ? '#f5f0e8' : '#d4181f'
                  const shadow = '1px 1px 0 rgba(0,0,0,0.5)'
                  const serif = '"Noto Serif JP", "Yu Mincho", serif'
                  if (count === 1) {
                    return (
                      <span className="absolute inset-0 z-10 flex items-center justify-center select-none pointer-events-none kanji-stamp"
                        key={badges[0]}
                        style={{ fontFamily: serif, fontSize: '3.5rem', color: kanjiColor, textShadow: shadow, lineHeight: 1 }} aria-hidden="true">
                        {MUSCLE_KANJI[badges[0]]}
                      </span>
                    )
                  }
                  if (count <= 3) {
                    const sz = count === 2 ? '2.2rem' : '1.6rem'
                    return (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center select-none pointer-events-none"
                        style={{ fontFamily: serif, fontSize: sz, color: kanjiColor, textShadow: shadow, lineHeight: 1.2, gap: '2px' }} aria-hidden="true">
                        {badges.map((m) => <span key={m} className="kanji-stamp">{MUSCLE_KANJI[m]}</span>)}
                      </div>
                    )
                  }
                  // 4-6 → 2-column at 22px
                  if (count <= 6) {
                    return (
                      <div className="absolute inset-0 z-10 grid grid-cols-2 gap-x-3 gap-y-0 justify-items-center content-center px-1 select-none pointer-events-none"
                        style={{ fontFamily: serif, fontSize: '1.4rem', lineHeight: '1.25', color: kanjiColor, textShadow: shadow }} aria-hidden="true">
                        {badges.map((m) => <span key={m} className="kanji-stamp">{MUSCLE_KANJI[m]}</span>)}
                      </div>
                    )
                  }
                  // 7+ → 2-column compact
                  return (
                    <div className="absolute inset-0 z-10 grid grid-cols-2 gap-x-2 gap-y-0 justify-items-center content-center px-0.5 select-none pointer-events-none"
                      style={{ fontFamily: serif, fontSize: '0.9rem', lineHeight: '1.2', color: kanjiColor, textShadow: shadow }} aria-hidden="true">
                      {badges.map((m) => <span key={m} className="kanji-stamp">{MUSCLE_KANJI[m]}</span>)}
                    </div>
                  )
                })()}

                {/* Rest indicator — shown for both intentional rest (selected, no muscles)
                    and auto-rest gaps (unselected day between first/last picked). */}
                {((selected && !hasMuscles) || autoRest) && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center font-display text-lg text-gtl-paper/60 leading-none -rotate-12 pointer-events-none">✕</span>
                )}

                {/* TODAY */}
                {todayCell && !hasMuscles && !selected && (
                  <span className="absolute bottom-1 left-0 right-0 z-10 text-center font-mono text-[6px] tracking-[0.2em] uppercase text-gtl-gold leading-none pointer-events-none">TODAY</span>
                )}
              </button>
            )
          })}

          {/* Attune Movements entry — absolute overlay measured to the
              kanji cells' bounding box (see attuneRect useEffect above).
              Out of grid flow → does not displace calendar auto-placement.
              Always rendered when the kanji has a position; activates the
              moment any day is selected. */}
          {attuneRect && (
            <div
              style={{
                position: 'absolute',
                top: `${attuneRect.top}px`,
                left: `${attuneRect.left}px`,
                width: `${attuneRect.width}px`,
                height: `${attuneRect.height}px`,
                // clipPath restricts the click area to the slash silhouette,
                // so taps in the wrapper's bounding-box corners pass through
                // to underlying day cells. Also clips the homescreen-style
                // background inside the button to the slash shape.
                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
              }}
            >
              <AttuneMovementsButton
                enabled={selectedDays.size > 0}
                monthKanji={MONTH_KANJI[month]}
                onTap={handleAttuneHandoff}
                onHover={() => play('button-hover')}
              />
            </div>
          )}
          {/* Yakiire flame overlay — sibling of the mix-blend wrapper so
              flames stay their natural orange (not difference-blended).
              Mounts whenever any day is selected and burns continuously
              until the selection is cleared or CARVE navigates away. */}
          {attuneRect && attuneIgniteKey > 0 && (
            <AttuneFlameLayer rect={attuneRect} />
          )}
        </div>
      </section>

      {/* Red accent line */}
      <div className="h-[2px] bg-gtl-red shrink-0" />

      {/* Logo — visible when no days selected */}
      {!sheetOpen && (
        <div className="flex-1 flex items-center justify-center opacity-30 overflow-hidden">
          <img
            src="/logo.png"
            alt="Gritted Teeth Lifestyle"
            className="-rotate-6"
            style={{ width: 226, height: 226, borderRadius: '50%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Muscle grid — fills remaining viewport, scrolls internally if needed.
          Calendar above is shrink-0 (always full 5 rows visible, never scrolls). */}
      {sheetOpen && (
        <div className="flex-1 overflow-y-auto px-3 pt-0 pb-1">
          <div className="grid grid-cols-2 grid-rows-6 gap-1" style={{ overflow: 'visible' }}>
            {SHEET_MUSCLES.map((m) => (
              <SheetMuscleButton
                key={m.id}
                kanji={m.kanji}
                label={m.label}
                active={batchMuscleState(m.id)}
                onClick={() => toggleMuscle(m.id)}
              />
            ))}
            <SheetCarveButton
              count={cycleDays}
              enabled={carveEnabled}
              onFire={handleCarve}
              onHover={() => play('button-hover')}
              onSlash={() => play(Math.random() < 0.2 ? 'slash-alt' : 'slash')}
            />
          </div>
        </div>
      )}

      </div>
      <FireTransition
        active={fireActive}
        onComplete={() => { if (!skippedRef.current) router.push(NEXT_TARGET) }}
      />
      <SlashWipe
        active={quickHeistActive}
        onComplete={() => { if (!skippedRef.current) router.push(NEXT_TARGET) }}
      />
      <SpeedLines active={quickForgeRunning} />
    </main>
  )
}
