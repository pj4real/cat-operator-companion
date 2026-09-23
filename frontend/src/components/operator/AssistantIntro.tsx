import { useMemo, useRef, useState } from 'react'
import { Cable, ChevronRight, ListChecks, Sun, Users, Zap, type LucideIcon } from 'lucide-react'
import { speak, stopSpeaking } from '@/lib/voice'
import { operator, tasks, briefing } from '@/data/demo'
import { firstName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/shared/Brand'
import VoiceOrb from './VoiceOrb'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

interface Beat { speech: string; caption: string; chip?: { icon: LucideIcon; text: string }; final?: boolean }

function buildBeats(): Beat[] {
  const first = firstName(operator.name)
  const beats: Beat[] = [
    { speech: `Namaste, ${first}. Good morning.`, caption: `Namaste, ${first}.` },
    {
      speech: `You have ${tasks.length} tasks today, starting with ${tasks[0].title.toLowerCase()} at ${tasks[0].start}.`,
      caption: `${tasks.length} tasks today, starting at ${tasks[0].start}.`,
      chip: { icon: ListChecks, text: `${tasks.length} tasks today` },
    },
  ]
  briefing.forEach((b) => beats.push({ speech: b.text, caption: b.text, chip: { icon: ICONS[b.icon], text: b.text.split('.')[0] } }))
  beats.push({ speech: `Here's your full dashboard, with live time estimates for each task.`, caption: `Here's your dashboard.`, final: true })
  return beats
}

/**
 * Spoken pre-shift briefing. Browsers block audio until a user gesture, so it opens
 * ready (tap to begin) rather than autoplaying. A rare, once-a-day moment, so it is
 * allowed more motion than the working screens.
 */
export function AssistantIntro({ onFinish }: { onFinish: () => void }) {
  const beats = useMemo(buildBeats, [])
  const [phase, setPhase] = useState<'ready' | 'running'>('ready')
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
      await new Promise((r) => setTimeout(r, 550))
    }
    if (!cancelled.current) onFinish()
  }

  const skip = () => { cancelled.current = true; stopSpeaking(); onFinish() }
  const seen = beats.slice(0, index + (phase === 'running' ? 1 : 0)).filter((b) => b.chip)

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-8">
        <Wordmark />
        <Button variant="ghost" onClick={skip}>Skip to dashboard <ChevronRight size={16} /></Button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <div className="label-caps mb-6 text-fg-3">Pre-shift briefing · {operator.shift}</div>
        <button onClick={phase === 'ready' ? start : undefined} aria-label="Start the voice briefing"
          className={cn('rounded-full', phase === 'ready' ? 'cursor-pointer' : 'cursor-default')} tabIndex={phase === 'ready' ? 0 : -1}>
          <VoiceOrb active={active} amplitude={amplitude} size={148} />
        </button>

        {phase === 'ready' ? (
          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            <h1 className="font-display text-[40px] leading-tight font-bold text-fg">Tap to hear your briefing</h1>
            <p className="text-fg-3">{firstName(operator.name)} · {operator.site} · about 40 seconds</p>
            <Button variant="primary" size="lg" onClick={start} className="mt-2 min-w-56">Start briefing</Button>
          </div>
        ) : (
          <>
            <p key={index} aria-live="polite"
              className="mt-8 max-w-3xl text-center font-display text-[32px] leading-tight font-semibold text-balance text-fg md:text-[40px]"
              style={{ animation: 'var(--animate-enter)' }}>
              {beats[index]?.caption}
            </p>
            <div className="mt-8 flex gap-1.5" aria-hidden>
              {beats.map((_, i) => (
                <span key={i} className={cn('h-1 w-8 rounded-full transition-colors duration-300', i <= index ? 'bg-fg' : 'bg-border-strong')} />
              ))}
            </div>
            <ul className="mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2">
              {seen.map((b, i) => {
                const Icon = b.chip!.icon
                return (
                  <li key={i} className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg-2 shadow-1"
                    style={{ animation: 'var(--animate-enter)' }}>
                    <Icon size={15} className="text-fg" aria-hidden />{b.chip!.text}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
