'use client'
/*
 * BodyStarChart — the WAR RECORD transmutation circle. Extracted verbatim
 * from app/fitness/stats/page.js (2026-07-18) so the DayStarRecap
 * cinematic can render the EXACT same image (Jordan's spec) and the two
 * can never drift. Any visual change here shows up in both places.
 *
 * Props: regionXP number[5], regionStars number[5], regionNewStars
 * number[5] — CORE/ARMS/LEGS/FRONT/BACK order (BODY_REGIONS).
 *
 * Badge wrappers carry data-region-badge={region.id} so callers can
 * measure the badges' on-screen positions through the 3D tilt (the
 * recap flies stars to those measured points). Non-visual addition.
 */
import { BODY_REGIONS } from '../../lib/exp/regions'
import RegionStarPips from './RegionStarPips'

const ZERO5 = [0, 0, 0, 0, 0]

// SVG canvas
export const VW = 340
export const VH = 310
const CX = 170
const CY = 148

const OUTER_MAX_R = 134  // max spike length at full XP — level 5 meets transmutation outer ring
const INNER_R     = 24   // fixed inner indent of the star
const BADGE_R     = 138  // radius for badge anchor dots (outside max star)

// 5 region angles clockwise from top (FRONT, ARMS, LEGS, CORE, BACK)
const STAR_TILT = 0  // tilt in radians — adjust to taste
const REGION_ANGLES = BODY_REGIONS.map((_, i) => -Math.PI / 2 + STAR_TILT + i * (2 * Math.PI / 5))
// 5 inner angles sit halfway between outer angles
const INNER_ANGLES = REGION_ANGLES.map(a => a + Math.PI / 5)

// XP thresholds for levels 1–6 per region. Values are in DISPLAY-scale
// EXP (the ÷100 scale from 9898c32) — see stats-page history. Region EXP
// only accrues from star-earning sets (sumDayRegionXP), so these are
// thresholds on starred work.
export const REGION_XP_LEVELS = [0, 900, 3000, 7500, 18000, 45000]

// Tier label per level (levels 1–6)
export const REGION_TIER_LABELS = ['VICTIM', 'SKINNY FAT', 'STACKED', 'YOLKED', 'DICED', 'SHREDDED']

export function getRegionLevel(xp) {
  let level = 0
  for (const threshold of REGION_XP_LEVELS) {
    if (xp >= threshold) level++
    else break
  }
  return level  // 0–6
}

function levelToR(level) {
  return INNER_R + (level / 6) * (OUTER_MAX_R - INNER_R)
}

// Radii for the 6 level rings
const LEVEL_RING_RADII = [1, 2, 3, 4, 5, 6].map(levelToR)

function buildStarPath(regionXP) {
  const pts = []
  for (let i = 0; i < 5; i++) {
    const level = getRegionLevel(regionXP[i])
    const r = levelToR(level)
    pts.push(`${CX + r * Math.cos(REGION_ANGLES[i])},${CY + r * Math.sin(REGION_ANGLES[i])}`)
    pts.push(`${CX + INNER_R * Math.cos(INNER_ANGLES[i])},${CY + INNER_R * Math.sin(INNER_ANGLES[i])}`)
  }
  return `M ${pts.join(' L ')} Z`
}

const GHOST_INNER_R = 54  // wider indent for ghost outline — fatter points than filled star

function buildGhostPath() {
  const pts = []
  for (let i = 0; i < 5; i++) {
    pts.push(`${CX + OUTER_MAX_R * Math.cos(REGION_ANGLES[i])},${CY + OUTER_MAX_R * Math.sin(REGION_ANGLES[i])}`)
    pts.push(`${CX + GHOST_INNER_R * Math.cos(INNER_ANGLES[i])},${CY + GHOST_INNER_R * Math.sin(INNER_ANGLES[i])}`)
  }
  return `M ${pts.join(' L ')} Z`
}

// Badge CSS positions — fixed outside the star regardless of XP
// Computed from BADGE_R + small extra margin
const BADGE_MARGIN = 28
// Extra outward push per badge to clear the transmutation circle at each angle
const BADGE_EXTRA = [30, -14, 30, 32, -14]
function badgeCSS(i) {
  const angle = REGION_ANGLES[i]
  const r = BADGE_R + BADGE_MARGIN + BADGE_EXTRA[i]
  const x = CX + r * Math.cos(angle)
  const y = CY + r * Math.sin(angle)
  // Anchor point alignment per quadrant
  let tx = '-50%', ty = '-50%'
  if (i === 0) { ty = '0%' }           // top: anchor at top-center
  else if (i === 1) { tx = '0%' }       // right: anchor at left
  else if (i === 2) { ty = '-100%' }    // bottom-right: anchor at bottom
  else if (i === 3) { ty = '-100%' }    // bottom-left: anchor at bottom
  else if (i === 4) { tx = '-100%' }    // left: anchor at right
  return {
    left: `${(x / VW) * 100}%`,
    top:  `${(y / VH) * 100}%`,
    transform: `translate(${tx}, ${ty}) rotateY(-20deg) rotateX(-30deg)`,
  }
}

function RegionBadge({ region, xp, isTop, starCount = 0, newStarCount = 0 }) {
  const level = getRegionLevel(xp)
  const tier = REGION_TIER_LABELS[level - 1] ?? 'VICTIM'
  return (
    <div className="text-center">
      <div
        className="inline-flex items-baseline gap-0.5 px-2 py-0.5"
        style={{ background: '#e4b022', clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)' }}
      >
        <span className="font-display text-base leading-none text-gtl-ink" style={{ fontStyle: 'italic' }}>
          {region.label}
        </span>
      </div>
      <div className="block mt-0">
        <span className="font-mono whitespace-nowrap" style={{ fontSize: '0.65rem', letterSpacing: '0.18em', marginLeft: '4px', color: '#c41e1e', fontWeight: 700, display: 'inline-block', transform: 'rotate(-10deg)', textShadow: '0 0 6px rgba(196,30,30,0.7)' }}>
          {tier}
        </span>
      </div>
      {starCount > 0 && (
        <div className="block">
          <RegionStarPips count={starCount} newCount={newStarCount} />
        </div>
      )}
    </div>
  )
}

// Transmutation circle overlay — rendered inside the tilted SVG, behind the star
function TransmutationCircle() {
  const RO1 = 128   // outer ring
  const RO2 = 120   // inner edge of text band
  const RT  = 124   // text path radius
  const RH  = 88    // hexagram vertex radius
  const RI  = 56    // inner concentric circle
  const RHB = 18    // central hub
  const RS  = 9     // symbol circle radius

  const hexA = Array.from({ length: 6 }, (_, i) => -Math.PI / 2 + i * (Math.PI / 3))
  const hexP = hexA.map(a => [CX + RH * Math.cos(a), CY + RH * Math.sin(a)])

  const tri1 = [hexP[0], hexP[2], hexP[4]].map(p => p.join(',')).join(' ')
  const tri2 = [hexP[1], hexP[3], hexP[5]].map(p => p.join(',')).join(' ')

  const syms = ['♂', '⊕', '♄', '♀', '☿', '♃']

  const RT2 = 108  // second text ring (just inside outer rings)
  const RT3 = 72   // third text ring (between hexagram and inner circle)

  const mkRing = (r) => `M ${CX - r},${CY} A ${r},${r} 0 1,1 ${CX + r},${CY} A ${r},${r} 0 1,1 ${CX - r},${CY}`

  return (
    <g stroke="#e4b022" fill="none" strokeWidth="0.8" opacity="0.45">
      <defs>
        <path id="txring1" d={mkRing(RT)} />
        <path id="txring2" d={mkRing(RT2)} />
        <path id="txring3" d={mkRing(RT3)} />
      </defs>

      {/* Double outer ring */}
      <circle cx={CX} cy={CY} r={RO1} />
      <circle cx={CX} cy={CY} r={RO2} />

      {/* Outer circular text */}
      <text fill="#e4b022" stroke="none" fontSize="5" fontFamily="Georgia, serif">
        <textPath href="#txring1" startOffset="5%">
          THERE SHALL APPEAR BEFORE YOU PERFECT WHITE AND MANY MORE • AND AFTER SHALL APPEAR THE RED BODY • FORGE THE BODY • PIERCE THE HEAVENS • GRITTED TEETH •
        </textPath>
      </text>

      {/* Second text ring — just inside the hexagram boundary */}
      <text fill="#e4b022" stroke="none" fontSize="4" fontFamily="Georgia, serif">
        <textPath href="#txring2" startOffset="33%">
          WASH THE BODY AND THE ELEMENTS ARE TURNED INTO FIRE BY CIRCULATING • TO YOURS DESIRE YOU NEED NOT BE IN DOUBT • FOR THE WORK OF THE PHILOSOPHER •
        </textPath>
      </text>

      {/* Third text ring — inner, between hexagram and hub */}
      <text fill="#e4b022" stroke="none" fontSize="3.5" fontFamily="Georgia, serif">
        <textPath href="#txring3" startOffset="62%">
          OF OUR PHILOSOPHIE WE HAVE FORMED • BUT OF THIS COURSE THE SUN • GRITTED TEETH LIFESTYLE • WAR RECORD • FORGE • PIERCE •
        </textPath>
      </text>

      {/* Hexagram — two overlapping triangles */}
      <polygon points={tri1} />
      <polygon points={tri2} />

      {/* Three diameters through center */}
      {[0, 1, 2].map(i => (
        <line key={i}
          x1={hexP[i][0]} y1={hexP[i][1]}
          x2={hexP[i + 3][0]} y2={hexP[i + 3][1]}
        />
      ))}

      {/* Inner concentric circle */}
      <circle cx={CX} cy={CY} r={RI} />

      {/* Central hub */}
      <circle cx={CX} cy={CY} r={RHB} />

      {/* Hub spokes to inner circle */}
      {hexA.map((a, i) => (
        <line key={i}
          x1={CX + RHB * Math.cos(a)} y1={CY + RHB * Math.sin(a)}
          x2={CX + RI  * Math.cos(a)} y2={CY + RI  * Math.sin(a)}
        />
      ))}

      {/* Symbol circles at hexagram vertices */}
      {hexP.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={RS} fill="#0a0a0a" stroke="#e4b022" />
          <text fill="#e4b022" stroke="none" textAnchor="middle" dominantBaseline="central"
            x={x} y={y} fontSize="7" fontFamily="serif">
            {syms[i]}
          </text>
        </g>
      ))}
    </g>
  )
}

export default function BodyStarChart({ regionXP, regionStars = ZERO5, regionNewStars = ZERO5 }) {
  const starPath  = buildStarPath(regionXP)
  const ghostPath = buildGhostPath()

  return (
    <div className="relative mx-auto" style={{ width: '100%', maxWidth: `${VW}px`, height: `${VH}px`, perspective: '500px', transform: 'translateX(14px)' }}>
    <div className="absolute inset-0" style={{ transform: 'rotateX(30deg) rotateY(20deg)', transformOrigin: 'center center', transformStyle: 'preserve-3d' }}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${VW} ${VH}`}
        aria-hidden="true"
      >
        {/* Transmutation circle — behind the star */}
        <TransmutationCircle />

        {/* Level rings */}
        <circle cx={CX} cy={CY} r={LEVEL_RING_RADII[2]} fill="none" stroke="#2e2e2e" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={LEVEL_RING_RADII[3]} fill="none" stroke="#2e2e2e" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={LEVEL_RING_RADII[5]} fill="none" stroke="#3a3a3a" strokeWidth="1.5" />

        {/* Ghost star — max potential, faint outline */}
        <path d={ghostPath} fill="none" stroke="#3a3a3a" strokeWidth="1" />

        {/* Filled XP star */}
        <path d={starPath} fill="rgba(228,176,34,0.18)" stroke="#e4b022" strokeWidth="1.5" />

        {/* Small center dot */}
        <circle cx={CX} cy={CY} r={4} fill="#e4b022" />
      </svg>

      {/* Badges */}
      {BODY_REGIONS.map((region, i) => (
        <div
          key={region.id}
          className="absolute"
          data-region-badge={region.id}
          style={{ ...badgeCSS(i), zIndex: 10 }}
        >
          <RegionBadge
            region={region}
            xp={regionXP[i]}
            isTop={i === 0}
            starCount={regionStars[i] || 0}
            newStarCount={regionNewStars[i] || 0}
          />
        </div>
      ))}
    </div>
    </div>
  )
}
