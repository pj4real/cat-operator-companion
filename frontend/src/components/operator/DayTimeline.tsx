import { Armchair, Mic, OctagonAlert, Power, ShieldAlert, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DayMark, DayState, TimelineItem } from '@/types'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/controls'

type Seg = Extract<TimelineItem, { kind: 'seg' }>
type Mark = Extract<TimelineItem, { kind: 'mark' }>

// Chart slots per DESIGN.md: work = s1, avoidable idle = s8 (the idle-waste colour everywhere),
// justified waits recede, engine-off is the good outcome, halted is a status (critical, hatched).
const STATE: Record<DayState, { label: string; cls: string }> = {
  working: { label: 'Working', cls: 'bg-s1' },
  waiting: { label: 'Waiting for truck', cls: 'bg-border-strong' },
  idle: { label: 'Avoidable idle', cls: 'bg-s8' },
  off: { label: 'Engine off', cls: 'bg-good' },
  halted: { label: 'Halted by interlock', cls: 'bg-critical hatch' },
}
const ORDER: DayState[] = ['working', 'waiting', 'idle', 'off', 'halted']

const MARK: Record<DayMark, { icon: LucideIcon; label: string; tone: string; rank: number }> = {
  worker: { icon: UserRound, label: 'Worker in swing radius', tone: 'text-critical-text', rank: 5 },
  restart_guard: { icon: ShieldAlert, label: 'Restart guard', tone: 'text-critical-text', rank: 4 },
  critical: { icon: OctagonAlert, label: 'Critical', tone: 'text-critical-text', rank: 3 },
  near_miss: { icon: Mic, label: 'Near-miss report', tone: 'text-warning-text', rank: 2 },
  belt_off: { icon: Armchair, label: 'Seatbelt off', tone: 'text-warning-text', rank: 1 },
  engine_off: { icon: Power, label: 'Switched off', tone: 'text-good-text', rank: 0 },
}

/** Site minutes after 09:00 → "09:42" */
const clock = (m: number) => {
  const t = Math.floor(m)
  return `${String(9 + Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
const mins = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.max(Math.round(m), m > 0 ? 1 : 0)} min`)

/** Horizontal strip of the docked session: state segments, event markers above, site-time ticks below. */
export function DayTimeline({ timeline }: { timeline: TimelineItem[] }) {
  // strip width in px, so marker merging and tick spacing hold on a phone as well as a desktop
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || 800))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const px = (p: number) => (p / 100) * width

  const segs = timeline.filter((i): i is Seg => i.kind === 'seg')
  const marks = timeline.filter((i): i is Mark => i.kind === 'mark').sort((a, b) => a.at - b.at)
  const start = segs[0]?.start ?? 0
  const end = Math.max(start + 5, ...segs.map((s) => s.end), ...marks.map((m) => m.at))
  const span = end - start
  const pct = (m: number) => ((m - start) / span) * 100

  // ticks: the smallest round step whose labels (~40 px each) don't crowd, so a 40-minute demo
  // and an 8-hour shift both read; no tick too close to the start and end labels
  const maxTicks = Math.max(2, Math.min(6, Math.floor(width / 90)))
  const step = [5, 10, 15, 20, 30, 60, 120].find((s) => span / s <= maxTicks) ?? 240
  const ticks: number[] = []
  for (let m = Math.ceil(start / step) * step; m < end; m += step) if (px(pct(m)) > 48 && width - px(pct(m)) > 48) ticks.push(m)

  // markers closer than one marker width merge into one, showing the most severe icon and a count
  const clusters: Mark[][] = []
  for (const m of marks) {
    const last = clusters.at(-1)
    if (last && px(pct(m.at) - pct(last[0].at)) < 32) last.push(m)
    else clusters.push([m])
  }

  const totals = ORDER.map((s) => [s, segs.filter((g) => g.state === s).reduce((a, g) => a + g.end - g.start, 0)] as const)
    .filter(([, m]) => m > 0.05)
  const alt = totals.map(([s, m]) => `${STATE[s].label} ${mins(m)}`).join(', ')

  return (
    <div ref={ref}>
      {/* event markers */}
      <div className="relative h-9">
        {clusters.map((c) => {
          const top = [...c].sort((a, b) => MARK[b.mark].rank - MARK[a.mark].rank)[0]
          const { icon: Icon, tone } = MARK[top.mark]
          const label = c.map((m) => `${clock(m.at)} ${MARK[m.mark].label}: ${m.text}`).join('; ')
          return (
            <Tooltip key={`${top.mark}-${c[0].at}`} content={
              <ul className="space-y-0.5">
                {c.map((m) => <li key={`${m.mark}-${m.at}`}><span className="font-mono opacity-70">{clock(m.at)}</span> {m.text}</li>)}
              </ul>
            }>
              <button type="button" aria-label={label}
                className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${Math.min(Math.max(pct(c[0].at), 1), 99)}%` }}>
                <span className={cn('relative flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-surface shadow-1', tone)}>
                  <Icon size={14} strokeWidth={2.4} aria-hidden />
                  {c.length > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fg px-1 font-mono text-[10px] leading-none text-bg">{c.length}</span>
                  )}
                </span>
                <span className="h-2 w-px bg-border-strong" aria-hidden />
              </button>
            </Tooltip>
          )
        })}
      </div>

      {/* state strip */}
      <div className="relative h-6 overflow-hidden rounded-sm bg-surface-2 ring-1 ring-border ring-inset" role="img"
        aria-label={`Docked ${clock(start)} to ${clock(end)}: ${alt}`}>
        {segs.map((g) => (
          <Tooltip key={`${g.state}-${g.start}`} content={<><span className="font-mono">{clock(g.start)}–{clock(g.end)}</span> · {STATE[g.state].label} · {mins(g.end - g.start)}</>}>
            <div className={cn('absolute inset-y-0 border-r border-surface', STATE[g.state].cls)}
              style={{ left: `${pct(g.start)}%`, width: `max(3px, ${pct(g.end) - pct(g.start)}%)` }} />
          </Tooltip>
        ))}
      </div>

      {/* site-time ticks */}
      <div className="relative mt-1 h-4 font-mono text-[11px] text-fg-3 tabular">
        <span className="absolute left-0">{clock(start)}</span>
        {ticks.map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pct(m)}%` }}>{clock(m)}</span>
        ))}
        <span className="absolute right-0">{clock(end)}</span>
      </div>

      {/* legend with direct values: colour is never the only cue */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-fg-2">
        {totals.map(([s, m]) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn('h-2.5 w-2.5 rounded-[2px]', STATE[s].cls)} aria-hidden />
            {STATE[s].label} <span className="font-mono text-fg-3">{mins(m)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
