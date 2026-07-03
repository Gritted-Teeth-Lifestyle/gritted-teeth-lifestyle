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
  compact: true,
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
        /* Phantom-Thieves throw — card flies in diagonally from off-screen
           top-right while spinning twice CCW, decelerates as it approaches
           the center, lands with a tiny jitter and settles flat. */
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
          onActivate={() => { /* navigation owned by parent timer */ }}
        />
      </div>
    </div>
  )
}

// Ransom-note title for dark war-room panels — inverse of CallingCard's paper version
function DarkRansomTitle({ text }) {
  const isLong = text.length > 7
  const recipes = isLong ? [
    { font: 'font-display',             size: 'text-3xl md:text-4xl', tilt: '-rotate-2', bg: 'bg-gtl-red',     color: 'text-gtl-paper', pad: 'px-1.5 py-0' },
    { font: 'font-athletic font-black', size: 'text-4xl md:text-5xl', tilt: 'rotate-1',  bg: '',               color: 'text-gtl-chalk', pad: 'px-1 py-0' },
    { font: 'font-display',             size: 'text-2xl md:text-3xl', tilt: 'rotate-3',  bg: '',               color: 'text-gtl-red',   pad: 'px-1 py-0' },
    { font: 'font-athletic font-black', size: 'text-3xl md:text-4xl', tilt: '-rotate-1', bg: 'bg-gtl-surface', color: 'text-gtl-chalk', pad: 'px-1.5 py-0' },
    { font: 'font-display',             size: 'text-4xl md:text-5xl', tilt: 'rotate-2',  bg: 'bg-gtl-red',     color: 'text-gtl-paper', pad: 'px-1.5 py-0' },
    { font: 'font-athletic font-black', size: 'text-3xl md:text-4xl', tilt: '-rotate-3', bg: '',               color: 'text-gtl-chalk', pad: 'px-1 py-0' },
    { font: 'font-display',             size: 'text-2xl md:text-3xl', tilt: 'rotate-1',  bg: 'bg-gtl-ink',     color: 'text-gtl-gold',  pad: 'px-1.5 py-0' },
    { font: 'font-athletic font-black', size: 'text-4xl md:text-5xl', tilt: '-rotate-2', bg: '',               color: 'text-gtl-chalk', pad: 'px-1 py-0' },
    { font: 'font-display',             size: 'text-3xl md:text-4xl', tilt: 'rotate-3',  bg: 'bg-gtl-red',     color: 'text-gtl-paper', pad: 'px-1.5 py-0' },
  ] : [
    { font: 'font-display',             size: 'text-4xl md:text-5xl', tilt: '-rotate-2', bg: 'bg-gtl-red',     color: 'text-gtl-paper', pad: 'px-2 py-0' },
    { font: 'font-athletic font-black', size: 'text-5xl md:text-6xl', tilt: 'rotate-1',  bg: '',               color: 'text-gtl-chalk', pad: 'px-1 py-0' },
    { font: 'font-display',             size: 'text-3xl md:text-4xl', tilt: 'rotate-3',  bg: '',               color: 'text-gtl-red',   pad: 'px-1.5 py-0' },
    { font: 'font-athletic font-black', size: 'text-4xl md:text-5xl', tilt: '-rotate-1', bg: 'bg-gtl-surface', color: 'text-gtl-chalk', pad: 'px-2 py-0' },
    { font: 'font-display',             size: 'text-5xl md:text-6xl', tilt: 'rotate-2',  bg: 'bg-gtl-red',     color: 'text-gtl-paper', pad: 'px-2 py-0' },
    { font: 'font-athletic font-black', size: 'text-4xl md:text-5xl', tilt: '-rotate-3', bg: '',               color: 'text-gtl-chalk', pad: 'px-1 py-0' },
    { font: 'font-display',             size: 'text-3xl md:text-4xl', tilt: 'rotate-1',  bg: 'bg-gtl-ink',     color: 'text-gtl-gold',  pad: 'px-2 py-0' },
  ]
  const letters = text.toUpperCase().split('')
  return (
    <div className="flex flex-wrap items-end gap-x-1 leading-none" aria-label={text}>
      {letters.map((letter, i) => {
        const r = recipes[i % recipes.length]
        return (
          <span
            key={i}
            className={`inline-block ${r.font} ${r.size} ${r.tilt} ${r.bg} ${r.color} ${r.pad}`}
            style={{ transform: `translateY(${(i % 3) - 1}px)` }}
            aria-hidden="true"
          >
            {letter}
          </span>
        )
      })}
    </div>
  )
}

// Inner content of a war-room door — separated from the button so hover
// state can be tracked on the button wrapper and passed down via a render
// prop / context-free prop drilling pattern isn't needed. Instead the button
// wraps this and we use CSS :has() or just inline state on the button.
function WarDoorInner({ kind, hovered, pressed }) {
  const isFitness = kind === 'fitness'
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden"
      style={{ background: '#070708', height: '100%', width: '100%' }}
    >
      {/* Noise */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" aria-hidden="true" />

      {/* Atmospheric corner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isFitness
            ? 'linear-gradient(135deg, rgba(122,14,20,0.5) 0%, transparent 55%)'
            : 'linear-gradient(225deg, rgba(122,14,20,0.5) 0%, transparent 55%)',
          opacity: hovered ? 1 : 0.5,
          transition: 'opacity 300ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: hovered ? 5 : 3,
          background: hovered ? '#ff2a36' : '#d4181f',
          transition: 'height 200ms ease-out, background 200ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Vertical side accent */}
      <div
        className="absolute top-0 pointer-events-none"
        style={{
          [isFitness ? 'left' : 'right']: 0,
          width: 4,
          height: hovered ? 200 : 110,
          background: '#d4181f',
          transition: 'height 300ms ease-out',
        }}
        aria-hidden="true"
      />

      {/* Palace number watermark */}
      <div
        className="absolute pointer-events-none select-none"
        aria-hidden="true"
        style={{
          bottom: '-2rem',
          [isFitness ? 'right' : 'left']: '-0.5rem',
          fontFamily: 'Anton, Impact, sans-serif',
          fontSize: 'clamp(6rem, 16vw, 16rem)',
          lineHeight: 0.8,
          color: '#ffffff',
          opacity: 0.025,
          fontWeight: 900,
          userSelect: 'none',
        }}
      >
        {isFitness ? '01' : '02'}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col p-5 md:p-10 pt-7 md:pt-12 flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-5 md:mb-8">
          <div
            style={{
              height: 1,
              width: hovered ? 56 : 32,
              background: hovered ? '#d4181f' : '#26262a',
              transition: 'width 300ms ease-out, background 200ms ease-out',
            }}
          />
          <span className="font-mono text-[8px] md:text-[10px] tracking-[0.35em] uppercase text-gtl-smoke">
            {isFitness ? 'TARGET / PALACE 01' : 'TARGET / PALACE 02'}
          </span>
        </div>

        {/* Ransom-note title */}
        <div className="mb-4 md:mb-6">
          <DarkRansomTitle text={isFitness ? 'FITNESS' : 'NUTRITION'} />
        </div>

        {/* Slash divider */}
        <div
          className="h-1.5 mb-4 md:mb-6 pointer-events-none"
          style={{
            background: hovered ? '#ff2a36' : '#d4181f',
            transform: 'skewX(-12deg)',
            transformOrigin: 'left center',
            width: hovered ? '82%' : '48%',
            transition: 'width 300ms ease-out, background 200ms ease-out',
          }}
          aria-hidden="true"
        />

        {/* Body */}
        <p
          className="font-mono text-[10px] md:text-xs leading-relaxed tracking-wide uppercase max-w-xs"
          style={{ color: '#4a4a4f' }}
        >
          {isFitness
            ? 'YOUR WEAKNESS HAS BEEN NOTED. THE CLIMB BEGINS THE MOMENT YOU STEP THROUGH.'
            : 'WHAT YOU PUT IN SHAPES WHAT WALKS OUT. EVERY MEAL IS IN THE RECORD.'}
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 p-5 md:p-10 pt-0">
        <div
          style={{
            transform: hovered ? 'translateX(6px)' : 'translateX(0)',
            transition: 'transform 200ms ease-out',
            display: 'inline-block',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            {/* Shadow slab */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: '#4a0a0e',
                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                transform: pressed ? 'translate(0,0)' : 'translate(5px, 5px)',
                transition: 'transform 80ms ease-out',
              }}
            />
            {/* Face */}
            <div
              style={{
                position: 'relative',
                padding: '0.6rem 1.25rem',
                clipPath: 'polygon(4% 0%, 100% 0%, 96% 100%, 0% 100%)',
                background: pressed ? '#ff2a36' : (hovered ? '#e8191f' : '#d4181f'),
                transform: pressed ? 'translate(5px,5px)' : 'translate(0,0)',
                transition: 'transform 80ms ease-out, background 100ms ease-out',
              }}
            >
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-paper">
                {isFitness ? '▸ ENTER' : '▸ LOG MEAL'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hover red wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(212,24,31,0.09) 0%, rgba(212,24,31,0.04) 60%, transparent 100%)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
        aria-hidden="true"
      />
    </div>
  )
}

function WarDoorButton({ kind, onActivate }) {
  const { play } = useSound()
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      aria-label={kind === 'fitness' ? 'Enter Fitness' : 'Enter Nutrition'}
      className="flex-1 outline-none cursor-pointer text-left"
      style={{
        padding: 0,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        // Press feedback on the door itself
        transform: pressed ? 'scale(0.988)' : 'scale(1)',
        transition: 'transform 80ms ease-out',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      onClick={onActivate}
      onMouseEnter={() => { setHovered(true); play('card-hover') }}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
    >
      <WarDoorInner kind={kind} hovered={hovered} pressed={pressed} />
    </button>
  )
}

function WarRoom({ onFitness, onNutrition, startMusic }) {
  const { play } = useSound()
  const [entered, setEntered] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60)
    return () => clearTimeout(t)
  }, [])

  // Prefetch all reachable routes silently while the user reads the doors
  useEffect(() => {
    ;['/fitness', '/diet', '/fitness/hub', '/fitness/load', '/fitness/active'].forEach(href => {
      try { router.prefetch(href) } catch {}
    })
  }, [router])

  const handleDoor = (kind) => {
    startMusic()
    play('brand-confirm')
    if (kind === 'fitness') onFitness()
    else onNutrition()
  }

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: '#070708' }}
    >
      <style>{`
        @keyframes war-door-left {
          from { transform: translateX(-6%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes war-door-right {
          from { transform: translateX(6%);  opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* Noise */}
      <div className="absolute inset-0 gtl-noise pointer-events-none" aria-hidden="true" />

      {/* Centre depth bloom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 80%, rgba(90,10,15,0.35) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none" style={{ height: 4, width: 120 }} aria-hidden="true" />
      <div className="absolute top-0 left-0 bg-gtl-red pointer-events-none" style={{ width: 4, height: 120 }} aria-hidden="true" />
      <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none" style={{ height: 4, width: 120 }} aria-hidden="true" />
      <div className="absolute bottom-0 right-0 bg-gtl-red pointer-events-none" style={{ width: 4, height: 120 }} aria-hidden="true" />

      {/* Kanji watermark */}
      <div
        className="absolute pointer-events-none select-none"
        aria-hidden="true"
        style={{
          top: '-3rem', left: '-2rem',
          fontFamily: '"FOT-Matisse Pro EB", "Noto Serif JP", serif',
          fontSize: 'clamp(14rem, 40vw, 28rem)',
          lineHeight: 0.8,
          color: '#ffffff',
          opacity: 0.022,
          fontWeight: 900,
          userSelect: 'none',
        }}
      >
        戦
      </div>

      {/* Header */}
      <header
        className="relative z-10 shrink-0 flex items-center justify-between"
        style={{
          padding: '0 1.25rem 0.6rem',
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        <div
          style={{
            fontFamily: 'Anton, Impact, sans-serif',
            fontSize: '1.5rem',
            color: '#f1eee5',
            letterSpacing: '-0.02em',
            textShadow: '2px 2px 0 #d4181f',
          }}
        >
          GTL
        </div>
        <div className="flex items-center gap-3">
          <div className="h-px w-6 bg-gtl-edge" />
          <span className="font-mono text-[8px] tracking-[0.35em] uppercase text-gtl-smoke">
            GRITTED TEETH LIFESTYLE
          </span>
        </div>
      </header>

      {/* War room doors */}
      <div
        className="relative z-10 flex-1 flex flex-col md:flex-row"
        style={{ minHeight: 0 }}
      >
        {/* FITNESS DOOR */}
        <div
          className="flex-1 flex flex-col"
          style={{
            animation: entered ? 'war-door-left 450ms cubic-bezier(0.2, 1, 0.3, 1) both' : 'none',
            opacity: entered ? undefined : 0,
          }}
        >
          <WarDoorButton kind="fitness" onActivate={() => handleDoor('fitness')} />
        </div>

        {/* Divider */}
        <div
          className="shrink-0 relative hidden md:block"
          aria-hidden="true"
          style={{ width: 2, background: '#1a1a1a' }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%) skewY(-12deg)',
              width: 4,
              height: '38%',
              background: '#d4181f',
            }}
          />
        </div>

        {/* NUTRITION DOOR */}
        <div
          className="flex-1 flex flex-col"
          style={{
            animation: entered ? 'war-door-right 450ms cubic-bezier(0.2, 1, 0.3, 1) 80ms both' : 'none',
            opacity: entered ? undefined : 0,
          }}
        >
          <WarDoorButton kind="nutrition" onActivate={() => handleDoor('nutrition')} />
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const { play } = useSound()

  // bfcache restore re-roll: returning via back button re-picks a random track
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

  const [phase, setPhase] = useState('gate')
  const [transitionTarget, setTransitionTarget] = useState('/fitness')
  const [transitioning, setTransitioning] = useState(false)
  const flashTimerRef = useRef(null)
  const skippedRef = useRef(false)
  const targetRef = useRef('/fitness')

  // activate() is called from WarRoom.handleDoor() — synchronously within the
  // user gesture, so startBgMusic() inside handleDoor runs in the same tick.
  const activate = (kind) => {
    if (phase !== 'gate') return
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

  // Keyboard shortcut: arrow up = fitness, arrow down = nutrition
  useEffect(() => {
    if (phase !== 'gate') return
    const handler = (e) => {
      if (e.key === 'ArrowUp')        { startBgMusic(); play('brand-confirm'); activate('fitness') }
      else if (e.key === 'ArrowDown') { startBgMusic(); play('brand-confirm'); activate('nutrition') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase])

  // Once gate committed, any tap skips straight to route
  useEffect(() => {
    if (phase === 'gate') return
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
      style={{ minHeight: '100%', background: '#280609', isolation: 'isolate' }}
    >
      {phase === 'gate' && (
        <WarRoom
          onFitness={() => activate('fitness')}
          onNutrition={() => activate('nutrition')}
          startMusic={startBgMusic}
        />
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
