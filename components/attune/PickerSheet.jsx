'use client'
/**
 * PickerSheet — exercise picker bottom sheet.
 *
 * mode='attune'        → multi-day target SELECTION lives on the calendar
 *                        (lifted to the page). The picker just shows the
 *                        count and confirms one exercise across all
 *                        currently-selected days. No internal day chips.
 * mode='in-the-moment' → single-day mode (log-set screen, Worker C)
 * mode='replace'       → single-day mode (chip Replace action, Step 5)
 *
 * Picker is muscle-locked to the source day's first muscle.
 *
 * Search uses iOS PWA keyboard recipe: form with action='.' + method,
 * input with inputMode + enterKeyHint. (The global IOSPWAKeyboardFix
 * already handles the el.click() leg of the recipe.)
 *
 * Backdrop is bottom-anchored only — the calendar above the sheet stays
 * interactive so the user can tap days to add/remove targets while the
 * picker stays open.
 *
 * Multi-select: the user can pick multiple exercises in one open. On
 * Confirm the picker calls `onConfirm(exerciseId)` once per selected
 * exercise, in selection order. The parent fans each call across every
 * selected day, so N exercises × M days = N×M chips placed total.
 *
 * Props:
 *   sourceDayId      - the source (first) selected day; used for muscle lock
 *   selectedDayIds   - all currently-selected days (attune mode); the
 *                      sheet shows the count + applies confirm to all
 *   mode             - 'attune' | 'in-the-moment' | 'replace'
 *   cycle            - { id, days, dailyPlan } — needed for muscle lookup
 *   onConfirm        - (exerciseId) => void  (called once per selected exercise)
 *   onClose          - () => void
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { searchExercises } from '../../lib/exerciseLibrary'
import { MUSCLE_KANJI, MUSCLE_LABEL, muscleGroupLabel } from '../../lib/attuneGroups'

// Compact vertical rolodex for the target-filter selection. Mirrors the
// active-page rolodex (active/page.js:2810-2871): scrollable list with
// a fixed "active line" in the middle of the container, --rolodex-t CSS
// var per row driven by scroll position, snap-on-scroll-end. The
// centered row IS the active selection — parent reads `selectedKey`.
const ROLODEX_ROW_H = 30
const ROLODEX_VISIBLE_ROWS = 3
const ROLODEX_HEIGHT = ROLODEX_ROW_H * ROLODEX_VISIBLE_ROWS
const ROLODEX_ACTIVE_Y = ROLODEX_ROW_H * Math.floor(ROLODEX_VISIBLE_ROWS / 2)
const ROLODEX_PHANTOM = ROLODEX_ACTIVE_Y  // matches active-line offset
const ROLODEX_SNAP_MS = 80

function MuscleRolodex({ entries, selectedKey, onSelect }) {
  const containerRef = useRef(null)

  // Update --rolodex-t per row + snap-to-nearest on scroll-end.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let snapTimer = null

    const update = () => {
      const rows = container.querySelectorAll('[data-rolodex-key]')
      rows.forEach((row) => {
        const dist = Math.abs(row.offsetTop - container.scrollTop - ROLODEX_ACTIVE_Y)
        const t = Math.max(0, Math.min(1, 1 - dist / ROLODEX_ROW_H))
        row.style.setProperty('--rolodex-t', String(t))
        if (t >= 0.9) row.setAttribute('data-rolodex-centered', '')
        else row.removeAttribute('data-rolodex-centered')
      })
    }

    const snap = () => {
      const rows = container.querySelectorAll('[data-rolodex-key]')
      let bestRow = null
      let bestDist = Infinity
      rows.forEach((row) => {
        const dist = Math.abs(row.offsetTop - container.scrollTop - ROLODEX_ACTIVE_Y)
        if (dist < bestDist) { bestDist = dist; bestRow = row }
      })
      if (!bestRow) return
      const target = bestRow.offsetTop - ROLODEX_ACTIVE_Y
      if (Math.abs(container.scrollTop - target) >= 1) {
        container.scrollTo({ top: target, behavior: 'smooth' })
      }
      const key = bestRow.getAttribute('data-rolodex-key')
      if (key && key !== selectedKey) onSelect(key)
    }

    const onScroll = () => {
      update()
      if (snapTimer) clearTimeout(snapTimer)
      snapTimer = setTimeout(snap, ROLODEX_SNAP_MS)
    }
    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (snapTimer) clearTimeout(snapTimer)
    }
  }, [entries, selectedKey, onSelect])

  // Center the externally-selected entry on selectedKey change. Direct
  // scrollTop assignment (no scrollBy) per iOS PWA WebKit reliability —
  // see memory feedback_ios_pwa_scrollby_unreliable.md.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !selectedKey) return
    const node = container.querySelector(`[data-rolodex-key="${selectedKey}"]`)
    if (!node) return
    const target = node.offsetTop - ROLODEX_ACTIVE_Y
    if (Math.abs(container.scrollTop - target) > 1) {
      container.scrollTop = target
    }
  }, [selectedKey])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: ROLODEX_HEIGHT,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
        paddingTop: ROLODEX_PHANTOM,
        paddingBottom: ROLODEX_PHANTOM,
        // Soft fade at top/bottom so off-center rows feel "out of frame"
        // instead of cropped at a hard edge.
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
      }}
    >
      {entries.map((e) => (
        <div
          key={e.key}
          data-rolodex-key={e.key}
          onClick={() => onSelect(e.key)}
          style={{
            height: ROLODEX_ROW_H,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            opacity: 'calc(0.35 + 0.65 * var(--rolodex-t, 0))',
            transition: 'opacity 100ms linear',
            paddingLeft: e.indent ? '1rem' : 0,
            ...(e.kind === 'group' ? {
              fontFamily: 'var(--font-display, Anton, sans-serif)',
              fontSize: '1rem',
              letterSpacing: '0.18em',
              color: '#d4181f',
              fontWeight: 700,
            } : {
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.12em',
              color: '#d8d2c2',
              fontWeight: 700,
            }),
          }}
        >
          <span style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: e.kind === 'group' ? '1.2rem' : '0.95rem',
            lineHeight: 1,
          }}>
            {e.kanji}
          </span>
          <span style={{ textTransform: 'uppercase' }}>{e.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function PickerSheet({
  sourceDayId,
  selectedDayIds,
  mode = 'attune',
  cycle,
  onConfirm,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [selectedExerciseIds, setSelectedExerciseIds] = useState([])
  const toggleExercise = (id) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  const inputRef = useRef(null)

  // Drag-resize: user can grab the top border (16px hit area, grey pill
  // affordance) to make the sheet taller or shorter. userHeight overrides
  // the CSS-class max-height when set; resets on sourceDayId change so each
  // re-open starts at the default size.
  const [userHeight, setUserHeight] = useState(null)
  const dragStartRef = useRef(null)
  useEffect(() => { setUserHeight(null) }, [sourceDayId])

  const onGrabberPointerDown = (e) => {
    e.preventDefault()
    const sheet = e.currentTarget.parentElement
    if (!sheet) return
    const startY = e.clientY
    const startH = sheet.getBoundingClientRect().height
    dragStartRef.current = { startY, startH }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
  }
  const onGrabberPointerMove = (e) => {
    if (!dragStartRef.current) return
    const dy = e.clientY - dragStartRef.current.startY
    const next = Math.max(180, Math.min(window.innerHeight * 0.92, dragStartRef.current.startH - dy))
    setUserHeight(next)
  }
  const onGrabberPointerUp = (e) => {
    dragStartRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (_) {}
  }

  // Full muscle list for the source day (was single-muscle before — bug).
  const dayMuscles = useMemo(() => {
    if (!cycle || !sourceDayId) return []
    return cycle?.dailyPlan?.[sourceDayId] || []
  }, [cycle, sourceDayId])

  // Group titles (UPPER / LOWER / ARMS / FULL BODY) computed from the day's
  // muscle list. Each title carries its `covers` — the subset of dayMuscles
  // it absorbs.
  const { titles } = useMemo(() => muscleGroupLabel(dayMuscles), [dayMuscles])

  // Flat rolodex entries: per title, push the title row first, then its
  // covered muscle rows (indented). Day-only muscles outside any title
  // append at the bottom, no indent. Each entry has a stable key so the
  // rolodex's centered-row tracker can resolve back to a filter.
  const entries = useMemo(() => {
    const out = []
    const covered = new Set()
    for (const t of titles) {
      out.push({
        key: `group:${t.label}`,
        kanji: t.kanji,
        label: t.label,
        kind: 'group',
        muscles: t.covers,
      })
      for (const m of t.covers) {
        out.push({
          key: `muscle:${m}`,
          kanji: MUSCLE_KANJI[m] || '·',
          label: MUSCLE_LABEL[m] || m.toUpperCase(),
          kind: 'muscle',
          indent: true,
          muscleId: m,
        })
        covered.add(m)
      }
    }
    for (const m of dayMuscles) {
      if (covered.has(m)) continue
      out.push({
        key: `muscle:${m}`,
        kanji: MUSCLE_KANJI[m] || '·',
        label: MUSCLE_LABEL[m] || m.toUpperCase(),
        kind: 'muscle',
        indent: false,
        muscleId: m,
      })
    }
    return out
  }, [titles, dayMuscles])

  // Which rolodex row is currently centered (= active filter).
  const [selectedKey, setSelectedKey] = useState(null)
  useEffect(() => {
    // Reset when the day's entries change (e.g., sourceDayId switch).
    if (entries.length === 0) { setSelectedKey(null); return }
    if (!entries.find((e) => e.key === selectedKey)) {
      setSelectedKey(entries[0].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  const selectedEntry = useMemo(
    () => entries.find((e) => e.key === selectedKey) || null,
    [entries, selectedKey],
  )

  // Derived filter the exercise query uses.
  const selectedFilter = useMemo(() => {
    if (!selectedEntry) return null
    if (selectedEntry.kind === 'group') {
      return { kind: 'group', label: selectedEntry.label, kanji: selectedEntry.kanji, muscles: selectedEntry.muscles }
    }
    return { kind: 'muscle', id: selectedEntry.muscleId }
  }, [selectedEntry])

  const exercises = useMemo(() => {
    if (!selectedFilter) return []
    if (selectedFilter.kind === 'muscle') {
      return searchExercises(selectedFilter.id, query)
    }
    // Group: union searchExercises across each muscle; dedup by id.
    const seen = new Set()
    const out = []
    for (const m of selectedFilter.muscles) {
      for (const ex of searchExercises(m, query)) {
        if (!seen.has(ex.id)) {
          seen.add(ex.id)
          out.push(ex)
        }
      }
    }
    return out
  }, [selectedFilter, query])

  // sr-only input scrollIntoView fallback (per memory:
  // feedback_ios_pwa_sr_only_input_scroll). Not strictly needed since
  // the input is on-screen, but harmless and keeps the recipe complete.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const handler = () => {
      try { el.scrollIntoView({ block: 'end' }) } catch (_) {}
    }
    el.addEventListener('focus', handler)
    return () => el.removeEventListener('focus', handler)
  }, [])

  const targetCount = mode === 'attune'
    ? (selectedDayIds?.length || (sourceDayId ? 1 : 0))
    : (sourceDayId ? 1 : 0)
  const exerciseCount = selectedExerciseIds.length
  const canConfirm = exerciseCount > 0 && targetCount > 0

  const commit = () => {
    if (!canConfirm) return
    if (onConfirm) {
      // Place every selected exercise. Parent's onConfirm fans across
      // every selected day, so N exercises × M days = N×M chips total.
      for (const id of selectedExerciseIds) onConfirm(id)
    }
    setSelectedExerciseIds([])
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Pick exercise"
      style={{
        // Bottom-anchored sheet ONLY — no full-bleed backdrop. Calendar
        // above stays tappable so the user can add/remove target days
        // while the picker is open.
        position: 'fixed', left: 0, right: 0, bottom: 0,
        zIndex: 100,
        display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <style>{`
        .gtl-picker-sheet {
          width: 100%;
          max-width: 430px;
          max-height: 70vh;
        }
        @media (orientation: landscape) and (max-height: 500px) {
          .gtl-picker-sheet {
            max-width: 100%;
            max-height: 60vh;
          }
        }
      `}</style>
      <div
        className="gtl-picker-sheet"
        style={{
          pointerEvents: 'auto',
          position: 'relative',
          background: '#1a1a1e',
          borderTop: '2px solid #d4181f',
          padding: '1.5rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.6)',
          height: userHeight ? `${userHeight}px` : undefined,
          maxHeight: userHeight ? `${userHeight}px` : undefined,
        }}
      >
        {/* Drag-resize grabber — 16px hit area at top edge, grey pill affordance. */}
        <div
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={onGrabberPointerUp}
          onPointerCancel={onGrabberPointerUp}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 16,
            cursor: 'ns-resize',
            touchAction: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 5,
          }}
          aria-label="resize picker"
          role="separator"
        >
          <span style={{
            width: 36, height: 4,
            background: '#3a3a40',
            borderRadius: 2,
          }} />
        </div>
        {/* Header: compact target-filter rolodex + close button. Vertical
            scroll-snap rolodex shows ~3 rows; the centered row IS the
            active filter. Mirrors the active-page rolodex pattern. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.2rem 0.75rem 0.4rem',
          borderBottom: '1px solid #2a2a30',
          gap: '0.75rem',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MuscleRolodex
              entries={entries}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>
          <button
            type="button"
            aria-label="close"
            onClick={() => onClose && onClose()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a8a39a',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '0 0.4rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              alignSelf: 'flex-start',
            }}
          >
            ×
          </button>
        </div>

        {/* Search input — iOS PWA keyboard recipe */}
        <form
          action="."
          method="get"
          onSubmit={(e) => e.preventDefault()}
          style={{ margin: 0 }}
        >
          <input
            ref={inputRef}
            type="search"
            name="gtl-attune-picker-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selectedFilter
              ? `search ${(selectedFilter.kind === 'group' ? selectedFilter.label : selectedFilter.id).toLowerCase()} exercises…`
              : 'search exercises…'}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={{
              width: '100%',
              background: '#0f0f12',
              border: '1px solid #2a2a30',
              borderLeft: '2px solid #d4181f',
              padding: '0.55rem 0.7rem',
              color: '#f1eee5',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              letterSpacing: '0.05em',
              outline: 'none',
            }}
          />
        </form>

        {/* Exercise list — capped at ~5 rows tall; rest reachable via scroll. */}
        <div
          style={{
            flex: '0 0 auto',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 4,
            minHeight: 80,
            maxHeight: 132,
          }}
        >
          {!selectedFilter && (
            <div style={{ color: '#888', fontSize: '0.75rem', padding: '0.5rem' }}>
              No muscle assigned to this day. Assign one on the schedule first.
            </div>
          )}
          {selectedFilter && exercises.length === 0 && (
            <div style={{ color: '#888', fontSize: '0.75rem', padding: '0.5rem' }}>
              No matches.
            </div>
          )}
          {exercises.map((ex) => {
            const selected = selectedExerciseIds.includes(ex.id)
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => toggleExercise(ex.id)}
                style={{
                  textAlign: 'left',
                  background: selected ? '#d4181f' : '#0f0f12',
                  color: selected ? '#fff' : '#d8d2c2',
                  border: `1px solid ${selected ? '#ff2a36' : '#2a2a30'}`,
                  borderLeft: `2px solid ${selected ? '#fff' : '#d4181f'}`,
                  padding: '0.55rem 0.7rem',
                  fontFamily: 'inherit',
                  fontSize: '0.78rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Confirm */}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={commit}
          style={{
            background: canConfirm ? '#d4181f' : '#2a2a30',
            color: canConfirm ? '#fff' : '#666',
            border: `1px solid ${canConfirm ? '#ff2a36' : '#2a2a30'}`,
            padding: '0.7rem 1rem',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: canConfirm ? 'pointer' : 'default',
            clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)',
          }}
        >
          {canConfirm
            ? `Confirm (${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} × ${targetCount} day${targetCount === 1 ? '' : 's'})`
            : exerciseCount === 0
              ? 'Pick exercises'
              : 'Pick days'}
        </button>
      </div>
    </div>
  )
}
