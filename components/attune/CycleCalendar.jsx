'use client'
import { useRef, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import DayCell from './DayCell'
import { useChipsForDay, isDayLocked, useIsChipDragging } from '../../lib/attunement'

const DOW_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function isoToLocalDate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function localTodayIso() {
  const d = new Date()
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

/**
 * Bucket carved days by weekday (0=Sun .. 6=Sat). Each bucket is sorted
 * chronologically. Skipped weeks within a column collapse — no placeholders.
 */
function bucketByWeekday(cycle) {
  const buckets = [[], [], [], [], [], [], []]
  if (!cycle || !Array.isArray(cycle.days)) return buckets
  for (const iso of cycle.days) {
    const d = isoToLocalDate(iso)
    if (!d) continue
    buckets[d.getDay()].push({ iso, dayNum: d.getDate(), date: d })
  }
  for (const b of buckets) b.sort((a, c) => a.date - c.date)
  return buckets
}

export default function CycleCalendar({ cycle, onDayTap, onChipReplace, selectedDayIds = [], sourceDayId = null }) {
  const isChipDragging = useIsChipDragging()
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(1)

  if (!cycle || !Array.isArray(cycle.days) || cycle.days.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#666', fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem',
      }}>
        no carved days · attune nothing
      </div>
    )
  }

  const buckets = bucketByWeekday(cycle)
  const todayIso = localTodayIso()

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Pan-zoom surface. DOW labels live inside each column (added below) so
          they scale with the content rather than living as a fixed UI band.
          Page lands at scale 1 with SUN/MON at the left edge — user pans
          right to reach the rest, or pinches out (down to 0.4) to see all 7. */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <TransformWrapper
          ref={wrapperRef}
          initialScale={1}
          initialPositionX={0}
          initialPositionY={0}
          minScale={0.4}
          maxScale={3}
          centerOnInit={false}
          centerZoomedOut={false}
          limitToBounds={false}
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
          panning={{ disabled: isChipDragging, velocityDisabled: false, lockAxisX: false, lockAxisY: false }}
          onTransformed={(_, state) => setScale(state.scale)}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ padding: '0.5rem 0.5rem 9rem 0.5rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 160px)',
                gap: 6,
                alignItems: 'start',
              }}
            >
              {buckets.map((bucket, dow) => (
                <div
                  key={dow}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    minHeight: 60,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.22em',
                      color: '#a8a39a',
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      padding: '0.25rem 0',
                      borderBottom: '1px solid #2a2a30',
                    }}
                  >
                    {DOW_HEADERS[dow]}
                  </div>
                  {bucket.map(({ iso, dayNum }) => (
                    <CarvedBlock
                      key={iso}
                      cycleId={cycle.id}
                      dayId={iso}
                      dayNum={dayNum}
                      muscles={cycle.dailyPlan?.[iso] || []}
                      onTap={onDayTap}
                      onChipReplace={onChipReplace}
                      isSelected={selectedDayIds.includes(iso)}
                      isSource={iso === sourceDayId}
                      isToday={iso === todayIso}
                    />
                  ))}
                </div>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <div style={{
        position: 'absolute', top: 8, right: 12, zIndex: 10,
        fontFamily: 'var(--font-mono, ui-monospace, "Courier New", monospace)',
        fontSize: '0.55rem', letterSpacing: '0.18em', color: '#5a5a5e',
        textTransform: 'uppercase', pointerEvents: 'none',
      }}>
        {scale.toFixed(2)}×
      </div>
    </div>
  )
}

function CarvedBlock({ cycleId, dayId, dayNum, muscles, onTap, onChipReplace, isSelected, isSource, isToday }) {
  const chips = useChipsForDay(cycleId, dayId)
  const locked = isDayLocked(cycleId, dayId)
  const isRest = !muscles || muscles.length === 0
  return (
    <DayCell
      cycleId={cycleId}
      dayId={dayId}
      dayNum={dayNum}
      muscles={muscles}
      chips={chips}
      isLocked={locked}
      isRestDay={isRest}
      isSelected={isSelected}
      isSource={isSource}
      isToday={isToday}
      onTap={onTap}
      onChipReplace={onChipReplace}
    />
  )
}
