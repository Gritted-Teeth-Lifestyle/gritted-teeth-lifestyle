'use client'
/*
 * RegionStarPips — R19 pip cluster rendered below each region badge in
 * the transmutation-circle BodyStarChart. The parent (stats page) reads
 * `pk('region-stars')` and `pk('region-stars-last-seen')` once on mount
 * and threads (count, newCount) down per region; this component just
 * renders the visual.
 *
 * For high counts (> 5) renders the compact `★ × N` form.
 * `newCount` are stars earned since the last stats-page mount; they
 * sparkle-in mirroring GateScreen's `gtl-gate-tooth-sparkle` vocabulary.
 */

const COMPACT_THRESHOLD = 5

function Pip({ isNew, delay }) {
  return (
    <span
      style={{
        display: 'inline-block',
        color: '#e4b022',
        textShadow: '0 0 6px rgba(228,176,34,0.8)',
        animation: isNew
          ? `gtl-region-pip-pop 600ms cubic-bezier(0.2, 0.9, 0.3, 1.2) ${delay}ms both`
          : 'none',
        opacity: isNew ? 0 : 1,
      }}
    >
      ★
    </span>
  )
}

export default function RegionStarPips({ count = 0, newCount = 0 }) {
  if (!count) return null
  const compact = count > COMPACT_THRESHOLD
  const safeNew = Math.min(Math.max(0, newCount), count)
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        fontFamily: '"FOT-Matisse Pro EB", "JetBrains Mono", monospace',
        fontSize: '0.7rem',
        fontWeight: 900,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        marginTop: '2px',
      }}
    >
      <style>{`
        @keyframes gtl-region-pip-pop {
          0%   { transform: scale(0);    opacity: 0; }
          55%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
      {compact ? (
        <span style={{ color: '#e4b022', textShadow: '0 0 6px rgba(228,176,34,0.8)' }}>
          <Pip isNew={safeNew > 0} delay={0} />
          <span style={{ marginLeft: '0.25em' }}>× {count}</span>
        </span>
      ) : (
        Array.from({ length: count }).map((_, j) => {
          const isNew = j >= count - safeNew
          const delay = isNew ? (j - (count - safeNew)) * 80 : 0
          return <Pip key={j} isNew={isNew} delay={delay} />
        })
      )}
    </span>
  )
}
