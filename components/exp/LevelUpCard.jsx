'use client'
/*
 * LevelUpCard — post-level-up results card (Jordan's spec 2026-07-21).
 *
 * Mounts after RankUpSlam's LEVEL UP finishes. A P5 results card in the
 * hard-edge language: angled dark panel, red header band with the new
 * level, gold EXP headline, mono stat rows, red ribbon chips for the
 * bonuses that fired. Data = summarizeDayForLevelCard for the day that
 * pushed the bar over. Tap anywhere dismisses.
 */
import { useEffect, useState } from 'react'
import { useSound } from '../../lib/useSound'

function fmt(n) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString()
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5" style={{ borderBottom: '1px solid #232327' }}>
      <span className="font-mono" style={{ fontSize: '0.58rem', letterSpacing: '0.26em', color: '#8a8a92' }}>{label}</span>
      <span className="font-display text-right" style={{ fontSize: '0.95rem', color: '#f4ede0', letterSpacing: '0.03em' }}>{value}</span>
    </div>
  )
}

export default function LevelUpCard({ level, summary, onDone }) {
  const { play } = useSound()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => { play('card-confirm') }, [play])

  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    play('menu-close')
    setTimeout(() => onDone && onDone(), 240)
  }

  const bonuses = [
    summary.heavy    > 0 && { label: 'HEAVY LIFT', n: summary.heavy },
    summary.overload > 0 && { label: 'OVERLOAD',   n: summary.overload },
    summary.fresh    > 0 && { label: 'NEW CYCLE',  n: summary.fresh },
    summary.power    > 0 && { label: 'POWER LIFT', n: summary.power },
  ].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
      style={{
        background: 'rgba(5,4,5,0.94)',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 220ms ease-out',
      }}
      onPointerDown={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="level up summary"
    >
      <style>{`
        @keyframes gtl-lvlcard-in {
          0%   { transform: rotate(-1.5deg) scale(1.6) translateY(20px); opacity: 0; }
          60%  { transform: rotate(-1.5deg) scale(0.97) translateY(0); opacity: 1; }
          100% { transform: rotate(-1.5deg) scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Kanji watermark */}
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: '-4%', left: '-10%',
        fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
        fontSize: '18rem', fontWeight: 900, lineHeight: 1,
        color: '#f4ede0', opacity: 0.04, transform: 'rotate(-6deg)',
        userSelect: 'none', pointerEvents: 'none',
      }}>昇</span>

      <div
        className="relative w-full"
        style={{
          maxWidth: 360,
          animation: 'gtl-lvlcard-in 280ms cubic-bezier(0.18, 1.1, 0.35, 1) both',
        }}
      >
        {/* Rank — just a giant letter overhanging the panel's top-right.
            S is gold; everything else red. No caption. */}
        {summary.rank && (
          <div className="font-display" style={{
            position: 'absolute', top: -42, right: -10, zIndex: 3,
            fontSize: '5.4rem', lineHeight: 1,
            transform: 'rotate(7deg)',
            color: summary.rank === 'S' ? '#e4b022' : '#d4181f',
            textShadow: summary.rank === 'S' ? '5px 5px 0 #1a1104' : '5px 5px 0 #2a0507',
            pointerEvents: 'none',
          }}>
            {summary.rank}
          </div>
        )}

        {/* Header band — overhangs the panel */}
        <div style={{
          position: 'relative', zIndex: 2,
          marginLeft: -10, marginRight: 18, marginBottom: -14,
          background: '#d4181f',
          clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          padding: '10px 18px',
          boxShadow: '5px 5px 0 #2a0507',
          transform: 'rotate(-1deg)',
        }}>
          <span className="font-display" style={{ fontSize: '1.7rem', color: '#f4ede0', letterSpacing: '0.06em', lineHeight: 1 }}>
            LEVEL {level} SEIZED
          </span>
        </div>

        {/* Panel */}
        <div style={{
          background: '#101013',
          border: '1px solid #2c2c31',
          clipPath: 'polygon(0% 0%, 100% 1.5%, 99% 100%, 1% 98.5%)',
          padding: '26px 22px 16px',
          boxShadow: '8px 8px 0 rgba(0,0,0,0.5)',
        }}>
          {/* EXP headline */}
          <div className="font-display" style={{
            fontSize: '2.6rem', lineHeight: 1, color: '#e4b022',
            textShadow: '3px 3px 0 #1a1104', transform: 'rotate(-0.5deg)',
            marginBottom: 14,
          }}>
            +{fmt(summary.totalXP)} <span style={{ fontSize: '0.45em' }}>EXP</span>
          </div>

          <StatRow label="SETS BRANDED" value={summary.setCount} />
          <StatRow label="EXERCISES" value={summary.exerciseCount} />
          {summary.topExercise && (
            <StatRow label="TOP SOURCE" value={`${summary.topExercise.name} · +${fmt(summary.topExercise.xp)}`} />
          )}
          {summary.biggestSet && (
            <StatRow label="HEAVIEST SINGLE SET" value={`+${fmt(summary.biggestSet.xp)}`} />
          )}
          {summary.stars > 0 && <StatRow label="STARS CLAIMED" value={`${summary.stars} ★`} />}
          {summary.consistencyXP > 0 && <StatRow label="CONSISTENCY CREDIT" value={`+${fmt(summary.consistencyXP)}`} />}
          {summary.leftOnTable > 0.5 && <StatRow label="LEFT ON THE TABLE" value={`−${fmt(summary.leftOnTable)}`} />}

          {/* Bonus ribbons */}
          {bonuses.length > 0 && (
            <div className="flex flex-wrap gap-2" style={{ marginTop: 14 }}>
              {bonuses.map(b => (
                <span key={b.label} style={{
                  background: '#d4181f', color: '#f4ede0',
                  clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                  padding: '3px 12px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.56rem', fontWeight: 700, letterSpacing: '0.22em',
                }}>
                  {b.label} ×{b.n}
                </span>
              ))}
            </div>
          )}

          <div className="text-center font-mono" style={{
            marginTop: 18, fontSize: '0.52rem', letterSpacing: '0.34em', color: '#5a5a62',
          }}>
            TAP TO CONTINUE
          </div>
        </div>
      </div>
    </div>
  )
}
