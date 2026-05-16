'use client'
/*
 * /fitness/new/muscles — muscle selection screen.
 *
 * The user has just survived the fire transition from the naming screen.
 * They land here staring at a rotatable 3D stylized humanoid rendered by
 * R3F. Each of the 10 muscle groups (chest, biceps, triceps, shoulders,
 * forearms, abs, quads, hamstrings, glutes, calves) is a clickable mesh.
 * Clicking toggles that group's selection.
 *
 * Right-side panel lists all 10 groups with their current state. The
 * user can select from zero to all 10.
 *
 * Forward navigation deferred — RETREAT is the only exit for now.
 */
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useSound } from '../../../../lib/useSound'
import { useProfileGuard } from '../../../../lib/useProfileGuard'
import { pk } from '../../../../lib/storage'
import FireTransition from '../../../../components/FireTransition'
import SlashWipe from '../../../../components/SlashWipe'
import SpeedLines from '../../../../components/SpeedLines'
import RetreatButton from '../../../../components/RetreatButton'

// R3F is client-only and touches `window`; dynamic import with ssr: false
// avoids hydration errors.
const MuscleBody = dynamic(() => import('../../../../components/MuscleBody'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-ash animate-flicker">
        LOADING VESSEL…
      </div>
    </div>
  ),
})

// kanji values match the canonical muscle-glyph set in
// app/fitness/new/branded/page.js — same symbols appear on the active
// rolodex day cards, so users see one consistent glyph per muscle
// throughout the app. Region (UPPER/LOWER/ARMS/CORE) field removed —
// the kanji is the new at-a-glance identifier.
const MUSCLE_GROUPS = [
  { id: 'chest',      label: 'CHEST',      kanji: '胸' },
  { id: 'shoulders',  label: 'SHOULDERS',  kanji: '肩' },
  { id: 'back',       label: 'BACK',       kanji: '背' },
  { id: 'biceps',     label: 'BICEPS',     kanji: '二' },
  { id: 'triceps',    label: 'TRICEPS',    kanji: '三' },
  { id: 'forearms',   label: 'FOREARMS',   kanji: '腕' },
  { id: 'abs',        label: 'ABS',        kanji: '腹' },
  { id: 'glutes',     label: 'GLUTES',     kanji: '尻' },
  { id: 'quads',      label: 'QUADS',      kanji: '腿' },
  { id: 'hamstrings', label: 'HAMSTRINGS', kanji: '裏' },
  { id: 'calves',     label: 'CALVES',     kanji: '脛' },
]

// Left column: upper body | Right column: core + lower
const LEFT_MUSCLES  = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms']
const RIGHT_MUSCLES = ['abs', 'glutes', 'quads', 'hamstrings', 'calves']

// Mobile ignition order — chest first, then left column top-to-bottom, then right
const IGNITION_ORDER = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hamstrings', 'calves']

// Available 3D models the user can switch between
const MODEL_OPTIONS = [
  { id: 'anatomy',  label: 'ANATOMY',   subtitle: 'REFERENCE'   },
  { id: 'goku',     label: 'GOKU',      subtitle: 'BASE'        },
  { id: 'gokuSSJ',  label: 'GOKU',      subtitle: 'SUPER SAIYAN' },
  { id: 'gohan',    label: 'GOHAN',     subtitle: 'TEEN'         },
]


/**
 * A single row in the right-side muscle list.
 *
 * Clicking the row focuses the camera on that muscle — only one muscle
 * can be focused at a time (handled by `handleFocus` upstream). Selection
 * for training is a separate action via the checkbox on the left of the
 * row; the checkbox stops propagation so it never affects focus.
 */
function MuscleRow({ group, selected, focusedGroup, onToggle, onFocus, stampRevision = 0, index = 0, onStamp }) {
  const { play } = useSound()
  const [hovered, setHovered] = useState(false)
  const [isStamping, setIsStamping] = useState(false)
  const [isWobbling, setIsWobbling] = useState(false)
  const prevRevisionRef = useRef(0)
  const onStampRef = useRef(onStamp)
  useEffect(() => { onStampRef.current = onStamp }, [onStamp])

  useEffect(() => {
    if (stampRevision > prevRevisionRef.current) {
      prevRevisionRef.current = stampRevision
      const startDelay = index * 500
      const t = setTimeout(() => {
        setIsStamping(true)
        setTimeout(() => {
          if (onStampRef.current) onStampRef.current()
          setIsWobbling(true)
          setTimeout(() => setIsWobbling(false), 400)
        }, 740)
        setTimeout(() => setIsStamping(false), 1050)
      }, startDelay)
      return () => clearTimeout(t)
    }
  }, [stampRevision, index])
  const isSelected = selected.has(group.id)
  const isFocused = focusedGroup === group.id

  const handleRowClick = () => {
    play('option-select')
    onFocus(group.id)
  }

  const handleCheckboxClick = (e) => {
    e.stopPropagation()
    if (!isSelected) {
      setIsStamping(true)
      setTimeout(() => {
        onToggle(group.id)
        if (onStampRef.current) onStampRef.current()
        setIsWobbling(true)
        setTimeout(() => setIsWobbling(false), 400)
      }, 740)
      setTimeout(() => setIsStamping(false), 1050)
    } else {
      onToggle(group.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick()
        }
      }}
      onMouseEnter={() => { setHovered(true); play('button-hover') }}
      onMouseLeave={() => setHovered(false)}
      className={`
        group relative w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer
        transition-all duration-200 ease-out outline-none
        ${isWobbling ? 'animate-row-wobble' : ''}
        ${isFocused
          ? 'bg-gtl-red/25'
          : isSelected
          ? 'bg-gtl-red/10'
          : hovered
          ? 'bg-gtl-surface'
          : 'bg-transparent'}
      `}
    >
      {/* Left marker — slash-shape indicator, tracks focus state */}
      <div
        className={`
          w-1 h-8 transition-all duration-200
          ${isFocused
            ? 'bg-gtl-red-bright'
            : isSelected
            ? 'bg-gtl-red/80'
            : hovered
            ? 'bg-gtl-red/60'
            : 'bg-gtl-edge'}
        `}
        style={{ clipPath: 'polygon(0 10%, 100% 0, 100% 90%, 0 100%)' }}
      />

      {/* P5-styled checkbox — independent of focus, toggles selection only */}
      <div
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`Select ${group.label}`}
        tabIndex={-1}
        onClick={handleCheckboxClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleCheckboxClick(e)
          }
        }}
        className={`
          relative w-5 h-5 shrink-0 flex items-center justify-center border-2
          transition-colors duration-150
          ${isStamping ? 'animate-checkbox-stamp' : ''}
          ${isSelected
            ? 'bg-gtl-red-bright border-gtl-red-bright shadow-red-glow'
            : 'bg-gtl-ink border-gtl-edge hover:border-gtl-red'}
        `}
        style={{
          clipPath: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)',
          transformOrigin: 'center center',
        }}
      >
        {isSelected && (
          <span className="font-display text-gtl-paper text-sm leading-none -rotate-12 select-none">
            ✕
          </span>
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div
          className={`
            font-display text-xl leading-none transition-colors duration-200
            ${isFocused
              ? 'text-gtl-red-bright'
              : isSelected || hovered
              ? 'text-gtl-chalk'
              : 'text-gtl-ash'}
          `}
        >
          {group.label}
        </div>
        <div
          className="leading-none mt-0.5 text-gtl-smoke"
          style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '14px',
          }}
          aria-hidden="true"
        >
          {group.kanji}
        </div>
      </div>

      {/* Focus indicator — only visible for the currently focused row */}
      <div
        className={`
          font-mono text-[10px] tracking-[0.2em] font-bold transition-opacity duration-200
          ${isFocused ? 'opacity-100 text-gtl-red-bright' : 'opacity-0'}
        `}
      >
        ◉ FOCUS
      </div>
    </div>
  )
}

/**
 * ModelToggle — a row of P5-styled buttons for switching between the
 * available 3D models. Active one is red and filled.
 */
function ModelToggle({ value, onChange }) {
  const { play } = useSound()
  return (
    <div className="flex items-stretch gap-2">
      {MODEL_OPTIONS.map((opt) => {
        const isActive = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => { play('option-select'); onChange(opt.id) }}
            onMouseEnter={() => play('button-hover')}
            className={`
              group relative px-4 py-2 text-left transition-all duration-200
              border
              ${isActive
                ? 'bg-gtl-red border-gtl-red-bright shadow-red-glow'
                : 'bg-gtl-ink/60 border-gtl-edge hover:border-gtl-red'
              }
            `}
            style={{ clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)' }}
          >
            <div
              className={`
                font-display text-sm leading-none
                ${isActive ? 'text-gtl-paper' : 'text-gtl-chalk'}
              `}
            >
              {opt.label}
            </div>
            <div
              className={`
                font-mono text-[8px] tracking-[0.3em] uppercase mt-1
                ${isActive ? 'text-gtl-paper/80' : 'text-gtl-ash'}
              `}
            >
              {opt.subtitle}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * ForgeButton — the physical stamp face inside the FORGE CYCLE widget.
 * Presses on mousedown (face sinks into shadow), fires the transition on mouseup.
 */
function ForgeButton({ count, onFire, onHover }) {
  const [pressed, setPressed] = useState(false)

  const handleMouseDown = () => {
    setPressed(true)
  }

  const handleMouseUp = () => {
    setPressed(false)
    onFire()
  }

  // If the cursor leaves while held, release without firing
  const handleMouseLeave = () => {
    setPressed(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Forge cycle — ${count} target${count !== 1 ? 's' : ''} locked`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={onHover}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFire()
        }
      }}
      className="relative cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-gtl-red focus-visible:outline-offset-4"
      style={{
        transform: `rotate(-2.5deg)`,
        transformOrigin: 'center center',
        // Subtle scale-down on press gives physical weight
        transition: 'transform 80ms ease-out',
      }}
    >
      {/* Shadow slab — stays fixed; face moves onto it when pressed */}
      <div
        className="absolute inset-0 bg-gtl-red-deep"
        style={{
          clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
          transform: pressed ? 'translate(0px, 0px)' : 'translate(8px, 8px)',
          transition: 'transform 80ms ease-out',
        }}
        aria-hidden="true"
      />
      {/* Face — slides toward shadow on press */}
      <div
        className="relative py-5 px-8"
        style={{
          clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
          background: pressed ? '#ff2a36' : '#d4181f',
          transform: pressed ? 'translate(8px, 8px)' : 'translate(0px, 0px)',
          transition: 'transform 80ms ease-out, background 80ms ease-out',
        }}
      >
        <div className="font-display text-5xl text-gtl-paper leading-none tracking-tight">HONE</div>
        <div className="font-display text-5xl text-gtl-paper leading-none tracking-tight">TARGETS</div>
        <div className="font-mono text-[9px] tracking-[0.4em] uppercase text-gtl-paper/60 mt-3 border-t border-gtl-paper/20 pt-2">
          {count} TARGET{count !== 1 ? 'S' : ''} LOCKED ▸
        </div>
      </div>
    </div>
  )
}

/* ── Mobile muscle pill — compact P5 slab, floats in the side columns ── */
function MobileMusclePill({ group, selected, focusedGroup, onToggle, onFocus, ignitionRevision = 0, ignitionIndex = 0 }) {
  const { play } = useSound()
  const [pressed, setPressed] = useState(false)
  const [snapping, setSnapping] = useState(false)
  const prevRevRef = useRef(0)
  const isSelected = selected.has(group.id)

  // Fire the snap animation when a new ignition cascade starts, staggered
  // by body position. The wrapper div handles scale so the button's own
  // pressed-state translateY is unaffected.
  useEffect(() => {
    if (ignitionRevision > prevRevRef.current) {
      prevRevRef.current = ignitionRevision
      const t = setTimeout(() => {
        play('option-select')
        setSnapping(true)
        setTimeout(() => setSnapping(false), 450)
      }, 200 + ignitionIndex * 120)
      return () => clearTimeout(t)
    }
  }, [ignitionRevision, ignitionIndex, play])

  const fire = () => {
    play('option-select')
    if (isSelected) {
      onToggle(group.id)
      // Only reset camera if this muscle currently owns the view
      if (focusedGroup === group.id) onFocus(group.id)
    } else {
      onToggle(group.id)
      onFocus(group.id)
    }
  }

  return (
    <div
      className="shrink-0"
      style={snapping ? { animation: 'pill-ignite 420ms cubic-bezier(0.18, 1.4, 0.4, 1) both' } : undefined}
    >
      <button
        type="button"
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onClick={fire}
        className="relative select-none outline-none w-full"
        style={{
          clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
          background: isSelected
            ? (pressed ? '#ff2a36' : '#d4181f')
            : (pressed ? '#1f1f24' : 'rgba(10,10,13,0.88)'),
          border: `1px solid ${isSelected ? '#ff2a36' : '#2a2a30'}`,
          boxShadow: isSelected ? '0 0 16px rgba(212,24,31,0.5)' : 'none',
          padding: '7px 14px',
          minWidth: '108px',
          transform: pressed ? 'translateY(2px)' : 'none',
          transition: 'transform 60ms ease-out, background 80ms ease-out',
          touchAction: 'manipulation',
          WebkitTouchCallout: 'none',
        }}
      >
        <div className={`font-display text-sm leading-none tracking-wide ${isSelected ? 'text-white' : 'text-gtl-ash'}`}>
          {group.label}
        </div>
        <div
          className={`leading-none mt-0.5 ${isSelected ? 'text-white/85' : 'text-gtl-smoke'}`}
          style={{
            fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
            fontSize: '13px',
          }}
          aria-hidden="true"
        >
          {group.kanji}
        </div>
      </button>
    </div>
  )
}

/* ── Mobile forge stamp — compact version of the desktop FORGE CYCLE button ── */
function MobileForgeStamp({ count, onFire }) {
  const { play } = useSound()
  const [pressed, setPressed] = useState(false)

  const handleFire = () => { play('card-confirm'); onFire() }

  return (
    <div className="relative" style={{ animation: 'forge-slam 700ms cubic-bezier(0.2,1.2,0.4,1) forwards' }}>
      <div
        className="absolute inset-0 bg-gtl-red-deep"
        style={{
          clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
          transform: pressed ? 'translate(0,0)' : 'translate(5px,5px)',
          transition: 'transform 60ms ease-out',
        }}
        aria-hidden="true"
      />
      <button
        type="button"
        onPointerDown={e => { if (e.pointerType === 'touch') setPressed(true) }}
        onPointerUp={e => { if (e.pointerType === 'touch') { setPressed(false); handleFire() } }}
        onPointerCancel={() => setPressed(false)}
        onClick={handleFire}
        className="relative select-none outline-none block"
        style={{
          clipPath: 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
          background: pressed ? '#ff2a36' : '#d4181f',
          padding: '12px 24px',
          transform: pressed ? 'translate(5px,5px)' : 'translate(0,0)',
          transition: 'transform 60ms ease-out, background 60ms ease-out',
          touchAction: 'manipulation',
        }}
      >
        <div className="font-display text-2xl text-white leading-none -rotate-1">HONE</div>
        <div className="font-mono text-[8px] tracking-[0.3em] text-white/70 mt-0.5">
          {count} TARGET{count !== 1 ? 'S' : ''} ▸
        </div>
      </button>
    </div>
  )
}

export default function MusclesPage() {
  useProfileGuard()
  let backHref = '/fitness/new'
  try {
    if (localStorage.getItem('gtl-back-to-edit') === '1') backHref = '/fitness/edit'
    // Swipe-forge bails the user back to NAME YOUR CYCLE in one tap rather
    // than walking the chain backward step-by-step.
    else if (localStorage.getItem('gtl-quick-forge') === '1') backHref = '/fitness/new'
  } catch (_) {}
  const [selected, setSelected] = useState(() => new Set())
  const [focusedGroup, setFocusedGroup] = useState(null)
  const [modelKey, setModelKey] = useState('goku')
  const [stampRevision, setStampRevision] = useState(0)
  const [fireActive, setFireActive] = useState(false)
  const [quickHeistActive, setQuickHeistActive] = useState(false)
  const [quickForgeRunning, setQuickForgeRunning] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileIgnitionRevision, setMobileIgnitionRevision] = useState(0)
  const [shockwaveKey, setShockwaveKey] = useState(0)
  const [bodyPulseKey, setBodyPulseKey] = useState(0)
  const { play } = useSound()
  const mainRef = useRef(null)
  const router = useRouter()
  const NEXT_TARGET = '/fitness/new/branded'
  const skippedRef = useRef(false)
  const skipNow = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    router.push(NEXT_TARGET)
  }
  // Window pointerdown+touchstart listener while FireTransition is active —
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  useEffect(() => {
    try { if (localStorage.getItem('gtl-back-to-edit') !== '1') return } catch (_) { return }
    const handleKey = (e) => {
      if (e.key === 'Enter' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))
        router.push('/fitness/edit')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])

  const handleStamp = () => {
    play('stamp')
    if (mainRef.current) {
      mainRef.current.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-8px, 5px)' },
          { transform: 'translate(7px, -6px)' },
          { transform: 'translate(-5px, -3px)' },
          { transform: 'translate(4px, 4px)' },
          { transform: 'translate(-2px, 2px)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
      )
    }
  }

  // Toggle selection state
  const toggle = (id) => {
    play('option-select')
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Camera focus — clicking a hitbox or row sets focus (zooms in); clicking
  // the same muscle again, or clicking the background, clears focus. Only one
  // muscle is ever focused at a time — setting a new one replaces the previous.
  // Selection is a separate concern, handled by the checkbox in MuscleRow.
  const handleFocus = (id) => {
    setFocusedGroup((prev) => (prev === id ? null : id))
  }

  const clearAll = () => {
    play('menu-close')
    setSelected(new Set())
  }

  const selectAll = () => {
    play('card-confirm')
    if (isMobile) {
      setSelected(new Set())
      setFocusedGroup(null)
      setShockwaveKey((k) => k + 1)
      setMobileIgnitionRevision((r) => r + 1)
      IGNITION_ORDER.forEach((id, i) => {
        setTimeout(() => {
          setSelected((prev) => new Set([...prev, id]))
        }, 200 + i * 120)
      })
      // Body pulse fires one beat after the last muscle lights
      setTimeout(() => {
        setBodyPulseKey((k) => k + 1)
        play('stamp')
        if (mainRef.current) {
          mainRef.current.animate(
            [
              { transform: 'translate(0, 0)' },
              { transform: 'translate(-6px, 3px)' },
              { transform: 'translate(5px, -5px)' },
              { transform: 'translate(-4px, -2px)' },
              { transform: 'translate(3px, 3px)' },
              { transform: 'translate(-2px, 1px)' },
              { transform: 'translate(0, 0)' },
            ],
            { duration: 220, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' }
          )
        }
      }, 200 + IGNITION_ORDER.length * 120)
    } else {
      setSelected(new Set())
      setStampRevision((r) => r + 1)
      MUSCLE_GROUPS.forEach((g, i) => {
        setTimeout(() => {
          setSelected((prev) => new Set([...prev, g.id]))
        }, i * 500 + 740)
      })
    }
  }

  const count = selected.size

  // Keep a live ref to selectAll so the quick-forge timer invokes the LATEST
  // closure (one with isMobile=true after the mobile-detection effect resolves).
  const selectAllRef = useRef(selectAll)
  useEffect(() => { selectAllRef.current = selectAll })

  // Quick-forge auto-progression: when arriving with the gtl-quick-forge flag,
  // press ALL → wait for the full mobile ignition cascade → press HONE. Triggers
  // only once isMobile is true so the mobile-path animation fires (shockwave +
  // staggered pill ignition), not the silent desktop path. Flag survives for
  // the next pages in the chain (branded, summary).
  const quickForgeFiredRef = useRef(false)
  useEffect(() => {
    if (!isMobile) return
    if (quickForgeFiredRef.current) return
    let isQuickForge = false
    try { isQuickForge = localStorage.getItem('gtl-quick-forge') === '1' } catch (_) {}
    if (!isQuickForge) return
    quickForgeFiredRef.current = true
    setQuickForgeRunning(true)
    let cancelled = false
    const t1 = setTimeout(() => { if (!cancelled) selectAllRef.current?.() }, 600)
    // Mobile cascade: 11 pills × 120ms stagger + 200ms init = 1520ms after
    // selectAll fires. Plus 600ms pre-delay = ~2120ms total. Small buffer.
    const t2 = setTimeout(() => {
      if (cancelled) return
      const allIds = MUSCLE_GROUPS.map(g => g.id)
      try { localStorage.setItem(pk('muscle-targets'), JSON.stringify(allIds)) } catch (_) {}
      setQuickHeistActive(true)
    }, 2400)
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2) }
  }, [isMobile, router])

  return (
    <main ref={mainRef} className={`relative overflow-hidden bg-gtl-void ${isMobile ? 'h-[100dvh] flex flex-col' : 'min-h-screen'}`}>
{/* Top nav — responsive */}
      <nav
        className={`${isMobile ? 'absolute top-0 left-0 right-0' : 'relative shrink-0'} z-20 flex items-center justify-between ${isMobile ? 'pl-0 pr-4 pb-2' : 'pl-0 pr-8 py-6'}`}
        style={isMobile ? { paddingTop: 'max(0.75rem, env(safe-area-inset-top))' } : undefined}
      >
        <RetreatButton href={backHref} />
        </nav>

      {/* ── MOBILE LAYOUT — gacha style: canvas fills screen, pills float on sides ── */}
      {isMobile && (
        <div className="relative flex-1 overflow-hidden">
          {/* Canvas fills the full area */}
          <div className="absolute inset-0 bg-gtl-void">
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center font-mono text-gtl-ash text-xs tracking-widest uppercase animate-flicker">LOADING VESSEL…</div>}>
              <MuscleBody
                onFocus={handleFocus}
                focusedGroup={focusedGroup}
                modelKey={modelKey}
              />
            </Suspense>
            {/* Shockwave ring — fires at the start of mobile ALL ignition */}
            {shockwaveKey > 0 && (
              <div
                key={shockwaveKey}
                className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
              >
                <div style={{
                  width: '96px', height: '96px', borderRadius: '50%',
                  borderStyle: 'solid', borderColor: '#d4181f',
                  animation: 'shockwave 900ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
                }} />
              </div>
            )}
            {/* Body pulse — entrance flash once all muscles are lit */}
            {bodyPulseKey > 0 && (
              <div
                key={bodyPulseKey}
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(212,24,31,0.55) 0%, rgba(212,24,31,0.18) 45%, transparent 70%)',
                  animation: 'body-pulse 700ms cubic-bezier(0.3, 0, 0.5, 1) forwards',
                }}
              />
            )}
            {/* Persistent full-body glow — held while all 11 muscles are selected.
                Delayed fade-in so it rises as the entrance pulse fades out.
                Fades out immediately when any muscle is deselected. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 8,
                background: 'radial-gradient(ellipse at center, rgba(212,24,31,0.32) 0%, rgba(212,24,31,0.10) 50%, transparent 72%)',
                opacity: count === 11 ? 1 : 0,
                transition: count === 11
                  ? 'opacity 700ms ease-in 500ms'
                  : 'opacity 500ms ease-out',
              }}
            />
          </div>

          {/* Left column — upper body */}
          <div
            className="absolute left-1.5 bottom-0 z-20 flex flex-col justify-between pb-40 pointer-events-none"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
          >
            {LEFT_MUSCLES.map(id => {
              const group = MUSCLE_GROUPS.find(g => g.id === id)
              return (
                <div key={id} className="pointer-events-auto">
                  <MobileMusclePill group={group} selected={selected} focusedGroup={focusedGroup} onToggle={toggle} onFocus={handleFocus} ignitionRevision={mobileIgnitionRevision} ignitionIndex={IGNITION_ORDER.indexOf(id)} />
                </div>
              )
            })}
          </div>

          {/* Right column — core + lower */}
          <div
            className="absolute right-1.5 bottom-0 z-20 flex flex-col justify-between pb-40 pointer-events-none"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
          >
            {RIGHT_MUSCLES.map(id => {
              const group = MUSCLE_GROUPS.find(g => g.id === id)
              return (
                <div key={id} className="pointer-events-auto">
                  <MobileMusclePill group={group} selected={selected} focusedGroup={focusedGroup} onToggle={toggle} onFocus={handleFocus} ignitionRevision={mobileIgnitionRevision} ignitionIndex={IGNITION_ORDER.indexOf(id)} />
                </div>
              )
            })}
          </div>

          {/* Bottom bar — count + all/none + forge */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 flex items-end justify-between px-4 pt-3"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              background: 'linear-gradient(to top, rgba(7,7,8,0.96) 70%, transparent)',
            }}
          >
            <div className="flex items-end gap-3">
              <div>
                <div className="font-display text-4xl text-gtl-chalk leading-none">
                  {String(count).padStart(2, '0')}
                  <span className="font-mono text-[9px] tracking-[0.2em] text-gtl-smoke ml-2">/ 11</span>
                </div>
                <div className="font-mono text-[8px] tracking-[0.3em] uppercase text-gtl-ash mt-0.5">
                  {count === 0 ? 'NO TARGETS' : count === 11 ? 'FULL BODY' : `TARGET${count !== 1 ? 'S' : ''}`}
                </div>
              </div>
              <div className="flex flex-col gap-1 mb-0.5">
                <button type="button" onClick={selectAll}
                  className="font-mono text-[12px] tracking-[0.2em] uppercase font-bold text-gtl-chalk border border-gtl-red px-3 py-1.5 active:text-gtl-red active:border-gtl-red-bright transition-colors"
                  style={{ touchAction: 'manipulation' }}>
                  ALL
                </button>
                <button type="button" onClick={clearAll}
                  className="font-mono text-[12px] tracking-[0.2em] uppercase font-bold text-gtl-chalk border border-gtl-red px-3 py-1.5 active:text-gtl-red active:border-gtl-red-bright transition-colors"
                  style={{ touchAction: 'manipulation' }}>
                  NONE
                </button>
              </div>
            </div>

            {count > 0 && (
              <MobileForgeStamp count={count} onFire={() => {
                try { localStorage.setItem(pk('muscle-targets'), JSON.stringify([...selected])) } catch (_) {}
                setFireActive(true)
              }} />
            )}
          </div>
        </div>
      )}

      {/* ── DESKTOP LAYOUT — unchanged ── */}
      {!isMobile && (
      <>

      {/* Headline */}
      <section className="relative z-10 px-8 pt-4 pb-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-0.5 w-16 bg-gtl-red" />
          <span className="font-mono text-xs tracking-[0.4em] uppercase text-gtl-red font-bold">
            STEP / 02 / TARGETS
          </span>
          <div className="h-0.5 w-16 bg-gtl-red" />
        </div>
        <h1 className="font-matisse text-6xl md:text-7xl text-gtl-chalk leading-none -rotate-1">
          MARK YOUR
          <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-2 ml-4">
            TARGETS
          </span>
        </h1>
        <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-gtl-ash mt-4 max-w-xl">
          Click the muscles you intend to train. Rotate the vessel to inspect
          every angle.
        </p>
      </section>

      {/* Main content — 3D body + side panel */}
      <section className="relative z-10 px-8 pb-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* 3D body canvas column */}
        <div className="flex flex-col gap-4">
          {/* Model toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-gtl-red" />
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-red">
                SPECIMEN
              </span>
            </div>
            <ModelToggle value={modelKey} onChange={setModelKey} />
          </div>

        {/* 3D body canvas */}
        <div className="relative h-[600px] bg-gtl-ink/60 border border-gtl-edge">
          {/* Corner marks */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gtl-red" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gtl-red" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gtl-red" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gtl-red" aria-hidden="true" />

          {/* Corner labels */}
          <div className="absolute top-2 left-10 font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-red/70">
            SPECIMEN / 01
          </div>
          <div className="absolute top-2 right-10 font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-red/70">
            VIEW / ORBIT
          </div>
          <div className="absolute bottom-2 left-10 font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash/70">
            DRAG TO ROTATE
          </div>
          <div className="absolute bottom-2 right-10 font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash/70">
            SCROLL TO ZOOM
          </div>

          <Suspense fallback={<div className="w-full h-full flex items-center justify-center font-mono text-gtl-ash">LOADING…</div>}>
            <MuscleBody
              onFocus={handleFocus}
              focusedGroup={focusedGroup}
              modelKey={modelKey}
            />
          </Suspense>
        </div>
        </div>

        {/* Side panel — muscle list */}
        <aside className="relative">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div>
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-red">
                TARGET LIST
              </div>
              <div className="font-display text-3xl text-gtl-chalk leading-none mt-1">
                {String(count).padStart(2, '0')} / 11
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={selectAll}
                className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash hover:text-gtl-red-bright transition-colors px-2 py-1 border border-gtl-edge hover:border-gtl-red"
              >
                ALL
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="font-mono text-[9px] tracking-[0.2em] uppercase text-gtl-ash hover:text-gtl-red-bright transition-colors px-2 py-1 border border-gtl-edge hover:border-gtl-red"
              >
                NONE
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-0.5 bg-gtl-red mb-2" />

          {/* Muscle rows */}
          <div className="flex flex-col gap-0.5">
            {MUSCLE_GROUPS.map((group, i) => (
              <MuscleRow
                key={group.id}
                group={group}
                selected={selected}
                focusedGroup={focusedGroup}
                onToggle={toggle}
                onFocus={handleFocus}
                stampRevision={stampRevision}
                index={i}
                onStamp={handleStamp}
              />
            ))}
          </div>

          {/* Footer count */}
          <div className="mt-6 px-1 flex items-center justify-between">
            <div className="h-px flex-1 bg-gtl-edge" />
            <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-smoke px-3">
              {count === 0
                ? 'NO TARGETS'
                : count === 11
                ? 'FULL BODY'
                : `${count} TARGET${count === 1 ? '' : 'S'}`}
            </div>
            <div className="h-px flex-1 bg-gtl-edge" />
          </div>

          {/* Confirm button — neon sign, appears once a target is selected */}
        </aside>
      </section>

      {/* ── FORGE CYCLE — stamp button, left side ─────────────────────── */}
      {count > 0 && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: '32px', bottom: '90px' }}
        >
          {/* Outer container — slam entry, then stays */}
          <div style={{ animation: 'forge-slam 700ms cubic-bezier(0.2, 1.2, 0.4, 1) forwards' }}>

            {/* Sizing context for the spinning shapes + button */}
            <div className="relative" style={{ width: '300px', height: '210px' }}>

              {/* Shape 1 — large parallelogram outline, rotates CW 22s */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ animation: 'spin-cw 22s linear infinite', transformOrigin: 'center center' }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 border-2 border-gtl-red/15"
                     style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }} />
              </div>

              {/* Shape 2 — diamond outline, rotates CCW 14s */}
              <div
                className="absolute inset-4 pointer-events-none"
                style={{ animation: 'spin-ccw 14s linear infinite', transformOrigin: 'center center' }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 border border-gtl-red/20 rotate-45" />
              </div>

              {/* Shape 3 — smaller parallelogram, rotates CW 9s */}
              <div
                className="absolute inset-8 pointer-events-none"
                style={{ animation: 'spin-cw 9s linear infinite', transformOrigin: 'center center' }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 border border-gtl-red/25"
                     style={{ clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)' }} />
              </div>

              {/* The stamp — centered, permanently tilted, pressable */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                <ForgeButton count={count} onFire={() => {
                  play('card-confirm')
                  try { localStorage.setItem(pk('muscle-targets'), JSON.stringify([...selected])) } catch (_) {}
                  setFireActive(true)
                }} onHover={() => play('button-hover')} />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer slash */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center gap-4 px-8">
        <div className="h-px flex-1 bg-gtl-edge" />
        <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
          GRITTED TEETH LIFESTYLE / FITNESS PALACE / TARGETING
        </div>
        <div className="h-px flex-1 bg-gtl-edge" />
      </div>

      </>
      )}

      {/* Fire transition — erupts on confirm, navigates on complete */}
      <FireTransition
        active={fireActive}
        onComplete={() => { if (!skippedRef.current) router.push(NEXT_TARGET) }}
      />
      {/* Red slash wipe — quick-forge swipe path only (no title text) */}
      <SlashWipe
        active={quickHeistActive}
        onComplete={() => { if (!skippedRef.current) router.push(NEXT_TARGET) }}
      />
      <SpeedLines active={quickForgeRunning} />
    </main>
  )
}
