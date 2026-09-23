import { useMemo, useRef, useState } from 'react'
import { Cable, ChevronRight, Sun, Users, Zap } from 'lucide-react'
import VoiceOrb from './VoiceOrb'
import { speak, stopSpeaking } from '../lib/voice'
import { operator, tasks, briefing } from '../data/demo'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

function buildBeats() {
  const first = operator.name.split(' ')[0]
  const beats = [
    { speech: `Namaste, ${first}. Good morning.`, caption: `Namaste, ${first}.` },
    {
      speech: `You have ${tasks.length} tasks today, starting with ${tasks[0].title.toLowerCase()} at ${tasks[0].start}.`,
      caption: `${tasks.length} tasks today, starting at ${tasks[0].start}.`,
      chip: { icon: null, text: `${tasks.length} tasks today` },
    },
  ]
  briefing.forEach((b) => beats.push({ speech: b.text, caption: b.text, chip: { icon: ICONS[b.icon], text: b.text.split('.')[0] } }))
  beats.push({ speech: `Here's your full dashboard, with live time estimates for each task.`, caption: `Here's your dashboard.`, final: true })
  return beats
}

// Browsers block audio until a user gesture, so this opens in a "ready" state
// (orb idle, tap to begin) rather than autoplaying -- which also happens to
// match how ChatGPT's and Gemini's voice modes actually start.
export default function AssistantIntro({ onFinish }) {
  const beats = useMemo(buildBeats, [])
  const [phase, setPhase] = useState('ready') // ready | running
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const amplitude = useRef(0)
  const cancelled = useRef(false)

  const start = async () => {
    setPhase('running')
    for (let i = 0; i < beats.length; i++) {
      if (cancelled.current) return
      setIndex(i)
      setActive(true)
      await speak(beats[i].speech, { onAmplitude: (v) => { amplitude.current = v } })
      if (cancelled.current) return
      setActive(false)
      await new Promise((r) => setTimeout(r, beats[i].final ? 500 : 550))
    }
    if (!cancelled.current) onFinish()
  }

  const skip = () => { cancelled.current = true; stopSpeaking(); onFinish() }
  const seen = beats.slice(0, index).filter((b) => b.chip)

  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-page px-6">
      <button onClick={skip} className="absolute right-5 top-5 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ink3 transition hover:bg-black/5 hover:text-ink1">
        Skip to dashboard <ChevronRight size={13} />
      </button>

      <button onClick={phase === 'ready' ? start : undefined} className="flex flex-col items-center" style={{ cursor: phase === 'ready' ? 'pointer' : 'default' }}>
        <VoiceOrb active={active} amplitude={amplitude} size={128} />
      </button>

      {phase === 'ready' ? (
        <button onClick={start} className="mt-6 flex flex-col items-center gap-1">
          <div className="text-2xl font-semibold text-ink1">Tap to hear your briefing</div>
          <div className="text-sm text-ink3">{operator.name.split(' ')[0]} · {operator.site}</div>
        </button>
      ) : (
        <>
          <div key={index} className="mt-6 max-w-xl text-balance text-center text-2xl font-semibold text-ink1" style={{ animation: 'caption-in .4s ease' }}>
            {beats[index]?.caption}
          </div>
          <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            {seen.map((b, i) => {
              const Icon = b.chip.icon
              return (
                <span key={i} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-ink2 shadow-sm ring-1 ring-black/5" style={{ animation: 'chip-in .35s ease' }}>
                  {Icon && <Icon size={12} className="text-cat" />}{b.chip.text}
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
