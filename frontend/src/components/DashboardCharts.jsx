import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { operator, idleBreakdown } from '../data/demo'

const SERIES = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100', magenta: '#e87ba4' }
const INK2 = '#52514e'
const INK3 = '#898781'
const GRID = '#e1e0d9'

function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-ink1 px-2.5 py-1.5 text-xs text-white shadow-lg">
      {label && <div className="mb-0.5 font-semibold">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: {p.value}{suffix}
        </div>
      ))}
    </div>
  )
}

export function WeeklyHoursChart() {
  const data = operator.weekHours.map((d) => ({ day: d.day, Regular: +(d.h - d.ot).toFixed(1), Overtime: +d.ot.toFixed(1) }))
  return (
    <div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap="28%" margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: INK3, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fill: INK3, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<ChartTooltip suffix=" h" />} cursor={{ fill: '#0b0b0b0a' }} />
          <Bar dataKey="Regular" stackId="h" fill={SERIES.blue} radius={[0, 0, 4, 4]} stroke="#fff" strokeWidth={2} maxBarSize={28} />
          <Bar dataKey="Overtime" stackId="h" fill={SERIES.orange} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={2} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-ink3">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES.blue }} />Regular</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SERIES.orange }} />Overtime</span>
      </div>
    </div>
  )
}

export function IdleReasonDonut() {
  const order = ['blue', 'orange', 'aqua', 'yellow', 'magenta']
  const data = idleBreakdown.map((d, i) => ({ name: d.reason, value: d.pct, color: SERIES[order[i]] }))
  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width={104} height={104}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={48} paddingAngle={2} startAngle={90} endAngle={-270}>
            {data.map((d) => <Cell key={d.name} fill={d.color} stroke="#fff" strokeWidth={2} />)}
          </Pie>
          <Tooltip content={<ChartTooltip suffix="%" />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="min-w-0 flex-1 space-y-1 text-[11px]">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-1.5 text-ink2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="truncate">{d.name}</span>
            <span className="ml-auto shrink-0 font-semibold text-ink1">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
