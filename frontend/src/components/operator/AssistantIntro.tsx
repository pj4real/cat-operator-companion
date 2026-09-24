import { useEffect, useMemo, useRef, useState } from 'react'
import { Cable, ChevronRight, Compass, ListChecks, Play, Sun, Users, Zap, type LucideIcon } from 'lucide-react'
import { speak, stopSpeaking } from '@/lib/voice'
import { operator, tasks, briefing } from '@/data/demo'
import { useInsights } from '@/hooks/queries'
import type { Insight } from '@/types'
import { cn, firstName } from '@/lib/utils'
import { BriefingOrb } from './BriefingOrb'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

interface Beat { speech: string; caption: string; chip?: { icon: LucideIcon; text: string } }

function buildBeats(copilot: Insight[]): Beat[] {
  const first = firstName(operator.name)
  const beats: Beat[] = [
    { speech: `Namaste, ${first}. Good morning.`, caption: `Namaste, ${first}.` },
    {
      speech: `You have ${tasks.length} tasks today, starting with ${tasks[0].title.toLowerCase()} at ${tasks[0].start}.`,
      caption: `${tasks.length} tasks today, starting at ${tasks[0].start}.`,
      chip: { icon: ListChecks, text: `${tasks.length} tasks today` },
    },
  ]
  // the Shift Copilot's top 3 come first: the few things that matter, not everything
  const top = copilot.filter((i) => i.kind !== 'well_done').slice(0, 3)
  if (top.length) {
    beats.push({ speech: `${top.length} things first.`, caption: `${top.length} things first.` })
    top.forEach((i) => beats.push({ speech: `${i.title}. ${i.why}.`, caption: i.title, chip: { icon: Compass, text: i.title } }))
  }
  briefing.forEach((b) => beats.push({ speech: b.text, caption: b.text, chip: { icon: ICONS[b.icon], text: b.text.split('.')[0] } }))
  beats.push({ speech: `Here's your full dashboard, with live time estimates for each task.`, caption: `Have a safe shift.` })
  return beats
}

// Night → morning: the room goes through a blue hour and a pale sky rather than a flat grey fade.
const SKY: [number, number[]][] = [[0, [6, 8, 12]], [0.4, [22, 30, 52]], [0.72, [196, 208, 224]], [1, [242, 242, 239]]]
const ORB: [number, number[]][] = [[0, [255, 255, 255]], [0.5, [214, 226, 255]], [1, [23, 55, 140]]]
const LIGHT_INK = [236, 239, 243]
const DARK_INK = [18, 19, 20]
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const ramp = (stops: [number, number[]][], t: number) => {
  const i = Math.max(1, stops.findIndex(([at]) => at >= t))
  const [a0, c0] = stops[i - 1], [a1, c1] = stops[i]
  return mix(c0, c1, Math.min(Math.max((t - a0) / (a1 - a0), 0), 1))
}
// relative luminance: the text flips ink as soon as the room is bright enough, so it never fades into it
const lum = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const rgb = (c: number[], a = 1) => (a === 1 ? `rgb(${c.join(',')})` : `rgba(${c.join(',')},${a})`)

/** Eases a number toward its target over `ms`, re-rendering on each frame while it moves. */
function useTween(target: number, ms = 2200) {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const k = Math.min((now - start) / ms, 1)
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 // easeInOutCubic: a slow sunrise
      const v = a + (target - a) * e
      from.current = v
      setValue(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

/** Words blur into focus one after another (after React Bits' BlurText). */
function BlurText({ text, className, delay = 0, step = 70 }: { text: string; className?: string; delay?: number; step?: number }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden className="inline-block whitespace-pre"
          style={{ animation: `blur-in 900ms var(--ease-out) ${delay + i * step}ms both` }}>
          {w}{' '}
        </span>
      ))}
    </span>
  )
}

/** Slow, staggered fade for the quiet first moment of the day. */
const rise = (delay: number) => ({ animation: `rise-in 1400ms var(--ease-out) ${delay}ms both` })

/**
 * Spoken pre-shift briefing: the first thing Ravi sees when he picks up the tablet in the morning.
 * Opens dark with a white orb; each briefing point brightens the room until it is day and the orb has
 * turned deep blue, then it fades into the (light) dashboard. Browsers block audio until a user gesture,
 * so it waits for a tap rather than autoplaying.
 */
export function AssistantIntro({ onFinish }: { onFinish: () => void }) {
  const { data } = useInsights('07:00')
  const beats = useMemo(() => buildBeats(data?.insights ?? []), [data])
  const [phase, setPhase] = useState<'ready' | 'running' | 'leaving'>('ready')
  const [index, setIndex] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const amplitude = useRef(0)
  const orbWrap = useRef<HTMLDivElement>(null)
  const cancelled = useRef(false)

  // 0 = night, 1 = morning. Advances with each spoken point.
  const target = phase === 'ready' ? 0 : phase === 'leaving' ? 1 : Math.min(index / (beats.length - 1), 1)
  const t = useTween(target)
  const bg = ramp(SKY, t)
  const bright = lum(bg) > 0.45
  const fg = bright ? DARK_INK : LIGHT_INK
  const orb = ramp(ORB, t)

  // the orb breathes with the voice (a ref + rAF, so no re-render per frame)
  useEffect(() => {
    let raf = 0, s = 1
    const tick = () => {
      s += (1 + amplitude.current * 0.18 - s) * 0.18
      if (orbWrap.current) orbWrap.current.style.transform = `scale(${s.toFixed(3)})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // reset on (re)mount: StrictMode mounts, unmounts and remounts in development
  useEffect(() => {
    cancelled.current = false
    return () => { cancelled.current = true; stopSpeaking(); document.documentElement.style.background = '' }
  }, [])

  const start = async () => {
    setPhase('running')
    await new Promise((r) => setTimeout(r, 700))
    for (let i = 0; i < beats.length; i++) {
      if (cancelled.current) return
      setIndex(i)
      setSpeaking(true)
      // watchdog: if audio never reports it ended, move on after the line's natural length
      await Promise.race([
        speak(beats[i].speech, { onAmplitude: (v) => { amplitude.current = v } }),
        new Promise((r) => setTimeout(r, 2500 + beats[i].speech.length * 75)),
      ])
      amplitude.current = 0
      if (cancelled.current) return
      setSpeaking(false)
      await new Promise((r) => setTimeout(r, 650))
    }
    if (cancelled.current) return
    setPhase('leaving')
    setTimeout(() => { if (!cancelled.current) onFinish() }, 1400)
  }

  const skip = () => { cancelled.current = true; stopSpeaking(); onFinish() }
  const chips = beats.slice(0, index + 1).filter((b) => b.chip)
  const muted = rgb(fg, 0.55)

  return (
    <div className="relative flex h-full flex-col overflow-hidden transition-[color] duration-700" style={{ background: rgb(bg), color: rgb(fg) }}>
      {/* first light: a soft glow around the orb that warms as the room brightens */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(60% 55% at 50% 42%, ${rgb(orb, 0.10 + 0.06 * t)} 0%, ${rgb(bg, 0)} 70%)` }} />

      <header className="relative z-10 flex h-16 items-center justify-between px-5 md:px-8" style={rise(200)}>
        <span className="font-mono text-xs tracking-wide" style={{ color: muted }}>06:40 · WED 23 SEP</span>
        <button onClick={skip} className="flex h-10 items-center gap-1 rounded-full px-3 text-sm transition-opacity hover:opacity-100"
          style={{ color: muted }}>
          Skip <ChevronRight size={15} />
        </button>
      </header>

      <main className={cn('relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-20 transition-opacity duration-[1200ms]',
        phase === 'leaving' && 'opacity-0')}>
        <button onClick={phase === 'ready' ? start : undefined} tabIndex={phase === 'ready' ? 0 : -1}
          aria-label="Start the voice briefing" className={cn('rounded-full', phase === 'ready' ? 'cursor-pointer' : 'cursor-default')}
          style={rise(600)}>
          <div ref={orbWrap} className="will-change-transform">
            <div style={{ width: 176, height: 176, display: 'grid', placeItems: 'center' }}>
              <BriefingOrb color={orb} speed={speaking ? 1.25 : 0.22} darkBackground={!bright}
                label={speaking ? 'Speaking' : 'Briefing assistant'} />
            </div>
          </div>
        </button>

        {phase === 'ready' ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <h1 className="font-display text-[44px] leading-tight font-semibold tracking-tight">
              <BlurText text={`Good morning, ${firstName(operator.name)}`} delay={1300} step={110} />
            </h1>
            <p className="mt-3 text-[17px]" style={{ ...rise(2100), color: muted }}>
              Your shift starts at 07:00. Your briefing takes about 40 seconds.
            </p>
            <button onClick={start} style={{ ...rise(2700), borderColor: rgb(fg, 0.22), background: rgb(fg, 0.06) }}
              className="mt-10 flex h-12 items-center gap-2.5 rounded-full border px-6 text-[15px] font-medium backdrop-blur-sm transition-[background-color,transform] duration-200 hover:bg-white/10 active:scale-[0.97]">
              <Play size={15} fill="currentColor" aria-hidden /> Start briefing
            </button>
          </div>
        ) : (
          <>
            <p key={index} aria-live="polite" className="mt-10 min-h-[2.6em] max-w-3xl text-center font-display text-[30px] leading-snug font-medium text-balance md:text-[38px]">
              <BlurText text={beats[index]?.caption ?? ''} step={55} />
            </p>
            <div className="mt-8 flex gap-1.5" aria-hidden>
              {beats.map((_, i) => (
                <span key={i} className="h-1 w-6 rounded-full transition-colors duration-700"
                  style={{ background: i <= index ? rgb(fg, 0.85) : rgb(fg, 0.15) }} />
              ))}
            </div>
            <ul className="mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-2">
              {chips.map((b, i) => {
                const Icon = b.chip!.icon
                return (
                  <li key={i} className="flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm"
                    style={{ ...rise(0), borderColor: rgb(fg, 0.14), background: rgb(fg, 0.04), color: rgb(fg, 0.8) }}>
                    <Icon size={15} aria-hidden />{b.chip!.text}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </main>

      <footer className="relative z-10 pb-6 text-center font-display text-[11px] font-semibold tracking-[0.18em] uppercase"
        style={{ ...rise(3200), color: rgb(fg, 0.3) }}>
        Operator Companion · {operator.site}
      </footer>
    </div>
  )
}
