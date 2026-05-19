'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RetreatButton from '../../components/RetreatButton'
import { useSound } from '../../lib/useSound'
import { pk } from '../../lib/storage'
import NumberRow from '../../components/settings/NumberRow'
import SexToggle from '../../components/settings/SexToggle'
import DateRow from '../../components/settings/DateRow'
import { canVibrate } from '../../lib/platform'
import {
  BGM_TRACKS,
  BGM_VOLUME_KEY,
  BGM_BASE_VOL,
  DEFAULT_BGM_TRACK_ID,
  getCurrentBgmTrack,
  getBgmTargetVol,
  setBgmMediaSession,
} from '../../lib/bgmTracks'

const KEY_SFX_VOLUME   = 'gtl-sfx-volume'
const KEY_BG_MUSIC_ON  = 'gtl-bg-music-on'
const KEY_HAPTICS_ON   = 'gtl-haptics-on'

function readNumber(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : fallback
  } catch { return fallback }
}
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

function VolumeSlider({ value, onChange, onPreview }) {
  return (
    <div className="bg-gtl-surface border border-gtl-edge px-5 py-4" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">SFX VOLUME</span>
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        onMouseUp={onPreview}
        onTouchEnd={onPreview}
        className="w-full accent-gtl-red py-3"
        style={{ touchAction: 'pan-x' }}
        aria-label="SFX volume"
      />
    </div>
  )
}

function DangerButton({ label, armedLabel, onConfirm }) {
  const [armed, setArmed] = useState(false)
  const { play } = useSound()
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  const handleClick = () => {
    if (!armed) {
      setArmed(true)
      play('menu-open')
      return
    }
    play('brand-confirm')
    onConfirm()
    setArmed(false)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group w-full flex items-center justify-between gap-4 px-5 py-4 border transition-colors duration-200 outline-none
        ${armed ? 'bg-gtl-red border-transparent' : 'bg-gtl-surface border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red'}`}
      style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
    >
      <span className={`font-mono text-[11px] tracking-[0.3em] uppercase font-bold transition-colors duration-200
        ${armed ? 'text-gtl-paper' : 'text-gtl-chalk [@media(hover:hover)]:group-hover:text-gtl-red'}`}>
        {armed ? armedLabel : label}
      </span>
      <span aria-hidden="true" className={`font-display text-base leading-none transition-colors duration-200
        ${armed ? 'text-gtl-paper' : 'text-gtl-red'}`}>
        {armed ? '✕' : '➤︎'}
      </span>
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { play } = useSound()
  const [ready, setReady] = useState(false)
  const [activeProfile, setActiveProfile] = useState(null)
  const [sfxVolume, setSfxVolume] = useState(1)
  const [bgMusicOn, setBgMusicOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [bgmTrackTitle, setBgmTrackTitle] = useState(null)
  const [bgmVolume, setBgmVolume] = useState(1)
  // canVibrate() reads navigator — keep it client-only via the `ready` gate.
  const hapticsSupported = ready && canVibrate()
  const [userBW, setUserBW]       = useState(null)   // R1a: lb integer, profile-scoped
  const [userSex, setUserSex]     = useState('m')    // R1a: 'm' | 'f', default 'm'
  const [userDOB, setUserDOB]     = useState(null)   // R16: ISO 'YYYY-MM-DD' | null, optional

  useEffect(() => {
    setActiveProfile(typeof window !== 'undefined' ? (localStorage.getItem('gtl-active-profile') || null) : null)
    setSfxVolume(readNumber(KEY_SFX_VOLUME, 1))
    setBgMusicOn(readFlag(KEY_BG_MUSIC_ON, true))
    setHapticsOn(readFlag(KEY_HAPTICS_ON, true))
    setBgmVolume(readNumber(BGM_VOLUME_KEY, 1))
    // WARRIOR DATA — pk()-scoped per active profile.
    try {
      const rawBW = localStorage.getItem(pk('user-bodyweight'))
      const n = rawBW != null ? parseInt(rawBW, 10) : null
      setUserBW(Number.isFinite(n) ? n : null)
    } catch (_) {}
    try {
      const rawSex = localStorage.getItem(pk('user-sex'))
      setUserSex(rawSex === 'f' ? 'f' : 'm')
    } catch (_) {}
    try {
      const rawDOB = localStorage.getItem(pk('user-dob'))
      setUserDOB(/^\d{4}-\d{2}-\d{2}$/.test(rawDOB || '') ? rawDOB : null)
    } catch (_) {}
    // Title only — used by the "BGM TRACK → /settings/music" entry to show
    // a hint of what's currently selected.
    const live = getCurrentBgmTrack()
    setBgmTrackTitle(live?.title || null)
    setReady(true)
  }, [])

  // Defensive body-scroll unlock. Same backstop as /fitness/hub — clear any
  // leftover position:fixed / touch-action:none from /fitness/active so this
  // page can scroll if a navigation race left them set.
  useEffect(() => {
    document.body.style.position = ''
    document.body.style.inset = ''
    document.body.style.touchAction = ''
    document.body.style.overflow = ''
    document.body.style.width = ''
    document.body.style.height = ''
    document.documentElement.style.overflow = ''
  }, [])

  // Shared "play this audio element from the top with the standard fade-in"
  // helper — used by both the BGM toggle and the track picker so the audio
  // ramp shape is identical. Reads getBgmTargetVol() so the slider's value
  // is honoured on every fade.
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

  const handleBgmVolume = (v) => {
    setBgmVolume(v)
    writeRaw(BGM_VOLUME_KEY, String(v))
    // Live update — set audio.volume directly. iOS PWA standalone
    // hardware-locks the value (slider effectively binary there) but we
    // accept that tradeoff in exchange for lockscreen continuity. On
    // Android/desktop the slider works normally.
    if (typeof window !== 'undefined' && window.__gtlBgMusic && bgMusicOn && !window.__gtlBgMusic.paused) {
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      const c = Math.max(0, Math.min(1, v))
      const target = BGM_BASE_VOL * c * c
      window.__gtlBgMusic.volume = target
    }
  }

  const handleSfxVolume = (v) => {
    setSfxVolume(v)
    writeRaw(KEY_SFX_VOLUME, String(v))
  }
  const previewSfx = () => play('card-confirm')

  const handleBgMusic = (next) => {
    setBgMusicOn(next)
    writeRaw(KEY_BG_MUSIC_ON, next ? '1' : '0')
    if (typeof window !== 'undefined' && window.__gtlBgMusic) {
      const a = window.__gtlBgMusic
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      try { a.pause(); a.currentTime = 0; if (!next) a.volume = 0 } catch {}
      if (next) playBgmFromTop(a)
    }
    play(next ? 'option-select' : 'menu-close')
  }

  // R1a: bodyweight (60-500 lb integer). null clears the key.
  // While the user is typing we accept the raw parsed value without clamping
  // — clamping mid-keystroke would overwrite partial input (e.g. "1" on the
  // way to "150" would snap to 60). The commit handler below clamps + persists
  // on blur.
  const handleBodyweight = (n) => {
    if (n == null) {
      setUserBW(null)
      try { localStorage.removeItem(pk('user-bodyweight')) } catch (_) {}
      return
    }
    if (!Number.isFinite(n)) return
    setUserBW(n)
  }

  const commitBodyweight = () => {
    setUserBW((current) => {
      if (current == null) {
        try { localStorage.removeItem(pk('user-bodyweight')) } catch (_) {}
        return null
      }
      const clamped = Math.max(60, Math.min(500, Math.round(current)))
      try { localStorage.setItem(pk('user-bodyweight'), String(clamped)) } catch (_) {}
      return clamped
    })
  }

  const handleSex = (next) => {
    const v = next === 'f' ? 'f' : 'm'
    setUserSex(v)
    try { localStorage.setItem(pk('user-sex'), v) } catch (_) {}
    play('option-select')
  }

  // R16: ISO 'YYYY-MM-DD' string from the native date picker, or null to
  // clear. Lets getHolidayMultiplier fire the birthday Tier-1 holiday.
  const handleDOB = (iso) => {
    if (iso == null) {
      setUserDOB(null)
      try { localStorage.removeItem(pk('user-dob')) } catch (_) {}
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
    setUserDOB(iso)
    try { localStorage.setItem(pk('user-dob'), iso) } catch (_) {}
  }

  const handleHaptics = (next) => {
    setHapticsOn(next)
    writeRaw(KEY_HAPTICS_ON, next ? '1' : '0')
    if (next && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(40) } catch {}
    }
    play(next ? 'option-select' : 'menu-close')
  }

  // Reset the app preferences (volumes, toggles, BGM track) to their factory
  // defaults. Profile data (cycles, lifts, EXP) is untouched — that lives
  // under gtl-{profile}-* and is owned by the DANGER ZONE buttons.
  const resetSettingsDefaults = () => {
    if (typeof window === 'undefined') return
    const keys = [
      KEY_SFX_VOLUME,
      KEY_BG_MUSIC_ON,
      KEY_HAPTICS_ON,
      BGM_VOLUME_KEY,
      'gtl-bgm-track',
      'gtl-bgm-random-on-launch',
    ]
    for (const k of keys) {
      try { localStorage.removeItem(k) } catch {}
    }
    setSfxVolume(1)
    setBgMusicOn(true)
    setHapticsOn(true)
    setBgmVolume(1)
    const defaultTrack = BGM_TRACKS.find(t => t.id === DEFAULT_BGM_TRACK_ID) || BGM_TRACKS[0]
    setBgmTrackTitle(defaultTrack?.title || null)
    // Swap live BGM back to the default track so a random-on-launch session
    // doesn't keep playing TRACK 7 while the title says TRACK 1. Reuses the
    // standard pause + reset + src + load + play-from-top sequence.
    if (window.__gtlBgMusic && defaultTrack && window.__gtlBgMusicTrackId !== defaultTrack.id) {
      const a = window.__gtlBgMusic
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      try { a.pause(); a.currentTime = 0 } catch {}
      a.src = defaultTrack.src
      try { a.load() } catch {}
      window.__gtlBgMusicTrackId = defaultTrack.id
      setBgmMediaSession(defaultTrack)
      // bgMusicOn was just reset to true; play from top.
      playBgmFromTop(a)
    } else if (window.__gtlBgMusic && !window.__gtlBgMusic.paused) {
      // Same track — just retarget volume to default (BGM_BASE_VOL × 1² = BGM_BASE_VOL).
      if (window.__gtlBgMusicFadeInterval) {
        clearInterval(window.__gtlBgMusicFadeInterval)
        window.__gtlBgMusicFadeInterval = null
      }
      window.__gtlBgMusic.volume = BGM_BASE_VOL
    }
  }

  // Wipe all keys scoped to the active profile (`gtl-${profile}-*`).
  const resetActiveProfileData = () => {
    if (typeof window === 'undefined') return
    const profile = localStorage.getItem('gtl-active-profile')
    if (!profile) return
    const prefix = `gtl-${profile}-`
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  }

  // Remove the active profile from the roster, drop its scoped keys, then send
  // the user back to /fitness so they re-pick or create.
  const deleteActiveProfile = () => {
    if (typeof window === 'undefined') return
    const profile = localStorage.getItem('gtl-active-profile')
    resetActiveProfileData()
    if (profile) {
      try {
        const raw = localStorage.getItem('gtl-profiles')
        const list = raw ? JSON.parse(raw) : []
        const next = list.filter(n => n !== profile)
        localStorage.setItem('gtl-profiles', JSON.stringify(next))
      } catch {}
    }
    try { localStorage.removeItem('gtl-active-profile') } catch {}
    router.replace('/fitness')
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
        設
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        <nav
          className="relative shrink-0 flex items-center justify-between pl-0 pr-8 pb-6"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
        >
          <RetreatButton href="/fitness/hub" />
        </nav>

        <section className="relative z-10 flex-1 flex flex-col px-8 pt-4 pb-12 max-w-3xl mx-auto w-full">
          <div className="mb-6 md:mb-12">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-16 bg-gtl-red" />
              <span className="font-matisse text-[10px] tracking-[0.3em] uppercase text-gtl-red">
                ENTRY POINT / 00
              </span>
            </div>
            <h1 className="font-matisse text-[5rem] md:text-[8rem] leading-[0.9] text-gtl-chalk -rotate-1">
              SETT
              <br />
              <span className="text-gtl-red gtl-headline-shadow-soft inline-block rotate-2">
                INGS
              </span>
            </h1>
            <p className="font-matisse text-xs tracking-[0.25em] uppercase text-gtl-ash mt-6 max-w-md">
              Tune the ritual. Audio, haptics, and the levers that hold your warrior's record.
            </p>
            {activeProfile && (
              <p className="font-matisse text-[10px] tracking-[0.3em] uppercase text-gtl-smoke mt-3">
                ACTIVE WARRIOR — <span className="text-gtl-chalk">{activeProfile}</span>
              </p>
            )}
          </div>

          {/* AUDIO */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-8 bg-gtl-edge" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">AUDIO</span>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
            <div className="flex flex-col gap-3">
              {ready && <VolumeSlider value={sfxVolume} onChange={handleSfxVolume} onPreview={previewSfx} />}
              {ready && (
                <div className="bg-gtl-surface border border-gtl-edge px-5 py-4" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk">BGM VOLUME</span>
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-gtl-red">{Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(bgmVolume * 100)}
                    onChange={(e) => handleBgmVolume(parseInt(e.target.value, 10) / 100)}
                    className="w-full accent-gtl-red py-3"
                    style={{ touchAction: 'pan-x' }}
                    aria-label="BGM volume"
                  />
                </div>
              )}
              {ready && <Toggle label="BACKGROUND MUSIC" value={bgMusicOn} onChange={handleBgMusic} />}
            </div>
          </div>

          {/* BGM TRACK — link to subpage so the giant track list doesn't
              dominate this page. */}
          {ready && (
            <div className="mb-8">
              <Link
                href="/settings/music"
                onClick={() => play('menu-open')}
                className="group w-full flex items-center justify-between gap-4 px-5 py-4 bg-gtl-surface border border-gtl-edge [@media(hover:hover)]:hover:border-gtl-red transition-colors duration-200 outline-none"
                style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}
              >
                <span className="flex flex-col items-start gap-1 min-w-0">
                  <span className="font-mono text-[11px] tracking-[0.3em] uppercase font-bold text-gtl-chalk [@media(hover:hover)]:group-hover:text-gtl-paper transition-colors duration-200">
                    BGM TRACK
                  </span>
                  {bgmTrackTitle && (
                    <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-gtl-ash">
                      {bgmTrackTitle}
                    </span>
                  )}
                </span>
                <span aria-hidden="true" className="font-display text-base leading-none text-gtl-red [@media(hover:hover)]:group-hover:text-gtl-paper transition-colors duration-200">
                  ➤︎
                </span>
              </Link>
            </div>
          )}

          {/* HAPTICS — only rendered on platforms that actually vibrate. iOS
              Safari / Chrome iOS PWA expose navigator.vibrate but it's a
              no-op there, so canVibrate() hides the toggle entirely rather
              than letting the user toggle a dead setting. */}
          {hapticsSupported && (
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-3">
                <div className="h-px w-8 bg-gtl-edge" />
                <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">HAPTICS</span>
                <div className="h-px flex-1 bg-gtl-edge" />
              </div>
              <Toggle label="VIBRATION" value={hapticsOn} onChange={handleHaptics} />
            </div>
          )}

          {/* WARRIOR DATA — R1a IPF GL inputs: bodyweight + sex. Profile-scoped via pk(). */}
          {ready && activeProfile && (
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-3">
                <div className="h-px w-8 bg-gtl-edge" />
                <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">WARRIOR DATA</span>
                <div className="h-px flex-1 bg-gtl-edge" />
              </div>
              <div className="flex flex-col gap-3">
                <NumberRow
                  label="BODY WEIGHT"
                  value={userBW}
                  unit="LBS"
                  onChange={handleBodyweight}
                  onCommit={commitBodyweight}
                  min={60}
                  max={500}
                  step={1}
                  placeholder="LBS"
                />
                <SexToggle value={userSex} onChange={handleSex} />
                <DateRow label="BIRTHDAY" value={userDOB} onChange={handleDOB} optional />
              </div>
            </div>
          )}

          {/* DEFAULTS — preferences-only reset. Doesn't touch profile data. */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-8 bg-gtl-edge" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">DEFAULTS</span>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
            {ready && (
              <DangerButton
                label="RESET TO DEFAULTS"
                armedLabel="TAP AGAIN — RESETS VOLUME / TRACK / TOGGLES"
                onConfirm={resetSettingsDefaults}
              />
            )}
          </div>

          {/* DANGER */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-8 bg-gtl-red" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-red">DANGER ZONE</span>
              <div className="h-px flex-1 bg-gtl-red" />
            </div>
            <p className="font-matisse text-[10px] tracking-[0.25em] uppercase text-gtl-ash mb-3">
              TAP ONCE TO ARM · TAP AGAIN TO CONFIRM
            </p>
            <div className="flex flex-col gap-3">
              <DangerButton
                label="RESET PROFILE DATA"
                armedLabel="TAP AGAIN — WIPES CYCLES + LOGS"
                onConfirm={resetActiveProfileData}
              />
              <DangerButton
                label="DELETE PROFILE"
                armedLabel="TAP AGAIN — REMOVES WARRIOR ENTIRELY"
                onConfirm={deleteActiveProfile}
              />
            </div>
            {!activeProfile && (
              <p className="font-matisse text-[9px] tracking-[0.3em] uppercase text-gtl-smoke mt-3">
                NO ACTIVE WARRIOR — RETURN TO IDENTITY
              </p>
            )}
          </div>

          {/* CREDITS */}
          <div className="mt-auto">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-px w-8 bg-gtl-edge" />
              <span className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">CREDITS</span>
              <div className="h-px flex-1 bg-gtl-edge" />
            </div>
            <div className="bg-gtl-surface border border-gtl-edge px-5 py-4" style={{ clipPath: 'polygon(2% 0%, 100% 0%, 98% 100%, 0% 100%)' }}>
              <p className="font-matisse text-2xl text-gtl-chalk leading-tight mb-2">GRITTED TEETH LIFESTYLE</p>
              <p className="font-matisse text-[10px] tracking-[0.25em] uppercase text-gtl-ash leading-relaxed">
                BUILT BY JORDAN HILLMAN<br />
                WITH ALEXANDER THUKU<br />
                INSPIRED BY PERSONA 5 + GURREN LAGANN<br />
                FORGED WITH GRITTED TEETH<br />
                EXERCISE DATA — WGER (CC-BY-SA 4.0)
              </p>
            </div>
          </div>

          {/* Decorative footer slash — same vocabulary as /fitness/hub. */}
          <div className="mt-12 flex items-center gap-4">
            <div className="h-px flex-1 bg-gtl-edge" />
            <div className="font-matisse text-[9px] tracking-[0.4em] uppercase text-gtl-smoke">
              GRITTED TEETH LIFESTYLE / SETTINGS
            </div>
            <div className="h-px flex-1 bg-gtl-edge" />
          </div>
        </section>
      </div>
    </main>
  )
}
