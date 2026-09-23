import { useState } from 'react'
import { ChevronDown, FlaskConical, RotateCcw, Square, Volume2 } from 'lucide-react'
import type { Skill, Soil, Task, TaskInput, Weather } from '@/types'
import { useTaskPrediction } from '@/hooks/queries'
import { speak, stopSpeaking } from '@/lib/voice'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/controls'
import { ModelStatus, type Tone } from '@/components/ui/status'

const WEATHER: Weather[] = ['Sunny', 'Cloudy', 'Rainy', 'Windy']
const SKILL: Skill[] = ['Beginner', 'Intermediate', 'Expert']
const SOIL: Soil[] = ['Sand', 'Loam', 'Clay', 'Rock']

/** P10–P90 band, P50 tick and the planner's number on one scale. */
function RangeBar({ p10, p50, p90, planner }: { p10: number; p50: number; p90: number; planner: number }) {
  const max = Math.max(p90, planner) * 1.12
  const pct = (v: number) => `${(v / max) * 100}%`
  return (
    <div className="relative mt-3 mb-1 h-10" role="img"
      aria-label={`Likely ${p50} minutes, range ${p10} to ${p90}. Planner estimated ${planner}.`}>
      {/* planner marker, labelled above */}
      <div className="absolute top-0 -translate-x-1/2 font-mono text-[10.5px] whitespace-nowrap text-fg-3" style={{ left: pct(planner) }}>plan {planner}</div>
      <div className="absolute top-3.5 h-5 w-0 -translate-x-1/2 border-l border-dashed border-fg-3" style={{ left: pct(planner) }} />
      {/* track + band + P50 */}
      <div className="absolute top-[21px] h-1 w-full rounded-full bg-surface-3" />
      <div className="absolute top-[18px] h-2.5 rounded-full bg-s1/25 ring-1 ring-s1/40 transition-[left,width] duration-300 ease-out"
        style={{ left: pct(p10), width: `calc(${pct(p90)} - ${pct(p10)})` }} />
      <div className="absolute top-[14px] h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-s1 ring-2 ring-surface transition-[left] duration-300 ease-out" style={{ left: pct(p50) }} />
      <div className="absolute top-[34px] -translate-x-1/2 font-mono text-[10.5px] text-fg-3" style={{ left: pct(p10) }}>{p10}</div>
      <div className="absolute top-[34px] -translate-x-1/2 font-mono text-[10.5px] text-fg-3" style={{ left: pct(p90) }}>{p90}</div>
    </div>
  )
}

/** One plain sentence per reason: what it is and what it costs, never a label on the operator. */
function reasonText(r: { factor: string; value: string; minutes: number }) {
  const m = `${Math.round(r.minutes)} min`
  const v = r.value.toLowerCase()
  switch (r.factor.toLowerCase()) {
    case 'soil': return `${r.value} soil adds ${m}`
    case 'weather': return `${{ rainy: 'Rain', windy: 'Wind', cloudy: 'Cloud cover', sunny: 'Sun' }[v] ?? r.value} adds ${m}`
    case 'operator skill': return `Experience level adds ${m}`
    case 'machine age': return `A ${r.value}-year-old machine adds ${m}`
    case 'heat': return `Heat adds ${m}`
    default: return `${r.factor} adds ${m}`
  }
}

function planTone(p50: number, planner: number): Tone {
  const over = (p50 - planner) / planner
  if (over > 0.15) return 'serious'
  if (over > 0) return 'warning'
  return 'good'
}

export function TaskEstimate({ task }: { task: Task }) {
  const [override, setOverride] = useState<Partial<TaskInput>>({})
  const [open, setOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const whatIf = Object.keys(override).length > 0
  const { data: p, isFetching } = useTaskPrediction(task, override)
  if (!p) return null

  const setField = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setOverride((o) => {
    const next = { ...o, [k]: v }
    if (v === task.input[k]) delete next[k]
    return next
  })

  const narrate = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const top = p.reasons[0]
    const why = top ? `, mainly because of ${top.factor.toLowerCase()}: ${top.value}` : ''
    setSpeaking(true)
    speak(`${task.title}. Likely ${p.p50} minutes${why}. The planner estimated ${p.planner_estimate}.`).finally(() => setSpeaking(false))
  }

  const delta = p.p50 - p.planner_estimate
  const value = <K extends keyof TaskInput>(k: K) => (override[k] ?? task.input[k]) as TaskInput[K]
  const top = p.reasons[0]
  const tone = planTone(p.p50, p.planner_estimate)

  return (
    <li className={cn('border-t border-border first:border-t-0', whatIf && '-mx-3 rounded-md bg-brand-soft/60 px-3')}>
      {/* collapsed: when, what, how long, and the one reason that matters */}
      <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}
        className="grid w-full grid-cols-[56px_1fr_auto_20px] items-center gap-x-4 py-4 text-left sm:grid-cols-[64px_1fr_auto_20px]">
        <span className="font-mono text-[15px] font-medium text-fg">{task.start}</span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] leading-snug font-semibold text-fg">{task.title}</span>
          <span className="mt-0.5 block truncate text-sm text-fg-3">
            {top ? reasonText(top) : `Zone ${task.zone}`}
            {task.note && <> · {task.note}</>}
          </span>
        </span>
        <span className="text-right">
          <span className={cn('block font-display text-[30px] leading-none font-semibold text-fg transition-opacity', isFetching && 'opacity-50')}>
            {p.p50}<span className="ml-1 text-base font-medium text-fg-3">min</span>
          </span>
          <span className={cn('mt-0.5 block font-mono text-[11.5px]', tone === 'good' ? 'text-good-text' : tone === 'serious' ? 'text-serious-text' : 'text-fg-3')}>
            {delta > 0 ? `${delta} over plan` : delta < 0 ? `${-delta} under plan` : 'on plan'}
          </span>
        </span>
        <ChevronDown size={18} className={cn('text-fg-3 transition-transform duration-200', expanded && 'rotate-180')} aria-hidden />
      </button>

      {expanded && (
        <div className="pb-5 sm:pl-[80px]" style={{ animation: 'var(--animate-enter)' }}>
          <div className="text-sm text-fg-2">Zone {task.zone} · {task.input.task_type} · {task.input.volume_m3} m³ · likely {p.p10}–{p.p90} min</div>
          <RangeBar p10={p.p10} p50={p.p50} p90={p.p90} planner={p.planner_estimate} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.reasons.map((r) => (
              <span key={r.factor} className="inline-flex h-7 items-center gap-1 rounded-sm bg-surface-3 px-2 text-[13px] text-fg-2">
                <b className="font-mono font-medium text-fg">{r.minutes > 0 ? '+' : ''}{r.minutes} min</b> {r.factor.toLowerCase()}: {r.value}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={speaking ? 'primary' : 'secondary'} onClick={narrate}>
              {speaking ? <Square size={14} /> : <Volume2 size={15} />} {speaking ? 'Stop' : 'Read aloud'}
            </Button>
            <Button size="sm" variant={open ? 'inverse' : 'secondary'} onClick={() => setOpen(!open)} aria-expanded={open}>
              <FlaskConical size={14} /> What if
            </Button>
            <ModelStatus live={p.live} className="ml-auto" />
          </div>
          {open && (
            <div className="mt-3 rounded-md border border-border bg-surface p-3" style={{ animation: 'var(--animate-enter)' }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg">What if conditions change?</span>
                {whatIf && <Button size="sm" variant="ghost" onClick={() => setOverride({})}><RotateCcw size={14} /> Reset</Button>}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                <Segmented label="Weather" value={value('weather')} options={WEATHER} onChange={(v) => setField('weather', v)} />
                <Segmented label="Skill" value={value('operator_skill')} options={SKILL} onChange={(v) => setField('operator_skill', v)} />
                <Segmented label="Soil" value={value('soil')} options={SOIL} onChange={(v) => setField('soil', v)} />
              </div>
              {p.offline && <p className="mt-3 text-[13px] text-serious-text">What-if needs the ML API. Showing the cached baseline.</p>}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
