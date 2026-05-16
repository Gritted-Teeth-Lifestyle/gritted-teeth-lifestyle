'use client'
import { useEffect, useState } from 'react'
import RetreatButton from '../../../components/RetreatButton'
import { useSound } from '../../../lib/useSound'
import {
  BGM_TRACKS,
  BGM_TRACK_KEY,
  BGM_RANDOM_ON_LAUNCH_KEY,
  DEFAULT_BGM_TRACK_ID,
  getCurrentBgmTrack,
  getBgmTracksByGenre,
  getBgmTargetVol,
  getRandomTrackId,
  setBgmMediaSession,
} from '../../../lib/bgmTracks'

function readFlag(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    return raw === '1'
  } catch { return fallback }
}
function writeRaw(key, value) {
  try { window.localStorage.setItem(key, value) } catch {}
}

function Toggle({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="group w-full flex items-center justify-between gap-4 px-5 py-4 bg-gtl-surface border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red transition-colors duration-200 outline-none"
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk [@media(hover:hover)]:group-hover:text-gtl-paper transition-colors duration-200">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`font-mono text-[10px] tracking-[0.3em] uppercase font-bold px-3 py-1 transition-colors duration-200
          ${value ? 'bg-gtl-red text-gtl-paper' : 'bg-gtl-void text-gtl-ash border border-gtl-edge'}`}
        style={{ clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)' }}
      >
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

export default function BgmMusicPage() {
  const { play } = useSound()
  const [ready, setReady] = useState(false)
  const [bgMusicOn, setBgMusicOn] = useState(true)
  const [bgmTrackId, setBgmTrackId] = useState(null)
  const [randomOnLaunch, setRandomOnLaunch] = useState(false)

  useEffect(() => {
    setBgMusicOn(readFlag('gtl-bg-music-on', true))
    setRandomOnLaunch(readFlag(BGM_RANDOM_ON_LAUNCH_KEY, false))
    const liveId = (typeof window !== 'undefined' && window.__gtlBgMusicTrackId) || getCurrentBgmTrack().id
    setBgmTrackId(liveId)
    setReady(true)
  }, [])

  // Defensive body-scroll unlock — clear any leftover lock from /fitness/active.
  useEffect(() => {
    document.body.style.position = ''
    document.body.style.inset = ''
    document.body.style.touchAction = ''
    document.body.style.overflow = ''
    document.body.style.width = ''
    document.body.style.height = ''
    document.documentElement.style.overflow = ''
  }, [])

  const playBgmFromTop = (a) => {
    if (typeof window === 'undefined' || !a) return
    if (window.__gtlBgMusicFadeInterval) {
      clearInterval(window.__gtlBgMusicFadeInterval)
      window.__gtlBgMusicFadeInterval = null
    }
    a.volume = 0
    const p = a.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        try { a.load(); a.play().catch(() => {}) } catch {}
      })
    }
    const TARGET_VOL = getBgmTargetVol()
    if (TARGET_VOL <= 0) return
    const FADE_MS = 1500
    const steps = FADE_MS / 50
    const increment = TARGET_VOL / steps
    window.__gtlBgMusicFadeInterval = setInterval(() => {
      const v = Math.min(TARGET_VOL, a.volume + increment)
      a.volume = v
      if (v >= TARGET_VOL) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
    }, 50)
  }

  const handleBgmTrackPick = (trackId) => {
    if (trackId === bgmTrackId) {
      play('option-select')
      if (typeof window !== 'undefined' && window.__gtlBgMusic && bgMusicOn) {
        playBgmFromTop(window.__gtlBgMusic)
      }
      return
    }
    setBgmTrackId(trackId)
    writeRaw(BGM_TRACK_KEY, trackId)
    const track = BGM_TRACKS.find(t => t.id === trackId)
    if (!track) return
    if (typeof window !== 'undefined' && window.__gtlBgMusic) {
      const a = window.__gtlBgMusic
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      try { a.pause(); a.currentTime = 0 } catch {}
      a.src = track.src
      try { a.load() } catch {}
      window.__gtlBgMusicTrackId = track.id
      setBgmMediaSession(track)
      if (bgMusicOn) playBgmFromTop(a)
    }
    play('option-select')
  }

  const handleRandomize = () => {
    const nextId = getRandomTrackId(bgmTrackId)
    handleBgmTrackPick(nextId)
  }

  const handleRandomOnLaunch = (next) => {
    setRandomOnLaunch(next)
    writeRaw(BGM_RANDOM_ON_LAUNCH_KEY, next ? '1' : '0')
    play(next ? 'option-select' : 'menu-close')

    if (typeof window === 'undefined' || !window.__gtlBgMusic) return
    const a = window.__gtlBgMusic

    let nextId
    if (next) {
      // Toggling ON → swap to a fresh random track now (excluding the
      // currently-playing one) so the toggle has visible effect even when
      // iOS PWA standalone keeps the singleton alive across "relaunches."
      // Stored gtl-bgm-track preference is NOT overwritten — flipping the
      // toggle off later restores it.
      nextId = getRandomTrackId(window.__gtlBgMusicTrackId)
    } else {
      // Toggling OFF → revert to the user's stored preference (or default).
      let storedId
      try { storedId = window.localStorage.getItem(BGM_TRACK_KEY) } catch {}
      nextId = (BGM_TRACKS.find(t => t.id === storedId) ||
                BGM_TRACKS.find(t => t.id === DEFAULT_BGM_TRACK_ID) ||
                BGM_TRACKS[0]).id
    }
    if (nextId === window.__gtlBgMusicTrackId) return
    const track = BGM_TRACKS.find(t => t.id === nextId)
    if (!track) return

    if (window.__gtlBgMusicFadeInterval) {
      clearInterval(window.__gtlBgMusicFadeInterval)
      window.__gtlBgMusicFadeInterval = null
    }
    try { a.pause(); a.currentTime = 0 } catch {}
    a.src = track.src
    try { a.load() } catch {}
    window.__gtlBgMusicTrackId = track.id
    setBgmTrackId(track.id)
    setBgmMediaSession(track)
    if (bgMusicOn) playBgmFromTop(a)
  }

  return (
    <main className="relative min-h-screen bg-gtl-void flex flex-col overflow-x-hidden">
      <div className="absolute inset-0 gtl-noise pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(122,14,20,0.2) 0%, transparent 40%, transparent 60%, rgba(74,10,14,0.3) 100%)',
        }}
      />

      <div
        className="absolute -right-8 pointer-events-none select-none animate-flicker"
        aria-hidden="true"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) - 48px)',
          fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
          fontSize: '40rem',
          lineHeight: '0.8',
          color: '#ffffff',
          opacity: 0.04,
          fontWeight: 900,
        }}
      >
        音
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <nav
          className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-6"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <RetreatButton href="/settings" />
        </nav>

        <section className="relative z-10 flex-1 flex flex-col px-8 pt-4 pb-12 max-w-3xl mx-auto w-full">
          <div className="mb-6 md:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-16 bg-gtl-red" />
              <span className="font-matisse text-[10px] tracking-[0.3em] uppercase text-gtl-red">
                AUDIO / TRACK
              </span>
            </div>
            <h1 className="font-matisse text-[5rem] md:text-[8rem] leading-[0.9] text-gtl-chalk -rotate-1">
              BGM
              <br />
              <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-2">
                TRACK
              </span>
            </h1>
            <p className="font-matisse text-xs tracking-[0.25em] uppercase text-gtl-ash mt-6 max-w-md">
              Pick the song that scores your sets, or let the wheel choose.
            </p>
          </div>

          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash mb-3">
            TAP A TRACK TO SWITCH · TAP THE ACTIVE ONE TO RESTART
          </p>
          {ready && (
            <div className="flex flex-col gap-3 mb-4">
              <button
                type="button"
                onClick={handleRandomize}
                className="group w-full flex items-center justify-between gap-4 px-5 py-4 bg-gtl-surface border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red transition-colors duration-200 outline-none"
                style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
              >
                <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk [@media(hover:hover)]:group-hover:text-gtl-paper transition-colors duration-200">
                  RANDOMIZE NOW
                </span>
                <span aria-hidden="true" className="font-display text-base leading-none text-gtl-red [@media(hover:hover)]:group-hover:text-gtl-paper transition-colors duration-200">
                  ⤮
                </span>
              </button>
              <Toggle label="RANDOM ON LAUNCH" value={randomOnLaunch} onChange={handleRandomOnLaunch} />
            </div>
          )}
          <div className="flex flex-col gap-5">
            {ready && getBgmTracksByGenre().map(({ genre, tracks }) => (
              <div key={genre} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-px w-4 bg-gtl-red/60" />
                  <span className="font-mono text-[8px] tracking-[0.45em] uppercase text-gtl-red/80">{genre}</span>
                  <div className="h-px flex-1 bg-gtl-edge" />
                </div>
                {tracks.map(track => {
                  const active = track.id === bgmTrackId
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleBgmTrackPick(track.id)}
                      className={`group w-full flex items-center justify-between gap-4 px-5 py-4 border transition-colors duration-200 outline-none
                        ${active ? 'bg-gtl-red border-transparent' : 'bg-gtl-surface border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red'}`}
                      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
                      aria-pressed={active}
                    >
                      <span className={`font-display text-xl leading-none truncate
                        ${active ? 'text-gtl-paper' : 'text-gtl-chalk [@media(hover:hover)]:group-hover:text-gtl-paper'}`}>
                        {track.title}
                      </span>
                      <span aria-hidden="true" className={`font-display text-base leading-none shrink-0
                        ${active ? 'text-gtl-paper' : 'text-gtl-red'}`}>
                        {active ? '◆' : '➤︎'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Decorative footer slash — same vocabulary as /fitness/hub. */}
          <div className="mt-12 flex items-center gap-4">
            <div className="h-px flex-1 bg-gtl-edge" />
            <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
              GRITTED TEETH LIFESTYLE / BGM
            </div>
            <div className="h-px flex-1 bg-gtl-edge" />
          </div>
        </section>
      </div>
    </main>
  )
}
