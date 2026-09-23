import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { operator, idleBreakdown } from '@/data/demo'
import { IDLE_REASONS } from '@/lib/constants'

interface TipProps { active?: boolean; payload?: { name: string; value: number; color?: string; fill?: string; dataKey?: string }[]; label?: string; suffix?: string }
function ChartTooltip({ active, payload, label, suffix = '' }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] shadow-2">
      {label && <div className="mb-1 font-semibold text-fg">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2 text-fg-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.fill }} />
          {p.name} <b className="ml-auto pl-3 font-mono font-medium text-fg">{p.value}{suffix}</b>
        </div>
      ))}
    </div>
  )
}

export function WeeklyHoursChart() {
  const data = operator.weekHours.map((d) => ({ day: d.day, Regular: +(d.h - d.ot).toFixed(1), Overtime: +d.ot.toFixed(1) }))
  return (
    <figure>
      <div className="mb-3 flex items-center gap-4 text-[13px] text-fg-2" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-s1" />Regular</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-s2" />Overtime</span>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--fg-3)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-strong)' }} tickLine={false} />
            <YAxis tick={{ fill: 'var(--fg-3)', fontSize: 12 }} axisLine={false} tickLine={false} width={40} unit=" h" />
            <Tooltip content={<ChartTooltip suffix=" h" />} cursor={{ fill: 'var(--surface-3)' }} />
            <Bar dataKey="Regular" stackId="h" fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} maxBarSize={36} />
            <Bar dataKey="Overtime" stackId="h" fill="var(--s2)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-[13px] text-fg-3">From clock-in and engine data, not self-reported. Friday not yet worked.</figcaption>
    </figure>
  )
}

/** Sorted bars with direct labels: easier to compare than a donut, and never colour-alone. */
export function IdleReasonBars() {
  const byLabel: Record<string, (typeof IDLE_REASONS)[number]> = {
    'Waiting for truck': IDLE_REASONS[1], 'Heat rest': IDLE_REASONS[2], 'Warm-up': IDLE_REASONS[3],
    'Cool-down': IDLE_REASONS[4], 'No reason found': IDLE_REASONS[0],
  }
  const rows = [...idleBreakdown].sort((a, b) => b.pct - a.pct)
  const max = rows[0]?.pct ?? 1
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const meta = byLabel[r.reason]
        return (
          <li key={r.reason}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="flex items-center gap-2 text-fg-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} aria-hidden />
                {r.reason}
                {!meta.justified && <span className="font-mono text-[11px] text-critical-text">avoidable</span>}
              </span>
              <b className="font-mono font-medium text-fg">{r.pct}%</b>
            </div>
            <div className="h-2.5 rounded-sm bg-surface-3">
              <div className="h-full origin-left rounded-sm" style={{ width: `${(r.pct / max) * 100}%`, background: meta.color, animation: 'bar-in 600ms var(--ease-out) both' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
