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
import { searchExercises, getExerciseById } from '../../lib/exerciseLibrary'
import { MUSCLE_KANJI, MUSCLE_LABEL, muscleGroupLabel } from '../../lib/attuneGroups'
import { byNotoriety } from '../../lib/exerciseNotoriety'
import { prettyExerciseLabel } from '../../lib/exerciseLabel'
import { getCustomExercisesForMuscles, addCustomExercise } from '../../lib/customExercises'

// Compact horizontal rolodex for the target-filter selection. Mirrors
// the vertical active-page rolodex (active/page.js:2810-2871) flipped
// onto the X axis: a single-row strip with a fixed "active line" at
// the container's horizontal center, --rolodex-t CSS var per entry
// driven by scroll position, snap-on-scroll-end. The entry that lands
// at center IS the active selection.
const ROLODEX_HEIGHT = 38
const ROLODEX_ENTRY_W = 72   // long labels (HAMSTRINGS, SHOULDERS) ellipsis-clip
const ROLODEX_SNAP_MS = 80

function MuscleRolodex({ entries, selectedKey, onSelect }) {
  const containerRef = useRef(null)

  // Update --rolodex-t per entry + snap-to-nearest on scroll-end.
  // The rolodex behaviors (fade, mask, snap) are always on — even in
  // landscape where the row could fit without scrolling, the spacers
  // intentionally force overflow so the user can swipe entries to
  // center for that "rolodex selector" feel.
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
        // Falloff unit = the entry's own width so the fade scales
        // naturally for both fixed-width entries (portrait) and
        // natural-width entries (landscape).
        const unit = nrect.width || ROLODEX_ENTRY_W
        const t = Math.max(0, Math.min(1, 1 - dist / unit))
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
    // Re-run t-fade on container/resize (orientation flip, sheet drag).
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (snapTimer) clearTimeout(snapTimer)
      ro.disconnect()
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

  return (
    <div
      ref={containerRef}
      className="gtl-picker-rolodex"
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
        // Half-container leading + trailing padding ensures the first
        // AND last entries can each scroll to dead center. Approximated
        // with calc(50% - half-entry-width) so the math works without
        // measuring at runtime; the small offset for variable-width
        // entries is unnoticeable.
        paddingInline: `calc(50% - ${ROLODEX_ENTRY_W / 2}px)`,
        scrollSnapType: 'x mandatory',
        // Hide native scrollbar — drag is the affordance.
        scrollbarWidth: 'none',
        // Soft fade at left/right is always on so the rolodex reads as
        // a rolodex selector even in landscape (where content might
        // otherwise sit naturally without scrolling).
        maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      {entries.map((e) => {
        const isSelected = e.key === selectedKey
        return (
        <div
          key={e.key}
          data-rolodex-key={e.key}
          onClick={() => onSelect(e.key)}
          style={{
            flex: '0 0 auto',
            // Natural width with internal horizontal padding so long
            // labels (HAMSTRINGS, SHOULDERS) read in full. The t-fade
            // math (see update() above) uses the entry's measured
            // width as the falloff unit so varying widths still work.
            paddingInline: '0.7rem',
            height: ROLODEX_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
            opacity: 'calc(0.35 + 0.65 * var(--rolodex-t, 0))',
            transition: 'opacity 100ms linear, color 120ms linear, text-shadow 120ms linear',
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            letterSpacing: '0.12em',
            color: isSelected ? '#ff2a36' : '#d8d2c2',
            textShadow: isSelected ? '0 0 8px rgba(255,42,54,0.55)' : 'none',
            fontWeight: isSelected ? 900 : 700,
            whiteSpace: 'nowrap',
            scrollSnapAlign: 'center',
            scrollSnapStop: 'always',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <span style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '0.95rem',
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {e.kanji}
          </span>
          <span style={{
            textTransform: 'uppercase',
            // Entries take natural width so labels never need to clip;
            // HAMSTRINGS / SHOULDERS render in full.
            whiteSpace: 'nowrap',
          }}>
            {e.label}
          </span>
        </div>
        )
      })}
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
  // Custom exercise entry — typed name gets added to selectedExerciseIds
  // on submit (like tapping a list card). Committed via the Confirm
  // button in the header's right column. Cleared on day switch.
  const [customName, setCustomName] = useState('')
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
  useEffect(() => { setUserHeight(null); setCustomName('') }, [sourceDayId])

  const onGrabberPointerDown = (e) => {
    e.preventDefault()
    // Walk up to the sheet — the grabber lives inside the main-column
    // wrapper, so parentElement points there instead of the sheet.
    const sheet = e.currentTarget.closest('.gtl-picker-sheet')
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
    // Each exercise belongs to its PRIMARY muscle(s) only. Bench press's
    // muscles[] array also lists shoulders + triceps as secondaries, but
    // its primaryMuscles is [chest] — so it should only appear in the
    // chest filter, not shoulders or triceps. Likewise squat's
    // primaryMuscles is [quads]; it shouldn't surface under glutes or
    // hamstrings even though those engage on the descent.
    let out
    if (selectedFilter.kind === 'muscle') {
      out = searchExercises(selectedFilter.id, query).filter(
        (ex) => (ex.primaryMuscles || []).includes(selectedFilter.id),
      )
    } else {
      // Group: an exercise appears if any of its primaries lands in the
      // group's muscle set. Dedup by id across the per-muscle searches.
      const groupSet = new Set(selectedFilter.muscles)
      const seen = new Set()
      out = []
      for (const m of selectedFilter.muscles) {
        for (const ex of searchExercises(m, query)) {
          if (seen.has(ex.id)) continue
          const primaries = ex.primaryMuscles || []
          if (!primaries.some((p) => groupSet.has(p))) continue
          seen.add(ex.id)
          out.push(ex)
        }
      }
    }
    // Sort library entries by notoriety so iconic lifts (BENCH PRESS,
    // SQUAT, DEADLIFT, etc.) surface at the top of each muscle / group
    // result set. Alphabetical tiebreak.
    out.sort(byNotoriety)

    // Custom exercises the user previously typed for this filter's
    // muscle(s) — surface them ABOVE the library list so they're easy
    // to re-pick. Synthesized as fake exercise entries with isCustom
    // tag so the row render can flag them visually.
    const muscleScope = selectedFilter.kind === 'group'
      ? selectedFilter.muscles
      : [selectedFilter.id]
    const customNames = getCustomExercisesForMuscles(muscleScope)
    const q = (query || '').trim().toLowerCase()
    const customMatching = customNames
      .filter((n) => !q || n.toLowerCase().includes(q))
      .map((n) => ({ id: n, label: n, isCustom: true }))

    return [...customMatching, ...out]
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
  // Pending custom-exercise text counts toward exerciseCount so ATTUNE
  // lights up even before the user taps + (commit() auto-flushes it).
  const hasPendingCustom = customName.trim().length > 0
  const exerciseCount = selectedExerciseIds.length + (hasPendingCustom ? 1 : 0)
  const canConfirm = exerciseCount > 0 && targetCount > 0

  const commit = () => {
    // Auto-flush any value still sitting in the custom-exercise input.
    // If the user typed a name but tapped ATTUNE without first tapping
    // the + submit, include the typed value as if + had been pressed.
    const pendingCustom = customName.trim().toUpperCase()
    const ids = [...selectedExerciseIds]
    if (pendingCustom && !ids.includes(pendingCustom)) {
      ids.push(pendingCustom)
    }
    if (ids.length === 0) return
    // Persist every custom (library-unknown) id to the custom store so
    // it surfaces at the top of the picker next time the user opens
    // for the same muscle. Scoped to the active filter's muscle(s).
    const muscleScope = selectedFilter
      ? (selectedFilter.kind === 'group' ? selectedFilter.muscles : [selectedFilter.id])
      : []
    for (const id of ids) {
      if (!getExerciseById(id)) addCustomExercise(id, muscleScope)
    }
    if (onConfirm) {
      for (const id of ids) onConfirm(id)
    }
    setSelectedExerciseIds([])
    setCustomName('')
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
        // Must sit above ExercisePanel (z 9995) when the picker is
        // opened from the set-log page's ADD MOVE button. Sits below
        // RepsPopup / WeightPopup (z 9999) which can stack on top.
        zIndex: 9998,
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
        .gtl-picker-header {
          gap: 1.75rem;
        }
        /* Hide WebKit's native scrollbar on the rolodex — drag/swipe is
           the only affordance. scrollbarWidth:'none' (Firefox/Chromium)
           is set inline; ::-webkit-scrollbar covers iOS/desktop Safari. */
        .gtl-picker-rolodex::-webkit-scrollbar { display: none; }
        @media (orientation: landscape) and (max-height: 500px) {
          .gtl-picker-sheet {
            max-width: 100%;
            max-height: 60vh;
          }
          /* Tighten the title-chip → rolodex spacing in landscape.
             The rolodex no longer overflows on a wide viewport, so the
             1.75rem portrait gap reads as a chasm; collapse it. */
          .gtl-picker-header {
            gap: 0.5rem;
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
          padding: '1.5rem 0 calc(env(safe-area-inset-bottom, 0px)) 0',
          fontFamily: 'var(--font-display, Anton, sans-serif)',
          color: '#f1eee5',
          // Sheet stacks: header (full-width) → body (two-column).
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
        <div
          className="gtl-picker-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.2rem 0.75rem 0.4rem',
            borderBottom: '1px solid #2a2a30',
          }}
        >
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
                      color: active ? '#ff2a36' : '#d8d2c2',
                      textShadow: active ? '0 0 8px rgba(255,42,54,0.55)' : 'none',
                      fontWeight: active ? 900 : 700,
                      opacity: active ? 1 : 0.85,
                      display: 'inline-flex', alignItems: 'baseline', gap: 6,
                      transition: 'color 120ms linear, text-shadow 120ms linear',
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

        {/* Body — header sits above (full-width); below it the body
            splits into the main column on the left and the ATTUNE
            column on the right. The ATTUNE column anchors to the
            search row's top and reaches the sheet's bottom edge,
            skipping the header area above. */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          minHeight: 0,
          gap: 0,
        }}>
          <div style={{
            flex: 1,
            minWidth: 0,
            padding: '0 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}>

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
                  {prettyExerciseLabel(ex.label)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Custom exercise input — sits where Confirm used to live.
            Submitting (Enter / + button) adds the typed name to
            selectedExerciseIds as if the user had tapped a card in
            the list. Use to add an exercise the library doesn't
            carry; the user's choice persists by name like the
            built-in entries. Confirm still commits everything via
            the button in the header's right column. */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = customName.trim().toUpperCase()
            if (!name) return
            if (!selectedExerciseIds.includes(name)) {
              setSelectedExerciseIds((prev) => [...prev, name])
            }
            // Persist to the custom store so the name surfaces at the
            // top of the picker next time, regardless of whether the
            // user actually goes on to tap ATTUNE.
            if (!getExerciseById(name)) {
              const muscleScope = selectedFilter
                ? (selectedFilter.kind === 'group' ? selectedFilter.muscles : [selectedFilter.id])
                : []
              addCustomExercise(name, muscleScope)
            }
            setCustomName('')
          }}
          style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}
          action="."
          method="get"
        >
          <input
            type="search"
            name="gtl-attune-custom-exercise"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="add custom exercise…"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              background: '#0f0f12',
              border: '1px solid #2a2a30',
              borderLeft: '2px solid #d4181f',
              padding: '0.55rem 0.7rem',
              color: '#f1eee5',
              fontFamily: 'inherit',
              fontSize: '0.78rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!customName.trim()}
            aria-label="add custom exercise"
            style={{
              background: customName.trim() ? '#d4181f' : '#2a2a30',
              color: customName.trim() ? '#fff' : '#666',
              border: `1px solid ${customName.trim() ? '#ff2a36' : '#2a2a30'}`,
              padding: '0 1rem',
              fontFamily: 'inherit',
              fontSize: '1.1rem',
              fontWeight: 900,
              letterSpacing: '0.05em',
              cursor: customName.trim() ? 'pointer' : 'default',
              clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </form>

          </div>

          {/* Body-height ATTUNE column — reaches the sheet's bottom
              but starts at the body's top (under the header). Letters
              stack vertically and stay UPRIGHT (no per-glyph rotation)
              via flex-column rendering one letter per row. */}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={commit}
            aria-label={canConfirm ? 'attune picks' : 'pick exercises and days'}
            style={{
              flexShrink: 0,
              alignSelf: 'stretch',
              width: 56,
              background: '#d4181f',
              opacity: canConfirm ? 1 : 0.45,
              color: '#fff',
              border: 'none',
              borderLeft: '1px solid #ff2a36',
              cursor: canConfirm ? 'pointer' : 'default',
              fontFamily: 'var(--font-display, Anton, sans-serif)',
              fontWeight: 900,
              textTransform: 'uppercase',
              padding: '1.25rem 0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.15rem',
              textShadow: canConfirm ? '0 0 14px rgba(255,42,54,0.55)' : 'none',
              transition: 'opacity 120ms linear, text-shadow 120ms linear',
            }}
          >
            {'ATTUNE'.split('').map((ch, i) => (
              <span
                key={i}
                style={{
                  fontSize: '1.55rem',
                  lineHeight: 1,
                  letterSpacing: 0,
                  display: 'block',
                }}
              >
                {ch}
              </span>
            ))}
          </button>
        </div>
      </div>
    </div>
  )
}
