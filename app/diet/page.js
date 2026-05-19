'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import RetreatButton from '../../components/RetreatButton'
import {
  logEntry, getAllEntries, deleteEntry, getDailyTotals, getWeekTotals, getMonthTotals, setGoals, getGoals
} from '../../lib/nutrition-storage'

function ProgressBar({ value, max, color = 'bg-red-600' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MacroRow({ label, value, target, unit = 'g', color = 'bg-red-600' }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#D4820A] font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-[#888]">{Math.round(value)}{unit} / {target}{unit}</span>
      </div>
      <ProgressBar value={value} max={target} color={color} />
    </div>
  )
}

const TABS = ['LOG FOOD', 'TODAY', 'WEEK/MONTH', 'GOALS']

export default function DietPage() {
  const [tab, setTab] = useState('LOG FOOD')

  // LOG FOOD state
  const [preview, setPreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // TODAY state
  const [todayTotals, setTodayTotals] = useState({ macros: {}, micros: {} })
  const [todayEntries, setTodayEntries] = useState([])

  // WEEK/MONTH state
  const [periodTab, setPeriodTab] = useState('WEEK')
  const [weekTotals, setWeekTotals] = useState({ macros: {}, micros: {} })
  const [monthTotals, setMonthTotals] = useState({ macros: {}, micros: {} })

  // GOALS state
  const [goals, setGoalsState] = useState({ weightLossPerMonth: 4, dailyCalories: 1800, protein: 150, carbs: 180, fat: 60 })
  const [saved, setSaved] = useState(false)

  function refreshData() {
    const today = new Date().toISOString().slice(0, 10)
    const dt = getDailyTotals(today)
    setTodayTotals(dt)
    setTodayEntries(getAllEntries().filter(e => e.timestamp && e.timestamp.startsWith(today)))
    setWeekTotals(getWeekTotals())
    setMonthTotals(getMonthTotals())
  }

  useEffect(() => {
    setGoalsState(getGoals())
    refreshData()
  }, [])

  // Photo capture
  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
  }

  async function analyzePhoto() {
    if (!imageFile) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('image', imageFile)
      const res = await fetch('/api/diet/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      setResult({ ...data, source: 'photo' })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Voice recording
  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          setLoading(true)
          try {
            const res = await fetch('/api/diet/voice', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, mimeType: 'audio/webm' }),
            })
            const data = await res.json()
            setResult({ ...data, source: 'voice' })
          } catch (err) {
            console.error(err)
          } finally {
            setLoading(false)
          }
        }
        reader.readAsDataURL(blob)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setResult(null)
      setPreview(null)
    } catch (err) {
      console.error(err)
    }
  }

  function handleLogMeal() {
    if (!result) return
    logEntry({
      source: result.source,
      foods: result.foods_detected || [],
      macros: result.macros || {},
      micros: result.micros || {},
      notes: result.transcript || '',
    })
    setResult(null)
    setPreview(null)
    setImageFile(null)
    refreshData()
    setTab('TODAY')
  }

  function handleDeleteEntry(id) {
    deleteEntry(id)
    refreshData()
  }

  function handleSaveGoals() {
    setGoals(goals)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const MICRO_TARGETS = { vitamin_c: 65, iron: 18, calcium: 1000 }

  return (
    <main className="min-h-screen bg-black text-white max-w-2xl mx-auto">
      <RetreatButton href="/" />
      <div className="px-6 pt-8 pb-4" style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 2.5rem))' }}>
        <h1 className="text-3xl font-black mb-1 tracking-tight">NUTRITION</h1>
        <p className="text-[#888] text-sm mb-6">Track meals by voice or photo</p>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[#2a2a2a] mb-6 px-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-bold py-2 px-3 mr-1 rounded-t-lg transition-colors ${
              tab === t ? 'bg-red-600 text-white' : 'text-[#888] hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-6 pb-16">

        {/* TAB 1: LOG FOOD */}
        {tab === 'LOG FOOD' && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center hover:border-red-600 transition-colors">
                  <div className="text-4xl mb-2">📷</div>
                  <div className="font-bold text-sm">TAKE PHOTO</div>
                </div>
              </label>

              <button onClick={toggleRecording}>
                <div className={`bg-[#1a1a1a] border rounded-xl p-6 text-center transition-colors ${
                  recording ? 'border-red-600 animate-pulse' : 'border-[#2a2a2a] hover:border-red-600'
                }`}>
                  <div className="text-4xl mb-2">🎙️</div>
                  <div className="font-bold text-sm">{recording ? 'STOP' : 'VOICE LOG'}</div>
                </div>
              </button>
            </div>

            {preview && (
              <div className="mb-4">
                <img src={preview} alt="Meal" className="rounded-xl w-full max-h-64 object-cover mb-3" />
                <button
                  onClick={analyzePhoto}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Analyzing...' : 'ANALYZE MEAL'}
                </button>
              </div>
            )}

            {loading && !preview && (
              <div className="text-center text-[#888] py-8">Processing audio...</div>
            )}

            {result && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                {result.transcript && (
                  <div className="mb-4">
                    <div className="text-xs text-[#D4820A] font-semibold uppercase mb-1">Transcript</div>
                    <p className="text-sm text-[#888] italic">"{result.transcript}"</p>
                  </div>
                )}

                {result.foods_detected?.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {result.foods_detected.map((f, i) => (
                      <span key={i} className="bg-[#2a2a2a] text-xs px-3 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                )}

                {result.macros && (
                  <div className="mb-4">
                    <div className="text-xs text-[#D4820A] font-semibold uppercase mb-2">Macros</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(result.macros).map(([k, v]) => (
                        <div key={k} className="bg-[#2a2a2a] rounded-lg p-3 text-center">
                          <div className="text-[#888] text-xs uppercase mb-1">{k}</div>
                          <div className="font-bold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.micros && (
                  <div className="mb-4">
                    <div className="text-xs text-[#D4820A] font-semibold uppercase mb-2">Micros</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(result.micros).map(([k, v]) => (
                        <div key={k} className="bg-[#2a2a2a] rounded-lg p-3 text-center">
                          <div className="text-[#888] text-xs uppercase mb-1">{k.replace('_', ' ')}</div>
                          <div className="font-bold">{v}mg</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.advice && (
                  <p className="text-sm text-[#888] mb-4 border-l-2 border-red-600 pl-3">{result.advice}</p>
                )}

                <button
                  onClick={handleLogMeal}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  LOG THIS MEAL
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TODAY */}
        {tab === 'TODAY' && (
          <div>
            <div className="text-xs text-[#D4820A] font-bold uppercase tracking-widest mb-4">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
              <div className="text-5xl font-black mb-1">{Math.round(todayTotals.macros?.calories || 0)}</div>
              <div className="text-[#888] text-sm mb-3">calories of {goals.dailyCalories} goal</div>
              <ProgressBar value={todayTotals.macros?.calories || 0} max={goals.dailyCalories} />
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
              <div className="text-xs text-[#D4820A] font-bold uppercase tracking-wide mb-3">Macros</div>
              <MacroRow label="Protein" value={todayTotals.macros?.protein || 0} target={goals.protein} />
              <MacroRow label="Carbs" value={todayTotals.macros?.carbs || 0} target={goals.carbs} color="bg-yellow-500" />
              <MacroRow label="Fat" value={todayTotals.macros?.fat || 0} target={goals.fat} color="bg-orange-500" />
              <MacroRow label="Fiber" value={todayTotals.macros?.fiber || 0} target={30} color="bg-green-600" />
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
              <div className="text-xs text-[#D4820A] font-bold uppercase tracking-wide mb-3">Micros</div>
              <MacroRow label="Vitamin C" value={todayTotals.micros?.vitamin_c || 0} target={MICRO_TARGETS.vitamin_c} unit="mg" color="bg-yellow-400" />
              <MacroRow label="Iron" value={todayTotals.micros?.iron || 0} target={MICRO_TARGETS.iron} unit="mg" color="bg-red-800" />
              <MacroRow label="Calcium" value={todayTotals.micros?.calcium || 0} target={MICRO_TARGETS.calcium} unit="mg" color="bg-blue-500" />
            </div>

            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="text-xs text-[#D4820A] font-bold uppercase tracking-wide mb-3">Meal Log</div>
              {todayEntries.length === 0 && (
                <p className="text-[#888] text-sm">No meals logged today.</p>
              )}
              {todayEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between py-3 border-b border-[#2a2a2a] last:border-0">
                  <div>
                    <div className="text-sm font-semibold">{(e.foods || []).join(', ') || 'Meal'}</div>
                    <div className="text-xs text-[#888]">
                      {e.macros?.calories || 0} kcal · {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(e.id)}
                    className="text-[#888] hover:text-red-500 text-lg ml-4"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: WEEK/MONTH */}
        {tab === 'WEEK/MONTH' && (
          <div>
            <div className="flex mb-6">
              {['WEEK', 'MONTH'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodTab(p)}
                  className={`text-sm font-bold py-2 px-5 rounded-lg mr-2 transition-colors ${
                    periodTab === p ? 'bg-red-600 text-white' : 'bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]'
                  }`}
                >
                  THIS {p}
                </button>
              ))}
            </div>

            {(() => {
              const t = periodTab === 'WEEK' ? weekTotals : monthTotals
              const mult = periodTab === 'WEEK' ? 7 : 30
              return (
                <>
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
                    <div className="text-5xl font-black mb-1">{Math.round(t.macros?.calories || 0)}</div>
                    <div className="text-[#888] text-sm">total calories</div>
                  </div>

                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
                    <div className="text-xs text-[#D4820A] font-bold uppercase tracking-wide mb-3">Macros</div>
                    <MacroRow label="Protein" value={t.macros?.protein || 0} target={goals.protein * mult} />
                    <MacroRow label="Carbs" value={t.macros?.carbs || 0} target={goals.carbs * mult} color="bg-yellow-500" />
                    <MacroRow label="Fat" value={t.macros?.fat || 0} target={goals.fat * mult} color="bg-orange-500" />
                    <MacroRow label="Fiber" value={t.macros?.fiber || 0} target={30 * mult} color="bg-green-600" />
                  </div>

                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                    <div className="text-xs text-[#D4820A] font-bold uppercase tracking-wide mb-3">Micros</div>
                    <MacroRow label="Vitamin C" value={t.micros?.vitamin_c || 0} target={MICRO_TARGETS.vitamin_c * mult} unit="mg" color="bg-yellow-400" />
                    <MacroRow label="Iron" value={t.micros?.iron || 0} target={MICRO_TARGETS.iron * mult} unit="mg" color="bg-red-800" />
                    <MacroRow label="Calcium" value={t.micros?.calcium || 0} target={MICRO_TARGETS.calcium * mult} unit="mg" color="bg-blue-500" />
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* TAB 4: GOALS */}
        {tab === 'GOALS' && (
          <div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-4">
              <div className="text-xs text-[#888] mb-4">1 lb fat = 3,500 cal · 4 lbs/month = ~500 cal/day deficit</div>
              {[
                { key: 'weightLossPerMonth', label: 'Target Weight Loss', unit: 'lbs/month' },
                { key: 'dailyCalories', label: 'Daily Calories', unit: 'kcal' },
                { key: 'protein', label: 'Protein', unit: 'g/day' },
                { key: 'carbs', label: 'Carbs', unit: 'g/day' },
                { key: 'fat', label: 'Fat', unit: 'g/day' },
              ].map(({ key, label, unit }) => (
                <div key={key} className="mb-4">
                  <label className="block text-xs text-[#D4820A] font-semibold uppercase tracking-wide mb-1">
                    {label} <span className="text-[#888] normal-case">{unit}</span>
                  </label>
                  <input
                    type="number"
                    value={goals[key] || ''}
                    onChange={e => setGoalsState(g => ({ ...g, [key]: Number(e.target.value) }))}
                    className="w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-red-600"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveGoals}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors"
            >
              {saved ? 'SAVED!' : 'SAVE GOALS'}
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
