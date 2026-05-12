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

// Compact horizontal rolodex for the target-filter selection. Mirrors
// the vertical active-page rolodex (active/page.js:2810-2871) flipped
// onto the X axis: a single-row strip with a fixed "active line" at
// the container's horizontal center, --rolodex-t CSS var per entry
// driven by scroll position, snap-on-scroll-end. The entry that lands
// at center IS the active selection.
const ROLODEX_HEIGHT = 38
const ROLODEX_ENTRY_W = 108  // wide enough for the longest label ("HAMSTRINGS")
const ROLODEX_SNAP_MS = 80

function MuscleRolodex({ entries, selectedKey, onSelect }) {
  const containerRef = useRef(null)

  // Update --rolodex-t per entry + snap-to-nearest on scroll-end.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let snapTimer = null

    const update = () => {
      const rect = container.getBoundingClientRect()
      const activeX = rect.left + rect.width / 2
      const nodes = container.querySelectorAll('[data-rolodex-key]')
      nodes.forEach((node) => {
        const nrect = node.getBoundingClientRect()
        const center = nrect.left + nrect.width / 2
        const dist = Math.abs(center - activeX)
        const t = Math.max(0, Math.min(1, 1 - dist / ROLODEX_ENTRY_W))
        node.style.setProperty('--rolodex-t', String(t))
        if (t >= 0.9) node.setAttribute('data-rolodex-centered', '')
        else node.removeAttribute('data-rolodex-centered')
      })
    }

    const snap = () => {
      const rect = container.getBoundingClientRect()
      const activeX = rect.left + rect.width / 2
      const nodes = container.querySelectorAll('[data-rolodex-key]')
      let best = null
      let bestDist = Infinity
      nodes.forEach((node) => {
        const nrect = node.getBoundingClientRect()
        const center = nrect.left + nrect.width / 2
        const dist = Math.abs(center - activeX)
        if (dist < bestDist) { bestDist = dist; best = node }
      })
      if (!best) return
      const target = best.offsetLeft + best.offsetWidth / 2 - container.clientWidth / 2
      if (Math.abs(container.scrollLeft - target) >= 1) {
        container.scrollTo({ left: target, behavior: 'smooth' })
      }
      const key = best.getAttribute('data-rolodex-key')
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
  // scrollLeft assignment (no scrollBy) per iOS PWA WebKit reliability —
  // see memory feedback_ios_pwa_scrollby_unreliable.md.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !selectedKey) return
    const node = container.querySelector(`[data-rolodex-key="${selectedKey}"]`)
    if (!node) return
    const target = node.offsetLeft + node.offsetWidth / 2 - container.clientWidth / 2
    if (Math.abs(container.scrollLeft - target) > 1) {
      container.scrollLeft = target
    }
  }, [selectedKey])

  // Spacer width = (entry_width / 2) at minimum so the first/last entries
  // can scroll to center. Using a flex pseudo-spacer at each end.
  const spacerWidth = ROLODEX_ENTRY_W / 2 + 16

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: ROLODEX_HEIGHT,
        width: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        touchAction: 'pan-x',
        display: 'flex',
        alignItems: 'center',
        // Hide native scrollbar — drag is the affordance.
        scrollbarWidth: 'none',
        // Soft fade at left/right so off-center entries feel "out of frame".
        maskImage: 'linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
      }}
    >
      {/* Leading spacer — lets the first entry scroll to dead center. */}
      <div style={{ flex: '0 0 auto', width: spacerWidth }} />
      {entries.map((e) => (
        <div
          key={e.key}
          data-rolodex-key={e.key}
          onClick={() => onSelect(e.key)}
          style={{
            flex: '0 0 auto',
            width: ROLODEX_ENTRY_W,
            height: ROLODEX_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            opacity: 'calc(0.35 + 0.65 * var(--rolodex-t, 0))',
            transition: 'opacity 100ms linear',
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            letterSpacing: '0.12em',
            color: '#d8d2c2',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '0.95rem',
            lineHeight: 1,
          }}>
            {e.kanji}
          </span>
          <span style={{ textTransform: 'uppercase' }}>{e.label}</span>
        </div>
      ))}
      {/* Trailing spacer — same idea for the last entry. */}
      <div style={{ flex: '0 0 auto', width: spacerWidth }} />
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

  // Title chips sit BESIDE the rolodex, not inside it. Each title can be
  // tapped to select the group filter (widens search to every muscle in
  // its covers). The rolodex only carries muscle rows.
  const titleChips = useMemo(
    () => titles.map((t) => ({
      key: `group:${t.label}`,
      kanji: t.kanji,
      label: t.label,
      muscles: t.covers,
    })),
    [titles],
  )

  // Rolodex entries — muscles only. Ordered: title-covered muscles first
  // (in title order), then any remainder muscles outside the titles.
  const entries = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const t of titles) {
      for (const m of t.covers) {
        if (seen.has(m)) continue
        out.push({
          key: `muscle:${m}`,
          kanji: MUSCLE_KANJI[m] || '·',
          label: MUSCLE_LABEL[m] || m.toUpperCase(),
          kind: 'muscle',
          muscleId: m,
        })
        seen.add(m)
      }
    }
    for (const m of dayMuscles) {
      if (seen.has(m)) continue
      out.push({
        key: `muscle:${m}`,
        kanji: MUSCLE_KANJI[m] || '·',
        label: MUSCLE_LABEL[m] || m.toUpperCase(),
        kind: 'muscle',
        muscleId: m,
      })
      seen.add(m)
    }
    return out
  }, [titles, dayMuscles])

  // Active filter for the exercise list. Either a `group:<label>` chip
  // tap or a `muscle:<id>` rolodex centering sets this. Default on day
  // change: first title if any, else first muscle.
  const [selectedKey, setSelectedKey] = useState(null)
  useEffect(() => {
    if (titleChips.length === 0 && entries.length === 0) {
      setSelectedKey(null)
      return
    }
    const allKeys = [...titleChips.map((t) => t.key), ...entries.map((e) => e.key)]
    if (!allKeys.includes(selectedKey)) {
      setSelectedKey(titleChips[0]?.key || entries[0].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleChips, entries])

  // Derived filter the exercise query uses.
  const selectedFilter = useMemo(() => {
    if (!selectedKey) return null
    if (selectedKey.startsWith('group:')) {
      const t = titleChips.find((x) => x.key === selectedKey)
      if (!t) return null
      return { kind: 'group', label: t.label, kanji: t.kanji, muscles: t.muscles }
    }
    if (selectedKey.startsWith('muscle:')) {
      const m = selectedKey.slice('muscle:'.length)
      return { kind: 'muscle', id: m }
    }
    return null
  }, [selectedKey, titleChips])

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
        {/* Header — three columns:
            (1) Group title chip(s) — UPPER / LOWER / ARMS / FULL BODY,
                tappable; selecting one widens the exercise list to every
                muscle in its covers.
            (2) Compact muscle rolodex — vertical scroll-snap, ~3 rows
                visible; centering a row narrows the search to that muscle.
            (3) Close button.

            Title chips sit BESIDE the rolodex (not above), and titles are
            never rolodex rows themselves. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.2rem 0.75rem 0.4rem',
          borderBottom: '1px solid #2a2a30',
          gap: '1.75rem',
        }}>
          {/* Title chips column — empty when day has no group titles. */}
          {titleChips.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              gap: '0.25rem',
              flexShrink: 0,
              alignSelf: 'center',
            }}>
              {titleChips.map((t) => {
                const active = selectedKey === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedKey(t.key)}
                    style={{
                      background: 'transparent', border: 'none',
                      textAlign: 'left',
                      padding: '0.1rem 0',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-display, Anton, sans-serif)',
                      fontSize: '1rem',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: active ? '#ff2a36' : '#d4181f',
                      textShadow: active ? '0 0 8px rgba(255,42,54,0.55)' : 'none',
                      fontWeight: active ? 900 : 700,
                      opacity: active ? 1 : 0.7,
                      display: 'inline-flex', alignItems: 'baseline', gap: 6,
                    }}
                  >
                    <span style={{
                      fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
                      fontSize: '1.15rem',
                      lineHeight: 1,
                    }}>
                      {t.kanji}
                    </span>
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Rolodex column — flexes to fill remaining width. */}
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
