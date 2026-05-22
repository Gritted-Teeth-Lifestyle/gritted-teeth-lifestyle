'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CallingCard from '../components/CallingCard'
import HeistTransition from '../components/HeistTransition'
import { useSound } from '../lib/useSound'
import {
  BGM_TRACKS,
  getCurrentBgmTrack,
  getBgmTargetVol,
  getRandomTrackId,
  setBgmMediaSession,
} from '../lib/bgmTracks'

// Pre-create the Audio element at module load with preload='auto' so it's ready
// when the user gestures. iOS PWA standalone mode rejects audio.play() if the
// element was created in the same synchronous tick as play() — even inside a
// user-gesture handler. Pre-creating sidesteps that. loop=true replaces the
// manual 'ended' listener.
//
// Window-level singleton so a stale module reload (HMR, dev refresh, or navigation
// glitch) doesn't create a second Audio instance that plays on top of the first.
const bgMusicAudio = (() => {
  if (typeof window === 'undefined') return null
  if (window.__gtlBgMusic) return window.__gtlBgMusic
  const track = getCurrentBgmTrack()
  const a = new Audio(track.src)
  a.loop = true
  a.preload = 'auto'
  a.volume = 0
  window.__gtlBgMusic = a
  window.__gtlBgMusicTrackId = track.id
  // Seed Media Session metadata at creation so the lockscreen has the
  // current track name/artwork ready the moment audio first plays.
  setBgmMediaSession(track)
  return a
})()

// Pause + reset on real page teardown so a refresh doesn't leave a zombie
// audio playing while the new module evaluation creates a second instance.
// Gate on `event.persisted === false` so bfcache transitions — including
// iOS lock/unlock — DON'T pause; the lockscreen-continuity code below
// depends on the audio element staying live across hidden/visible.
if (typeof window !== 'undefined' && bgMusicAudio && !window.__gtlBgMusicHideHook) {
  window.__gtlBgMusicHideHook = true
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return
    try { bgMusicAudio.pause(); bgMusicAudio.currentTime = 0 } catch {}
  })
}

// Lockscreen continuity: keep mediaSession.playbackState in sync with
// the audio element's actual state on visibility changes so the
// lockscreen card reflects reality. The audio session category itself
// stays in "media playback" because we no longer route through Web
// Audio (see lib/bgmTracks.js getBgmGainNode for the why) — that's
// what lets playback survive lock. Idempotent: installs once.
if (typeof window !== 'undefined' && bgMusicAudio && !window.__gtlBgMusicVisHook) {
  window.__gtlBgMusicVisHook = true
  document.addEventListener('visibilitychange', () => {
    try {
      if (window.__gtlBgMusic && !window.__gtlBgMusic.paused) {
        navigator.mediaSession.playbackState = 'playing'
      }
    } catch {}
  })
}

// iOS Chrome PWA (Add-to-Home-Screen, WKWebView) unlocks audio per-element.
// Even when the engine is unlocked by useSound's card-hover primer, this
// Audio element stays locked until it's played-once inside a user gesture.
// Prime it silently on first pointerdown so the actual play() in handleClick
// succeeds. once:true means it runs exactly once, on the first interaction.
//
// IMPORTANT: skip the prime entirely when the user has BGM disabled. iOS
// WKWebView has a known quirk where `muted = true` set immediately before
// `play()` doesn't always silence the first ~100-300ms of playback — if the
// singleton survived a prior session at volume 0.04, that brief window is
// audible. If BGM is off, settings/toggle-on will handle the unlock at the
// moment the user re-enables it (that toggle tap is itself a user gesture).
if (typeof window !== 'undefined' && bgMusicAudio) {
  const primeBgMusic = () => {
    try {
      if (window.localStorage.getItem('gtl-bg-music-on') === '0') return
    } catch {}
    // Same-tap race guard: if the click that fired this pointerdown also
    // routes through startBgMusic (it does on the homepage), the start path
    // owns the playback — skip the prime entirely so we don't fight it.
    if (window.__gtlBgMusicStarted) return
    bgMusicAudio.muted = true
    // Belt-and-suspenders: if iOS leaks the muted prime, volume 0 = silent.
    bgMusicAudio.volume = 0
    const p = bgMusicAudio.play()
    if (p && typeof p.then === 'function') {
      p.then(() => {
        // Async resolution race: startBgMusic may have run while this
        // promise was pending. If so, leave the audio alone — pausing or
        // resetting now would silence the playback startBgMusic just took
        // over, which is the bug we're guarding against.
        if (window.__gtlBgMusicStarted) return
        bgMusicAudio.pause()
        bgMusicAudio.currentTime = 0
        bgMusicAudio.muted = false
      }).catch(() => {
        // If even the muted prime fails, leave muted=true reset and let
        // startBgMusic's load()-and-retry path try later.
        bgMusicAudio.muted = false
      })
    }
  }
  window.addEventListener('pointerdown', primeBgMusic, { once: true })
}

function startBgMusic() {
  if (!bgMusicAudio) return
  // Settings toggle — if the user disabled bg music, don't start it. Also
  // backstop any audio that primeBgMusic or another race-y path may have
  // left playing (iOS PWA muted-prime leak). Force-pause + reset so we
  // don't leak audible BGM after a fresh launch with the flag off.
  try {
    if (window.localStorage.getItem('gtl-bg-music-on') === '0') {
      try { bgMusicAudio.pause(); bgMusicAudio.currentTime = 0; bgMusicAudio.volume = 0 } catch {}
      return
    }
  } catch {}
  // Already started AND still playing — skip. (Re-mounting the home page
  // shouldn't re-fade a song mid-loop.) But if we started before and the
  // audio got paused since (backgrounded tab, etc.), fall through and
  // restart cleanly.
  if (window.__gtlBgMusicStarted && !bgMusicAudio.paused) return

  // Latch SYNCHRONOUSLY so primeBgMusic's pending async .then() (same-tap
  // race) sees the flag and bails out instead of pausing what we're about
  // to take over.
  window.__gtlBgMusicStarted = true

  // Restore mute in case prime left it silenced. The prime may still be
  // mid-flight — its .then() will see the flag above and skip cleanup.
  bgMusicAudio.muted = false
  bgMusicAudio.volume = 0

  // Only call play() if paused — if prime is currently playing (muted),
  // we just unmute and fade up.
  if (bgMusicAudio.paused) {
    const playPromise = bgMusicAudio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        bgMusicAudio.load()
        bgMusicAudio.play().catch(() => {})
      })
    }
  }

  // Fade audio.volume up to the user-configured target. iOS PWA standalone
  // hardware-locks audio.volume so this is effectively a 0→1 binary on
  // that platform — but we accept the tradeoff because the audio session
  // now stays in "media playback" category and survives screen lock.
  const TARGET_VOL = getBgmTargetVol()
  const FADE_MS = 1500
  const steps = FADE_MS / 50
  const increment = (TARGET_VOL || 0.0001) / steps
  const interval = setInterval(() => {
    const next = Math.min(TARGET_VOL, bgMusicAudio.volume + increment)
    bgMusicAudio.volume = next
    if (next >= TARGET_VOL) clearInterval(interval)
  }, 50)
}

const FLASH_DURATION = 1000

const FITNESS_CARD = {
  title: 'FITNESS',
  subtitle: 'TARGET / PALACE 01',
  body: 'YOUR WEAKNESS HAS BEEN NOTED. THE CLIMB BEGINS THE MOMENT YOU PICK UP THIS CARD.',
  signOff: 'WITH GRITTED TEETH',
  rotate: '-rotate-2',
  compact: false,
}
const NUTRITION_CARD = {
  title: 'NUTRITION',
  subtitle: 'TARGET / PALACE 02',
  body: 'WHAT YOU PUT IN SHAPES WHAT WALKS OUT. EVERY MEAL IS IN THE RECORD.',
  signOff: 'NOTHING GOES UNLOGGED',
  rotate: 'rotate-2',
  compact: false,
}

function CallingCardReveal({ kind }) {
  const card = kind === 'fitness' ? FITNESS_CARD : NUTRITION_CARD
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'radial-gradient(ellipse at 50% 55%, rgba(74,10,14,0.55) 0%, rgba(7,7,8,0.94) 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
        animation: 'card-reveal-fade 1000ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes card-reveal-fade {
          0%   { opacity: 0; }
          16%  { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes card-spin-throw {
          0%   { opacity: 0; transform: translate(140vw, -90vh) rotate(-720deg) scale(0.55); }
          15%  { opacity: 1; }
          70%  { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1.05); }
          80%  { transform: translate(-6px, 3px)  rotate(3deg)    scale(0.97); }
          90%  { transform: translate(2px, -1px)  rotate(-1.5deg) scale(1.02); }
          100% { transform: translate(0, 0)       rotate(0deg)    scale(1); }
        }
      `}</style>
      <div
        style={{
          width: '100%', maxWidth: '20rem',
          pointerEvents: 'none',
          animation: 'card-spin-throw 750ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <CallingCard
          title={card.title}
          subtitle={card.subtitle}
          body={card.body}
          signOff={card.signOff}
          rotate={card.rotate}
          compact={card.compact}
          onActivate={() => {}}
        />
      </div>
    </div>
  )
}

// ── Ransom-note title — letter-by-letter mismatched font/bg/color mix ──
function DoorRansomTitle({ text }) {
  const RECIPES = [
    { cls: 'font-display',            color: '#f4ede0', bg: '#0e0e10', tilt: -2 },
    { cls: 'font-athletic font-black', color: '#0e0e10', bg: '#f4ede0', tilt:  1 },
    { cls: 'font-display',            color: '#f4ede0', bg: '#d4181f', tilt:  3 },
    { cls: 'font-athletic font-black', color: '#0e0e10', bg: '#f4ede0', tilt: -1 },
    { cls: 'font-display',            color: '#d4181f', bg: '#0e0e10', tilt:  2 },
    { cls: 'font-athletic font-black', color: '#0e0e10', bg: '#f4ede0', tilt: -3 },
    { cls: 'font-display',            color: '#f4ede0', bg: '#d4181f', tilt:  1 },
    { cls: 'font-athletic font-black', color: '#f4ede0', bg: '#0e0e10', tilt: -2 },
    { cls: 'font-display',            color: '#0e0e10', bg: '#f4ede0', tilt:  2 },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: 2, lineHeight: 1 }}>
      {text.toUpperCase().split('').map((char, i) => {
        const r = RECIPES[i % RECIPES.length]
        return (
          <span
            key={i}
            className={r.cls}
            style={{
              display: 'inline-block',
              fontSize: 'clamp(3rem, 7.5vw, 6rem)',
              color: r.color,
              background: r.bg,
              padding: '0 4px',
              lineHeight: 1,
              transform: `rotate(${r.tilt}deg) translateY(${((i % 3) - 1) * 4}px)`,
            }}
          >
            {char}
          </span>
        )
      })}
    </div>
  )
}

// ── War-room door panel — fills its flex slot, full P5 treatment ──
function DoorPanel({ kind, onActivate }) {
  const { play } = useSound()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const isFitness = kind === 'fitness'
  const cfg = isFitness
    ? {
        palace:   'PALACE 01',
        domain:   'PHYSICAL / COMBAT',
        title:    'FITNESS',
        body:     'YOUR WEAKNESS HAS BEEN NOTED. THE CLIMB BEGINS THE MOMENT YOU CHOOSE THIS DOOR.',
        kanji:    '体',
        bloom:    '15% 20%',
        gradient: 'linear-gradient(145deg, rgba(212,24,31,0.22) 0%, transparent 55%)',
        bg:       '#070708',
      }
    : {
        palace:   'PALACE 02',
        domain:   'FUEL / DISCIPLINE',
        title:    'NUTRITION',
        body:     'WHAT YOU PUT IN SHAPES WHAT WALKS OUT. EVERY MEAL IS IN THE RECORD.',
        kanji:    '食',
        bloom:    '85% 80%',
        gradient: 'linear-gradient(-145deg, rgba(212,24,31,0.18) 0%, transparent 55%)',
        bg:       '#0e0e10',
      }

  return (
    <button
      type="button"
      className="relative flex-1 overflow-hidden text-left"
      style={{
        minHeight: '50svh',
        background: cfg.bg,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={() => { setHovered(true); play('card-hover') }}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => { setPressed(false); setHovered(false) }}
      onClick={() => { play('card-confirm'); onActivate() }}
    >
      {/* Red atmosphere bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at ${cfg.bloom}, rgba(212,24,31,0.4) 0%, transparent 65%)`,
          opacity: hovered ? 1 : 0.35,
          transition: 'opacity 500ms ease-out',
        }}
      />
      {/* Directional gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: cfg.gradient,
          opacity: hovered ? 1 : 0.45,
          transition: 'opacity 400ms ease-out',
        }}
      />

      {/* Kanji watermark */}
      <div
        className="absolute pointer-events-none select-none"
        aria-hidden="true"
        style={{
          ...(isFitness
            ? { bottom: '-3rem', right: '-1rem' }
            : { top: '-3rem', left: '-1rem' }),
          fontFamily: '"FOT-Matisse Pro EB", "Noto Serif JP", serif',
          fontSize: 'clamp(14rem, 30vw, 22rem)',
          lineHeight: 0.8,
          color: '#ffffff',
          opacity: hovered ? 0.07 : 0.03,
          fontWeight: 900,
          transition: 'opacity 500ms ease-out',
          userSelect: 'none',
        }}
      >
        {cfg.kanji}
      </div>

      {/* Primary corner accent — fitness: top-left, nutrition: bottom-right */}
      {isFitness ? (
        <>
          <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
               style={{ height: 4, width: hovered ? 200 : 140, transition: 'width 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
               style={{ width: 4, height: hovered ? 200 : 140, transition: 'height 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
               style={{ height: 3, width: hovered ? 80 : 48, opacity: 0.45, transition: 'width 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
               style={{ width: 3, height: hovered ? 80 : 48, opacity: 0.45, transition: 'height 350ms cubic-bezier(0.2,1,0.3,1)' }} />
        </>
      ) : (
        <>
          <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
               style={{ height: 4, width: hovered ? 200 : 140, transition: 'width 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none"
               style={{ width: 4, height: hovered ? 200 : 140, transition: 'height 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
               style={{ height: 3, width: hovered ? 80 : 48, opacity: 0.45, transition: 'width 350ms cubic-bezier(0.2,1,0.3,1)' }} />
          <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none"
               style={{ width: 3, height: hovered ? 80 : 48, opacity: 0.45, transition: 'height 350ms cubic-bezier(0.2,1,0.3,1)' }} />
        </>
      )}

      {/* Palace badge — parallelogram pill */}
      <div
        className="absolute pointer-events-none"
        style={{
          ...(isFitness ? { top: '1.5rem', right: '1.5rem' } : { top: '1.5rem', left: '1.5rem' }),
          clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
          background: hovered ? '#d4181f' : '#1a1a1e',
          padding: '0.35rem 1.1rem',
          transition: 'background 300ms ease-out',
        }}
      >
        <span
          className="font-mono text-[9px] tracking-[0.4em] uppercase"
          style={{ color: hovered ? '#f4ede0' : '#6a6a72', transition: 'color 300ms ease-out' }}
        >
          {cfg.palace}
        </span>
      </div>

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col justify-center flex-1"
        style={{
          padding: 'clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 4rem)',
          transform: hovered ? (pressed ? 'translateY(2px)' : 'translateY(-4px)') : 'translateY(0)',
          transition: pressed ? 'transform 80ms ease-out' : 'transform 300ms ease-out',
        }}
      >
        {/* Step tag */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="h-px bg-gtl-red flex-shrink-0"
            style={{ width: hovered ? 48 : 32, transition: 'width 300ms ease-out' }}
          />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">
            {cfg.domain}
          </span>
        </div>

        {/* Ransom-note title */}
        <div className="mb-8">
          <DoorRansomTitle text={cfg.title} />
        </div>

        {/* Slash divider */}
        <div
          className="mb-6"
          style={{
            height: 5,
            background: '#d4181f',
            transform: 'skewX(-12deg)',
            width: hovered ? '85%' : '55%',
            transition: 'width 500ms cubic-bezier(0.2, 1, 0.3, 1)',
          }}
        />

        {/* Body copy */}
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-gtl-ash max-w-xs mb-10 leading-relaxed">
          {cfg.body}
        </p>

        {/* INFILTRATE — shadow slab CTA */}
        <div
          className="relative inline-flex self-start"
          style={{ opacity: hovered ? 1 : 0.5, transition: 'opacity 300ms ease-out' }}
        >
          {/* Shadow */}
          <div
            className="absolute inset-0 bg-gtl-red-deep pointer-events-none"
            style={{
              clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
              transform: pressed ? 'translate(0,0)' : 'translate(6px, 6px)',
              transition: 'transform 80ms ease-out',
            }}
            aria-hidden="true"
          />
          {/* Face */}
          <div
            className="relative flex items-center gap-2 px-6 py-3"
            style={{
              clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
              background: pressed ? '#ff2a36' : '#d4181f',
              transform: pressed ? 'translate(6px, 6px)' : 'translate(0,0)',
              transition: 'transform 80ms ease-out, background 80ms ease-out',
            }}
          >
            <span className="font-display text-sm tracking-[0.15em] text-gtl-paper">INFILTRATE</span>
            <span className="font-display text-base text-gtl-paper leading-none">▶</span>
          </div>
        </div>
      </div>

      {/* Hover wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isFitness
            ? 'linear-gradient(145deg, rgba(212,24,31,0.1) 0%, transparent 60%)'
            : 'linear-gradient(-145deg, rgba(212,24,31,0.1) 0%, transparent 60%)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 500ms ease-out',
        }}
        aria-hidden="true"
      />
    </button>
  )
}

export default function Home() {
  const router = useRouter()
  const { play } = useSound()

  // bfcache restore re-roll — swap singleton to a fresh random track on
  // back-button returns when random-on-launch is enabled.
  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return
      try {
        if (window.localStorage.getItem('gtl-bgm-random-on-launch') !== '1') return
      } catch { return }
      if (!window.__gtlBgMusic) return
      const a = window.__gtlBgMusic
      const nextId = getRandomTrackId(window.__gtlBgMusicTrackId)
      const track = BGM_TRACKS.find(t => t.id === nextId)
      if (!track || track.id === window.__gtlBgMusicTrackId) return
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      try { a.pause(); a.currentTime = 0 } catch {}
      a.src = track.src
      try { a.load() } catch {}
      window.__gtlBgMusicTrackId = track.id
      setBgmMediaSession(track)
      window.__gtlBgMusicStarted = false
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // Warm up destination route bundles during idle time on the home screen.
  useEffect(() => {
    const routes = ['/fitness', '/diet', '/fitness/hub', '/fitness/load', '/fitness/active']
    routes.forEach(href => { try { router.prefetch(href) } catch {} })
  }, [router])

  const [phase, setPhase] = useState('idle')
  const [transitionTarget, setTransitionTarget] = useState('/fitness')
  const [transitioning, setTransitioning] = useState(false)
  const flashTimerRef = useRef(null)
  const skippedRef = useRef(false)
  const targetRef = useRef('/fitness')

  const activate = (kind) => {
    if (phase !== 'idle') return
    // startBgMusic MUST be called synchronously inside the user-gesture handler.
    // iOS PWA blocks audio.play() outside the synchronous click context.
    startBgMusic()
    play('brand-confirm')
    const target = kind === 'fitness' ? '/fitness' : '/diet'
    setPhase(kind === 'fitness' ? 'flash-fitness' : 'flash-nutrition')
    setTransitionTarget(target)
    targetRef.current = target
    flashTimerRef.current = setTimeout(() => setTransitioning(true), FLASH_DURATION)
  }

  const skipAll = () => {
    if (skippedRef.current) return
    skippedRef.current = true
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    router.push(targetRef.current)
  }

  // Keyboard: up/left = fitness, down/right = nutrition
  useEffect(() => {
    if (phase !== 'idle') return
    const handler = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')        activate('fitness')
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') activate('nutrition')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase])

  // Skip-all: once committed, next tap anywhere routes immediately.
  useEffect(() => {
    if (phase === 'idle') return
    const handler = () => skipAll()
    window.addEventListener('pointerdown', handler, { capture: true })
    return () => window.removeEventListener('pointerdown', handler, { capture: true })
  }, [phase])

  const handleTransitionComplete = () => {
    if (skippedRef.current) return
    router.push(transitionTarget)
  }

  return (
    <main
      className="relative overflow-hidden"
      style={{ minHeight: '100svh', background: '#070708', isolation: 'isolate' }}
    >
      {/* Global noise grain */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" />

      {/* Global atmospheric gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(122,14,20,0.15) 0%, transparent 50%, rgba(74,10,14,0.2) 100%)',
        }}
      />

      {/* War-room doors */}
      {phase === 'idle' && (
        <div
          className="relative z-10 flex flex-col md:flex-row"
          style={{ minHeight: '100svh' }}
          role="navigation"
          aria-label="Choose your palace"
        >
          <DoorPanel kind="fitness" onActivate={() => activate('fitness')} />

          {/* Seam divider — horizontal on mobile, vertical on desktop */}
          <style>{`
            .gtl-seam-div { height: 3px; background: #d4181f; }
            @media (min-width: 768px) {
              .gtl-seam-div { height: auto; width: 3px; }
            }
          `}</style>
          <div
            className="gtl-seam-div flex-shrink-0 self-stretch relative"
            aria-hidden="true"
          />

          {/* GTL seal — centered on screen (exactly where the two doors meet) */}
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden="true"
          >
            <div
              style={{
                background: '#070708',
                border: '2px solid #d4181f',
                clipPath: 'polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)',
                padding: '0.35rem 1.4rem',
                boxShadow: '0 0 20px rgba(212,24,31,0.4)',
              }}
            >
              <span className="font-mono text-[10px] tracking-[0.5em] uppercase text-gtl-red">
                GTL
              </span>
            </div>
          </div>

          <DoorPanel kind="nutrition" onActivate={() => activate('nutrition')} />
        </div>
      )}

      {phase === 'flash-fitness'   && <CallingCardReveal kind="fitness"   />}
      {phase === 'flash-nutrition' && <CallingCardReveal kind="nutrition" />}

      <HeistTransition
        active={transitioning}
        onComplete={handleTransitionComplete}
        title="GTL"
      />
    </main>
  )
}
