'use client'
/*
 * /fitness/new/summary — Mission Briefing.
 *
 * For short cycles (<7 days): THE BLADE — a vertical katana with days
 * etched along it. For longer cycles (>=7 days): classic day card grid.
 */
import { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSound } from '../../../../lib/useSound'
import { useProfileGuard } from '../../../../lib/useProfileGuard'
import { pk } from '../../../../lib/storage'
import FireTransition from '../../../../components/FireTransition'
import RetreatButton from '../../../../components/RetreatButton'
import SpeedLines from '../../../../components/SpeedLines'

const MUSCLE_LABELS = {
  chest: 'CHEST', back: 'BACK', shoulders: 'SHOULDERS',
  biceps: 'BICEPS', triceps: 'TRICEPS', forearms: 'FOREARMS',
  abs: 'ABS', glutes: 'GLUTES', quads: 'QUADS',
  hamstrings: 'HAMSTRINGS', calves: 'CALVES',
}
const MUSCLE_KANJI = {
  chest: '胸', shoulders: '肩', back: '背', biceps: '二', triceps: '三',
  forearms: '腕', quads: '腿', hamstrings: '裏', calves: '脛', glutes: '尻', abs: '腹',
}

const DAY_SHORT   = ['SUN','MON','TUE','WED','THU','FRI','SAT']
const MONTH_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

const CARD_ROTATIONS = ['-0.8deg','0.6deg','-0.5deg','0.9deg','-0.7deg','0.4deg','-1deg','0.7deg','-0.6deg','0.8deg']
const SLAB_ROTATIONS = ['-1.5deg','1deg','-0.8deg','1.5deg','-1.2deg','0.8deg','-1.8deg','1.2deg','-0.6deg','1.4deg','-1deg']

function parseDate(iso) {
  return new Date(iso + 'T12:00:00')
}

// Per-element randomized CSS vars for the flame-engulf bloom. Each seed yields a unique
// duration/blur/glow combo so no two blooms render identically across the cascade.
function engulfVars(seed) {
  const h = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
  const r1 = h(seed * 7 + 3)
  const r2 = h(seed * 11 + 17)
  const r3 = h(seed * 13 + 29)
  return {
    '--engulf-dur': `${220 + r1 * 120}ms`,
    '--engulf-opacity-start': `${0.45 + r2 * 0.25}`,
    '--engulf-glow-1':  `${4  + r1 * 6}px`,
    '--engulf-glow-1b': `${12 + r2 * 10}px`,
    '--engulf-glow-1c': `${22 + r3 * 14}px`,
    '--engulf-glow-2':  `${8  + r1 * 6}px`,
    '--engulf-glow-2b': `${20 + r3 * 10}px`,
    '--engulf-blur-1':  `${1.0 + r2 * 1.2}px`,
    '--engulf-blur-2':  `${2.2 + r3 * 2.0}px`,
    '--engulf-blur-3':  `${4.0 + r1 * 2.5}px`,
  }
}

/* ── Compact muscle chip ── */
function MuscleChip({ id, index = 0 }) {
  const rot = SLAB_ROTATIONS[index % SLAB_ROTATIONS.length]
  return (
    <div
      className="px-4 py-2 bg-gtl-red border border-gtl-red-bright shadow-red-glow shrink-0"
      style={{
        clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
        transform: `rotate(${rot})`,
        transformOrigin: 'center center',
      }}
    >
      <div className="font-display text-base text-gtl-paper leading-none whitespace-nowrap">
        {MUSCLE_LABELS[id] || id.toUpperCase()}
      </div>
    </div>
  )
}

/* ── Day dossier card (used for >= 7 day cycles) ── */
function DayCard({ iso, muscles, index }) {
  const date    = parseDate(iso)
  const dayName = DAY_SHORT[date.getDay()]
  const dayNum  = date.getDate()
  const mon     = MONTH_SHORT[date.getMonth()]
  const hasWork = muscles.length > 0
  const rot     = CARD_ROTATIONS[index % CARD_ROTATIONS.length]

  return (
    <div
      className={`flex flex-col border-l-4 bg-gtl-ink border-r border-t border-b
        ${hasWork ? 'border-l-gtl-red border-t-gtl-edge border-r-gtl-edge border-b-gtl-edge' : 'border-l-gtl-smoke border-t-gtl-edge border-r-gtl-edge border-b-gtl-edge'}`}
      style={{ transform: `rotate(${rot})`, transformOrigin: 'center top', overflow: 'visible' }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className={`font-display text-3xl leading-none tracking-widest ${hasWork ? 'text-gtl-red' : 'text-gtl-smoke'}`}>
          {dayName}
        </div>
        <div className="flex items-baseline gap-2 mt-0">
          <span className={`font-display leading-none ${hasWork ? 'text-gtl-chalk' : 'text-gtl-ash'}`}
                style={{ fontSize: 'clamp(3rem, 5vw, 5rem)' }}>
            {dayNum}
          </span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-smoke">{mon}</span>
        </div>
      </div>
      {hasWork && (
        <div className="mx-4 mb-3 h-0.5 bg-gtl-red" style={{ transform: 'skewX(-8deg)' }} />
      )}
      <div className="px-4 pb-6 pt-1 flex flex-wrap gap-x-3 gap-y-4 min-h-[2rem]" style={{ overflow: 'visible' }}>
        {hasWork
          ? muscles.map((id, i) => <MuscleChip key={id} id={id} index={i} />)
          : <span className="font-mono text-[8px] tracking-[0.2em] uppercase text-gtl-smoke self-center">REST</span>}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   THE BLADE — potrace-traced wakizashi for cycles < 7 days.
   Source: public/reference/wakizashi.png → threshold → potrace → SVG.
   Diagonal pose: hilt upper-right, tip lower-left.
   ══════════════════════════════════════════════════════════════════════════ */
function CycleBlade({ days, dailyPlan, glowingDays = [], glowIntensity = 'off', hotDays = [], cooledDays = [], weekdayLetterIgnited = [], weekdayLetterZoomed = [], weekdayLetterCooled = [] }) {
  const anyGlowing = glowingDays.some(Boolean)
  const anyWeekdayIgnited = Array.isArray(weekdayLetterIgnited) && weekdayLetterIgnited.some(Boolean)
  const first = days[0] ? parseDate(days[0]) : null
  const last  = days[days.length - 1] ? parseDate(days[days.length - 1]) : null
  const dateRange = first && last
    ? `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} — ${MONTH_SHORT[last.getMonth()]} ${last.getDate()}`
    : ''

  // Backdrop renders client-side only — guarantees no hydration mismatch even if the bundler/browser
  // serializes the extra <img> differently between server and client.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Interior anchors — on the mune-side edge of the hi (fuller/blood groove).
  // This is the red-to-dark transition line INSIDE the blade face, ~45% from mune edge.
  // ~140px margin to mune, ~175px margin to ha — plenty of room for inscriptions.
  const INTERIOR_ANCHORS = [
    { x: 1355.48, y: 541.87, angle: 94.4 },
    { x: 1339.68, y: 758.88, angle: 95.1 },
    { x: 1318.07, y: 974.92, angle: 96.5 },
    { x: 1291.49, y: 1190.98, angle: 98.0 },
    { x: 1258.11, y: 1408.07, angle: 100.2 },
    { x: 1214.47, y: 1624.14, angle: 101.5 },
  ]
  // For weekday side label positioning (uses y-values only)
  const FACE_ANCHORS = INTERIOR_ANCHORS.map(a => [a.x, a.y])

  const dayLabels = days.map((iso, i) => {
    const d = parseDate(iso)
    const num = String(d.getDate())
    const muscles = dailyPlan[iso] || []
    const hasWork = muscles.length > 0
    const kanjiStr = hasWork
      ? muscles.map((m) => MUSCLE_KANJI[m] || '?').join('')
      : '休'
    const anchor = INTERIOR_ANCHORS[i] || INTERIOR_ANCHORS[INTERIOR_ANCHORS.length - 1]
    return { num, hasWork, kanjiStr, iso, cx: anchor.x, cy: anchor.y, angle: anchor.angle }
  })

  const renderDayInscription = (dl, { outline = false, maskFill = null, hot = false } = {}) => {
    const { num, kanjiStr } = dl
    const kanjiChars = kanjiStr.split('')
    const n = kanjiChars.length
    const baseOpacity = 1.0
    const font = '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
    const outlineProps = outline
      ? { stroke: '#000', strokeWidth: 1, paintOrder: 'stroke' }
      : {}

    // 3D embossed depth: 4 stacked layers with progressive y-offset + darkening ramp.
    // Red stack is the default pre-ignition color; hot stack is the dark-orange ignited
    // state (post-flame, persists until navigation). maskFill (mask + zoom-burst passes)
    // collapses to a single flat layer so the silhouette stays crisp.
    const DEPTH_STACK_RED = [
      { dy: 3, fill: '#3a0608' },
      { dy: 2, fill: '#6b0b10' },
      { dy: 1, fill: '#9e1118' },
      { dy: 0, fill: '#d4181f' },
    ]
    const DEPTH_STACK_HOT = [
      { dy: 3, fill: '#ffffff' },
      { dy: 2, fill: '#ffe0a0' },
      { dy: 1, fill: '#d85a10' },
      { dy: 0, fill: '#ff6600' },
    ]
    const stack = hot ? DEPTH_STACK_HOT : DEPTH_STACK_RED
    const layers = maskFill ? [{ dy: 0, fill: maskFill }] : stack

    // Dark stroke on the face layer of the HOT base inscription only. Creates a consistent
    // dark neighborhood around each letter so simultaneous-contrast doesn't make the orange
    // read as different colors over the red blade vs the black background. Mask/zoom passes
    // use maskFill (no stroke); depth layers dy=3/2/1 stay stroke-free to keep the extrusion
    // shadows clean.
    const hotStrokeProps = (isFace) =>
      (hot && !maskFill && isFace)
        ? { stroke: '#1a0500', strokeWidth: 2, paintOrder: 'stroke' }
        : {}

    const renderText = (keyBase, x, y, fontSize, char) => layers.map((layer, li) => {
      const isFace = li === layers.length - 1
      return (
        <text key={`${keyBase}-${li}`} x={x} y={y + layer.dy} textAnchor="middle" dominantBaseline="central"
          {...outlineProps} {...hotStrokeProps(isFace)}
          style={{ fontFamily: font, fontSize: `${fontSize}px`, fontWeight: 600, fill: layer.fill, opacity: baseOpacity }}>
          {char}
        </text>
      )
    })

    const numEls = renderText('num', 0, 0, 68, num)

    let kanjiEls
    if (n === 1) {
      kanjiEls = renderText('kj0', 0, 60, 104, kanjiChars[0])
    } else if (n <= 7) {
      // n=2..7: pair columns in rows of 2; an odd last kanji sits centered in the final row.
      let fontSize, colSpacing, baseY, rowYStep
      if (n <= 4) {
        fontSize = 56; colSpacing = 56; baseY = 60; rowYStep = 58
      } else if (n <= 6) {
        fontSize = 48; colSpacing = n === 5 ? 57 : 44; baseY = 46; rowYStep = 42
      } else {
        // n === 7 — 4 rows × 2 cols, last row is a centered singleton
        fontSize = 38; colSpacing = 44; baseY = 42; rowYStep = 36
      }
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    } else if (n <= 11) {
      // n=8..11: 4 columns × 2 rows (squat wide grid). n=9/10/11 add a row 3 with 1/2/3 kanji
      // at the midpoint gaps between adjacent columns of the 4-col grid above.
      const fontSize = 28
      const P = 30           // column pitch — columns at -1.5P, -0.5P, +0.5P, +1.5P
      const baseY = 38
      const rowYStep = 28
      // Row-3 gap positions (midpoints between adjacent columns): -P, 0, +P
      const row3Positions = n === 9 ? [0] : n === 10 ? [-P, P] : n === 11 ? [-P, 0, P] : null
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        let x, y
        if (ki < 8) {
          const row = Math.floor(ki / 4)
          const col = ki % 4
          x = (col - 1.5) * P
          y = baseY + row * rowYStep
        } else {
          x = row3Positions[ki - 8]
          y = baseY + 2 * rowYStep
        }
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    } else {
      // n=12 speculative (max live n=11): every column of the 4-col grid takes a 3rd kanji.
      const fontSize = 28
      const P = 30
      const baseY = 38
      const rowYStep = 28
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const x = ((ki % 4) - 1.5) * P
        const y = baseY + Math.floor(ki / 4) * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    }

    return <>{numEls}{kanjiEls}</>
  }

  const lastIdx = dayLabels.length - 1
  const lastDay = lastIdx >= 0 ? dayLabels[lastIdx] : null

  return (
    <section className="relative z-10 py-2 px-2 pointer-events-none min-h-[calc(100vh-7px)]">
      {false && (
      <div className="text-center mb-1">
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '11px', letterSpacing: '0.2em', color: '#5a5a62' }}>
          {dateRange}
        </span>
      </div>
      )}

      <div>
        {/* Blade container — 180vw overflow wrapper, bottom-anchored to the section so the tip sits ~24px above the viewport bottom.
            The section's pointer-events-none keeps the blade's overflow from swallowing clicks on the nav and fixed button above. */}
        <div style={{ position: 'absolute', bottom: '6px', left: 0, width: '180vw', maxWidth: 'none', marginLeft: 'calc(-40vw - 80px)', transform: 'rotate(11deg) scale(0.5625)', transformOrigin: '34.4% 97.7%' }}>
          {/* Black backdrop — outer-subpath-only SVG (inner hole subpaths stripped out).
              Same viewBox + same rotate/translate/scale transforms as the red weapon,
              so it aligns pixel-exact. No interior holes means the page gradient can't
              bleed through handle binding, tsuba interior, or blade interior.
              Rendered post-mount to sidestep any SSR/CSR hydration mismatch. */}
          {mounted && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/reference/wakizashi_solid_silhouette.svg"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 block w-full h-auto"
            />
          )}
          {/* Potrace-traced wakizashi — rotated -45deg, tight viewBox 668,-635,1136,2642 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reference/wakizashi_styled.svg"
          alt="Wakizashi"
          className="relative block w-full h-auto"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
        />

        {/* Engraved day labels along the blade spine — same viewBox as weapon SVG */}
        <svg
          viewBox="668 -635 1136 2642"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ top: '-15px', left: '0px' }}
          aria-hidden="true"
        >
          <defs>
            {/* Blade silhouette clip — spine edge + ha edge */}
            <clipPath id="blade-clip">
              <polygon points="
                1180,180 1100,520 1010,880 920,1240 860,1490 840,1600
                925,1655
                1010,1710 1130,1610 1225,1420 1330,1040 1400,700 1460,380
              " />
            </clipPath>
            {/* Half-plane clips in each glyph's local rotated frame — split the last day across the interior design line */}
            <clipPath id="last-day-left" clipPathUnits="userSpaceOnUse">
              <rect x="-500" y="-500" width="500" height="1000" />
            </clipPath>
            <clipPath id="last-day-right" clipPathUnits="userSpaceOnUse">
              <rect x="0" y="-500" width="500" height="1000" />
            </clipPath>
            {/* Inscription-window mask — white-filled glyph duplicates inside an
                otherwise-black rect. Everything drawn with mask='url(#inscription-window)'
                is clipped to the glyph silhouettes: visible inside letters, hidden
                outside. Used to turn the inscriptions into flame-filled windows. */}
            <mask id="inscription-window" maskUnits="userSpaceOnUse" x="668" y="-635" width="1136" height="2642">
              <rect x="668" y="-635" width="1136" height="2642" fill="black"/>
              {/* Only currently-glowing days contribute to the mask. Once a day transitions to
                  hot, dropping it from the mask lets the dark-underlay rect stop bleeding through
                  that glyph, exposing the hot-orange base inscription cleanly. */}
              {dayLabels.map((dl, i) => glowingDays[i] ? (
                <g key={`mask-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(${dl.angle - 90})`}>
                  {renderDayInscription(dl, { maskFill: 'white' })}
                </g>
              ) : null)}
            </mask>
            {/* Weekday-label yakiire mask — white-filled weekday glyphs carved into the
                overlay's viewBox. Particles clipped through this appear inside the SUN/MON/…
                letters only. Mask is built unconditionally; the particle group below only
                renders while weekdaysIgnited && !weekdaysCooled. */}
            <mask id="weekday-window" maskUnits="userSpaceOnUse" x="668" y="-635" width="1136" height="2642">
              <rect x="668" y="-635" width="1136" height="2642" fill="black"/>
              {dayLabels.map((dl, i) => {
                const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                const isLeftSide = i < 3
                const yNudge = isLeftSide ? 0 : 10
                const LEFT_X  = [1001,  998, 1001]
                const RIGHT_X = [1597, 1572, 1542]
                const labelX = isLeftSide ? LEFT_X[i] : RIGHT_X[i - 3]
                const labelY = dl.cy + yNudge
                const ADVANCE = 46
                return (
                  <g key={`wd-mask-${dl.iso}`} transform={`rotate(-11 ${labelX} ${labelY})`}>
                    {dow.split('').map((ch, L) => {
                      const lit = !!weekdayLetterIgnited[i * 3 + L]
                      const x = labelX + (isLeftSide ? L : -(2 - L)) * ADVANCE
                      return (
                        <text key={`wd-mask-${dl.iso}-${L}`}
                          x={x} y={labelY}
                          textAnchor={isLeftSide ? 'start' : 'end'}
                          dominantBaseline="central"
                          style={{
                            fontFamily: '"Noto Serif JP", Georgia, serif',
                            fontSize: '45px',
                            fontWeight: 700,
                            fill: 'white',
                            opacity: lit ? 1 : 0,
                          }}>
                          {ch}
                        </text>
                      )
                    })}
                  </g>
                )
              })}
            </mask>
          </defs>
          {/* Flame-aura overlay — mounts while ANY inscription is still glowing. Per-day
              particle subsets unmount as each day transitions out of glowing, so the flames
              retract one-by-one in sync with the cascade. */}
          {anyGlowing && (
            <>
              {/* Particles clipped to the inscription silhouettes via SVG mask.
                  Wide horizontal spread (±90 viewBox units, broader than glyph width)
                  gives the particles material to flow through the glyph 'windows'.
                  SVG <animateTransform> ensures the rise direction is in the blade's
                  tilted local frame — particles flow up-along-blade through the cutouts.
                  Deterministic per-index delay keeps SSR/CSR consistent. */}
              <g mask="url(#inscription-window)" style={{ pointerEvents: 'none' }}>
                {/* Dark underlay — same rect as the mask region, filled gtl-void so the
                    glyph windows show near-black instead of the red blade. Orange particles
                    on black = high contrast regardless of position; orange on red bled. */}
                <rect x="668" y="-635" width="1136" height="2642" fill="#0a0a0a"/>
                {(() => {
                  // GLSL-style fractional-sin hash — adjacent integer seeds produce wildly
                  // uncorrelated outputs in [0, 1). Same input → same output (SSR/CSR safe),
                  // but no visible banding the way (k*97) % 1000 has.
                  const hash01 = (n) => {
                    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
                    return x - Math.floor(x)
                  }
                  return dayLabels.flatMap((dl, dayIdx) => {
                    if (!glowingDays[dayIdx]) return []
                    const PARTS = 12
                    return Array.from({ length: PARTS }).map((_, i) => {
                      const k = i + dayIdx * 23
                      const rX      = hash01(k * 1)
                      const rXj     = hash01(k * 2 + 5)
                      const rDly    = hash01(k * 3 + 11)
                      const rDur    = hash01(k * 5 + 17)
                      const rRise   = hash01(k * 7 + 19)
                      const rSize   = hash01(k * 11 + 23)
                      const rPeak   = hash01(k * 13 + 29)
                      const rDrft   = hash01(k * 17 + 31)
                      const rStartJ = hash01(k * 19 + 37)
                      const rEndR   = hash01(k * 23 + 41)

                      const xOff   = (rX - 0.5) * 200 + (rXj - 0.5) * 60
                      const delay  = (rDly * 540 + dayIdx * 131) % 600       // 0-600ms spawn window, stagger via 131
                      const dur    = 130 + rDur * 150                        // 130-280ms (2x faster — pixel-per-ms doubled)
                      const rise   = 280 + rRise * 200                       // 280-480 vb units
                      const size   = 20 + rSize * 38                         // r 20-58
                      const peakA  = 0.5 + rPeak * 0.5                       // 0.5-1.0
                      const driftX = (rDrft - 0.5) * 180                     // ±90 lateral
                      const startY = 120 + (rStartJ - 0.5) * 140             // ±70 start-y jitter
                      const endR   = 2 + rEndR * 4                           // 2-6 shrink-to-dot

                      return (
                        <circle
                          key={`${dl.iso}-sp${i}`}
                          cx={dl.cx + xOff}
                          cy={dl.cy + startY}
                          r={size}
                          fill="#ff5000"
                          opacity={0}
                        >
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; ${(driftX * 0.4).toFixed(2)} -${(rise * 0.5).toFixed(2)}; ${driftX.toFixed(2)} -${rise.toFixed(2)}`}
                            dur={`${dur.toFixed(0)}ms`}
                            begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          {/* Trapezoidal opacity: ignite in 4%, hold 71% at peak, 25% fade. Constant burn. */}
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.04; 0.75; 1"
                            dur={`${dur.toFixed(0)}ms`}
                            begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="r"
                            values={`${size.toFixed(2)}; ${size.toFixed(2)}; ${endR.toFixed(2)}`}
                            dur={`${dur.toFixed(0)}ms`}
                            begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            </>
          )}
          {/* Base inscriptions — per-day wrapper so each day can flip to hot independently.
              Pre-ignition: difference-blend red (reads dark carved). Post-ignition: normal blend
              over dark-orange DEPTH_STACK_HOT + warm drop-shadow halo that ramps in over 300ms. */}
          {/* Two decoupled animations: hot-hold keeps the bright glow in place as long as the
              .inscription-hot class is applied; cool-down plays once over 700ms when cooledDays
              flips and the class swaps to .inscription-cooled. Both ends declare 4 drop-shadows
              so CSS can smoothly interpolate between HOT and COOLED filter stacks. */}
          <style>{`
            @keyframes inscription-hot-hold {
              from, to { filter: drop-shadow(0 0 4px #fff4c9) drop-shadow(0 0 10px #ffa840) drop-shadow(0 0 22px rgba(255, 120, 0, 0.85)) drop-shadow(0 0 36px rgba(255, 80, 0, 0.5)); }
            }
            @keyframes inscription-cool-down {
              0%   { filter: drop-shadow(0 0 4px #fff4c9) drop-shadow(0 0 10px #ffa840) drop-shadow(0 0 22px rgba(255, 120, 0, 0.85)) drop-shadow(0 0 36px rgba(255, 80, 0, 0.5)); }
              100% { filter: drop-shadow(0 0 1.5px #ff8800) drop-shadow(0 0 4px rgba(255, 122, 0, 0.55)) drop-shadow(0 0 7px rgba(255, 80, 0, 0.2)) drop-shadow(0 0 7px rgba(255, 80, 0, 0)); }
            }
            .inscription-hot    { animation: inscription-hot-hold 100ms forwards; }
            .inscription-cooled { animation: inscription-cool-down 1000ms ease-out forwards; }
          `}</style>
          {dayLabels.map((dl, i) => {
            const textAngle = dl.angle - 90
            const isLast = i === lastIdx
            const hot = !!hotDays[i]
            const cooled = !!cooledDays[i]
            const flameOn = !!glowingDays[i]
            const cls = cooled ? 'inscription-cooled' : (hot ? 'inscription-hot' : '')
            return (
              <g key={dl.iso}
                 className={cls}
                 style={{
                   mixBlendMode: hot ? 'normal' : 'difference',
                   opacity: flameOn ? 0 : 1,
                   transition: 'opacity 0ms',
                 }}>
                <g transform={`translate(${dl.cx},${dl.cy}) rotate(${textAngle})`}>
                  {isLast ? (
                    <g clipPath="url(#last-day-right)">{renderDayInscription(dl, { hot })}</g>
                  ) : (
                    renderDayInscription(dl, { hot })
                  )}
                </g>
              </g>
            )
          })}
          {/* Last day's LEFT half — outside the main group so the design-line crossing stays plain
              (no difference blend) even in the red state. Uses hotDays[lastIdx] to sync with the
              last day's right half. */}
          {lastDay && (
            <g className={cooledDays[lastIdx] ? 'inscription-cooled' : (hotDays[lastIdx] ? 'inscription-hot' : '')}
               style={{
                 opacity: glowingDays[lastIdx] ? 0 : 1,
                 transition: 'opacity 0ms',
               }}>
              <g transform={`translate(${lastDay.cx},${lastDay.cy}) rotate(${lastDay.angle - 90})`}>
                <g clipPath="url(#last-day-left)">{renderDayInscription(lastDay, { outline: true, hot: !!hotDays[lastIdx] })}</g>
              </g>
            </g>
          )}
          {/* Zoom-burst finale — fires during the 'peak' glow phase. Each inscription
              spawns a bright near-white duplicate that rapidly scales from 1x to 12x
              while fading to zero. plus-lighter blend reads as light 'punching toward
              the viewer'. Inner <g> holds the scale animation so the outer <g>'s
              translate/rotate SVG attribute isn't clobbered by the CSS transform. */}
          {glowIntensity === 'peak' && (
            <>
              <style>{`
                @keyframes inscription-zoom {
                  0%   { transform: scale(1);    opacity: 1.0; }
                  30%  { transform: scale(1.4);  opacity: 1.0; }
                  70%  { transform: scale(1.68); opacity: 0.9; }
                  100% { transform: scale(1.85); opacity: 0; }
                }
                .inscription-zoom-burst .zoom-glyph {
                  transform-box: fill-box;
                  transform-origin: center;
                  animation: inscription-zoom 340ms ease-out forwards;
                  mix-blend-mode: plus-lighter;
                  filter: drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400);
                  /* Invisible before (during staggered delay) and after the animation — only
                     visible while the 280ms keyframes are running. Keyframe opacity drives reveal. */
                  opacity: 0;
                }
              `}</style>
              <g className="inscription-zoom-burst" style={{ mixBlendMode: 'plus-lighter', pointerEvents: 'none' }}>
                {dayLabels.map((dl, i) => (
                  <g key={`zoom-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(${dl.angle - 90})`}>
                    <g className="zoom-glyph" style={{ animationDelay: `${i * 220}ms` }}>
                      {renderDayInscription(dl, { maskFill: '#ff6600' })}
                    </g>
                  </g>
                ))}
                {lastDay && (
                  <g transform={`translate(${lastDay.cx},${lastDay.cy}) rotate(${lastDay.angle - 90})`}>
                    <g className="zoom-glyph" style={{ animationDelay: `${lastIdx * 220}ms` }}>
                      <g clipPath="url(#last-day-left)">{renderDayInscription(lastDay, { maskFill: '#ff6600' })}</g>
                    </g>
                  </g>
                )}
              </g>
            </>
          )}
          {/* Weekday labels — per-day ignition gate. Each text hides once its own weekday
              ignites (inscription cheat), so the staggered particle flames are the sole
              visible content inside that letter silhouette. Class goes on the <text> level
              so each weekday's hot-glow keyframe fires on its own schedule. */}
          <g>
            {dayLabels.map((dl, i) => {
              const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()]
              const isLeftSide = i < 3
              const yNudge = isLeftSide ? 0 : 10
              const LEFT_X  = [1001,  998, 1001]
              const RIGHT_X = [1597, 1572, 1542]
              const labelX = isLeftSide ? LEFT_X[i] : RIGHT_X[i - 3]
              const labelY = dl.cy + yNudge
              const ADVANCE = 46
              return (
                <g key={`dow-${dl.iso}`}>
                  {dow.split('').map((ch, L) => {
                    const flatIdx   = i * 3 + L
                    const isFlaming = !!weekdayLetterIgnited[flatIdx]
                    const isZoomed  = !!weekdayLetterZoomed[flatIdx]
                    const isCooled  = !!weekdayLetterCooled[flatIdx]
                    const isHot     = isZoomed && !isCooled
                    const fill      = (isHot || isCooled) ? '#d4181f' : '#b0a898'
                    const baseAlpha = (isHot || isCooled) ? 1 : 0.7
                    const textOpacity = isFlaming ? 0 : baseAlpha
                    const textClass = isCooled ? 'inscription-cooled' : (isHot ? 'inscription-hot' : '')
                    const x = labelX + (isLeftSide ? L : -(2 - L)) * ADVANCE
                    return (
                      <g key={`dow-${dl.iso}-${L}`}>
                        <text
                          x={x} y={labelY}
                          textAnchor={isLeftSide ? 'start' : 'end'}
                          dominantBaseline="central"
                          transform={`rotate(-11 ${labelX} ${labelY})`}
                          className={textClass}
                          style={{
                            fontFamily: '"Noto Serif JP", Georgia, serif',
                            fontSize: '45px',
                            fontWeight: 700,
                            fill,
                            opacity: textOpacity,
                            transition: 'opacity 0ms',
                          }}
                        >
                          {ch}
                        </text>
                        {isZoomed && (
                          <g transform={`rotate(-11 ${labelX} ${labelY})`}>
                            <text
                              x={x} y={labelY}
                              textAnchor={isLeftSide ? 'start' : 'end'}
                              dominantBaseline="central"
                              className="weekday-zoom-burst"
                              style={{
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: '45px',
                                fontWeight: 700,
                                fill: '#ff6600',
                                /* Override the class's transform-box: fill-box (which
                                   iOS PWA can't resolve on <text>). Inline transform-box
                                   + transform-origin in absolute SVG coords pins the
                                   scale's fixed point to the text anchor. */
                                transformBox: 'view-box',
                                transformOrigin: `${x}px ${labelY}px`,
                              }}
                            >
                              {ch}
                            </text>
                          </g>
                        )}
                        {isFlaming && (
                          <text
                            x={x} y={labelY}
                            textAnchor={isLeftSide ? 'start' : 'end'}
                            dominantBaseline="central"
                            transform={`rotate(-11 ${labelX} ${labelY})`}
                            className="weekday-flame-engulf"
                            style={{
                              ...engulfVars(i * 13 + L + 7),
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: '45px',
                              fontWeight: 700,
                            }}
                          >
                            {ch}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </g>
          {/* Weekday particle flames AFTER — clipped to weekday letter silhouettes via the
              weekday-window mask. Each weekday's particle subset mounts when its own
              weekdaysIgnited[wi] flips, producing the 60ms cascade. */}
          {anyWeekdayIgnited && (
            <g mask="url(#weekday-window)" style={{ pointerEvents: 'none' }}>
              {(() => {
                const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                const PARTS_PER_WEEKDAY = 45
                return dayLabels.flatMap((dl, wi) => {
                  const dayLit = weekdayLetterIgnited.slice(wi * 3, wi * 3 + 3).some(Boolean)
                  if (!dayLit) return []
                  const isLeftSide = wi < 3
                  // Per-day labelX drifts across the blade's rotated right edge, so use the
                  // SAME table the mask uses, then shift to the text center (±65 since text
                  // is ~130 viewBox units wide). Without this, right-side particles all cluster
                  // near x=1599 and miss the leftward-drifting 5th/6th labels.
                  const LEFT_X  = [1001,  998, 1001]
                  const RIGHT_X = [1597, 1572, 1542]
                  const labelX  = isLeftSide ? LEFT_X[wi] : RIGHT_X[wi - 3]
                  const baseX   = isLeftSide ? (labelX + 65) : (labelX - 65)
                  return Array.from({ length: PARTS_PER_WEEKDAY }).map((_, i) => {
                    const k = i + wi * 23
                    const rX    = hash01(k * 1)
                    const rDly  = hash01(k * 3 + 11)
                    const rDur  = hash01(k * 5 + 17)
                    const rSize = hash01(k * 11 + 23)
                    const rPeak = hash01(k * 13 + 29)
                    const xOff  = (rX - 0.5) * 220
                    const delay = rDly * 300
                    const dur   = 130 + rDur * 150
                    const size  = 18 + rSize * 24
                    const peakA = 0.55 + rPeak * 0.45
                    return (
                      <circle key={`wd${wi}-${i}`} cx={baseX + xOff} cy={dl.cy + 120} r={size} fill="#ff5000" opacity={0}>
                        <animateTransform attributeName="transform" type="translate"
                          values={`0 0; 0 -${180 + rSize * 40}`}
                          dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        <animate attributeName="opacity"
                          values={`0; ${peakA.toFixed(2)}; 0`}
                          keyTimes="0; 0.2; 1"
                          dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                      </circle>
                    )
                  })
                })
              })()}
            </g>
          )}
        </svg>
        </div>
      </div>
    </section>
  )
}

/* Drill SVG path data inlined from public/reference/drill.svg (viewBox 0 0 816 931).
 * Inlined so the substrate paints inside the same <svg> as the inscription overlay,
 * which is the only way CSS mix-blend-mode='difference' can blend inscriptions
 * against the red drill body — a sibling <img> lives in a different stacking layer
 * and the blend skips it (renders red-on-red, invisible). */
const DRILL_PATH_DATA = [
  { d: "M0 0 C0.9900000000000091 0.3299999999999983 1.9800000000000182 0.6599999999999966 3 1 C4.000173128011909 3.4287717253417043 4.793228539217978 5.7400156620226 5.53125 8.25 C5.763689117431625 9.003074340820312 5.996128234863306 9.756148681640624 6.2356109619140625 10.53204345703125 C6.738110523560181 12.164160868499664 7.235128589899716 13.79797363964424 7.727325439453125 15.4332275390625 C9.032838933989922 19.77005478336517 10.37673360200779 24.095018260701067 11.71484375 28.421875 C11.986548919677716 29.304540405273443 12.25825408935549 30.18720581054687 12.538192749023438 31.09661865234375 C15.457477673912535 40.55246348112716 18.592704322822556 49.93260114196755 21.75732421875 59.30859375 C29 80.76992328519856 29 80.76992328519856 29 85 C24.59449592164691 84.3955825468613 20.745723208052368 83.29837778163045 16.59765625 81.70703125 C15.383601074218745 81.24401611328125 14.169545898437491 80.7810009765625 12.918701171875 80.303955078125 C11.633222389624962 79.80700611679529 10.347823235021508 79.30985113480875 9.0625 78.8125 C7.753153793836077 78.31041865081335 6.443664463589073 77.80871038880382 5.134033203125 77.307373046875 C-3.6097265972751416 73.95330208267646 -12.332777633431476 70.54772314486483 -21 67 C-20.38138141814909 61.48755268116521 -19.047060709984407 56.526553490143556 -17.3046875 51.26953125 C-17.036104278564437 50.44446578979492 -16.76752105712893 49.61940032958984 -16.490798950195313 48.76933288574219 C-15.624778976180437 46.11507779280856 -14.75020918577826 43.46373773748607 -13.875 40.8125 C-13.28073527426858 38.99878655175287 -12.686741385256369 37.184984341366146 -12.093017578125 35.37109375 C-8.207533983719202 23.529257279217433 -4.24080595311068 11.720045543142206 0 0 Z ", transform: "translate(413,49)" },
  { d: "M0 0 C7.676808712658612 0.46382691358849115 14.203945162350124 3.1319524829894476 21.3125 5.9375 C23.889193931409295 6.947699323827322 26.46761668210314 7.953398926488575 29.046875 8.95703125 C29.701441802978536 9.21260803222657 30.356008605957015 9.468184814453139 31.030410766601563 9.73150634765625 C35.571169748973716 11.489668515729477 40.14730491323155 13.0954320283048 44.765625 14.63671875 C45.99240966796873 15.056389160156243 47.219194335937516 15.476059570312486 48.483154296875 15.908447265625 C50.81947780451304 16.702519978165782 53.16463006574486 17.47120134225949 55.518798828125 18.210693359375 C63.11078235088746 20.840089466283132 63.11078235088746 20.840089466283132 65.53662109375 24.00439453125 C66.61368744251297 26.316816534551407 67.3483010876729 28.53564383094178 68 31 C68.21535400390627 31.681108398437516 68.43070800781248 32.362216796875 68.652587890625 33.06396484375 C69.32354537903427 35.23864880424074 69.91545160362296 37.4255593828446 70.5 39.625 C72.55032356148138 47.11035342577625 74.7675646817961 54.532810451617564 77.08984375 61.9375 C77.36329620361329 62.812239685058586 77.63674865722658 63.68697937011717 77.91848754882813 64.58822631835938 C79.0361133715985 68.1615669626691 80.15432005966738 71.73460286679676 81.2890625 75.30255126953125 C82.09488200886773 77.83738785689607 82.89007269624994 80.37535386739478 83.68359375 82.9140625 C83.93221664428711 83.6850830078125 84.18083953857422 84.45610351562499 84.43699645996094 85.25048828125 C86.11355616231259 90.6593315130622 86.11355616231259 90.6593315130622 85 94 C78.5275066876394 91.91327903917846 72.17820980963319 89.58506223889782 65.84375 87.11328125 C64.87889678955077 86.73877838134766 63.91404357910153 86.36427551269531 62.919952392578125 85.97842407226563 C59.7791074562316 84.75865077457982 56.63949875299443 83.53573357031587 53.5 82.3125 C51.320847074406856 81.4648061155217 49.14164733032732 80.61723257737873 46.96240234375 79.769775390625 C42.50540540748352 78.03615718715159 38.04895466789276 76.30114341543782 33.5927734375 74.5654296875 C28.302633131343157 72.5056603315947 23.00989070657431 70.45270016800401 17.71575927734375 68.40321350097656 C13.914239823689059 66.93115720138414 10.113858561561415 65.45617903212121 6.313720703125 63.980560302734375 C4.527229771740451 63.28751034423314 2.7402854411010935 62.595627945404914 0.952880859375 61.904937744140625 C-1.5197145392858147 60.94910669671128 -3.990524358134053 59.988798185465924 -6.4609375 59.02734375 C-7.18675018310546 58.7479898071289 -7.912562866210919 58.468635864257806 -8.660369873046875 58.180816650390625 C-11.694763734547735 56.99518524709987 -14.2761333060717 55.81591112928555 -17 54 C-15.642444363194215 47.435506723522735 -13.875632987383767 41.14830326038373 -11.77734375 34.78515625 C-11.471800689697261 33.84820419311524 -11.166257629394522 32.91125213623047 -10.851455688476563 31.945907592773438 C-10.210488907912065 29.98306524510079 -9.567512298948088 28.020878158219375 -8.922607421875 26.059326171875 C-7.932792660779683 23.04817965577962 -6.949287820596055 20.035027586709873 -5.966796875 17.021484375 C-5.341509339898607 15.109256097218207 -4.715870918054179 13.197142513747622 -4.08984375 11.28515625 C-3.7950462341308366 10.38313980102538 -3.50024871826173 9.481123352050787 -3.1965179443359375 8.551773071289063 C-2.922758331298837 7.720081024169929 -2.648998718261737 6.888388977050795 -2.366943359375 6.031494140625 C-2.1264878845215094 5.299190826416009 -1.886032409667962 4.566887512207018 -1.6382904052734375 3.8123931884765625 C-1 2 -1 2 0 0 Z ", transform: "translate(385,135)" },
  { d: "M0 0 C7.73771256754992 2.1989676474470627 15.26984288589216 4.8356263228055525 22.8125 7.625 C24.092118837435123 8.0962824482788 25.37174136525107 8.567554876588389 26.6513671875 9.038818359375 C51.29346010305915 18.133942361815627 75.85158968392795 27.464980022142697 100.375 36.875 C101.38272460937503 37.261154785156236 102.39044921875 37.6473095703125 103.4287109375 38.045166015625 C105.20081709420288 38.7279773647021 106.96780857291361 39.4243267799765 108.7275390625 40.138427734375 C111 41 111 41 113.0458984375 41.472900390625 C114.8828125 41.96484375 114.8828125 41.96484375 118 44 C120.10564956648312 48.04104447122921 121.25849219270611 52.31662457535191 122.5 56.6875 C122.90070755693284 58.023378001173455 123.30428147855281 59.35839895648223 123.71044921875 60.692626953125 C124.62566719453332 63.70837609028132 125.52625373685072 66.72808858707572 126.4208984375 69.75 C128.2017590819712 75.72046235086623 130.08913307843892 81.6562830923005 131.9765625 87.59375 C133.01497297270828 90.86979544217536 134.05281904862397 94.1460192720981 135.090576171875 97.42227172851563 C135.7798703313603 99.59807502666678 136.46981119432985 101.77367355558835 137.160400390625 103.94906616210938 C138.1362868404654 107.03062569645994 139.10433194862367 110.11454184100006 140.0703125 113.19921875 C140.36668609619142 114.130244140625 140.66305969238283 115.06126953124999 140.96841430664063 116.0205078125 C141.23681121826172 116.88216552734377 141.50520812988282 117.74382324218749 141.78173828125 118.631591796875 C142.018049621582 119.3819218444824 142.25436096191407 120.13225189208981 142.49783325195313 120.90531921386719 C143 123 143 123 143 127 C137.5803488561645 126.42148549724533 132.97120799328292 125.07891590690878 127.90234375 123.11328125 C127.51532539367679 122.96665794372558 127.51532539367679 122.96665794372558 125.55677795410156 122.22465515136719 C123.88765601998585 121.59145286365543 122.21975710290491 120.95501904715366 120.552978515625 120.315673828125 C116.97272446406936 118.94245774506311 113.38658446108332 117.5849358655338 109.80068969726563 116.22653198242188 C107.9424639303353 115.52249717294114 106.08453605724651 114.8176756309631 104.22689819335938 114.11209106445313 C95.9460787212605 110.9692039925817 87.63929082602994 107.89995987809044 79.32327270507813 104.85165405273438 C68.89082373714069 101.02737745185652 58.46554480037531 97.18488596926238 48.0625 93.28125 C47.23267105102536 92.96989105224611 46.40284210205078 92.65853210449217 45.54786682128906 92.33773803710938 C41.37901355039787 90.77230573477107 37.21182904856602 89.2025729544826 33.046630859375 87.62744140625 C24.416076374718273 84.36932214450644 15.764854813717875 81.18980417557441 7.06640625 78.1171875 C4.418609824330986 77.17344525057854 1.7713561870404533 76.22819627625495 -0.875732421875 75.282470703125 C-2.57263286942748 74.68136720902868 -4.27217681077758 74.08767068115185 -5.974365234375 73.501708984375 C-8.321706394856221 72.69349341369445 -10.659171126534716 71.8612110021628 -12.99609375 71.0234375 C-13.34556816101076 70.9070542907715 -13.34556816101076 70.9070542907715 -15.114120483398438 70.31808471679688 C-19.697271264763685 68.63815857494541 -19.697271264763685 68.63815857494541 -21.062255859375 65.7607421875 C-20.982318945045506 62.21593188460656 -20.114827829158685 59.138358697071396 -19.0078125 55.8046875 C-18.786395874023412 55.1071838378906 -18.564979248046882 54.40968017578126 -18.33685302734375 53.6910400390625 C-17.611030668273543 51.415165962636365 -16.868429355600085 49.14517736513079 -16.125 46.875 C-15.620415308179645 45.30707384929366 -15.116678387913453 43.73887463056164 -14.61376953125 42.17041015625 C-13.33785982373206 38.20367973669613 -12.046550977155789 34.242181118047256 -10.748291015625 30.28271484375 C-10.032556479056097 28.09931584964903 -9.31958161957101 25.915035940742 -8.607421875 23.73046875 C-7.371302923695453 19.942651565868005 -6.125657702248418 16.158045347794825 -4.875 12.375 C-4.497465820312527 11.232729492187502 -4.119931640624998 10.090458984375005 -3.73095703125 8.91357421875 C-3.3840380859375045 7.877329101562509 -3.037119140625009 6.84108398437499 -2.6796875 5.7734375 C-2.377885742187516 4.870288085937489 -2.076083984374975 3.9671386718750057 -1.76513671875 3.03662109375 C-1 1 -1 1 0 0 Z ", transform: "translate(362,209)" },
  { d: "M0 0 C5.1480665966885795 0.5037392842609734 9.687712505878267 2.2123609233379966 14.48046875 4.03515625 C15.30883743286131 4.345130462646466 16.137206115722677 4.655104675292989 16.990676879882813 4.9744720458984375 C19.724848673430643 5.998835670156836 22.45611795402658 7.0307233881746924 25.1875 8.0625 C27.11957567233668 8.787685098972759 29.051871210545528 9.512284662802074 30.984375 10.236328125 C35.000043033472366 11.741382101538761 39.01475187842874 13.248954855198065 43.02880859375 14.75830078125 C51.295598136702665 17.864592362458097 59.573742117005395 20.940254640440116 67.85195922851563 24.01593017578125 C72.30809653239089 25.671928187798642 76.76338095767267 27.33021764351929 81.21875 28.98828125 C83.00911241749151 29.654465456120647 84.7994770048465 30.32064383078682 86.58984375 30.98681640625 C91.14906381452857 32.68331597806139 95.70820585104792 34.3800251372561 100.26731872558594 36.076812744140625 C103.93772108972979 37.442831310068016 107.60815956923057 38.808752824172814 111.27859497070313 40.1746826171875 C113.97410339170904 41.17786213472431 116.66954857266796 42.18121143567424 119.364990234375 43.1845703125 C127.95082153802758 46.380145580377416 136.53815662857664 49.57157479482851 145.12890625 52.75390625 C146.73893905044747 53.35064908260085 148.34896523502402 53.947409765394184 149.958984375 54.544189453125 C152.92721505960128 55.64439490020277 155.89603698800056 56.742982754931006 158.865234375 57.840576171875 C160.20314897385703 58.33636109071125 161.54104090102294 58.83220719674347 162.87890625 59.328125 C163.44903442382815 59.539047851562486 163.44903442382815 59.539047851562486 166.334228515625 60.6064453125 C167.54393310546874 61.06631835937503 168.75363769531248 61.52619140625001 170 62 C170.82204421997073 62.194588012695306 171.6440884399414 62.38917602539061 172.4910430908203 62.58966064453125 C176.71260984222312 63.78555864060161 179.26030826271312 64.76907978487395 181.5747528076172 68.62054443359375 C182.92475903296315 72.12241017765575 184.00069265846014 75.6542795682879 185.00390625 79.265625 C185.40971408621272 80.61063657390355 185.8194283362336 81.9544749824422 186.23280334472656 83.29718017578125 C187.09191636326545 86.10744668030276 187.92881120319964 88.92295971246614 188.74884033203125 91.744873046875 C189.94788413017432 95.85466743138795 191.22058952909344 99.9382441904691 192.51904296875 104.017578125 C194.19264736875846 109.28366508791021 195.85205404783505 114.55359242714178 197.486328125 119.83203125 C197.6876956748963 120.48239097595217 197.8890632247925 121.13275070190429 198.09653282165527 121.80281829833984 C198.50424439505196 123.11996841318307 198.91188593677396 124.43714020768755 199.3194580078125 125.75433349609375 C200.15771481494528 128.46107681258786 200.9987362462698 131.16695765928733 201.83985042572021 133.8728141784668 C206.18848928908892 147.8629123094587 206.18848928908892 147.8629123094587 208.06295776367188 153.9559326171875 C208.67738866606282 155.95196758386066 209.29647135404412 157.9465778350937 209.92068481445313 159.9395751953125 C210.05852890014648 160.38540954589843 210.05852890014648 160.38540954589843 210.756103515625 162.6416015625 C210.99756607055667 163.4152203369141 211.23902862548834 164.1888391113281 211.48780822753906 164.98590087890625 C212 167 212 167 212 170 C206.95337175230748 169.3570544176793 202.57577487098774 167.88302429238297 197.859375 166.078125 C197.07343963623043 165.78232543945313 196.28750427246098 165.48652587890626 195.47775268554688 165.1817626953125 C192.89977387665704 164.20986868924547 190.32488925090593 163.23004689235142 187.75 162.25 C185.9316339703953 161.56241254796362 184.11310961175877 160.87524367247136 182.29443359375 160.1884765625 C176.85980605060422 158.13390248386463 171.42928422645036 156.06864683417768 166 154 C165.2498864746094 153.71431152343746 164.4997729492187 153.42862304687503 163.7269287109375 153.13427734375 C157.66874362995566 150.82633106684568 151.6128011090966 148.512560055314 145.5595703125 146.191650390625 C132.88278292379147 141.331261574184 120.19223642698284 136.50738510196106 107.5 131.6875 C91.15869766928193 125.48122676551156 74.81970899463579 119.26898951688884 58.486419677734375 113.04165649414063 C47.92796214250751 109.01611583849842 37.36628512582422 104.99920132191016 26.80078125 100.9921875 C24.535800446068322 100.13283054251713 22.270826469776807 99.2734555894134 20.005859375 98.4140625 C16.702373910700373 97.16064539741791 13.398729704953723 95.9076575136279 10.094482421875 94.65625 C-1.6474179363650592 90.20926694756054 -13.367760307339267 85.72765231186389 -25 81 C-24.407174377770048 74.26619837337603 -22.705453297649058 68.22549881219777 -20.6484375 61.80078125 C-20.311317443847656 60.72990768432618 -19.974197387695313 59.65903411865236 -19.626861572265625 58.55570983886719 C-18.549336285574384 55.139236205829604 -17.462133953098544 51.725926593955194 -16.375 48.3125 C-15.66737444977781 46.06984889179466 -14.960338111967985 43.8270117793931 -14.25390625 41.583984375 C-10.914821795712726 31.007189427706805 -7.521795829415623 20.448386507582086 -4.0390625 9.91796875 C-3.7459115600585733 9.026204376220676 -3.4527606201172034 8.134440002441409 -3.150726318359375 7.2156524658203125 C-1.1189279261233764 1.1189279261233764 -1.1189279261233764 1.1189279261233764 0 0 Z ", transform: "translate(334,295)" },
  { d: "M0 0 C5.6898058643367335 0.5869573343755405 10.563279766175526 2.1088855246902654 15.89453125 4.140625 C16.74586639404299 4.458711242675804 17.597201538085926 4.776797485351551 18.474334716796875 5.104522705078125 C21.256371995168934 6.146107242281971 24.03442765928662 7.197890983619573 26.8125 8.25 C28.767139481648314 8.984404601841902 30.72197590889914 9.718285225656132 32.677001953125 10.45166015625 C45.37448597378176 15.222026862611301 58.0484966287799 20.054293263972454 70.70947265625 24.920654296875 C84.2131490347237 30.10653034057816 97.7638857451775 35.1656030090104 111.3131103515625 40.23101806640625 C124.68984228879253 45.233803158117155 138.03780009033568 50.30028059776134 151.341796875 55.493316650390625 C158.89536206644755 58.440453095601356 166.46303956245822 61.28699938303453 174.132568359375 63.9169921875 C179.49342538724272 65.7722255205947 184.74388605152012 67.86786839736294 190 70 C195.9375879061439 72.4077222241429 201.8798275520561 74.72455879848354 207.9375 76.8125 C216.05930717171623 79.61385050728626 224.09289584875887 82.64085701229425 232.125 85.6875 C232.4427085876465 85.80768997192382 232.4427085876465 85.80768997192382 234.05050659179688 86.41592407226563 C237.03808221662302 87.54682956919743 240.01974238955233 88.68865611662028 242.9921875 89.85888671875 C246 91 246 91 248.2890625 91.62939453125 C251.07836052260893 92.45598999928478 252.6946337863044 93.44102340526399 254.09619140625 96.006591796875 C255.150773533637 98.80716544333359 255.96587516359455 101.61192730185655 256.75 104.5 C257.410148145652 106.74517731577362 258.0716916662791 108.98994465965063 258.734375 111.234375 C259.0882226562501 112.46349609375 259.44207031249994 113.69261718749999 259.806640625 114.958984375 C261.107439824382 119.42084172230636 262.52688038416727 123.84255732559609 263.953125 128.265625 C264.4626337780238 129.85219148943497 264.97207394143993 131.43878001535893 265.4814453125 133.025390625 C266.2378679492957 135.38040341340786 266.9951816411849 137.73509925453118 267.7562255859375 140.088623046875 C268.4695935374498 142.3016782911336 269.1733758369372 144.51757297026688 269.875 146.734375 C269.9826065063477 147.06462677001946 269.9826065063477 147.06462677001946 270.52716064453125 148.73590087890625 C271.6331176550477 152.26038806448423 272.2399344585185 155.30395080443964 272 159 C270.8462084960938 158.9992749023438 269.6924169921874 158.9985498046875 268.503662109375 158.997802734375 C267.7053749084473 158.99756607055667 266.9070877075195 158.99732940673834 266.08460998535156 158.99708557128906 C264.1958869429951 158.99640308121093 262.3071640563894 158.99509589803677 260.41844177246094 158.99327087402344 C254.11999992873814 158.99015862242038 247.8221994791295 159.01064462378145 241.52392578125 159.05126953125 C234.36592250135595 159.09624976198904 227.20864469252592 159.10064464909783 220.05054664611816 159.07515907287598 C215.88986821002266 159.06175865481396 211.73059329376338 159.065066325967 207.570068359375 159.106201171875 C188.25280851647193 159.2845249150248 172.0719010365449 158.8065041984445 154.37265014648438 150.11740112304688 C150.76654590692794 148.41910399606627 147.0429384691509 147.16423732876729 143.265625 145.90625 C134.85647261541806 143.00805338766395 126.58866397322504 139.77563145115744 118.31585693359375 136.51177978515625 C113.81518141080096 134.73705397956292 109.31012049119863 132.97354450074386 104.8046875 131.2109375 C103.89095367431639 130.85345428466803 102.97721984863279 130.49597106933595 102.03579711914063 130.12765502929688 C93.33887744498855 126.73116696907482 84.61245159919133 123.41556304981304 75.875 120.125 C59.667384029374034 114.01888315289699 43.484194619678306 107.85068084392327 27.319091796875 101.6328125 C18.070519548553875 98.0773206196825 8.815159696858245 94.54679106377415 -0.4765625 91.10546875 C-2.84487830162891 90.22244797712511 -5.212767243947553 89.3382939209456 -7.580474853515625 88.45364379882813 C-9.054614713797378 87.90636642798313 -10.53065098333309 87.3641671796426 -12.008636474609375 86.82736206054688 C-14.017112866763398 86.09780450060441 -16.018657216249437 85.3516679648755 -18.01953125 84.6015625 C-19.13432861328124 84.1924462890625 -20.249125976562482 83.783330078125 -21.397705078125 83.36181640625 C-24 82 -24 82 -25.50146484375 80.295166015625 C-26.26154013877715 76.7959163346502 -25.09932030133797 73.95990458318039 -23.95703125 70.67578125 C-23.717517395019513 69.94910247802733 -23.478003540039083 69.22242370605466 -23.231231689453125 68.47372436523438 C-22.43903589160624 66.0817084866656 -21.625971114989568 63.69735574922936 -20.8125 61.3125 C-20.259162060170866 59.65580043888701 -19.707174475264367 57.998649286696946 -19.156494140625 56.341064453125 C-18.018289273317578 52.92286222649187 -16.871576870484432 49.507694501661774 -15.7177734375 46.0947265625 C-14.075581850446952 41.233793238458816 -12.45986890198509 36.36442024857013 -10.8515625 31.4921875 C-3.0326958587316426 7.845236172259888 -3.0326958587316426 7.845236172259888 0 0 Z ", transform: "translate(302,395)" },
  { d: "M0 0 C5.220338234832411 0.5632669909333003 9.749767814075426 1.8327824388305203 14.6328125 3.78125 C15.365151062011705 4.06615798950196 16.09748962402341 4.35106597900392 16.852020263671875 4.6446075439453125 C18.44182239800756 5.263910105152604 20.030333684777077 5.886534502605173 21.61767578125 6.512115478515625 C25.99179333017537 8.235515663231581 30.37571055002627 9.933748523604777 34.7578125 11.63671875 C35.67782043457032 11.995093231201167 36.59782836914064 12.353467712402335 37.54571533203125 12.722702026367188 C46.744487486966136 16.301925022551416 55.97716702583057 19.789046453917422 65.2154541015625 23.264739990234375 C82.28790128335447 29.68870572050116 99.33914336866223 36.16714342825196 116.375 42.6875 C117.35887695312499 43.06363433837896 118.34275390624998 43.43976867675781 119.3564453125 43.827301025390625 C130.60753805282855 48.12965583621451 141.8339094340862 52.481009831981964 153 57 C153 57.33000000000004 153 57.65999999999997 153 58 C135.26439078583047 58.023561459648135 117.52878658759892 58.04109157469247 99.79316520690918 58.051812171936035 C91.55465032777329 58.05692648670197 83.31614527816856 58.06387404235204 75.07763671875 58.075439453125 C67.88084725485498 58.08553749037367 60.68406492090992 58.09188858089237 53.487268567085266 58.09408849477768 C49.69128033799302 58.09537049742312 45.89531247093453 58.09829078942403 42.09933090209961 58.105730056762695 C22.376199802103372 58.14291229150217 2.708519139105988 57.800675247669005 -17 57 C-16.40479894447273 51.94965537892551 -15.680054854925771 47.37951236030301 -14.14453125 42.5078125 C-13.77199218749999 41.31583251953123 -13.399453125000008 40.123852539062455 -13.015625 38.895751953125 C-12.817109374999973 38.27357788085942 -12.817109374999973 38.27357788085942 -11.8125 35.125 C-11.404535007981337 33.83110342478301 -10.996985686681512 32.53707571831774 -10.58984375 31.242919921875 C-1.982194043647894 3.964388087295845 -1.982194043647894 3.964388087295845 0 0 Z ", transform: "translate(269,495)" },
  { d: "M0 0 C1.1205546945333538 0.0003797203302156049 2.2411093890667075 0.0007594406604312098 3.395620286464691 0.001150667667388916 C4.682984302639966 -0.0008403807878494263 5.97034831881524 -0.0028314292430877686 7.296723365783691 -0.0048828125 C8.744043825774355 -0.0020292133252723943 10.191364106666072 0.0009163948923287535 11.638684213161469 0.003943979740142822 C13.161598785194712 0.0035084115573909003 14.684513285188473 0.002633771956197961 16.207427382469177 0.001354813575744629 C20.412358246918046 -0.0008929846313776579 24.61726388902511 0.003135004269097408 28.822191536426544 0.008132874965667725 C33.34914195845647 0.012433129965529588 37.8760908451373 0.010991255266276312 42.40304273366928 0.010230600833892822 C50.252961375608834 0.009705093994512026 58.10287173499427 0.01285466709339289 65.95278829336166 0.01846843957901001 C77.30258693327238 0.026579847068660456 88.65238154975424 0.029198289664236654 100.00218277424574 0.030456431210041046 C118.41446103976546 0.032647517495320244 136.8267348864693 0.03930913451301876 155.2390107512474 0.04875904321670532 C173.1296355255708 0.05793169817047783 191.02025910164411 0.0650132472040923 208.9108857512474 0.06926685571670532 C209.4618550736085 0.0693982174619805 209.4618550736085 0.0693982174619805 212.2500937655568 0.07006298750638962 C217.77794541654237 0.07136798200326666 223.30579707604682 0.07263170029102639 228.83364874124527 0.07387489080429077 C274.7256906530692 0.08424926760847029 320.6177243956895 0.1026885165317708 366.5097627043724 0.12419849634170532 C366.5097627043724 32.794198496341664 366.5097627043724 65.46419849634174 366.5097627043724 99.1241984963417 C288.6297627043724 99.45419849634175 210.74976270437242 99.78419849634167 130.5097627043724 100.1241984963417 C131.9599648208441 143.63026199049182 131.9599648208441 143.63026199049182 147.2519502043724 160.0851359963417 C157.6383190011423 169.46521300657332 170.79957389989903 171.6726941350364 184.3222627043724 171.4991984963417 C184.89436475515367 171.49412281274795 184.89436475515367 171.49412281274795 187.7895478606224 171.4684367775917 C201.21886750983418 171.22218486078316 215.3307493005143 169.59009507317296 225.7050752043724 160.1202922463417 C233.36980684988544 151.15672532198653 233.86763709558159 140.7973820065888 234.1323212981224 129.4977336525917 C234.30875060086657 123.32521059984754 234.30875060086657 123.32521059984754 236.5097627043724 121.1241984963417 C238.43974107503897 120.87530952692032 238.43974107503897 120.87530952692032 240.84364026784897 120.87696033716202 C241.29865667104718 120.87486309289932 241.29865667104718 120.87486309289932 243.6013154387474 120.86424976587296 C244.60243360280992 120.86986927270891 245.60355176687244 120.87548877954487 246.6350068449974 120.8812785744667 C247.161042535305 120.8803294014931 247.161042535305 120.8803294014931 249.82310193777084 120.87552601099014 C253.3137825035239 120.87180985166322 256.8042567630153 120.88253376070361 260.2949189543724 120.8937297463417 C262.7110513140391 120.89492109587854 265.1271841417542 120.8953748044562 267.54331678152084 120.89511829614639 C272.611669960494 120.89668457373068 277.6799526475445 120.90498579830683 282.7482880949974 120.9183879494667 C289.26117850582636 120.93538703826539 295.7739914190796 120.9392021219104 302.2869014143944 120.93844276666641 C307.27697712732447 120.93871403166463 312.267035728996 120.94418806884812 317.2571057677269 120.95144420862198 C319.65940369406735 120.95463734398118 322.06170356822577 120.95659977830053 324.4640035033226 120.95733791589737 C327.8140073305141 120.95949415868495 331.16392716184873 120.96822255276516 334.5139130949974 120.9789348244667 C335.5170554900169 120.9784816384315 336.5201978850364 120.97802845239642 337.55373853445053 120.97756153345108 C338.0073450255394 120.97969402551655 338.0073450255394 120.97969402551655 340.30286878347397 120.99048572778702 C341.09577849149696 120.99216157197952 341.8886881995202 120.99383741617203 342.705625474453 120.99556404352188 C344.5097627043724 121.1241984963417 344.5097627043724 121.1241984963417 345.5097627043724 122.1241984963417 C345.6687218697166 124.748044389705 345.7626550359839 127.3468151585796 345.8137177824974 129.9735637307167 C345.8331393218041 130.79645389795303 345.85256086111076 131.61934406518935 345.87257093191147 132.46717029809952 C346.0416964581225 140.08623098021076 346.1381430310039 147.7067226761485 346.21364015340805 155.327230989933 C346.2649669847913 160.44669987748478 346.33926432628164 165.56346165435912 346.4699677824974 170.6815715432167 C346.59585624595 175.63026379390067 346.66205584920476 180.57651685642065 346.6872281432152 185.52671200037003 C346.70679225977665 187.40834937836019 346.7471028096081 189.28989594833274 346.80908864736557 191.1706138253212 C347.2951426226848 206.64498902957348 347.2951426226848 206.64498902957348 342.92373365163803 211.44759327173233 C340.03687579412644 214.07802802630158 336.85546188406227 216.1134894164161 333.5097627043724 218.1241984963417 C331.9131915912801 219.269335767622 330.3227787007304 220.42321720503844 328.7441377043724 221.5929484963417 C327.2543877688893 222.6107839922555 325.7595437789728 223.62120263628822 324.2597627043724 224.6241984963417 C323.45111768484117 225.17043873071668 322.6424726653099 225.71667896509166 321.8093232512474 226.2794719338417 C285.31181206661347 250.79000282055267 245.62222900998722 271.9452295298871 200.9707002043724 274.8781047463417 C198.50976270437246 275.1241984963417 198.50976270437246 275.1241984963417 195.5097627043724 276.1241984963417 C195.17976270437237 290.31419849634176 194.84976270437244 304.5041984963417 194.5097627043724 319.1241984963417 C171.3439881451784 319.1241984963417 171.3439881451784 319.1241984963417 162.1972627043724 316.6241984963417 C161.15151075124743 316.3528508400917 160.1057587981224 316.08150318384173 159.0283173918724 315.8019328713417 C155.8417777322299 314.95129287783664 152.67478869337288 314.05147367165114 149.5097627043724 313.1241984963417 C148.5573066496849 312.8457609963417 147.6048505949974 312.5673234963417 146.6235322356224 312.2804484963417 C123.41964259790467 305.28161426803376 100.93372032794338 294.1133931140166 80.5097627043724 281.1241984963417 C79.7287519621849 280.63097095727926 78.9477412199974 280.1377434182167 78.1430634856224 279.6295695900917 C45.13905651017251 258.71008690785584 45.13905651017251 258.71008690785584 31.509762704372406 245.1241984963417 C31.197809579372404 244.82384693384165 31.197809579372404 244.82384693384165 29.619137704372406 243.3038859963417 C21.958527287384953 235.29506601494575 20.178903872145924 225.50877889133085 18.966793954372406 214.9015422463417 C18.839509103298184 213.80914737939838 18.71222425222396 212.71675251245495 18.58108228445053 211.59125477075577 C17.174442050361648 198.9432324534664 16.498299846369264 186.26858574851076 15.884762704372406 173.5616984963417 C15.758154814167057 171.07324519525935 15.631362058417665 168.58480129343593 15.504391610622406 166.0963664650917 C14.667415763623069 149.30864886627353 14.073707334372614 132.52220149290224 13.800290048122406 115.7157512307167 C13.786513192653672 114.94185550928114 13.77273633718491 114.16795978784558 13.758542001247406 113.37061268091202 C13.72346475579974 111.32452017941898 13.695180493568529 109.27831428366301 13.667477548122406 107.2321086525917 C13.509762704372406 104.1241984963417 13.509762704372406 104.1241984963417 12.509762704372406 101.1241984963417 C10.400387704372434 100.3156047463417 10.400387704372434 100.3156047463417 7.759762704372406 99.6866984963417 C3.5249699222003414 98.53561032951382 0.6752293680245032 97.28966515999377 -2.490237295627594 94.1241984963417 C-4.13588553195811 90.83290202368062 -3.6283264378633646 87.17678382658141 -3.619631826877594 83.5595012307167 C-3.621384146213529 82.6732405495643 -3.6231364655494644 81.786979868412 -3.624941885471344 80.87386280298233 C-3.629354577325273 77.93515288519097 -3.6264246942837985 74.99650280957258 -3.623049795627594 72.0577922463417 C-3.623722941739061 70.02280372489201 -3.6246930565636433 67.98781528161715 -3.625948965549469 65.95282703638077 C-3.6274250990461496 61.68482914785295 -3.625273854849951 57.416852162614305 -3.620608389377594 53.148856699466705 C-3.6149075427067032 47.66504940540665 -3.618192897462592 42.1812910102193 -3.624180853366852 36.697485506534576 C-3.6277856553679726 32.494906993787026 -3.6266483172542507 28.292340171993146 -3.6240530610084534 24.089761316776276 C-3.6233837545708525 22.067049822692525 -3.6242123409847693 20.04433728292895 -3.6265326142311096 18.021627008914948 C-3.6290582046155464 15.200889591056352 -3.62522004104261 12.380232620943275 -3.619631826877594 9.559501230716705 C-3.6216560578346275 8.715321390628787 -3.623680288791661 7.8711415505408695 -3.625765860080719 7.001380503177643 C-3.600593151815559 0.1795765633174824 -3.600593151815559 0.1795765633174824 0 0 Z ", transform: "translate(230.4902372956276,567.8758015036583)" },
]

/* ── CYCLE DRILL (8–13 days) ──
 * Sister of CycleBlade. Renders the Gurren-Lagann core-drill silhouette as
 * substrate (public/reference/drill.svg, viewBox 816x931), with day inscriptions
 * locked to cone-band centers and a 2x3 grid in the rectangular base. Weekday
 * labels alternate along anchor sides. Per-letter yakiire (canonical 50ms flame /
 * 50ms zoom / 75ms cooled stagger) cascades on weekday labels exactly like blade.
 */
function CycleDrill({ days, dailyPlan, cycleName = '', glowingDays = [], glowIntensity = 'off', hotDays = [], cooledDays = [], weekdayLetterIgnited = [], weekdayLetterZoomed = [], weekdayLetterCooled = [] }) {
  const N = days.length
  const anyGlowing = glowingDays.some(Boolean)
  const anyWeekdayIgnited = Array.isArray(weekdayLetterIgnited) && weekdayLetterIgnited.some(Boolean)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Inscription layout — cone tip empty, ridges widen top→bottom with growing capacity:
  //   ridge 1 (apex)        : 0 inscriptions (empty)
  //   ridge 2 (band 1)      : 1
  //   ridge 3 (band 2)      : 2
  //   ridge 4 (band 3)      : 4
  //   ridge 5 (band 4 widest): 5
  //   mount  (rectangular base, day-13 only): 1, axis-upright (no slant).
  // Total cone capacity = 1+2+4+5 = 12; +1 mount = 13.
  //
  // Per-ridge rotation is derived from the actual top-edge slope of each band
  // (sampled via Playwright getPointAtLength on drill.svg, fit a line through the
  // top edge points). Kanji rotation = ridge angle (kanji bottom rests on the ridge);
  // number rotation = ridge angle - 90 (sideways, with the same ridge tilt baked in).
  //
  // Slots distribute along each ridge: x at t = (k+1)/(n+1) of the ridge span; y
  // interpolated from the ridge slope so each anchor literally sits ON the ridge
  // line (rightward slots descend by tan(angle) — they don't share a constant y).
  // Measured ridge angles (top-edge least-squares fit) read too horizontal at the
  // drill's render scale, so amplify by 1.6 for visible tilt. Ridges 4 and 5 inherit
  // the same amplified angles as ridges 2 and 3 respectively so the four populated
  // ridges alternate between the same two slopes (cleaner visual rhythm than each
  // ridge having its own measured slope).
  const RIDGE_GENTLE = 7.3 * 1.6  // → 11.7°  — used by ridges 2 + 4
  const RIDGE_STEEP  = 11.8 * 1.6 // → 18.9°  — used by ridges 3 + 5
  const RIDGE2_BBOX = { xLeft: 348, xRight: 451, yMid: 177, angle: RIDGE_STEEP  } // band 1, 1 anchor
  const RIDGE3_BBOX = { xLeft: 313, xRight: 477, yMid: 268, angle: RIDGE_STEEP  } // band 2, 2 anchors
  const RIDGE4_BBOX = { xLeft: 296, xRight: 533, yMid: 385, angle: 20.5        } // band 3, 4 anchors
  const RIDGE5_BBOX = { xLeft: 266, xRight: 564, yMid: 487, angle: 20.5        } // band 4, 5 anchors (slightly steeper than the rest)

  const ridgeSlots = (ridge, n) => {
    const xMid = (ridge.xLeft + ridge.xRight) / 2
    const tanAngle = Math.tan(ridge.angle * Math.PI / 180)
    return Array.from({ length: n }, (_, k) => {
      // 1-2 slot ridges keep the (k+1)/(n+1) distribution that tucks the pair
      // inward. 3+ slot ridges use (k+0.5)/n with a 0.85 shrink toward the ridge
      // center so the pitch is wide enough to clear the kanji+number pair
      // (~53vb) but the cluster stays tucked away from the band edges.
      const t = n === 1
        ? 0.5                         // 1-slot ridge centered (anchor 1 unaffected)
        : n === 2
        ? 0.5 + (k - 0.5) * 0.358    // 2-slot: pitch ≈ 0.358 × span (~59vb on ridge 3)
        : 0.5 + 0.88 * ((k + 0.5) / n - 0.5)
      const x = ridge.xLeft + t * (ridge.xRight - ridge.xLeft)
      const y = ridge.yMid + (x - xMid) * tanAngle
      return {
        x, y,
        numRotation:   ridge.angle - 90, // sideways, tilted with the ridge
        kanjiRotation: ridge.angle,      // kanji bottom rests on ridge
      }
    })
  }

  const sideFor = (x) => x < 408 ? 'left' : 'right'
  const CONE_SLOTS = [
    ...ridgeSlots(RIDGE2_BBOX, 1),
    ...ridgeSlots(RIDGE3_BBOX, 2),
    ...ridgeSlots(RIDGE4_BBOX, 4),
    ...ridgeSlots(RIDGE5_BBOX, 5),
  ].map(s => ({ ...s, side: sideFor(s.x) }))
  // Mount sits directly below anchor 8 (ridge 5's leftmost slot at x≈326, y≈440) on
  // the next ridge down — landing in the small band-5 transition strip just above
  // the rectangular base body. Same RIDGE_STEEP tilt as cone anchors. isMount keeps
  // the bigger weekday sizing.
  const MOUNT_SLOT = {
    x: 277, y: 529, side: 'left',
    numRotation: RIDGE_STEEP - 90,
    kanjiRotation: RIDGE_STEEP,
    isMount: true,
  }
  const anchors = days.map((_, i) => i < 12 ? CONE_SLOTS[i] : MOUNT_SLOT)

  const dayLabels = days.map((iso, i) => {
    const d = parseDate(iso)
    const num = String(d.getDate())
    const muscles = dailyPlan[iso] || []
    const hasWork = muscles.length > 0
    const kanjiStr = hasWork
      ? muscles.map((m) => MUSCLE_KANJI[m] || '?').join('')
      : '休'
    const a = anchors[i] || anchors[anchors.length - 1]
    return { num, hasWork, kanjiStr, iso, cx: a.x, cy: a.y, side: a.side,
             numRotation: a.numRotation, kanjiRotation: a.kanjiRotation,
             isMount: !!a.isMount }
  })

  // Day-number + kanji at each anchor — vertically stacked: number CENTERED ABOVE
  // the kanji, both sharing one rotation transform (the ridge tilt) so the entire
  // inscription leans together with the ridge underneath. Cone glyphs are sized
  // smaller than base glyphs so adjacent inscriptions on the 4- and 5-anchor ridges
  // (~50vb slot pitch) still leave visible breathing room.
  const NUM_FONT = '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
  const renderInscription = (dl, { hot = false, maskFill = null } = {}) => {
    const { num, kanjiStr, cx, cy, numRotation = 0, kanjiRotation = 0 } = dl
    const kanjiChars = (kanjiStr || '').split('')
    const n = kanjiChars.length
    const isCone = numRotation !== 0

    const numFontSize    = isCone ? 18 : 28
    const kanjiFontN1    = isCone ? 22 : 36
    const kanjiFontN2to4 = isCone ? 16 : 24
    const kanjiFontN5plus = isCone ? 14 : 20
    const kanjiSpacingN2to4 = isCone ? 17 : 26
    const kanjiSpacingN5plus = isCone ? 15 : 22
    const kanjiRowStepN2to4 = isCone ? 16 : 24
    const kanjiRowStepN5plus = isCone ? 14 : 20

    // Horizontal layout: kanji centered at (0, 0), number on the RIGHT of the kanji.
    // Weekday cluster lives ABOVE the kanji (rendered in a separate <g> sharing this
    // inscription's rotation — see wdGroupTransform).
    // Double-digit dates are visually wider, so their left edge crowds the kanji at
    // the single-digit gap; bump the gap a touch when we have 2+ digits.
    const isMultiDigit = (num || '').length >= 2
    const stackGap = isCone ? (isMultiDigit ? 11 : 7) : (isMultiDigit ? 13 : 9)
    const kanjiClusterRows = (n === 1 ? 1 : Math.ceil(n / 2))
    const kanjiBaseFont = (n === 1 ? kanjiFontN1 : (n <= 4 ? kanjiFontN2to4 : kanjiFontN5plus))
    const kanjiRowStep  = (n === 1 ? 0 : (n <= 4 ? kanjiRowStepN2to4 : kanjiRowStepN5plus))
    const kanjiHeight = kanjiBaseFont + (kanjiClusterRows - 1) * kanjiRowStep
    const kanjiCenterX = 0
    const kanjiCenterY = 0
    const numCenterX   = kanjiBaseFont / 2 + stackGap + numFontSize / 2
    const numCenterY   = 0
    void kanjiHeight

    const DEPTH_STACK_RED = [
      { dy: 2, fill: '#3a0608' },
      { dy: 1, fill: '#9e1118' },
      { dy: 0, fill: '#d4181f' },
    ]
    const DEPTH_STACK_HOT = [
      { dy: 2, fill: '#ffe0a0' },
      { dy: 1, fill: '#d85a10' },
      { dy: 0, fill: '#ff6600' },
    ]
    const stack = maskFill ? [{ dy: 0, fill: maskFill }] : (hot ? DEPTH_STACK_HOT : DEPTH_STACK_RED)

    const renderText = (keyBase, x, y, fontSize, char) => stack.map((layer, li) => (
      <text key={`${keyBase}-${li}`} x={x} y={y + layer.dy} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: NUM_FONT, fontSize: `${fontSize}px`, fontWeight: 700, fill: layer.fill }}>
        {char}
      </text>
    ))

    // Number — single glyph centered at (numCenterX, numCenterY).
    const numEls = renderText('num', numCenterX, numCenterY, numFontSize, num)

    // Kanji — single glyph or 2-col grid centered at (kanjiCenterX, kanjiCenterY).
    let kanjiEls = []
    if (n === 1) {
      kanjiEls = renderText('kj0', kanjiCenterX, kanjiCenterY, kanjiFontN1, kanjiChars[0])
    } else if (n <= 4) {
      const fontSize = kanjiFontN2to4, colSpacing = kanjiSpacingN2to4, rowYStep = kanjiRowStepN2to4
      const baseY = kanjiCenterY - ((kanjiClusterRows - 1) * rowYStep) / 2
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = kanjiCenterX + (isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing)
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    } else {
      const fontSize = kanjiFontN5plus, colSpacing = kanjiSpacingN5plus, rowYStep = kanjiRowStepN5plus
      const baseY = kanjiCenterY - ((kanjiClusterRows - 1) * rowYStep) / 2
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = kanjiCenterX + (isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing)
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    }

    return (
      <g transform={`translate(${cx},${cy}) rotate(${kanjiRotation})`}>
        {numEls}
        {kanjiEls}
      </g>
    )
  }

  // Weekday-label sizing + per-anchor positioning. Each weekday cluster sits at the
  // OLD date-number position (left of the kanji at the anchor's offset), rotated by
  // the same numRotation the number used pre-stacking, so they slot into the cone
  // ridge sideways like the dates did before the stack commit.
  // Weekday cluster sits ABOVE the inscription, centered horizontally on the midpoint
  // between the kanji (at local x=0) and the date number (at local x=numCenterX). The
  // midpoint shifts a couple vb depending on whether the date is single- or double-
  // digit (different stackGap), so the cluster moves with it.
  const wdParams = () => ({
    fontSize: 13,
    advance:  13,
    aboveY:   -23,
  })
  // Mirror the offsets renderInscription uses internally so the cluster lands on the
  // exact midpoint between kanji center and number center.
  const wdMidX = (dl) => {
    const isMulti = (dl.num || '').length >= 2
    const isCone = (dl.numRotation || 0) !== 0
    const kanjiBaseFont = isCone ? 22 : 36
    const numFontSize   = isCone ? 18 : 28
    const stackGap = isCone ? (isMulti ? 11 : 7) : (isMulti ? 13 : 9)
    const numCenterX = kanjiBaseFont / 2 + stackGap + numFontSize / 2
    return numCenterX / 2 - 10  // nudged 10vb left of the kanji↔number midpoint
  }
  const wdGroupTransform = (dl) => `translate(${dl.cx},${dl.cy}) rotate(${dl.kanjiRotation || 0})`
  const wdLetterX = (dl, L) => wdMidX(dl) + (L - 1) * wdParams().advance
  const wdLetterY = () => wdParams().aboveY
  // World-space anchor of the cluster center (used for spawning particles in world
  // coordinates — particle group sits outside the rotated frame).
  const wdCenterWorld = (dl) => {
    const r = (dl.kanjiRotation || 0) * Math.PI / 180
    const dx = wdMidX(dl)
    const dy = wdParams().aboveY
    return { x: dl.cx + dx * Math.cos(r) - dy * Math.sin(r),
             y: dl.cy + dx * Math.sin(r) + dy * Math.cos(r) }
  }

  return (
    <section className="relative z-10 py-2 px-2 pointer-events-none min-h-[calc(100vh-7px)]">
      <div>
        {/* Drill container — 179vw width (188 × 0.95) with -39.5vw left shift to keep it
            horizontally centered while running ~79% larger than viewport. Inscription anchors
            live in the overlay's viewBox-local coords, so they scale with the container
            automatically. */}
        <div style={{ position: 'absolute', top: '-70px', left: '-39.5vw', width: '179vw', maxWidth: 'none' }}>
          {/* Drill substrate + inscription overlay rendered inside ONE <svg>. The drill
              path data is inlined from public/reference/drill.svg so the inscription
              <g> elements (mixBlendMode: 'difference') blend against the red silhouette
              as their actual backdrop. Sibling <img> + overlay-svg setup put the substrate
              in a different stacking context, which broke the blend (red-on-red, invisible).
              viewBox matches the trace's native 816×931. */}
          <svg
            viewBox="0 0 816 931"
            className="block w-full h-auto pointer-events-none"
            style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))' }}
            aria-hidden="true"
          >
            {/* Drill silhouette — rendered first so it sits behind the inscriptions. */}
            <g>
              {DRILL_PATH_DATA.map((p, i) => (
                <path key={`drill-body-${i}`} d={p.d} transform={p.transform} fill="#d4181f" />
              ))}
            </g>
            {/* Cycle title — sits between the last cone-ridge inscription (anchor 12)
                and the mount inscription (anchor 13) on the rectangular base. Off-white
                fill to read against the red drill body, slight uppercase tracking. */}
            {cycleName && (
              <text
                x={408} y={610}
                textAnchor="middle"
                dominantBaseline="central"
                transform="rotate(-3 408 610)"
                style={{
                  fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif',
                  fontSize: '32px',
                  fontWeight: 900,
                  fill: '#000000',
                  letterSpacing: '0.04em',
                  opacity: 0.95,
                }}>
                {cycleName.toUpperCase()}
              </text>
            )}
            <defs>
              {/* Inscription mask — particles flow through ignited day-number AND kanji
                  silhouettes (mirrors the on-screen renderInscription so flames fill both halves). */}
              <mask id="drill-inscription-window" maskUnits="userSpaceOnUse" x="0" y="0" width="816" height="931">
                <rect x="0" y="0" width="816" height="931" fill="black"/>
                {dayLabels.map((dl, i) => glowingDays[i] ? (
                  <Fragment key={`drill-mask-${dl.iso}`}>
                    {renderInscription(dl, { maskFill: 'white' })}
                  </Fragment>
                ) : null)}
              </mask>
              {/* Weekday-label mask — particles clipped to weekday letter silhouettes.
                  Each cluster wrapped in the anchor's translate+rotate so mask matches
                  the on-screen weekday placement (sideways, at the old number spot). */}
              <mask id="drill-weekday-window" maskUnits="userSpaceOnUse" x="0" y="0" width="816" height="931">
                <rect x="0" y="0" width="816" height="931" fill="black"/>
                {dayLabels.map((dl, i) => {
                  const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                  const w = wdParams(dl)
                  return (
                    <g key={`drill-wd-mask-${dl.iso}`} transform={wdGroupTransform(dl)}>
                      {dow.split('').map((ch, L) => {
                        const lit = !!weekdayLetterIgnited[i * 3 + L]
                        const x = wdLetterX(dl, L)
                        return (
                          <text key={`drill-wd-mask-${dl.iso}-${L}`}
                            x={x} y={wdLetterY()}
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${w.fontSize}px`,
                              fontWeight: 700,
                              fill: 'white',
                              opacity: lit ? 1 : 0,
                            }}>
                            {ch}
                          </text>
                        )
                      })}
                    </g>
                  )
                })}
              </mask>
            </defs>

            {/* Inscription particle aura — clipped to day-number silhouettes. */}
            {anyGlowing && (
              <g mask="url(#drill-inscription-window)" style={{ pointerEvents: 'none' }}>
                <rect x="0" y="0" width="816" height="931" fill="#0a0a0a"/>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  return dayLabels.flatMap((dl, dayIdx) => {
                    if (!glowingDays[dayIdx]) return []
                    const PARTS = 8
                    return Array.from({ length: PARTS }).map((_, i) => {
                      const k = i + dayIdx * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rRise = hash01(k * 7 + 19)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 60
                      const delay = (rDly * 540) % 600
                      const dur   = 130 + rDur * 150
                      const rise  = 60 + rRise * 50
                      const size  = 7 + rSize * 11
                      const peakA = 0.5 + rPeak * 0.5
                      return (
                        <circle key={`${dl.iso}-sp${i}`} cx={dl.cx + xOff} cy={dl.cy + 28} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${rise.toFixed(0)}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}

            {/* Day-number base inscriptions — per-day hot/cooled gating. */}
            <style>{`
              .drill-inscription-hot    { animation: inscription-hot-hold 100ms forwards; }
              .drill-inscription-cooled { animation: inscription-cool-down 1000ms ease-out forwards; }
            `}</style>
            {dayLabels.map((dl, i) => {
              const hot = !!hotDays[i]
              const cooled = !!cooledDays[i]
              const flameOn = !!glowingDays[i]
              const cls = cooled ? 'drill-inscription-cooled' : (hot ? 'drill-inscription-hot' : '')
              return (
                <g key={dl.iso}
                   className={cls}
                   style={{
                     mixBlendMode: hot ? 'normal' : 'difference',
                     opacity: flameOn ? 0 : 1,
                     transition: 'opacity 0ms',
                   }}>
                  {renderInscription(dl, { hot })}
                </g>
              )
            })}

            {/* Zoom-burst — fires during 'peak' glow phase. REVERSE order: anchor N
                fires first (delay 0), anchor 1 last (delay (N-1)*220ms) — matching
                the rest of the drill's cascade direction. */}
            {glowIntensity === 'peak' && (
              <g style={{ mixBlendMode: 'plus-lighter', pointerEvents: 'none' }}>
                {dayLabels.map((dl, i) => {
                  const step = (dayLabels.length - 1) - i
                  return (
                  <g key={`zoom-${dl.iso}`} className="zoom-glyph" style={{ animationDelay: `${step * 220}ms`,
                        transformBox: 'fill-box', transformOrigin: 'center',
                        animation: `inscription-zoom 340ms ease-out forwards ${step * 220}ms`,
                        mixBlendMode: 'plus-lighter',
                        filter: 'drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400)',
                        opacity: 0,
                     }}>
                    {renderInscription(dl, { maskFill: '#ff6600' })}
                  </g>
                  )
                })}
              </g>
            )}

            {/* Weekday labels — placed at each anchor's old number spot (left of kanji,
                rotated by the same numRotation the number had pre-stack). Per-letter
                yakiire still cascades through ignited/zoomed/cooled. */}
            <g>
              {dayLabels.map((dl, i) => {
                const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                const w = wdParams(dl)
                return (
                  <g key={`dow-${dl.iso}`} transform={wdGroupTransform(dl)}>
                    {dow.split('').map((ch, L) => {
                      const flatIdx = i * 3 + L
                      const isFlaming = !!weekdayLetterIgnited[flatIdx]
                      const isZoomed  = !!weekdayLetterZoomed[flatIdx]
                      const isCooled  = !!weekdayLetterCooled[flatIdx]
                      const isHot     = isZoomed && !isCooled
                      const fill      = (isHot || isCooled) ? '#d4181f' : '#000000'
                      const baseAlpha = (isHot || isCooled) ? 1 : 0.95
                      const textOpacity = isFlaming ? 0 : baseAlpha
                      const textClass = isCooled ? 'drill-inscription-cooled' : (isHot ? 'drill-inscription-hot' : '')
                      const x = wdLetterX(dl, L)
                      return (
                        <g key={`dow-${dl.iso}-${L}`}>
                          <text
                            x={x} y={wdLetterY()}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={textClass}
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${w.fontSize}px`,
                              fontWeight: 700,
                              fill,
                              opacity: textOpacity,
                              transition: 'opacity 0ms',
                            }}>
                            {ch}
                          </text>
                          {isZoomed && (
                            <text
                              x={x} y={wdLetterY()}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-zoom-burst"
                              style={{
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${w.fontSize}px`,
                                fontWeight: 700,
                                fill: '#ff6600',
                              }}>
                              {ch}
                            </text>
                          )}
                          {isFlaming && (
                            <text
                              x={x} y={wdLetterY()}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-flame-engulf"
                              style={{
                                ...engulfVars(i * 13 + L + 7),
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${w.fontSize}px`,
                                fontWeight: 700,
                              }}>
                              {ch}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>

            {/* Weekday particle aura — clipped to weekday letter silhouettes. */}
            {anyWeekdayIgnited && (
              <g mask="url(#drill-weekday-window)" style={{ pointerEvents: 'none' }}>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  const PARTS_PER_WEEKDAY = 28
                  return dayLabels.flatMap((dl, wi) => {
                    const dayLit = weekdayLetterIgnited.slice(wi * 3, wi * 3 + 3).some(Boolean)
                    if (!dayLit) return []
                    const center = wdCenterWorld(dl)
                    const baseX = center.x
                    return Array.from({ length: PARTS_PER_WEEKDAY }).map((_, i) => {
                      const k = i + wi * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 110
                      const delay = rDly * 300
                      const dur   = 130 + rDur * 150
                      const size  = 8 + rSize * 12
                      const peakA = 0.55 + rPeak * 0.45
                      return (
                        <circle key={`drill-wd${wi}-${i}`} cx={baseX + xOff} cy={center.y + 25} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${50 + rSize * 25}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>
    </section>
  )
}

/* ── CYCLE OUROBOROS (exactly 7 days) ──
 * Sister of CycleBlade / CycleDrill. Renders the snake-eats-its-tail silhouette
 * (public/reference/ouroboros.svg, viewBox 1374x1370) as substrate, with 7 day
 * inscriptions distributed CW around the ring on a 240° arc — the upper 120° wedge
 * stays clear for the snake's head and tail-bite junction. Inscriptions and weekday
 * labels rotate to read radially-outward (magic-circle aesthetic). Per-letter yakiire
 * (canonical 50ms flame / 50ms zoom / 75ms cooled stagger) cascades on weekday labels.
 */
function CycleOuroboros({ days, dailyPlan, glowingDays = [], glowIntensity = 'off', hotDays = [], cooledDays = [], weekdayLetterIgnited = [], weekdayLetterZoomed = [], weekdayLetterCooled = [] }) {
  const anyGlowing = glowingDays.some(Boolean)
  const anyWeekdayIgnited = Array.isArray(weekdayLetterIgnited) && weekdayLetterIgnited.some(Boolean)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Ring geometry — viewBox 0 0 1374 1370. Center near (687, 685). Snake body sits roughly
  // between R=400 (hollow inner edge) and R=620 (outer edge). Day-number inscription radius
  // lands mid-body at 510 so digits carve into the silhouette. Weekday labels live at
  // R_WEEKDAY=320, which sits well inside the snake's hollow interior so the labels read on
  // empty negative space. All inscriptions render upright (no per-anchor tangent rotation).
  // Compass convention: 0°=top, increases CW.
  const CX = 687
  const CY = 685
  const R_INSC = 510
  const R_WEEKDAY = 320
  const WEEKDAY_FONT_SIZE = 48
  const WEEKDAY_ADVANCE = 48
  // Seven anchors over a 240° arc, shifted ~40° CW from the original layout so the first
  // anchor (day 1) lands just behind the snake's head/bite junction at compass 350°.
  // Order is reversed: day 1 sits closest to the head, day 7 trails CW down the body.
  const COMPASS_ANGLES = [350, 310, 270, 230, 190, 150, 110]

  const dayLabels = days.slice(0, 7).map((iso, i) => {
    const d = parseDate(iso)
    const num = String(d.getDate())
    const muscles = dailyPlan[iso] || []
    const hasWork = muscles.length > 0
    const kanjiStr = hasWork
      ? muscles.map((m) => MUSCLE_KANJI[m] || '?').join('')
      : '休'
    const angle = COMPASS_ANGLES[i] ?? COMPASS_ANGLES[COMPASS_ANGLES.length - 1]
    const rad = (angle * Math.PI) / 180
    // Day 7 (last anchor) — at compass 110° the snake's main body coil sits at a larger
    // radius than the global R_INSC=510, with thin tail wisps trailing inside it. Pushing
    // day 7's inscription OUT to R=580 lands it on the outer thick body where it belongs.
    const r = i === 6 ? 580 : R_INSC
    // Day 7 (i=6) nudged left ~5 screen px (~17 viewBox units) for tighter alignment with
    // the FRI weekday cluster.
    const cxShift = i === 6 ? -17 : 0
    const cx = CX + r * Math.sin(rad) + cxShift
    // Per-day vertical nudges:
    //   day 1 (i=0) shifts up ~30 screen px (~105 viewBox units) so its kanji + side-rendered
    //   date number sit clear of the snake's head/bite zone.
    //   day 6 (i=5) shifts down ~10 screen px (~35 viewBox units) for visual balance.
    const cyShift = i === 0 ? -105 : i === 5 ? 35 : 0
    const cy = CY - r * Math.cos(rad) + cyShift
    // Weekday cluster sits on the inner hollow at R_WEEKDAY. World coords precomputed so
    // both the rendered text and the particle spawn (in world space) share the same anchor.
    const wdCx = CX + R_WEEKDAY * Math.sin(rad)
    const wdCy = CY - R_WEEKDAY * Math.cos(rad)
    return { num, hasWork, kanjiStr, iso, cx, cy, angle, wdCx, wdCy }
  })

  // Day-number + kanji column inscription — replicated from CycleBlade with sizes scaled
  // ~50% to fit on the snake body (which is much narrower than the wakizashi face).
  const renderDayInscription = (dl, { hot = false, maskFill = null, isFirst = false } = {}) => {
    const { num, kanjiStr } = dl
    const kanjiChars = kanjiStr.split('')
    const n = kanjiChars.length
    const font = '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'

    const DEPTH_STACK_RED = [
      { dy: 2, fill: '#3a0608' },
      { dy: 1, fill: '#9e1118' },
      { dy: 0, fill: '#d4181f' },
    ]
    const DEPTH_STACK_HOT = [
      { dy: 2, fill: '#ffe0a0' },
      { dy: 1, fill: '#d85a10' },
      { dy: 0, fill: '#ff6600' },
    ]
    const stack = maskFill ? [{ dy: 0, fill: maskFill }] : (hot ? DEPTH_STACK_HOT : DEPTH_STACK_RED)

    const renderText = (keyBase, x, y, fontSize, char) => stack.map((layer, li) => (
      <text key={`${keyBase}-${li}`} x={x} y={y + layer.dy} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: font, fontSize: `${fontSize}px`, fontWeight: 600, fill: layer.fill }}>
        {char}
      </text>
    ))

    // Day 1 of the ouroboros sits behind the snake's head where vertical space is tight;
    // the date number is placed to the RIGHT of the kanji column at the column's vertical
    // center instead of stacked above it. All other days keep the default stacked layout.
    const kanjiCenterY =
      n === 1 ? 42 :
      n <= 4 ? 36 + (Math.ceil(n / 2) - 1) * 31 :
      n <= 6 ? 29 + (Math.ceil(n / 2) - 1) * 24.5 :
               23 + (Math.ceil(n / 2) - 1) * 21
    const numEls = isFirst
      ? renderText('num', 100, kanjiCenterY, 91, num)
      : renderText('num', 0, -47, 91, num)

    let kanjiEls
    if (n === 1) {
      kanjiEls = renderText('kj0', 0, 42, 104, kanjiChars[0])
    } else if (n <= 4) {
      const fontSize = 62, colSpacing = 62, baseY = 36, rowYStep = 62
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    } else if (n <= 6) {
      const fontSize = 49, colSpacing = n === 5 ? 58 : 49, baseY = 29, rowYStep = 49
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    } else {
      // n >= 7 — 4 rows × 2 cols, last row centered if odd
      const fontSize = 42, colSpacing = 46, baseY = 23, rowYStep = 42
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / 2)
        const isOddLast = n % 2 === 1 && ki === n - 1
        const x = isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing
        const y = baseY + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    }

    return <>{numEls}{kanjiEls}</>
  }

  return (
    <section className="relative z-10 py-2 px-2 pointer-events-none min-h-[calc(100vh-7px)]">
      <div>
        {/* Ouroboros container — square, full viewport width, top-anchored. The dispatched
            stamp card / fire button live below this section in the SummaryPage layout. */}
        <div style={{ position: 'absolute', top: '100px', left: '-7px', width: '100vw', maxWidth: 'none', transform: 'scale(1.03)', transformOrigin: 'center' }}>
          {mounted && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/reference/ouroboros.svg"
              alt="Ouroboros"
              className="block w-full h-auto"
              style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))' }}
            />
          )}

          {/* Overlay — same viewBox as the ouroboros SVG so anchor coords align exactly. */}
          <svg
            viewBox="0 0 1374 1370"
            className="absolute inset-0 w-full h-auto pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              {/* Inscription mask — particles flow through ignited day-inscription silhouettes.
                  Glyphs render upright (no tangent rotation) at each anchor's world position. */}
              <mask id="ouroboros-inscription-window" maskUnits="userSpaceOnUse" x="0" y="0" width="1374" height="1370">
                <rect x="0" y="0" width="1374" height="1370" fill="black"/>
                {dayLabels.map((dl, i) => glowingDays[i] ? (
                  <g key={`our-mask-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy})`}>
                    {renderDayInscription(dl, { maskFill: 'white', isFirst: i === 0 })}
                  </g>
                ) : null)}
              </mask>
              {/* Weekday-label mask — particles clipped to weekday letter silhouettes inside
                  the ring's hollow interior. Cluster center sits at (wdCx, wdCy) on R_WEEKDAY;
                  3 letters arranged horizontally with WEEKDAY_ADVANCE pitch. No rotation. */}
              <mask id="ouroboros-weekday-window" maskUnits="userSpaceOnUse" x="0" y="0" width="1374" height="1370">
                <rect x="0" y="0" width="1374" height="1370" fill="black"/>
                {dayLabels.map((dl, i) => {
                  const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                  return (
                    <g key={`our-wd-mask-${dl.iso}`} transform={`translate(${dl.wdCx},${dl.wdCy})`}>
                      {dow.split('').map((ch, L) => {
                        const lit = !!weekdayLetterIgnited[i * 3 + L]
                        const x = (L - 1) * WEEKDAY_ADVANCE
                        return (
                          <text key={`our-wd-mask-${dl.iso}-${L}`}
                            x={x} y={0}
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${WEEKDAY_FONT_SIZE}px`,
                              fontWeight: 700,
                              fill: 'white',
                              opacity: lit ? 1 : 0,
                            }}>
                            {ch}
                          </text>
                        )
                      })}
                    </g>
                  )
                })}
              </mask>
            </defs>

            {/* Inscription particle aura — clipped to day-inscription silhouettes. */}
            {anyGlowing && (
              <g mask="url(#ouroboros-inscription-window)" style={{ pointerEvents: 'none' }}>
                <rect x="0" y="0" width="1374" height="1370" fill="#0a0a0a"/>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  return dayLabels.flatMap((dl, dayIdx) => {
                    if (!glowingDays[dayIdx]) return []
                    const PARTS = 14
                    return Array.from({ length: PARTS }).map((_, i) => {
                      const k = i + dayIdx * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rRise = hash01(k * 7 + 19)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 130
                      const delay = (rDly * 540 + dayIdx * 131) % 600
                      const dur   = 130 + rDur * 150
                      const rise  = 130 + rRise * 110
                      const size  = 14 + rSize * 24
                      const peakA = 0.5 + rPeak * 0.5
                      return (
                        <circle key={`${dl.iso}-sp${i}`} cx={dl.cx + xOff} cy={dl.cy + 70} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${rise.toFixed(0)}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}

            {/* Day-inscription base — per-day hot/cooled gating. Pre-ignition uses difference
                blend so red-on-black snake reads as bright carved letters; post-ignition flips
                to normal blend so the orange depth-stack reads with full saturation. */}
            <style>{`
              .ouroboros-inscription-hot    { animation: inscription-hot-hold 100ms forwards; }
              .ouroboros-inscription-cooled { animation: inscription-cool-down 1000ms ease-out forwards; }
            `}</style>
            {dayLabels.map((dl, i) => {
              const hot = !!hotDays[i]
              const cooled = !!cooledDays[i]
              const flameOn = !!glowingDays[i]
              const cls = cooled ? 'ouroboros-inscription-cooled' : (hot ? 'ouroboros-inscription-hot' : '')
              return (
                <g key={dl.iso}
                   className={cls}
                   style={{
                     mixBlendMode: hot ? 'normal' : 'difference',
                     opacity: flameOn ? 0 : 1,
                     transition: 'opacity 0ms',
                   }}>
                  <g transform={`translate(${dl.cx},${dl.cy})`}>
                    {renderDayInscription(dl, { hot, isFirst: i === 0 })}
                  </g>
                </g>
              )
            })}

            {/* Zoom-burst — fires during 'peak' glow phase. Scaled and faded near-white duplicates
                punch outward from each inscription. Animation delay staggers across the 7 anchors. */}
            {glowIntensity === 'peak' && (
              <g style={{ mixBlendMode: 'plus-lighter', pointerEvents: 'none' }}>
                {dayLabels.map((dl, i) => (
                  <g key={`zoom-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy})`}>
                    <g style={{
                          transformBox: 'fill-box', transformOrigin: 'center',
                          animation: `inscription-zoom 340ms ease-out forwards ${i * 220}ms`,
                          mixBlendMode: 'plus-lighter',
                          filter: 'drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400)',
                          opacity: 0,
                       }}>
                      {renderDayInscription(dl, { maskFill: '#ff6600', isFirst: i === 0 })}
                    </g>
                  </g>
                ))}
              </g>
            )}

            {/* Weekday labels — per-letter yakiire. Cluster sits inside the ring's hollow at
                (wdCx, wdCy) on R_WEEKDAY; 3 letters horizontally arranged. No tangent rotation. */}
            <g>
              {dayLabels.map((dl, i) => {
                const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                return (
                  <g key={`dow-${dl.iso}`} transform={`translate(${dl.wdCx},${dl.wdCy})`}>
                    {dow.split('').map((ch, L) => {
                      const flatIdx = i * 3 + L
                      const isFlaming = !!weekdayLetterIgnited[flatIdx]
                      const isZoomed  = !!weekdayLetterZoomed[flatIdx]
                      const isCooled  = !!weekdayLetterCooled[flatIdx]
                      const isHot     = isZoomed && !isCooled
                      const fill      = (isHot || isCooled) ? '#d4181f' : '#b0a898'
                      const baseAlpha = (isHot || isCooled) ? 1 : 0.7
                      const textOpacity = isFlaming ? 0 : baseAlpha
                      const textClass = isCooled ? 'ouroboros-inscription-cooled' : (isHot ? 'ouroboros-inscription-hot' : '')
                      const x = (L - 1) * WEEKDAY_ADVANCE
                      const y = 0
                      return (
                        <g key={`dow-${dl.iso}-${L}`}>
                          <text
                            x={x} y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={textClass}
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${WEEKDAY_FONT_SIZE}px`,
                              fontWeight: 700,
                              fill,
                              opacity: textOpacity,
                              transition: 'opacity 0ms',
                            }}>
                            {ch}
                          </text>
                          {isZoomed && (
                            <text
                              x={x} y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-zoom-burst"
                              style={{
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${WEEKDAY_FONT_SIZE}px`,
                                fontWeight: 700,
                                fill: '#ff6600',
                              }}>
                              {ch}
                            </text>
                          )}
                          {isFlaming && (
                            <text
                              x={x} y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-flame-engulf"
                              style={{
                                ...engulfVars(i * 13 + L + 7),
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${WEEKDAY_FONT_SIZE}px`,
                                fontWeight: 700,
                              }}>
                              {ch}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>

            {/* Weekday particle aura — clipped to weekday letter silhouettes via the
                ouroboros-weekday-window mask. Particles spawn around the cluster's world center
                (precomputed in dayLabels as wdCx/wdCy) and rise straight up in world space. */}
            {anyWeekdayIgnited && (
              <g mask="url(#ouroboros-weekday-window)" style={{ pointerEvents: 'none' }}>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  const PARTS_PER_WEEKDAY = 32
                  return dayLabels.flatMap((dl, wi) => {
                    const dayLit = weekdayLetterIgnited.slice(wi * 3, wi * 3 + 3).some(Boolean)
                    if (!dayLit) return []
                    return Array.from({ length: PARTS_PER_WEEKDAY }).map((_, i) => {
                      const k = i + wi * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 130
                      const delay = rDly * 300
                      const dur   = 130 + rDur * 150
                      const size  = 10 + rSize * 16
                      const peakA = 0.55 + rPeak * 0.45
                      return (
                        <circle key={`our-wd${wi}-${i}`} cx={dl.wdCx + xOff} cy={dl.wdCy + 50} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${110 + rSize * 35}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>
    </section>
  )
}

/* ── CYCLE SCROLL (15+ days) ──
 * Sister of CycleBlade / CycleDrill / CycleOuroboros. Renders the ancient-scroll
 * silhouette (public/reference/scroll.svg) rotated 90° so the ornate handles sit
 * at TOP and BOTTOM, with the writing banner running vertically between them.
 * The substrate is inlined as <image> inside the overlay SVG with a rotation
 * transform so the overlay viewBox is the rotated 1061×1300 frame; inscription
 * anchors live directly in that vertical coordinate space (3 columns × ceil(N/3)
 * rows). Each cell stacks the day number above its weekday DOW label. Per-letter
 * yakiire (canonical 50ms flame / 50ms zoom / 75ms cooled) cascades through the
 * same state arrays the other cycle components consume.
 */
function CycleScroll({ days, dailyPlan, glowingDays = [], glowIntensity = 'off', hotDays = [], cooledDays = [], weekdayLetterIgnited = [], weekdayLetterZoomed = [], weekdayLetterCooled = [] }) {
  const N = days.length
  const anyGlowing = glowingDays.some(Boolean)
  const anyHot     = hotDays.some(Boolean)
  const allCooled  = cooledDays.length > 0 && cooledDays.every(Boolean)
  const anyWeekdayIgnited = Array.isArray(weekdayLetterIgnited) && weekdayLetterIgnited.some(Boolean)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Vertical layout — column-major, 7 rows per column. Days fill column 1 top-to-bottom,
  // then start column 2 at day 8, column 3 at day 15, etc. The LAST day renders larger
  // (font + spacing) and, when alone in its column, vertically centers in the column
  // area instead of sitting at the top. Writing area in the rotated viewBox: x≈280..800,
  // y≈270..1030 (1061×1300 vertical frame). The original horizontal scroll mapped
  // (x,y) → (y, 1300-x) under `translate(0 1300) rotate(-90)`; that mapping is baked
  // into the substrate <image> transform, so anchors live in post-rotation coords.
  const ROWS_PER_COL = 7
  const colsNeeded = Math.max(1, Math.ceil(N / ROWS_PER_COL))
  // Writing area shifted 14 viewBox units left (~7px on a 390-wide viewport at
  // the 143.325vw scroll container) so columns sit slightly off-center.
  const WRITE_X0 = 320
  const WRITE_X1 = 766
  const WRITE_Y0 = 215
  const WRITE_Y1 = 1075
  const colStep = (WRITE_X1 - WRITE_X0) / colsNeeded
  const rowStep = (WRITE_Y1 - WRITE_Y0) / ROWS_PER_COL
  const halfN   = Math.floor(N / 2)
  // Inscriptions stay at full size for 1-6 columns (≤42 days). Once a 7th column
  // is needed, text scales down proportionally so cells stay legible. Floor at
  // 0.45 so very long cycles don't disappear.
  const colScale = colsNeeded <= 6 ? 1.0 : Math.max(0.45, 6 / colsNeeded)

  const BIG_LAST_THRESHOLD = 35  // up to 35 days, the last day renders 1.7×; beyond that, same size as the rest

  const anchors = days.map((_, i) => {
    const c = Math.floor(i / ROWS_PER_COL)
    const r = i % ROWS_PER_COL
    const isLast = i === N - 1
    const isBig  = isLast && N <= BIG_LAST_THRESHOLD
    return {
      x: WRITE_X0 + colStep * (c + 0.5),
      // Final day always pinned to the bottom-right cell, regardless of how many
      // earlier days occupy its column or whether it gets the BIG treatment.
      y: isLast
        ? WRITE_Y1 - rowStep * 0.5
        : WRITE_Y0 + rowStep * (r + 0.5),
      side: i < halfN ? 'left' : 'right',
      isLast,
      isBig,
    }
  })

  const dayLabels = days.map((iso, i) => {
    const d = parseDate(iso)
    const num = String(d.getDate())
    const muscles = dailyPlan[iso] || []
    const hasWork = muscles.length > 0
    const kanjiStr = hasWork
      ? muscles.map((m) => MUSCLE_KANJI[m] || '?').join('')
      : '休'
    const a = anchors[i]
    return { num, hasWork, kanjiStr, iso, cx: a.x, cy: a.y, side: a.side, isLast: a.isLast, isBig: a.isBig }
  })

  // Day-number + muscle-kanji depth-stack inscription (mirrors CycleBlade's
  // renderDayInscription, scaled down to fit each scroll grid cell). Each cell
  // stacks: day number (top), kanji char(s) for the day's muscles (middle).
  // The LAST day uses a 1.7× scale factor so it visually dominates the column.
  const NUM_FONT = '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
  const renderInscription = (dl, { hot = false, maskFill = null } = {}) => {
    const { num, kanjiStr, isBig, isLast } = dl
    const kanjiChars = kanjiStr.split('')
    const n = kanjiChars.length
    // BIG day (≤35-day cycles) renders 1.7×; for 7+ columns everything also
    // scales down by colScale so dense layouts stay legible.
    const S = (isBig ? 1.7 : 1.0) * colScale
    const DEPTH_STACK_RED = [
      { dy: 2, fill: '#3a0608' },
      { dy: 1, fill: '#9e1118' },
      { dy: 0, fill: '#d4181f' },
    ]
    const DEPTH_STACK_HOT = [
      { dy: 2, fill: '#ffe0a0' },
      { dy: 1, fill: '#d85a10' },
      { dy: 0, fill: '#ff6600' },
    ]
    // Final-day inscription uses the GTL gold stack (matches BATTLEDAYS yellow
    // on the load page) so the cycle's last day pops visually.
    const DEPTH_STACK_GOLD = [
      { dy: 2, fill: '#5a4015' },
      { dy: 1, fill: '#a8782a' },
      { dy: 0, fill: '#e4b022' },
    ]
    const stack = maskFill
      ? [{ dy: 0, fill: maskFill }]
      : hot
        ? DEPTH_STACK_HOT
        : isLast
          ? DEPTH_STACK_GOLD
          : DEPTH_STACK_RED
    const renderText = (keyBase, x, y, fontSize, char) => stack.map((layer, li) => (
      <text key={`${keyBase}-${li}`} x={x} y={y + layer.dy} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: NUM_FONT, fontSize: `${fontSize}px`, fontWeight: 700, fill: layer.fill }}>
        {char}
      </text>
    ))
    // Layout (DOW lives in a separate render block above number+kanji):
    //   day number at y ≈ -16 (just above center), kanji block at y ≈ +28 (below
    //   center, with a small breathing gap between number bottom and kanji top).
    const numEls = renderText('num', 0, -16 * S, 36 * S, num)
    let kanjiEls = null
    if (n === 1) {
      kanjiEls = renderText('kj0', 0, 28 * S, 44 * S, kanjiChars[0])
    } else if (n <= 3) {
      const colSpacing = (n === 2 ? 32 : 30) * S
      const fontSize   = (n === 2 ? 36 : 28) * S
      kanjiEls = kanjiChars.flatMap((k, ki) =>
        renderText(`kj${ki}`, (ki - (n - 1) / 2) * colSpacing, 28 * S, fontSize, k))
    } else {
      // n >= 4: 2 rows × ceil(n/2) cols.
      const cols = Math.ceil(n / 2)
      const fontSize = 22 * S
      const colSpacing = 26 * S
      const rowYStep   = 22 * S
      kanjiEls = kanjiChars.flatMap((k, ki) => {
        const row = Math.floor(ki / cols)
        const col = ki % cols
        const x = (col - (cols - 1) / 2) * colSpacing
        const y = 18 * S + row * rowYStep
        return renderText(`kj${ki}`, x, y, fontSize, k)
      })
    }
    return <>{numEls}{kanjiEls}</>
  }

  // Weekday DOW label sits ABOVE the date number; sizing scales with isBig (BIG day).
  const WEEKDAY_FONT_SIZE = 24
  const WEEKDAY_ADVANCE   = 20
  const WEEKDAY_DY        = -40
  const dayScale = (dl) => (dl.isBig ? 1.7 : 1.0) * colScale
  // Per-letter x: center-anchored around the cell so all 3 letters sit together above the date.
  const weekdayLetterX = (cx, L, advance) => cx + (L - 1) * advance

  return (
    <section className="relative z-10 py-2 px-2 pointer-events-none min-h-[calc(100vh-7px)]">
      <div>
        {/* Scroll container — sized 143.325% of viewport width (136.5 × 1.05) so
            the inscription banner reads larger; horizontal overflow lets the
            handle ornament tips sit just past the screen edges. Shifted 5px
            left of the centered position. */}
        <div style={{ position: 'absolute', top: '0px', left: 'calc(-21.6625vw - 5px)', width: '143.325vw', maxWidth: 'none' }}>
          {/* Single SVG holds both the rotated substrate (as <image>) and the inscription
              overlay so they share one coordinate system. ViewBox is the rotated frame
              1061×1300; substrate <image> applies translate(0 1300) rotate(-90) to bring
              the source 1300×1061 into that frame with original-right-side at top. */}
          <svg
            viewBox="0 0 1061 1300"
            className="block w-full h-auto pointer-events-none"
            aria-hidden="true"
            style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))' }}
          >
            {mounted && (
              <image
                href="/reference/scroll.svg"
                width="1300"
                height="1061"
                transform="translate(0 1300) rotate(-90)"
              />
            )}
            <defs>
              {/* Red-frame mask — sourced directly from the scroll SVG so flame
                  particles are clipped to the red ink regions only (rolled
                  handles top/bottom + the parchment border), keeping the writing
                  area where inscriptions live free of particles. Alpha-mode so
                  any opaque pixel of the source counts as "inside." */}
              <mask id="scroll-red-frame" maskUnits="userSpaceOnUse" x="0" y="0" width="1061" height="1300" style={{ maskType: 'alpha' }}>
                <image
                  href="/reference/scroll.svg"
                  width="1300"
                  height="1061"
                  transform="translate(0 1300) rotate(-90)"
                />
              </mask>
            </defs>

            {/* Per-day inscription particle aura intentionally removed — the
                red-frame flame layer below is the only flame visual now.
                Inscriptions still cascade through hot/cool color states. */}

            {/* Red-frame cascade overlays — match the inscription cascade phases.
                During flame: void-black so particles read. During hot: orange
                glow with a cream highlight (mirrors DEPTH_STACK_HOT colors).
                When all columns cool: opacity fades to 0 over 1s, revealing red. */}
            {(anyGlowing || anyHot) && (
              <g mask="url(#scroll-red-frame)" style={{ pointerEvents: 'none' }}>
                {anyGlowing && (
                  <rect x="0" y="0" width="1061" height="1300" fill="#0a0a0a" opacity="0.92"/>
                )}
                {anyHot && (
                  <rect
                    x="0" y="0" width="1061" height="1300"
                    className={allCooled ? 'scroll-frame-cooled' : 'scroll-frame-hot'}
                    fill="#ff6600"
                  />
                )}
              </g>
            )}
            {anyHot && (
              <g mask="url(#scroll-red-frame)" style={{ mixBlendMode: 'plus-lighter', pointerEvents: 'none' }}>
                <rect
                  x="0" y="0" width="1061" height="1300"
                  className={allCooled ? 'scroll-frame-cooled' : 'scroll-frame-hot-highlight'}
                  fill="#ffe0a0"
                />
              </g>
            )}

            {/* Red-frame flame layer — ADDITIVE on top of the per-cell particles
                above. Clipped to the scroll's red ink regions via the alpha mask
                sourced from /reference/scroll.svg, so the rolled handles + frame
                curl glow with rising sparks even when the parchment area is
                cooling down. 80 particles distributed across the canvas; the
                mask culls them to red areas only. */}
            {anyGlowing && (
              <g mask="url(#scroll-red-frame)" style={{ pointerEvents: 'none' }}>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  const PARTS = 80
                  return Array.from({ length: PARTS }).map((_, i) => {
                    const k = i + 7
                    const rX    = hash01(k * 1)
                    const rY    = hash01(k * 2 + 5)
                    const rDly  = hash01(k * 3 + 11)
                    const rDur  = hash01(k * 5 + 17)
                    const rRise = hash01(k * 7 + 19)
                    const rSize = hash01(k * 11 + 23)
                    const rPeak = hash01(k * 13 + 29)
                    const cx = rX * 1061
                    const cy = rY * 1300
                    const delay = (rDly * 600) % 700
                    const dur   = 200 + rDur * 250
                    const rise  = 30 + rRise * 50
                    const size  = 4 + rSize * 8
                    const peakA = 0.55 + rPeak * 0.45
                    return (
                      <circle key={`scroll-frame-sp${i}`} cx={cx} cy={cy} r={size} fill="#ff5000" opacity={0}>
                        <animateTransform attributeName="transform" type="translate"
                          values={`0 0; 0 -${rise.toFixed(0)}`}
                          dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        <animate attributeName="opacity"
                          values={`0; ${peakA.toFixed(2)}; 0`}
                          keyTimes="0; 0.2; 1"
                          dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                      </circle>
                    )
                  })
                })()}
              </g>
            )}

            {/* Day-number base inscriptions — per-day hot/cooled gating.
                Scroll cycles use a single-shadow lite filter (vs the canonical 4-shadow
                inscription-hot-hold) to keep frame budgets sane on 30+ glyphs at once. */}
            <style>{`
              @keyframes scroll-inscription-hot-hold-lite {
                from, to { filter: drop-shadow(0 0 6px rgba(255, 100, 0, 0.7)); }
              }
              @keyframes scroll-inscription-cool-down-lite {
                0%   { filter: drop-shadow(0 0 6px rgba(255, 100, 0, 0.7)); }
                100% { filter: drop-shadow(0 0 0 rgba(255, 100, 0, 0)); }
              }
              .scroll-inscription-hot    { animation: scroll-inscription-hot-hold-lite 100ms forwards; }
              .scroll-inscription-cooled { animation: scroll-inscription-cool-down-lite 1000ms ease-out forwards; }
              /* Red-frame cascade overlays — glow orange/cream during hot phase,
                 fade to fully transparent over 1s when allCooled flips. */
              .scroll-frame-hot           { opacity: 0.85; }
              .scroll-frame-hot-highlight { opacity: 0.40; }
              .scroll-frame-cooled        { opacity: 0; transition: opacity 1000ms ease-out; }
            `}</style>
            {dayLabels.map((dl, i) => {
              const hot = !!hotDays[i]
              const cooled = !!cooledDays[i]
              const flameOn = !!glowingDays[i]
              const cls = cooled ? 'scroll-inscription-cooled' : (hot ? 'scroll-inscription-hot' : '')
              return (
                <g key={dl.iso}
                   className={cls}
                   style={{
                     mixBlendMode: hot ? 'normal' : 'difference',
                     opacity: 1,
                     transition: 'opacity 0ms',
                   }}>
                  <g transform={`translate(${dl.cx},${dl.cy})`}>
                    {renderInscription(dl, { hot })}
                  </g>
                </g>
              )
            })}

            {/* Zoom-burst layer intentionally omitted in scroll mode — the duplicate-
                glyph plus-lighter cascade is too expensive at 30+ glyphs and visually
                disappears in the density anyway. Inscriptions go straight to hot. */}

            {/* Weekday labels — column-major layout means row r is the same
                weekday across every column, so we only render labels for the
                leftmost column (col 0 = cells 0..6) as a vertical 3-letter
                stack to the LEFT of the kanji. Per-letter yakiire still drives
                the same flat indices so the cascade lights these letters as
                the matching column ignites. */}
            <g>
              {dayLabels.map((dl, i) => {
                const colIdx = Math.floor(i / 7)
                if (colIdx !== 0) return null
                const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                const s         = dayScale(dl)
                const fontSize  = WEEKDAY_FONT_SIZE * s
                const lineH     = 28 * s    // taller line so letters don't collide
                const xOff      = -65 * s   // compensates for the shifted-right inscription block so DOW stays put visually
                const yCenter   = 12 * s    // shifted up ~8px from the kanji vertical center
                return (
                  <g key={`dow-${dl.iso}`}>
                    {dow.split('').map((ch, L) => {
                      const flatIdx = i * 3 + L
                      const isFlaming = !!weekdayLetterIgnited[flatIdx]
                      const isZoomed  = !!weekdayLetterZoomed[flatIdx]
                      const isCooled  = !!weekdayLetterCooled[flatIdx]
                      const isHot     = isZoomed && !isCooled
                      const fill      = (isHot || isCooled) ? '#d4181f' : '#b0a898'
                      const baseAlpha = (isHot || isCooled) ? 1 : 0.7
                      const textOpacity = isFlaming ? 0 : baseAlpha
                      const textClass = isCooled ? 'scroll-inscription-cooled' : (isHot ? 'scroll-inscription-hot' : '')
                      const x = dl.cx + xOff
                      const y = dl.cy + yCenter + (L - 1) * lineH
                      return (
                        <g key={`dow-${dl.iso}-${L}`}>
                          <text
                            x={x} y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={textClass}
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${fontSize}px`,
                              fontWeight: 700,
                              fill,
                              opacity: textOpacity,
                              transition: 'opacity 0ms',
                            }}>
                            {ch}
                          </text>
                          {isZoomed && (
                            <text
                              x={x} y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-zoom-burst"
                              style={{
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${fontSize}px`,
                                fontWeight: 700,
                                fill: '#ff6600',
                              }}>
                              {ch}
                            </text>
                          )}
                          {isFlaming && (
                            <text
                              x={x} y={y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-flame-engulf"
                              style={{
                                ...engulfVars(i * 13 + L + 7),
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${fontSize}px`,
                                fontWeight: 700,
                              }}>
                              {ch}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>

            {/* Per-weekday-letter particle aura intentionally removed — the
                red-frame flame layer above is the only flame visual now.
                Weekday letters still cascade through hot/cool color states. */}
          </svg>
        </div>
      </div>
    </section>
  )
}

/* ── CYCLE INFINITY (exactly 14 days) ──
 * Renders the figure-8 ouroboros silhouette (public/reference/ouroboros-14.svg, viewBox
 * 796×416) as substrate, with 14 day inscriptions distributed 7-per-loop on each lobe.
 * Day 1 sits at the top of the LEFT loop (CW from there); day 8 at the top of the RIGHT
 * loop (also CW). Yakiire wires through the same shared state arrays the per-day cascade
 * already drives in handleBegin (glowingDays/hotDays/cooledDays sized to N=14 by the
 * existing resize effect).
 */
function CycleInfinity({ days, dailyPlan, glowingDays = [], glowIntensity = 'off', hotDays = [], cooledDays = [], weekdayLetterIgnited = [], weekdayLetterZoomed = [], weekdayLetterCooled = [] }) {
  const anyGlowing = glowingDays.some(Boolean)
  const anyWeekdayIgnited = Array.isArray(weekdayLetterIgnited) && weekdayLetterIgnited.some(Boolean)

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ouroboros-14.svg viewBox is 0 0 796 416. Two lobes side-by-side; each lobe ~410px wide
  // with center near (208, 208) for the left, (588, 208) for the right.
  const VB_W = 796
  const VB_H = 416
  const LEFT_CX = 208
  const RIGHT_CX = 588
  const LOOP_CY = 208
  const R_INSC = 162    // mid-segment radius — lands on the body of the segmented ring
  // Weekday labels sit ABOVE each anchor's date number (in the inscription's local frame),
  // not in the hollow. R_WEEKDAY kept for the legacy mask/particle blocks below; the visible
  // weekday text rides the inscription anchor.
  const R_WEEKDAY = 80
  const WEEKDAY_FONT_SIZE = 14
  const WEEKDAY_ADVANCE = 13
  const WEEKDAY_LOCAL_Y = -3   // weekday cluster — slightly closer to kanji than the old number slot
  // 7 anchors per loop, even compass distribution. Days 1-7 trace the left loop CW; days
  // 8-14 trace the right loop CCW so the date order flows continuously around the figure-8.
  // Bottom (left) loop shifted 3 steps CCW (screen); top (right) loop shifted 3 steps CW
  // (screen). Note: container's 270° rotation inverts visual CW/CCW vs viewBox compass —
  // screen CCW = viewBox CW = compass increase by step.
  // Day 1 + day 8 stay put; the subsequent dates within each loop now traverse in the
  // opposite direction (bottom flipped CW→CCW; top flipped CCW→CW).
  const COMPASS_LEFT  = [51, 0, 309, 257, 206, 154, 103]
  const COMPASS_RIGHT = [309, 0, 51, 103, 154, 206, 257]

  const dayLabels = days.slice(0, 14).map((iso, i) => {
    const d = parseDate(iso)
    const num = String(d.getDate())
    const muscles = dailyPlan[iso] || []
    const hasWork = muscles.length > 0
    const kanjiStr = hasWork
      ? muscles.map((m) => MUSCLE_KANJI[m] || '?').join('')
      : '休'
    const onLeftLoop = i < 7
    const loopCx = onLeftLoop ? LEFT_CX : RIGHT_CX
    const angle = (onLeftLoop ? COMPASS_LEFT : COMPASS_RIGHT)[i % 7]
    const rad = (angle * Math.PI) / 180
    const cx = loopCx + R_INSC * Math.sin(rad)
    const cy = LOOP_CY - R_INSC * Math.cos(rad)
    // Weekday cluster sits on its loop's inner hollow at R_WEEKDAY (same compass angle).
    const wdCx = loopCx + R_WEEKDAY * Math.sin(rad)
    const wdCy = LOOP_CY - R_WEEKDAY * Math.cos(rad)
    return { num, hasWork, kanjiStr, iso, cx, cy, angle, onLeftLoop, wdCx, wdCy }
  })

  // Compact day-number + small kanji column. Sized down vs CycleOuroboros since the lobes
  // are narrower than the single ouroboros ring.
  const renderDayInscription = (dl, { hot = false, maskFill = null } = {}) => {
    const { num, kanjiStr } = dl
    const kanjiChars = kanjiStr.split('')
    const n = kanjiChars.length
    const font = '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'

    const DEPTH_STACK_RED = [
      { dy: 2, fill: '#3a0608' },
      { dy: 1, fill: '#9e1118' },
      { dy: 0, fill: '#d4181f' },
    ]
    const DEPTH_STACK_HOT = [
      { dy: 2, fill: '#ffe0a0' },
      { dy: 1, fill: '#d85a10' },
      { dy: 0, fill: '#ff6600' },
    ]
    const stack = maskFill ? [{ dy: 0, fill: maskFill }] : (hot ? DEPTH_STACK_HOT : DEPTH_STACK_RED)

    const renderText = (keyBase, x, y, fontSize, char) => stack.map((layer, li) => (
      <text key={`${keyBase}-${li}`} x={x} y={y + layer.dy} textAnchor="middle" dominantBaseline="central"
        style={{ fontFamily: font, fontSize: `${fontSize}px`, fontWeight: 600, fill: layer.fill }}>
        {char}
      </text>
    ))

    const kanjiSize = n === 1 ? 30 : n <= 4 ? 20 : 15
    const colSpacing = kanjiSize
    const baseY = n === 1 ? 18 : 14
    const rowYStep = kanjiSize
    // Date number now sits to the RIGHT of the kanji column, lifted ~10 screen px above
    // the kanji's vertical center (≈ 11 viewBox units at the current 1.875× scale).
    const rowCount = n === 1 ? 1 : Math.ceil(n / 2)
    const kanjiCenterY = n === 1 ? 18 : (14 + (rowCount - 1) * rowYStep / 2)
    const numEls = renderText('num', 30, kanjiCenterY - 11, 24, num)
    const kanjiEls = kanjiChars.flatMap((k, ki) => {
      if (n === 1) return renderText('kj0', 0, baseY, kanjiSize, k)
      const row = Math.floor(ki / 2)
      const isOddLast = n % 2 === 1 && ki === n - 1
      const x = isOddLast ? 0 : (ki % 2 - 0.5) * colSpacing
      const y = baseY + row * rowYStep
      return renderText(`kj${ki}`, x, y, kanjiSize, k)
    })
    return <>{numEls}{kanjiEls}</>
  }

  return (
    <section className="relative z-10 py-2 px-2 pointer-events-none min-h-[calc(100vh-7px)]">
      <div>
        {/* Infinity container — full viewport width, vertically centered in the body area.
            Rotated 270° (vertical, upside-down) and scaled 1.875× from center. */}
        <div style={{ position: 'absolute', top: '215px', left: 0, width: '100vw', maxWidth: 'none', transform: 'rotate(270deg) scale(1.875)', transformOrigin: 'center' }}>
          {mounted && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/reference/ouroboros-14.svg"
              alt="Infinity"
              className="block w-full h-auto"
              style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))' }}
            />
          )}

          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="absolute inset-0 w-full h-auto pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              <mask id="infinity-inscription-window" maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
                <rect x="0" y="0" width={VB_W} height={VB_H} fill="black"/>
                {dayLabels.map((dl, i) => glowingDays[i] ? (
                  <g key={`inf-mask-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(90)`}>
                    {renderDayInscription(dl, { maskFill: 'white' })}
                  </g>
                ) : null)}
              </mask>
              {/* Weekday-label mask — particles clipped to weekday letter silhouettes inside
                  each loop's hollow. Counter-rotated 90° so letters read upright through the
                  container's 270° rotation. */}
              <mask id="infinity-weekday-window" maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
                <rect x="0" y="0" width={VB_W} height={VB_H} fill="black"/>
                {dayLabels.map((dl, i) => {
                  const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                  return (
                    <g key={`inf-wd-mask-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(90)`}>
                      {dow.split('').map((ch, L) => {
                        const lit = !!weekdayLetterIgnited[i * 3 + L]
                        const x = (L - 1) * WEEKDAY_ADVANCE
                        return (
                          <text key={`inf-wd-mask-${dl.iso}-${L}`}
                            x={x} y={WEEKDAY_LOCAL_Y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${WEEKDAY_FONT_SIZE}px`,
                              fontWeight: 700,
                              fill: 'white',
                              opacity: lit ? 1 : 0,
                            }}>
                            {ch}
                          </text>
                        )
                      })}
                    </g>
                  )
                })}
              </mask>
            </defs>

            {/* Particle aura clipped to inscription silhouettes. */}
            {anyGlowing && (
              <g mask="url(#infinity-inscription-window)" style={{ pointerEvents: 'none' }}>
                <rect x="0" y="0" width={VB_W} height={VB_H} fill="#0a0a0a"/>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  return dayLabels.flatMap((dl, dayIdx) => {
                    if (!glowingDays[dayIdx]) return []
                    const PARTS = 8
                    return Array.from({ length: PARTS }).map((_, i) => {
                      const k = i + dayIdx * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rRise = hash01(k * 7 + 19)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 40
                      const delay = (rDly * 540 + dayIdx * 131) % 600
                      const dur   = 130 + rDur * 150
                      const rise  = 50 + rRise * 35
                      const size  = 6 + rSize * 9
                      const peakA = 0.55 + rPeak * 0.45
                      return (
                        <circle key={`${dl.iso}-sp${i}`} cx={dl.cx + xOff} cy={dl.cy + 18} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${rise.toFixed(0)}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}

            <style>{`
              .infinity-inscription-hot    { animation: inscription-hot-hold 100ms forwards; }
              .infinity-inscription-cooled { animation: inscription-cool-down 1000ms ease-out forwards; }
            `}</style>
            {dayLabels.map((dl, i) => {
              const hot = !!hotDays[i]
              const cooled = !!cooledDays[i]
              const flameOn = !!glowingDays[i]
              const cls = cooled ? 'infinity-inscription-cooled' : (hot ? 'infinity-inscription-hot' : '')
              return (
                <g key={dl.iso}
                   className={cls}
                   style={{
                     mixBlendMode: hot ? 'normal' : 'difference',
                     opacity: flameOn ? 0 : 1,
                     transition: 'opacity 0ms',
                   }}>
                  <g transform={`translate(${dl.cx},${dl.cy}) rotate(90)`}>
                    {renderDayInscription(dl, { hot })}
                  </g>
                </g>
              )
            })}

            {glowIntensity === 'peak' && (
              <g style={{ mixBlendMode: 'plus-lighter', pointerEvents: 'none' }}>
                {dayLabels.map((dl, i) => (
                  <g key={`zoom-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(90)`}>
                    <g style={{
                          transformBox: 'fill-box', transformOrigin: 'center',
                          animation: `inscription-zoom 340ms ease-out forwards ${i * 220}ms`,
                          mixBlendMode: 'plus-lighter',
                          filter: 'drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400)',
                          opacity: 0,
                       }}>
                      {renderDayInscription(dl, { maskFill: '#ff6600' })}
                    </g>
                  </g>
                ))}
              </g>
            )}

            {/* Weekday labels inside each loop's hollow — per-letter yakiire mirrors the
                7-day ouroboros. Cluster center sits at (wdCx, wdCy) on R_WEEKDAY; 3 letters
                horizontally arranged with WEEKDAY_ADVANCE pitch. Counter-rotated 90° so they
                read upright through the container's 270° rotation. */}
            <g>
              {dayLabels.map((dl, i) => {
                const dow = ['SUN','MON','TUE','WED','THU','FRI','SAT'][parseDate(dl.iso).getDay()] || ''
                return (
                  <g key={`dow-${dl.iso}`} transform={`translate(${dl.cx},${dl.cy}) rotate(90)`}>
                    {dow.split('').map((ch, L) => {
                      const flatIdx = i * 3 + L
                      const isFlaming = !!weekdayLetterIgnited[flatIdx]
                      const isZoomed  = !!weekdayLetterZoomed[flatIdx]
                      const isCooled  = !!weekdayLetterCooled[flatIdx]
                      const isHot     = isZoomed && !isCooled
                      // Carved-into-substrate look: paint the canonical red fill on top of the
                      // red substrate, then difference-blend so it reads near-black (pre-flame).
                      // Hot/cooled flip to normal blend so the warm post-ignition palette pops.
                      const fill      = '#d4181f'
                      const baseAlpha = 1
                      const textOpacity = isFlaming ? 0 : baseAlpha
                      const textClass = isCooled ? 'infinity-inscription-cooled' : (isHot ? 'infinity-inscription-hot' : '')
                      const x = (L - 1) * WEEKDAY_ADVANCE
                      return (
                        <g key={`dow-${dl.iso}-${L}`} style={{ mixBlendMode: (isHot || isCooled) ? 'normal' : 'difference' }}>
                          <text
                            x={x} y={WEEKDAY_LOCAL_Y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={textClass}
                            style={{
                              fontFamily: '"Noto Serif JP", Georgia, serif',
                              fontSize: `${WEEKDAY_FONT_SIZE}px`,
                              fontWeight: 700,
                              fill,
                              opacity: textOpacity,
                              transition: 'opacity 0ms',
                            }}>
                            {ch}
                          </text>
                          {isZoomed && (
                            <text
                              x={x} y={WEEKDAY_LOCAL_Y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-zoom-burst"
                              style={{
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${WEEKDAY_FONT_SIZE}px`,
                                fontWeight: 700,
                                fill: '#ff6600',
                              }}>
                              {ch}
                            </text>
                          )}
                          {isFlaming && (
                            <text
                              x={x} y={WEEKDAY_LOCAL_Y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="weekday-flame-engulf"
                              style={{
                                ...engulfVars(i * 13 + L + 7),
                                fontFamily: '"Noto Serif JP", Georgia, serif',
                                fontSize: `${WEEKDAY_FONT_SIZE}px`,
                                fontWeight: 700,
                              }}>
                              {ch}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>

            {/* Weekday particle aura — clipped to weekday letter silhouettes. */}
            {anyWeekdayIgnited && (
              <g mask="url(#infinity-weekday-window)" style={{ pointerEvents: 'none' }}>
                {(() => {
                  const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
                  const PARTS_PER_WEEKDAY = 18
                  return dayLabels.flatMap((dl, wi) => {
                    const dayLit = weekdayLetterIgnited.slice(wi * 3, wi * 3 + 3).some(Boolean)
                    if (!dayLit) return []
                    return Array.from({ length: PARTS_PER_WEEKDAY }).map((_, i) => {
                      const k = i + wi * 23
                      const rX    = hash01(k * 1)
                      const rDly  = hash01(k * 3 + 11)
                      const rDur  = hash01(k * 5 + 17)
                      const rSize = hash01(k * 11 + 23)
                      const rPeak = hash01(k * 13 + 29)
                      const xOff  = (rX - 0.5) * 60
                      const delay = rDly * 300
                      const dur   = 130 + rDur * 150
                      const size  = 5 + rSize * 8
                      const peakA = 0.55 + rPeak * 0.45
                      return (
                        <circle key={`inf-wd${wi}-${i}`} cx={dl.wdCx + xOff} cy={dl.wdCy + 22} r={size} fill="#ff5000" opacity={0}>
                          <animateTransform attributeName="transform" type="translate"
                            values={`0 0; 0 -${50 + rSize * 25}`}
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                          <animate attributeName="opacity"
                            values={`0; ${peakA.toFixed(2)}; 0`}
                            keyTimes="0; 0.2; 1"
                            dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                        </circle>
                      )
                    })
                  })
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>
    </section>
  )
}


/* ── EXPORT ── */
function ExportButton() {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={() => window.print()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red focus-visible:outline-offset-4 no-print"
      style={{ transform: 'rotate(0.7deg)', transformOrigin: 'center center' }}
      aria-label="Export cycle summary as PDF"
    >
      <div
        className="absolute inset-0 bg-gtl-edge"
        style={{
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          transform: hovered ? 'translate(0,0)' : 'translate(5px, 5px)',
          transition: 'transform 80ms ease-out',
        }}
        aria-hidden="true"
      />
      <div
        className="relative flex items-center gap-6 px-10 py-4"
        style={{
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          background: hovered ? '#2a2a2e' : '#1a1a1e',
          border: '1px solid #3a3a42',
          transform: hovered ? 'translate(5px, 5px)' : 'translate(0,0)',
          transition: 'transform 80ms ease-out, background 80ms ease-out',
        }}
      >
        <div className="font-display text-2xl text-gtl-ash leading-none tracking-tight">EXPORT</div>
        <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">SAVE AS PDF / PRINT</div>
        <div className="font-display text-xl text-gtl-smoke/50 leading-none select-none ml-auto">⬇</div>
      </div>
    </button>
  )
}

/* ── BEGIN ── */
// Gurren flame outline — path data lifted from public/reference/gurren_flame.svg
// (same asset the <img src> was loading). Inlined so we can apply SVG-mask-window
// effects (particles rising through the silhouette on press).
const GURREN_FLAME_D = 'M23.2,520.6c5.4-0.2,10.8-0.3,16.2,1.1c5.1,1.4,10.2,4.3,13.1,8.5c3.7,5.5,3.5,13.2,2.3,20.3c-2,11.8-6.6,21.8-11.8,31.8c-6.9,13.3-14.8,26.6-17.3,41.5c-2.5,14.9,0.5,31.4,8.9,44c5.9,8.8,14.6,15.8,24.1,20.2c10.9,5.1,22.9,6.9,34.9,8.7c-5.5-5.1-10.9-10.2-15.8-16c-4.8-5.8-9-12.4-11.2-19.6c-2-6.9-2.2-14.5-0.6-21.6c1.3-5.7,3.7-11,6.1-16.4c-0.7,5.5-1.3,11-0.5,16.4c1.2,7.5,5.3,14.6,10.6,20.5c5.3,5.8,11.7,10.4,18.9,12.7c4.1,1.3,8.5,1.8,12.8,2.2c-2.1-3.8-4.2-7.5-5.9-11.6c-2.4-5.7-4-12-4.1-18.1c-0.2-13.7,6.8-27,15.9-37.3c8-9,17.6-15.7,23-26.8c4-8.1,5.7-18.5,7.2-27.7c2.7,6.5,4,12.1,4.1,17.9c0.2,10.3-3.4,20.7-8,30.1c-5.1,10.3-11.6,19.4-16,29.8c-2.9,6.9-4.9,14.5-4.8,21.9c0,5.3,1.1,10.6,2.2,15.9c7.5-2.9,14.9-5.8,21.5-10.1c6.7-4.5,12.4-10.6,17.4-17.1c3.5-4.5,6.5-9.3,9.6-14c0,7.1-0.1,14.2-1.8,21.2c-1.4,5.6-3.8,11.2-6.7,16.2c-4.1,7.2-9.3,13.3-15,18.5c-5,4.5-10.3,8.2-16.7,11.9c10.6-0.3,20.8-1.9,31.1-4.6c11.8-3.1,23.8-7.8,34.4-16.1c9.9-7.7,18.6-18.7,24-31c10.3-23.7,7.9-52.4-1.3-74.7c-4.4-10.7-10.3-19.8-13.1-29.8c0,10.5-0.7,19.3-2.5,27.7c-1.8,8.4-4.6,16.3-10.6,22.3c-3.8,3.8-8.8,6.7-15.4,7.6c4.1-6.9,8.2-13.8,10.8-21.2c3.1-8.9,4-18.4,2.3-27.9c-1.9-10.9-7.2-21.7-14.3-30.3c-5.9-7.1-13.1-12.7-19.5-19c-9.7-9.5-17.8-20.7-23.2-32.9c-4.2-9.5-6.7-19.7-5.6-34c-10.3,16-11.6,28.8-10.4,40.7c0.6,6.4,1.9,12.6,7.1,24.7c-9.4-4.6-16.1-11.8-20.8-19.8c-6.9-11.6-9.6-25.1-9.1-37.7c0.5-10.8,3.4-20.9,7.5-30.1c3.2-7.3,7-14,10.8-20.7c-6.3,4.1-12.6,8.2-18.6,13c-7.4,6-14.3,13.1-19.1,21.3c-7.4,12.7-9.7,28.1-7.6,42.4c1.4,9.1,4.6,17.8,8.5,26.2c6.6,14.1,15.3,27.1,19.6,43.1c2.5,9,3.6,18.9,2,27.8c-1.4,7.9-5,15-11,17.2c-3,1.1-6.5,1.1-9.3-0.8c-2.8-1.9-4.8-5.8-5.9-9.4c-1.7-5.6-1.4-10.8-1.5-16.4c-0.2-7.8-1.3-16.5-5.3-23.7c-3.2-5.8-8.4-10.6-14.2-13.2c-5.9-2.7-12.4-3.1-19-1.8C32.2,515.3,27.8,517,23.2,520.6z'

function BeginButton({ onFire, onHover, onTriggerFlicker, flickering = false, label = 'ETCH CYCLE', size = 128 }) {
  const [pressed, setPressed] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Etch the cycle"
      onMouseDown={() => { setPressed(true); onTriggerFlicker && onTriggerFlicker() }}
      onMouseUp={() => { setPressed(false); onFire() }}
      onMouseLeave={() => setPressed(false)}
      onMouseEnter={onHover}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriggerFlicker && onTriggerFlicker(); onFire() } }}
      className="fixed bottom-5 right-5 z-40 no-print cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-paper focus-visible:outline-offset-2"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="23.2 388.8 208.8 307.9"
        width={size}
        height={size}
        className="relative z-10 block"
        aria-hidden="true"
        style={{
          filter: 'drop-shadow(2px 2px 0 #000) drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
          transform: pressed ? 'translate(2px, 2px)' : 'none',
          transition: 'transform 80ms ease-out',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Mask defining the flame silhouette as the 'window' — white-filled path
              inside a black rect. Particles clipped through this reveal only inside
              the Gurren flame shape. */}
          <mask id="btn-flame-window" maskUnits="userSpaceOnUse" x="23.2" y="388.8" width="208.8" height="307.9">
            <rect x="23.2" y="388.8" width="208.8" height="307.9" fill="black"/>
            <path d={GURREN_FLAME_D} fill="white"/>
          </mask>
        </defs>
        {/* Static flame silhouette. Red at rest; void-black when flickering so the
            masked orange particles pop through a dark window instead of the red fill. */}
        <path d={GURREN_FLAME_D} fill={flickering ? '#0a0a0a' : '#d4181f'}/>
        {flickering && (
          <g mask="url(#btn-flame-window)">
            {(() => {
              const hash01 = (n) => {
                const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
                return x - Math.floor(x)
              }
              const PARTS = 10
              return Array.from({ length: PARTS }).map((_, i) => {
                const rX      = hash01(i * 1)
                const rXj     = hash01(i * 2 + 5)
                const rDly    = hash01(i * 3 + 11)
                const rDur    = hash01(i * 5 + 17)
                const rRise   = hash01(i * 7 + 19)
                const rSize   = hash01(i * 11 + 23)
                const rPeak   = hash01(i * 13 + 29)
                const rDrft   = hash01(i * 17 + 31)
                const rStartJ = hash01(i * 19 + 37)

                const cxBase = 23.2 + 104.4                              // viewBox horizontal center
                const xOff   = (rX - 0.5) * 190 + (rXj - 0.5) * 60       // ±125 spread — fills the 128px button silhouette
                const delay  = (rDly * 540) % 600                        // ~600ms window
                const dur    = 130 + rDur * 150                          // 130-280ms (matches inscriptions)
                const rise   = 200 + rRise * 100                         // 200-300 viewBox units
                const size   = 20 + rSize * 34                           // r 20-54 — bigger min for a fuller fire
                const peakA  = 0.5 + rPeak * 0.5                         // 0.5-1.0
                const driftX = (rDrft - 0.5) * 80                        // ±40 lateral
                const startY = 630 + (rStartJ - 0.5) * 60                // near the BOTTOM of the flame (high viewBox y)

                return (
                  <circle key={`btn-sp${i}`}
                    cx={cxBase + xOff} cy={startY}
                    r={size} fill="#ff5000" opacity={0}>
                    <animateTransform attributeName="transform" type="translate"
                      values={`0 0; ${(driftX * 0.4).toFixed(2)} -${(rise * 0.5).toFixed(2)}; ${driftX.toFixed(2)} -${rise.toFixed(2)}`}
                      dur={`${dur.toFixed(0)}ms`}
                      begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                    <animate attributeName="opacity"
                      values={`0; ${peakA.toFixed(2)}; ${peakA.toFixed(2)}; 0`}
                      keyTimes="0; 0.08; 0.55; 1"
                      dur={`${dur.toFixed(0)}ms`}
                      begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                    <animate attributeName="r"
                      values={`${size.toFixed(2)}; ${size.toFixed(2)}; ${(2 + rPeak * 4).toFixed(2)}`}
                      dur={`${dur.toFixed(0)}ms`}
                      begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                  </circle>
                )
              })
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}


export default function SummaryPage() {
  useProfileGuard()
  const router = useRouter()
  const { play } = useSound()
  let backHref = '/fitness/new/branded'
  try {
    if (localStorage.getItem('gtl-back-to-edit') === '1') backHref = '/fitness/edit'
    else if (localStorage.getItem('gtl-quick-forge') === '1') backHref = '/fitness/new'
  } catch (_) {}
  useEffect(() => {
    try { if (localStorage.getItem('gtl-back-to-edit') !== '1') return } catch (_) { return }
    const handleKey = (e) => {
      if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))
        router.push('/fitness/edit')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])

  const [cycleName,   setCycleName]  = useState('NEW CYCLE')
  const [targets,     setTargets]    = useState([])
  const [days,        setDays]       = useState([])
  const [dailyPlan,   setDailyPlan]  = useState({})
  const [fireActive,  setFireActive] = useState(false)
  // Inscription engulf / yakiire cascade is intentionally unskippable on the
  // tap-ETCH path — the 4-phase yakiire (ignite → zoom → hot-hold → cool-down)
  // is the cinematic centerpiece. Swipe-forge auto-progresses past summary so
  // it never sees the cascade either way.
  // FireTransition's onComplete normally routes to /fitness/load. On the
  // quick-forge chain we want /fitness/active so the deep-launch effect
  // there continues to the first set's weight popup.
  const fireDestRef = useRef('/fitness/load')
  // Skip-the-fire-transition: ONLY on the swipe-forge auto-progression path
  // (fireDestRef.current === '/fitness/active'). The tap-ETCH path's
  // FireTransition (yakiire) plays through unskippable.
  const skippedRef = useRef(false)
  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    router.push(fireDestRef.current)
  }
  useEffect(() => {
    if (!fireActive) return
    if (fireDestRef.current !== '/fitness/active') return  // tap-ETCH: no skip listener
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
  }, [fireActive])
  const [stampVisible, setStampVisible] = useState(false)
  const [stampLanded,  setStampLanded]  = useState(false)
  // Per-day flame/hot/cooled state arrays — sized to days.length so both CycleBlade
  // (≤7 days) and CycleDrill (8-13 days) can read from the same state regardless of
  // which renders. Re-allocates on resize to keep array length in sync with days.
  const [glowingDays, setGlowingDays] = useState(() => Array(0).fill(false))
  // Glow state machine: 'off' → 'peak' (zoom-burst one-shot) → 'off' again.
  const [glowIntensity, setGlowIntensity] = useState('off')
  const [hotDays,    setHotDays]    = useState(() => Array(0).fill(false))
  const [cooledDays, setCooledDays] = useState(() => Array(0).fill(false))
  // Button flicker state lifted to SummaryPage so the watermark can co-ignite with the button.
  const [flickering, setFlickering] = useState(false)
  // Per-letter weekday lifecycle — N days × 3 letters, indexed `dayIdx * 3 + letterIdx`.
  // Direction inside each day: left-side days right-to-left, right-side days left-to-right (50ms stagger).
  const [weekdayLetterIgnited, setWeekdayLetterIgnited] = useState(() => Array(0).fill(false))
  const [weekdayLetterZoomed,  setWeekdayLetterZoomed]  = useState(() => Array(0).fill(false))
  const [weekdayLetterCooled,  setWeekdayLetterCooled]  = useState(() => Array(0).fill(false))
  // Watermark per-line ignition: [ETCH, CYCLE]. Joins the weekday cascade as steps 6 and 7.
  // Per-letter ETCH/CYCLE ignition (was 2-element whole-word `watermarkIgnited`).
  const [etchIgnited,  setEtchIgnited]  = useState(() => Array(4).fill(false))
  const [cycleIgnited, setCycleIgnited] = useState(() => Array(5).fill(false))
  // Per-letter zoom/cooled. ETCH=4 letters, CYCLE=5. Flame stays whole-word via watermarkIgnited[2].
  const [etchZoomed,  setEtchZoomed]  = useState(() => Array(4).fill(false))
  const [etchCooled,  setEtchCooled]  = useState(() => Array(4).fill(false))
  const [cycleZoomed, setCycleZoomed] = useState(() => Array(5).fill(false))
  const [cycleCooled, setCycleCooled] = useState(() => Array(5).fill(false))
  const mainRef = useRef(null)

  useEffect(() => {
    try {
      const name = localStorage.getItem(pk('cycle-name'))
      const rawT = localStorage.getItem(pk('muscle-targets'))
      const rawD = localStorage.getItem(pk('training-days'))
      const rawP = localStorage.getItem(pk('daily-plan'))
      if (name) setCycleName(name)
      if (rawT) setTargets(JSON.parse(rawT))
      if (rawD) {
        // Derive the contiguous-span cycle from min/max of the user-picked days.
        // Auto-rest gap days (any unpicked day between first and last) are filled here so
        // the cascade scales with the cycle's effective length, not just the picked count.
        const picked = JSON.parse(rawD).sort()
        if (picked.length === 0) {
          setDays([])
        } else {
          const first = picked[0]
          const last  = picked[picked.length - 1]
          const span = []
          let cur = new Date(first + 'T00:00:00Z')
          const end = new Date(last  + 'T00:00:00Z')
          while (cur <= end) {
            span.push(cur.toISOString().slice(0, 10))
            cur.setUTCDate(cur.getUTCDate() + 1)
          }
          setDays(span)
        }
      }
      if (rawP) setDailyPlan(JSON.parse(rawP))
    } catch (_) {}
  }, [])

  // Resize per-day state arrays whenever days.length changes (covers blade ≤7 and drill 8-13).
  useEffect(() => {
    const N = days.length
    setGlowingDays(prev => prev.length === N ? prev : Array(N).fill(false))
    setHotDays(prev    => prev.length === N ? prev : Array(N).fill(false))
    setCooledDays(prev => prev.length === N ? prev : Array(N).fill(false))
    setWeekdayLetterIgnited(prev => prev.length === N * 3 ? prev : Array(N * 3).fill(false))
    setWeekdayLetterZoomed(prev  => prev.length === N * 3 ? prev : Array(N * 3).fill(false))
    setWeekdayLetterCooled(prev  => prev.length === N * 3 ? prev : Array(N * 3).fill(false))
  }, [days.length])

  // Quick-forge auto-progression: ONLY on summary, run the full default
  // ETCH CYCLE flow (handleBegin) — flame animation, fire transition. Land on
  // /fitness/load with the just-forged cycle pre-selected (ACTIVATE popup
  // visible, ready). User decides whether to lift or look around.
  const quickForgeFiredRef = useRef(false)
  const [quickForgeRunning, setQuickForgeRunning] = useState(false)
  useEffect(() => {
    if (quickForgeFiredRef.current) return
    if (!days.length) return  // Wait for storage hydration
    let isQuickForge = false
    try { isQuickForge = localStorage.getItem('gtl-quick-forge') === '1' } catch (_) {}
    if (!isQuickForge) return
    quickForgeFiredRef.current = true
    setQuickForgeRunning(true)
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        localStorage.removeItem('gtl-quick-forge')
        // /fitness/load reads this on mount, auto-selects the matching cycle,
        // then clears the flag. The cycle id is set by handleBegin's
        // localStorage.setItem(pk('cycles'), [newCycle, ...]) — newCycle.id
        // is `Date.now().toString()` so we mark "use the most-recent cycle".
        localStorage.setItem('gtl-just-forged', '1')
      } catch (_) {}
      fireDestRef.current = '/fitness/load'
      handleBeginRef.current?.()
    }, 800)
    return () => { cancelled = true; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days])

  const handleBeginRef = useRef(null)
  const handleBegin = () => {
    play('card-confirm')
    try {
      const existing  = JSON.parse(localStorage.getItem(pk('cycles')) || '[]')
      const editingId = localStorage.getItem(pk('editing-cycle-id'))
      if (editingId) {
        const updated = existing.map((c) =>
          c.id === editingId ? { ...c, name: cycleName, targets, days, dailyPlan } : c
        )
        localStorage.setItem(pk('cycles'), JSON.stringify(updated))
        localStorage.removeItem(pk('editing-cycle-id'))
      } else {
        const cycle = {
          id: Date.now().toString(),
          name: cycleName, targets, days, dailyPlan,
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem(pk('cycles'), JSON.stringify([cycle, ...existing]))
      }
    } catch (_) {}

    // handleBegin fires immediately on press (no onFire delay).
    // All timers are press-absolute from t=0. Below N=15 we use the canonical
    // per-day cascade (blade/ouroboros/drill); above that we switch to a
    // column-major group cascade so 30-day scroll cycles don't drag for 13s.
    const N = Math.max(days.length, 1)
    const isScroll = N > 14
    let stampVisibleAt
    if (isScroll) {
      // ── Scroll cascade ──────────────────────────────────────────────────
      // Days are laid out column-major, 7 rows per column. Days inside a
      // column ignite/zoom/cool simultaneously; columns stagger.
      const ROWS_PER_COL = 7
      const colCount = Math.ceil(N / ROWS_PER_COL)
      // Flame ignite: column 0 at t=200, columns 100ms apart.
      for (let col = 0; col < colCount; col++) {
        const at = 200 + col * 100
        setTimeout(() => {
          setGlowingDays(prev => {
            const next = [...prev]
            for (let row = 0; row < ROWS_PER_COL; row++) {
              const i = col * ROWS_PER_COL + row
              if (i < N) next[i] = true
            }
            return next
          })
        }, at)
      }
      // Peak / zoom: columns cascade 400ms each (slowed from 200ms so the cascade
      // is visible even at the degraded frame-rates the scroll layout produces).
      setTimeout(() => setGlowIntensity('peak'), 1600)
      for (let col = 0; col < colCount; col++) {
        const at = 1600 + col * 400
        setTimeout(() => {
          setGlowingDays(prev => {
            const next = [...prev]
            for (let row = 0; row < ROWS_PER_COL; row++) {
              const i = col * ROWS_PER_COL + row
              if (i < N) next[i] = false
            }
            return next
          })
          setHotDays(prev => {
            const next = [...prev]
            for (let row = 0; row < ROWS_PER_COL; row++) {
              const i = col * ROWS_PER_COL + row
              if (i < N) next[i] = true
            }
            return next
          })
        }, at)
      }
      // Cooled: 1600ms hold after zoom starts, then columns cool 500ms each
      // (slowed from 300ms to match the visible cascade pace above).
      for (let col = 0; col < colCount; col++) {
        const at = 1600 + 1600 + col * 500
        setTimeout(() => {
          setCooledDays(prev => {
            const next = [...prev]
            for (let row = 0; row < ROWS_PER_COL; row++) {
              const i = col * ROWS_PER_COL + row
              if (i < N) next[i] = true
            }
            return next
          })
        }, at)
      }
      const glowOffAt    = 1600 + (colCount - 1) * 400 + 340
      const lastCooledAt = 3200 + (colCount - 1) * 500
      setTimeout(() => setGlowIntensity('off'), Math.max(3040, glowOffAt))
      stampVisibleAt = Math.max(4290, lastCooledAt + 400)
      setTimeout(() => setStampVisible(true), stampVisibleAt)
    } else {
      // ── Canonical cascade (blade ≤6 / ouroboros =7 / drill 8-13) ─────────
      // Flame activation: REVERSE order, 60ms stagger. Last inscription ignites first at t=200,
      // cascading up to day 0 at t=200 + (N-1)*60.
      for (let step = 0; step < N; step++) {
        const dayIdx = N - 1 - step
        setTimeout(() => {
          setGlowingDays(prev => { const next = [...prev]; next[dayIdx] = true; return next })
        }, 200 + step * 60)
      }
      setTimeout(() => setGlowIntensity('peak'),      1600)   // zoom-burst cascade begins (340ms per glyph, 220ms stagger)
      // Fast cascade (REVERSE order): anchor N fires first at t=1600, anchor 1 last.
      for (let step = 0; step < N; step++) {
        const dayIdx = N - 1 - step
        const at = 1600 + step * 220
        setTimeout(() => {
          setGlowingDays(prev => { const next = [...prev]; next[dayIdx] = false; return next })
          setHotDays(prev => { const next = [...prev]; next[dayIdx] = true; return next })
        }, at)
      }
      // Slow dissipation (REVERSE order): anchor N cools first, anchor 1 last.
      for (let step = 0; step < N; step++) {
        const dayIdx = N - 1 - step
        setTimeout(() => {
          setCooledDays(prev => { const next = [...prev]; next[dayIdx] = true; return next })
        }, 1600 + 1600 + step * 350)
      }
      // Last inscription's zoom cascade ends at 1600 + (N-1)*220 + 340.
      const glowOffAt   = 1600 + (N - 1) * 220 + 340
      const lastCooledAt = 3200 + (N - 1) * 350
      setTimeout(() => setGlowIntensity('off'),       Math.max(3040, glowOffAt))
      // Stamp lands after the LAST cooled trigger plus a small breath. For N=6 this resolves
      // to 4290 (canonical); for N=13 it pushes out so the stamp doesn't collide with cooling.
      stampVisibleAt = Math.max(4290, lastCooledAt + 90)
      setTimeout(() => setStampVisible(true),         stampVisibleAt)
    }
    // Middle-out symmetric cascade, 70ms stagger, starts t=700.
    // Step 0 (t=700): innermost pair (days 3+4) + ETCH + CYCLE ignite together.
    // Step 1 (t=770): days 2+5. Step 2 (t=840): outermost pair (days 1+6).
    // Middle-out pairs with ETCH and CYCLE on separate steps — ETCH anchored to day 5,
    // CYCLE anchored to day 6.
    // ETCH per-letter flame (50ms stagger, t=985).
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        setEtchIgnited(prev => { const next = [...prev]; next[i] = true; return next })
      }, 985 + i * 50)
    }
    // CYCLE per-letter flame (50ms stagger, t=1035 — letter 1 fires at ETCH letter 2 time).
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setCycleIgnited(prev => { const next = [...prev]; next[i] = true; return next })
      }, 1035 + i * 50)
    }

    // Per-letter weekday cascade. Below 15 days, canonical middle-out pair scheduling;
    // 15+ days uses a column-block cascade that flips ALL 21 weekday letters in a
    // column with a single state update (3 setTimeouts per column instead of 21).
    // Staggers slowed (400ms zoom / 500ms cooled) so the cascade is perceptible
    // even when the browser drops to 2-3fps on dense scroll layouts.
    let lastPairCooledAt
    if (isScroll) {
      const ROWS_PER_COL = 7
      const colCount = Math.ceil(N / ROWS_PER_COL)
      for (let col = 0; col < colCount; col++) {
        // Match the per-day cascade so a column's day-numbers + weekday letters
        // ignite/zoom/cool together.
        const flameAt  = 200  + col * 100
        const zoomAt   = 1600 + col * 400
        const cooledAt = 3200 + col * 500
        const indices = []
        for (let row = 0; row < ROWS_PER_COL; row++) {
          const dayIdx = col * ROWS_PER_COL + row
          if (dayIdx >= N) break
          for (let L = 0; L < 3; L++) indices.push(dayIdx * 3 + L)
        }
        setTimeout(() => {
          setWeekdayLetterIgnited(prev => {
            const next = [...prev]
            indices.forEach(i => { next[i] = true })
            return next
          })
        }, flameAt)
        setTimeout(() => {
          setWeekdayLetterIgnited(prev => {
            const next = [...prev]
            indices.forEach(i => { next[i] = false })
            return next
          })
          setWeekdayLetterZoomed(prev => {
            const next = [...prev]
            indices.forEach(i => { next[i] = true })
            return next
          })
        }, zoomAt)
        setTimeout(() => {
          setWeekdayLetterCooled(prev => {
            const next = [...prev]
            indices.forEach(i => { next[i] = true })
            return next
          })
        }, cooledAt)
      }
      lastPairCooledAt = 3200 + (colCount - 1) * 500
    } else {
      // ── Per-letter weekday cascade ──
      //   Within each weekday, letters fire L=2 → L=0.
      //   The PER-ANCHOR ORDER is silhouette-dependent:
      //     - Blade (1-6 days, katana): reverse N → 1 — matches the spine layout
      //       so the cascade reads tip-to-hilt (the "middle-out" feel).
      //     - All other silhouettes (Ouroboros, Drill, Infinity): plain 1 → N
      //       forward — looks correct on circles / spirals / loops where reverse
      //       reads as "starts from a random side".
      const isBlade = N >= 1 && N <= 6
      const letterStaggerOffsetFast   = (_dayIdx, L) => (2 - L) * 50
      const letterStaggerOffsetCooled = (_dayIdx, L) => (2 - L) * 75
      const letterStaggerOffsetSlow   = (_dayIdx, L) => (2 - L) * 50

      const WEEKDAY_PAIRS = Array.from({ length: N }, (_, step) => ({
        days: [isBlade ? (N - 1 - step) : step],
        flame:  900  + step * 50,
        zoom:   3000 + step * 50,
        cooled: 3650 + step * 75,
      }))
      WEEKDAY_PAIRS.forEach(({ days: pairDays, flame, zoom, cooled }) => {
        pairDays.forEach(dayIdx => {
          for (let L = 0; L < 3; L++) {
            const flatIdx = dayIdx * 3 + L
            setTimeout(() => {
              setWeekdayLetterIgnited(prev => { const next = [...prev]; next[flatIdx] = true; return next })
            }, flame + letterStaggerOffsetSlow(dayIdx, L))
            setTimeout(() => {
              setWeekdayLetterIgnited(prev => { const next = [...prev]; next[flatIdx] = false; return next })
              setWeekdayLetterZoomed(prev  => { const next = [...prev]; next[flatIdx] = true;  return next })
            }, zoom + letterStaggerOffsetFast(dayIdx, L))
            setTimeout(() => {
              setWeekdayLetterCooled(prev => { const next = [...prev]; next[flatIdx] = true; return next })
            }, cooled + letterStaggerOffsetCooled(dayIdx, L))
          }
        })
      })
      lastPairCooledAt = 3650 + (WEEKDAY_PAIRS.length - 1) * 75 + 2 * 75
    }

    // Weekday + ETCH/CYCLE zoom-burst cascade — fires after the blade's final inscription
    // zoom (t=2600), mirroring the same middle-out 175/150ms stagger. Each step also flips
    // its ignited flag false so the particle group unmounts at the same moment the zoom
    // fires (matches the blade's flame-off + hot-on pattern).
    // ETCH per-letter zoom cascade (35ms stagger, t=3050). Flame off per-letter.
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        setEtchIgnited(prev => { const next = [...prev]; next[i] = false; return next })
        setEtchZoomed(prev  => { const next = [...prev]; next[i] = true;  return next })
      }, 3150 + i * 50)
    }
    // CYCLE per-letter zoom cascade (35ms stagger, t=3085 — letter 1 at ETCH letter 2 time).
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setCycleIgnited(prev => { const next = [...prev]; next[i] = false; return next })
        setCycleZoomed(prev  => { const next = [...prev]; next[i] = true;  return next })
      }, 3200 + i * 50)
    }
    // Cooled cascade — 700ms after each zoom step (matches blade's hot→cooled fade duration).
    // ETCH per-letter cooled cascade (50ms stagger, t=3690).
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        setEtchCooled(prev => { const next = [...prev]; next[i] = true; return next })
      }, 3740 + i * 75)
    }
    // CYCLE per-letter cooled cascade (50ms stagger, t=3850).
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        setCycleCooled(prev => { const next = [...prev]; next[i] = true; return next })
      }, 3815 + i * 75)
    }

    // Stamp/fire anchors derive from stampVisibleAt so larger N pushes them out together.
    const stampLandedAt = stampVisibleAt + 665
    const stampPlayAt   = stampVisibleAt + 750
    const fireActiveAt  = stampVisibleAt + 1710
    void lastPairCooledAt
    setTimeout(() => {
      play('stamp')
      setStampLanded(true)
      if (mainRef.current) {
        mainRef.current.animate(
          [
            { transform: 'translate(0,0)' },
            { transform: 'translate(-16px, 10px)' },
            { transform: 'translate(14px, -14px)' },
            { transform: 'translate(-12px, -7px)' },
            { transform: 'translate(10px, 10px)' },
            { transform: 'translate(-8px, 5px)' },
            { transform: 'translate(6px, -8px)' },
            { transform: 'translate(-4px, 4px)' },
            { transform: 'translate(2px, -2px)' },
            { transform: 'translate(0,0)' },
          ],
          { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
        )
      }
    }, stampLandedAt)

    setTimeout(() => play('stamp'),       stampPlayAt)
    setTimeout(() => setFireActive(true), fireActiveAt)
  }

  // Keep handleBeginRef in sync so the quick-forge useEffect can invoke
  // handleBegin without depending on it as a render-time closure.
  useEffect(() => { handleBeginRef.current = handleBegin })

  const cols = days.length <= 5 ? days.length
             : days.length <= 10 ? Math.ceil(days.length / 2)
             : Math.ceil(days.length / 3)

  // Watermark layout — same stacked ETCH-above-CYCLE shape in every mode; in
  // scroll mode the magnitudes shrink (font 14 vs 18) so the watermark fits
  // beside the smaller 92px flame button without crowding the scroll body.
  const wmScroll    = days.length > 14
  const wmInfinity  = days.length === 14
  const wmDrill     = (days.length >= 8 && days.length <= 13) || wmInfinity   // 14-day shares drill watermark slot
  const wmBladeLike = days.length > 0 && days.length <= 7   // blade ≤6 + ouroboros =7
  const WM_FONT   = wmScroll ? 14 : 18
  const WM_W      = wmScroll ? 100 : 130
  const WM_H      = wmScroll ? 62  : 78
  const WM_VB     = `0 0 ${WM_W} ${WM_H}`
  const ETCH_X    = wmScroll ? [6, 20, 34, 48]      : [8, 26, 44, 62]
  const ETCH_Y    = wmScroll ? 32 : 40
  const ETCH_ROTY = wmScroll ? 27 : 34
  const CYCLE_X   = wmScroll ? [6, 19, 33, 47, 61]  : [8, 25, 43, 61, 79]
  const CYCLE_Y   = wmScroll ? 58 : 72
  const CYCLE_ROTY = wmScroll ? 53 : 66

  return (
    <main ref={mainRef} className="relative h-[100dvh] overflow-hidden bg-gtl-void">

      {/* ── Shared SVG filter defs (accessible via CSS filter: url(#…) from any element) ──
           flame-outer-btn is a button-scaled version of the inscription flame-outer filter:
           smaller displacement (72px canvas vs viewBox-compressed inscription SVG), tighter
           blur, coarser dropout so holes are still readable at the button render size. Same
           turbulence type, same animated baseFrequency technique, same amber palette. */}
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page { margin: 0.6in; size: portrait; }
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .gtl-noise { display: none !important; }
          .fixed { display: none !important; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* ── Atmospherics ── */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(122,14,20,0.18) 0%, transparent 45%, rgba(74,10,14,0.28) 100%)' }} />

      {/* ── Retreat button (fixed top-left, safe-area aware via canonical component) ── */}
      <RetreatButton href={backHref} />

      {/* ── BLADE (1–6) / OUROBOROS (7) / DRILL (8–13) / FALLBACK (14) / SCROLL (15+) ── */}
      {days.length > 0 && days.length < 7 && (
        <CycleBlade days={days} dailyPlan={dailyPlan} glowingDays={glowingDays} glowIntensity={glowIntensity} hotDays={hotDays} cooledDays={cooledDays} weekdayLetterIgnited={weekdayLetterIgnited} weekdayLetterZoomed={weekdayLetterZoomed} weekdayLetterCooled={weekdayLetterCooled} />
      )}

      {days.length === 7 && (
        <CycleOuroboros days={days} dailyPlan={dailyPlan} glowingDays={glowingDays} glowIntensity={glowIntensity} hotDays={hotDays} cooledDays={cooledDays} weekdayLetterIgnited={weekdayLetterIgnited} weekdayLetterZoomed={weekdayLetterZoomed} weekdayLetterCooled={weekdayLetterCooled} />
      )}

      {(days.length > 0 && days.length <= 7 || days.length === 14) && (() => {
        // Cycle title styled to match the ETCH/CYCLE watermark exactly: same Shippori Mincho
        // serif, 18px, weight 600, dim red 65% alpha, 0.35em letter spacing, each word on
        // its own line. Blade (1-6) sits top-left; 7-day sits bottom-left; 14-day sits
        // top-center above the upper loop.
        const titleStyle = {
          fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif',
          fontSize: '18px',
          fontWeight: 600,
          letterSpacing: '0.35em',
          color: 'rgba(212, 24, 31, 0.65)',
          lineHeight: '1.6',
          textTransform: 'uppercase',
        }
        const words = cycleName.split(/\s+/).filter(Boolean)
        const containerStyle =
          days.length === 14
            ? { position: 'fixed', top: '140px', left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none', textAlign: 'center' }
            : days.length === 7
              ? { position: 'fixed', bottom: '20px', left: '20px', zIndex: 40, pointerEvents: 'none' }
              : { position: 'fixed', top: '70px', left: '20px', zIndex: 40, pointerEvents: 'none', transform: 'rotate(-8deg)', transformOrigin: 'left top' }
        return (
          <div className="no-print" style={containerStyle}>
            {words.map((w, i) => (
              <div key={i} style={titleStyle}>{w}</div>
            ))}
          </div>
        )
      })()}

      {days.length >= 8 && days.length <= 13 && (
        <CycleDrill days={days} dailyPlan={dailyPlan} cycleName={cycleName} glowingDays={glowingDays} glowIntensity={glowIntensity} hotDays={hotDays} cooledDays={cooledDays} weekdayLetterIgnited={weekdayLetterIgnited} weekdayLetterZoomed={weekdayLetterZoomed} weekdayLetterCooled={weekdayLetterCooled} />
      )}

      {days.length === 14 && (
        <CycleInfinity days={days} dailyPlan={dailyPlan} glowingDays={glowingDays} glowIntensity={glowIntensity} hotDays={hotDays} cooledDays={cooledDays} weekdayLetterIgnited={weekdayLetterIgnited} weekdayLetterZoomed={weekdayLetterZoomed} weekdayLetterCooled={weekdayLetterCooled} />
      )}

      {days.length > 14 && (
        <CycleScroll days={days} dailyPlan={dailyPlan} glowingDays={glowingDays} glowIntensity={glowIntensity} hotDays={hotDays} cooledDays={cooledDays} weekdayLetterIgnited={weekdayLetterIgnited} weekdayLetterZoomed={weekdayLetterZoomed} weekdayLetterCooled={weekdayLetterCooled} />
      )}

      {days.length === 0 && (
        <section className="relative z-10 px-8 py-12">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-gtl-smoke">
            NO DAYS SCHEDULED
          </div>
        </section>
      )}

      {/* Watermark — full yakiire: SVG mask carved into ETCH CYCLE letters, particle flames
          rise through the silhouettes while the button is flickering, hot-glow drop-shadow on
          the visible text. Idle: dim red; press: bright orange with particle fire. */}
      <style>{`
        /* Inscription keyframes lifted from CycleBlade so CycleDrill (and the
           ETCH/CYCLE watermark) can use the same hot-hold / cool-down animations
           regardless of whether the blade is mounted. */
        @keyframes inscription-hot-hold {
          from, to { filter: drop-shadow(0 0 4px #fff4c9) drop-shadow(0 0 10px #ffa840) drop-shadow(0 0 22px rgba(255, 120, 0, 0.85)) drop-shadow(0 0 36px rgba(255, 80, 0, 0.5)); }
        }
        @keyframes inscription-cool-down {
          0%   { filter: drop-shadow(0 0 4px #fff4c9) drop-shadow(0 0 10px #ffa840) drop-shadow(0 0 22px rgba(255, 120, 0, 0.85)) drop-shadow(0 0 36px rgba(255, 80, 0, 0.5)); }
          100% { filter: drop-shadow(0 0 1.5px #ff8800) drop-shadow(0 0 4px rgba(255, 122, 0, 0.55)) drop-shadow(0 0 7px rgba(255, 80, 0, 0.2)) drop-shadow(0 0 7px rgba(255, 80, 0, 0)); }
        }
        @keyframes inscription-zoom {
          0%   { transform: scale(1);    opacity: 1.0; }
          30%  { transform: scale(1.4);  opacity: 1.0; }
          70%  { transform: scale(1.68); opacity: 0.9; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        .inscription-hot    { animation: inscription-hot-hold 100ms forwards; }
        .inscription-cooled { animation: inscription-cool-down 1000ms ease-out forwards; }
        @keyframes watermark-hot-hold {
          from, to {
            filter: drop-shadow(0 0 3px #fff4c9)
                    drop-shadow(0 0 7px #ffa840)
                    drop-shadow(0 0 14px rgba(255, 120, 0, 0.8))
                    drop-shadow(0 0 22px rgba(255, 80, 0, 0.4));
          }
        }
        .watermark-hot { animation: watermark-hot-hold 100ms forwards; }
        @keyframes weekday-flame-engulf {
          /* 0% — moment of ignition, small tight glow */
          0% {
            opacity: var(--engulf-opacity-start, 0.55);
            filter:
              drop-shadow(0 0 var(--engulf-glow-0, 1.5px) #ff5000)
              drop-shadow(0 0 var(--engulf-glow-0b, 3px) rgba(255, 80, 0, 0.45))
              blur(var(--engulf-blur-0, 0.2px));
          }
          /* 12% — CATCH peak (briefly brighter, still tight) */
          12% {
            opacity: 1;
            filter:
              drop-shadow(0 0 var(--engulf-glow-catch, 5px) #ff5000)
              drop-shadow(0 0 var(--engulf-glow-catch-b, 12px) rgba(255, 80, 0, 0.75))
              blur(var(--engulf-blur-catch, 0.7px));
          }
          /* 32% — wisp begins spreading */
          32% {
            opacity: 0.72;
            filter:
              drop-shadow(0 0 var(--engulf-glow-1, 7px) #ff5000)
              drop-shadow(0 0 var(--engulf-glow-1b, 18px) rgba(255, 80, 0, 0.55))
              drop-shadow(0 0 var(--engulf-glow-1c, 26px) rgba(255, 80, 0, 0.35))
              blur(var(--engulf-blur-1, 1.6px));
          }
          /* 62% — mid wisp, glow diffusing, opacity dropping */
          62% {
            opacity: 0.38;
            filter:
              drop-shadow(0 0 var(--engulf-glow-2, 10px) rgba(255, 80, 0, 0.75))
              drop-shadow(0 0 var(--engulf-glow-2b, 22px) rgba(255, 80, 0, 0.3))
              blur(var(--engulf-blur-2, 3.2px));
          }
          /* 100% — wisped away */
          100% {
            opacity: 0;
            filter:
              drop-shadow(0 0 var(--engulf-glow-3, 14px) rgba(255, 80, 0, 0.1))
              blur(var(--engulf-blur-3, 5.5px));
          }
        }
        .weekday-flame-engulf {
          animation: weekday-flame-engulf var(--engulf-dur, 260ms) cubic-bezier(0.1, 0.6, 0.35, 1) forwards;
          fill: #ff5000;
          pointer-events: none;
        }
        @keyframes weekday-zoom {
          0%   { transform: scale(1);    opacity: 1.0; }
          30%  { transform: scale(1.06); opacity: 1.0; }
          70%  { transform: scale(1.10); opacity: 0.9; }
          100% { transform: scale(1.12); opacity: 0; }
        }
        .weekday-zoom-burst {
          transform-box: fill-box;
          transform-origin: center;
          animation: weekday-zoom 340ms ease-out forwards;
          mix-blend-mode: plus-lighter;
          filter: drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400);
          pointer-events: none;
        }
        @keyframes watermark-zoom {
          0%   { transform: scale(1);    opacity: 1.0; }
          30%  { transform: scale(1.03); opacity: 1.0; }
          70%  { transform: scale(1.05); opacity: 0.9; }
          100% { transform: scale(1.06); opacity: 0; }
        }
        .watermark-zoom-burst {
          transform-box: fill-box;
          transform-origin: center;
          animation: watermark-zoom 340ms ease-out forwards;
          mix-blend-mode: plus-lighter;
          filter: drop-shadow(0 0 6px #ff6600) drop-shadow(0 0 16px #ff4400);
          pointer-events: none;
        }
      `}</style>
      {/* 14-day watermark — plain centered text matching the cycle-title format. Sits in the
          bottom loop's hollow. The SVG watermark below is hidden for 14-day so this CSS-text
          variant carries the format. */}
      {wmInfinity && (
        <div className="fixed z-[20] no-print pointer-events-none"
             style={{ top: '500px', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          {['ETCH', 'CYCLE'].map((word) => (
            <div key={word} style={{
              fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '0.35em',
              color: 'rgba(212, 24, 31, 0.65)',
              lineHeight: '1.6',
              textTransform: 'uppercase',
            }}>{word}</div>
          ))}
        </div>
      )}
      <svg
        aria-hidden="true"
        className="fixed z-[20] pointer-events-none select-none"
        width={WM_W} height={WM_H}
        viewBox={WM_VB}
        style={wmScroll
          ? {
              // CycleScroll mode: small stacked watermark sitting to the LEFT of the
              // smaller 92px flame button (button at bottom:5, right:5, size 92).
              // No tilt — sits flush against the button's left edge.
              bottom: '20px',
              right: 'calc(5px + 92px - 4px)',
              overflow: 'visible',
            }
          : wmInfinity
          ? { display: 'none' }   // 14-day uses the CSS-text watermark above instead.
          : wmBladeLike
          ? {
              // Blade (≤6) + ouroboros (=7): watermark sits ABOVE the 128px flame
              // button. 8° tilt pivoted around the right-bottom corner.
              bottom: 'calc(20px + 128px + 10px)',
              right: '2px',
              transform: 'rotate(8deg)',
              transformOrigin: 'right bottom',
              overflow: 'visible',
            }
          : wmDrill
          ? {
              // Drill (8-13): watermark sits beside the 128px flame button (bottom-
              // aligned, ~10px gap to its left). Same 8° tilt, right-bottom origin.
              bottom: '20px',
              right: 'calc(20px + 128px + 10px)',
              transform: 'rotate(8deg)',
              transformOrigin: 'right bottom',
              overflow: 'visible',
            }
          : {
              // Fallback (days.length === 0): same as drill's original placement.
              bottom: 'calc(20px + 128px + 10px)',
              right: '2px',
              transform: 'rotate(8deg)',
              transformOrigin: 'right bottom',
              overflow: 'visible',
            }}
      >
        <defs>
          <mask id="watermark-window" maskUnits="userSpaceOnUse" x="0" y="0" width={WM_W} height={WM_H}>
            <rect x="0" y="0" width={WM_W} height={WM_H} fill="black"/>
            {[
              { ch: 'E', x: ETCH_X[0],  y: ETCH_Y,  w: 0, i: 0 },
              { ch: 'T', x: ETCH_X[1],  y: ETCH_Y,  w: 0, i: 1 },
              { ch: 'C', x: ETCH_X[2],  y: ETCH_Y,  w: 0, i: 2 },
              { ch: 'H', x: ETCH_X[3],  y: ETCH_Y,  w: 0, i: 3 },
              { ch: 'C', x: CYCLE_X[0], y: CYCLE_Y, w: 1, i: 0 },
              { ch: 'Y', x: CYCLE_X[1], y: CYCLE_Y, w: 1, i: 1 },
              { ch: 'C', x: CYCLE_X[2], y: CYCLE_Y, w: 1, i: 2 },
              { ch: 'L', x: CYCLE_X[3], y: CYCLE_Y, w: 1, i: 3 },
              { ch: 'E', x: CYCLE_X[4], y: CYCLE_Y, w: 1, i: 4 },
            ].map((g, k) => {
              const lit = g.w === 0 ? !!etchIgnited[g.i] : !!cycleIgnited[g.i]
              return (
                <text key={`mask-${k}`} x={g.x} y={g.y} textAnchor="start"
                  fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
                  fontSize={WM_FONT} fontWeight="600"
                  fill="white" opacity={lit ? 1 : 0}>
                  {g.ch}
                </text>
              )
            })}
          </mask>
        </defs>
        {/* Base text — each line rendered as its own <text> so ETCH and CYCLE can be gated
            independently against watermarkIgnited[0] and [1]. Hidden once its own line ignites
            (inscription cheat) so the particle flames are the only visible content. */}
        {/* Per-letter ETCH base text — each letter independently flips zoomed → cooled. */}
        {['E','T','C','H'].map((ch, i) => {
          const x = ETCH_X[i]
          const isZoomed  = !!etchZoomed[i]
          const isCooled  = !!etchCooled[i]
          const isFlaming = !!etchIgnited[i]
          const isHot     = isZoomed && !isCooled
          return (
            <text key={`etch-base-${i}`} x={x} y={ETCH_Y} textAnchor="start"
              fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
              fontSize={WM_FONT} fontWeight="600"
              className={isCooled ? 'inscription-cooled' : (isHot ? 'inscription-hot' : '')}
              fill={(isHot || isCooled) ? '#d4181f' : 'rgba(212, 24, 31, 0.65)'}
              opacity={isFlaming ? 0 : 1}
              style={{ transition: 'opacity 0ms' }}>
              {ch}
            </text>
          )
        })}
        {/* Per-letter ETCH engulf bloom — each letter unmounts as it zooms. */}
        {['E','T','C','H'].map((ch, i) => {
          if (!etchIgnited[i]) return null
          const x = ETCH_X[i]
          return (
            <g key={`etch-engulf-${i}`} transform={`rotate(-8 ${x + 6} ${ETCH_ROTY})`}>
              <text x={x} y={ETCH_Y} textAnchor="start"
                fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
                fontSize={WM_FONT} fontWeight="600"
                className="weekday-flame-engulf"
                style={engulfVars(91 + i)}>
                {ch}
              </text>
            </g>
          )
        })}
        {/* Per-letter ETCH zoom-burst — fires per letter on its 50ms cascade. */}
        {['E','T','C','H'].map((ch, i) => {
          if (!etchZoomed[i]) return null
          const x = ETCH_X[i]
          return (
            <text key={`etch-zoom-${i}`} x={x} y={ETCH_Y} textAnchor="start"
              fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
              fontSize={WM_FONT} fontWeight="600"
              fill="#ff6600"
              className="watermark-zoom-burst">{ch}</text>
          )
        })}
        {/* Per-letter CYCLE base text — each letter independently flips zoomed → cooled. */}
        {['C','Y','C','L','E'].map((ch, i) => {
          const x = CYCLE_X[i]
          const isZoomed  = !!cycleZoomed[i]
          const isCooled  = !!cycleCooled[i]
          const isFlaming = !!cycleIgnited[i]
          const isHot     = isZoomed && !isCooled
          return (
            <text key={`cycle-base-${i}`} x={x} y={CYCLE_Y} textAnchor="start"
              fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
              fontSize={WM_FONT} fontWeight="600"
              className={isCooled ? 'inscription-cooled' : (isHot ? 'inscription-hot' : '')}
              fill={(isHot || isCooled) ? '#d4181f' : 'rgba(212, 24, 31, 0.65)'}
              opacity={isFlaming ? 0 : 1}
              style={{ transition: 'opacity 0ms' }}>
              {ch}
            </text>
          )
        })}
        {/* Per-letter CYCLE engulf bloom — each letter unmounts as it zooms. */}
        {['C','Y','C','L','E'].map((ch, i) => {
          if (!cycleIgnited[i]) return null
          const x = CYCLE_X[i]
          return (
            <g key={`cycle-engulf-${i}`} transform={`rotate(-8 ${x + 6} ${CYCLE_ROTY})`}>
              <text x={x} y={CYCLE_Y} textAnchor="start"
                fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
                fontSize={WM_FONT} fontWeight="600"
                className="weekday-flame-engulf"
                style={engulfVars(95 + i)}>
                {ch}
              </text>
            </g>
          )
        })}
        {/* Per-letter CYCLE zoom-burst — fires per letter on its 50ms cascade. */}
        {['C','Y','C','L','E'].map((ch, i) => {
          if (!cycleZoomed[i]) return null
          const x = CYCLE_X[i]
          return (
            <text key={`cycle-zoom-${i}`} x={x} y={CYCLE_Y} textAnchor="start"
              fontFamily='"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif'
              fontSize={WM_FONT} fontWeight="600"
              fill="#ff6600"
              className="watermark-zoom-burst">{ch}</text>
          )
        })}
        {/* Particles AFTER — clipped to letter silhouettes via the mask, paint on top of the
            void-black base so the flames show through the letter shapes. */}
        {(etchIgnited.some(Boolean) || cycleIgnited.some(Boolean)) && (
          <g mask="url(#watermark-window)">
            {(() => {
              const hash01 = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) }
              const PARTS = 95
              return Array.from({ length: PARTS }).map((_, i) => {
                const rX    = hash01(i * 1)
                const rDly  = hash01(i * 3 + 11)
                const rDur  = hash01(i * 5 + 17)
                const rSize = hash01(i * 11 + 23)
                const rPeak = hash01(i * 13 + 29)
                // Partition by index parity: odd → ETCH band (top), even → CYCLE band (bottom).
                // CYCLE band is deliberately thinned out (~half the particles dropped) and tuned
                // toward smaller/slower/dimmer sparks so visible dark gaps show between flashes
                // rather than a continuous orange wash.
                const isEtchBand = (i % 2 === 1)
                if (!isEtchBand && (i % 4 === 2)) return null
                if (isEtchBand && !etchIgnited.some(Boolean)) return null
                if (!isEtchBand && !cycleIgnited.some(Boolean)) return null
                // Particle band Y positions scale with the watermark vertical magnitude.
                const startY = wmScroll
                  ? (isEtchBand ? 38 : 60)
                  : (isEtchBand ? 46 : 74)
                const rise   = isEtchBand ? (18 + rSize * 14) : (12 + rSize * 10)
                const xBase  = 8
                const xSpan  = wmScroll
                  ? (isEtchBand ? 56 : 68)
                  : (isEtchBand ? 70 : 85)
                const xOff   = xBase + rX * xSpan
                const delay  = rDly * 300
                const dur    = 130 + rDur * 150
                const size   = isEtchBand ? (9 + rSize * 11) : (5 + rSize * 6)
                const peakA  = isEtchBand ? (0.55 + rPeak * 0.45) : (0.40 + rPeak * 0.40)
                const peakKeyTime = isEtchBand ? 0.25 : 0.15
                return (
                  <circle key={`wm${i}`} cx={xOff} cy={startY} r={size} fill="#ff5000" opacity={0}>
                    <animateTransform attributeName="transform" type="translate"
                      values={`0 0; 0 -${rise.toFixed(0)}`}
                      dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                    <animate attributeName="opacity"
                      values={`0; ${peakA.toFixed(2)}; 0`}
                      keyTimes={`0; ${peakKeyTime}; 1`}
                      dur={`${dur.toFixed(0)}ms`} begin={`${delay.toFixed(0)}ms`} repeatCount="indefinite"/>
                  </circle>
                )
              })
            })()}
          </g>
        )}
      </svg>

      {/* Cycle-name banner — sits in the scroll's TOP rolled-banner area, mirroring
          the ETCH CYCLE label at the bottom. Only renders in scroll mode. */}
      {wmScroll && (
        <div
          aria-hidden="true"
          className="fixed z-[20] pointer-events-none select-none"
          style={{
            top: 'calc(37vw - 60px)',
            left: 'calc(50% + 17px)',
            transform: 'translateX(-50%)',
            fontFamily: '"Shippori Mincho", "Noto Serif JP", "Yu Mincho", Georgia, serif',
            fontSize: '24px',
            fontWeight: 600,
            color: 'rgba(212, 24, 31, 0.65)',
            letterSpacing: '0.18em',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {cycleName}
        </div>
      )}

      {/* ── ETCH CYCLE (fixed bottom-right CTA) ── */}
      <BeginButton
        onFire={handleBegin}
        onHover={() => play('button-hover')}
        onTriggerFlicker={() => setFlickering(true)}
        flickering={flickering}
        label={(() => { try { return localStorage.getItem('gtl-back-to-edit') === '1' ? 'RE-ETCH CYCLE' : 'ETCH CYCLE' } catch (_) { return 'ETCH CYCLE' } })()}
        size={days.length > 14 ? 92 : 128}
      />

      {/* ── DEADLINE STAMP OVERLAY ── */}
      {stampVisible && days.length > 0 && (() => {
        const lastDay  = days[days.length - 1]
        const date     = parseDate(lastDay)
        const dayName  = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][date.getDay()]
        const dayNum   = date.getDate()
        const month    = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'][date.getMonth()]
        const year     = date.getFullYear()

        return (
          <div className="fixed inset-0 z-[9997] flex items-center justify-center pointer-events-none"
               style={{ transform: days.length === 7 ? 'translate(0, 260px)' : 'translate(-40px, -250px)' }}>
            <style>{`
              @keyframes deadline-slam {
                0%   { transform: translateY(-320px) scale(9) rotate(-18deg); opacity: 0; filter: blur(24px); }
                6%   { opacity: 1; filter: blur(14px); }
                45%  { transform: translateY(30px) scale(2.2) rotate(-10deg); opacity: 1; filter: blur(5px); }
                65%  { transform: translateY(-20px) scale(0.78) rotate(-9deg); opacity: 1; filter: blur(0); }
                78%  { transform: translateY(8px) scale(1.14) rotate(-10deg); opacity: 1; }
                88%  { transform: translateY(-4px) scale(0.97) rotate(-10deg); opacity: 1; }
                100% { transform: translateY(0) scale(1) rotate(-10deg); opacity: 1; }
              }
              @keyframes deadline-ring {
                0%   { transform: translate(-50%,-50%) scale(0); opacity: 0; border-width: 14px; }
                4%   { opacity: 1; }
                70%  { opacity: 0.5; border-width: 4px; }
                100% { transform: translate(-50%,-50%) scale(10); opacity: 0; border-width: 1px; }
              }
              @keyframes deadline-flash {
                0%   { opacity: 0; }
                12%  { opacity: 0.85; }
                100% { opacity: 0; }
              }
            `}</style>

            {stampLanded && (
              <div className="absolute inset-0 bg-white"
                style={{ animation: 'deadline-flash 500ms cubic-bezier(0.3, 0, 0.5, 1) forwards', mixBlendMode: 'screen' }} />
            )}

            {stampLanded && [0, 90, 180].map((delay, i) => (
              <div key={i} className="absolute rounded-full border-gtl-red"
                style={{
                  left: '50%', top: '50%', width: '120px', height: '120px',
                  borderColor: i === 0 ? '#ffffff' : i === 1 ? '#ff2a36' : '#d4181f',
                  animation: `deadline-ring 900ms cubic-bezier(0.2, 0.8, 0.3, 1) ${delay}ms forwards`,
                  mixBlendMode: 'screen',
                }} />
            ))}

            <div style={{ transform: 'scale(0.6)' }}>
              <div style={{ animation: 'deadline-slam 950ms cubic-bezier(0.18, 1.2, 0.35, 1) forwards' }}>
                <div className="relative">
                <div className="absolute inset-0 bg-gtl-red-deep"
                  style={{ transform: 'translate(18px, 18px)', clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}
                  aria-hidden="true" />
                <div className="relative px-8 md:px-14 py-10 bg-gtl-red border-4 border-gtl-red-deep"
                  style={{ clipPath: 'polygon(3% 0%, 100% 0%, 97% 100%, 0% 100%)' }}>
                  <div className="font-mono text-[18px] font-bold tracking-[0.5em] uppercase text-gtl-paper mb-3"
                    style={{ letterSpacing: '0.5em', textShadow: '2px 2px 0 #070708' }}>◼ DEADLINE ◼</div>
                  <div className="font-display text-3xl md:text-5xl text-gtl-paper leading-none"
                    style={{ textShadow: '3px 3px 0 #070708' }}>{month}</div>
                  <div className="flex items-center gap-16">
                    <div className="font-display text-gtl-paper leading-none"
                      style={{ fontSize: 'clamp(6rem, 16vw, 13rem)', textShadow: '6px 6px 0 #070708, 12px 12px 0 rgba(0,0,0,0.4)', lineHeight: '0.85' }}>
                      {String(dayNum).padStart(2, '0')}
                    </div>
                    <img src="/logo.png" alt="Gritted Teeth" className="-rotate-12 opacity-90"
                      style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  </div>
                  <div className="font-display text-3xl text-gtl-paper/80 leading-none mt-3"
                    style={{ textShadow: '2px 2px 0 #070708' }}>{dayName} · {year}</div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )
      })()}

      <FireTransition
        active={fireActive}
        onComplete={() => { if (!skippedRef.current) router.push(fireDestRef.current) }}
      />
      <SpeedLines active={quickForgeRunning && !fireActive} />
    </main>
  )
}
