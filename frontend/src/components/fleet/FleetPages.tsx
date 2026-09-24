import { Bell, ChevronRight, CircleDot, Fuel, Gauge, HeartPulse, Map as MapIcon, TableProperties, Timer, TriangleAlert, Wrench } from 'lucide-react'
import { useFleet } from '@/hooks/queries'
import { useApp } from '@/store/app'
import { cn, inr } from '@/lib/utils'
import type { FleetData, FleetMachine, RiskLevel3 } from '@/types'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { SiteCopilot } from './SiteCopilot'
import { Kpi } from '@/components/ui/kpi'
import { EmptyState } from '@/components/ui/controls'
import { MachineThumb } from '@/components/ui/machine-thumb'
import { ModelStatus, StatusBadge, type Tone } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'
import { TelemetryTable } from '@/components/shared/TelemetryTable'
import { IDLE_REASONS, RISK } from '@/lib/constants'

const RISK3: Record<RiskLevel3, { tone: Tone; label: string }> = {
  safe: { tone: 'good', label: 'Safe' }, caution: { tone: 'warning', label: 'Caution' }, critical: { tone: 'critical', label: 'Critical' },
}
const ALERT_TONE: Record<string, Tone> = { high: 'critical', medium: 'serious', low: 'neutral' }

function IdleStack({ m, className }: { m: FleetMachine; className?: string }) {
  const total = Math.max(m.idle_min, 1)
  return (
    <div className={cn('flex h-2.5 overflow-hidden rounded-sm bg-surface-3', className)} role="img"
      aria-label={IDLE_REASONS.map((r) => `${r.label} ${m.idle_by_reason[r.key] ?? 0} min`).join(', ')}>
      {IDLE_REASONS.map((r) => {
        const v = m.idle_by_reason[r.key] ?? 0
        return v > 0 ? <div key={r.key} className="border-r-2 border-surface last:border-r-0" style={{ width: `${(v / total) * 100}%`, background: r.color }} /> : null
      })}
    </div>
  )
}

function IdleLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-fg-2">
      {IDLE_REASONS.map((r) => (
        <span key={r.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />{r.label}</span>
      ))}
    </div>
  )
}

function MachinesTable({ data }: { data: FleetData }) {
  const { selectedMachine, selectMachine, highlight } = useApp()
  return (
    <div className="max-h-[520px] overflow-auto scrollbar-thin rounded-md border border-border">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="label-caps text-fg-3">
            <th scope="col" className="px-3 py-2.5">Machine</th>
            <th scope="col" className="px-3 py-2.5">Operator</th>
            <th scope="col" className="px-3 py-2.5 text-right">Hours</th>
            <th scope="col" className="px-3 py-2.5">Idle by reason</th>
            <th scope="col" className="px-3 py-2.5">Fuel</th>
            <th scope="col" className="px-3 py-2.5">Health · 50 h</th>
            <th scope="col" className="px-3 py-2.5">Risk now</th>
            <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {data.machines.map((m) => {
            const on = selectedMachine === m.id
            const named = highlight.includes(m.id)
            return (
              <tr key={m.id} onClick={() => selectMachine(m.id)} aria-selected={on}
                className={cn('cursor-pointer border-t border-border transition-colors', on ? 'bg-brand-soft/70' : named ? 'bg-brand-soft/35' : 'hover:bg-surface-2',
                  named && 'shadow-[inset_4px_0_0_var(--brand)]')}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <MachineThumb kind={m.kind} size="sm" />
                    <div>
                      <div className="font-mono font-medium text-fg">{m.id}</div>
                      <div className="text-xs text-fg-3">{m.make} {m.model} · {m.kind.split(' (')[0]}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-fg">{m.operator.split(' (')[0]}</div>
                  <div className="text-xs text-fg-3">Zone {m.zone}</div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="font-mono text-fg tabular">{m.hours.toLocaleString('en-IN')}</div>
                  <div className={cn('text-xs', m.service_due_h < 0 ? 'font-medium text-critical-text' : m.service_due_h < 25 ? 'text-serious-text' : 'text-fg-3')}>
                    {m.service_due_h < 0 ? `service ${-m.service_due_h} h overdue` : `service in ${m.service_due_h} h`}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <IdleStack m={m} className="w-32" />
                  <div className="mt-1 font-mono text-xs text-fg-3">{m.idle_min} min · <span className="text-critical-text">{m.idle_waste_min} waste</span></div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-mono text-fg">{m.fuel_pct}%</div>
                  <div className={cn('text-xs', m.fuel_plan.runs_out_at ? 'font-medium text-critical-text' : 'text-fg-3')}>
                    {m.fuel_plan.runs_out_at ? `reserve ~${m.fuel_plan.runs_out_at}` : 'ok for today'}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge tone={RISK[m.health.level].tone} size="sm">{m.health.risk_pct}% · {RISK[m.health.level].label}</StatusBadge>
                  <div className="mt-1 max-w-40 truncate text-xs text-fg-3">{m.health.component || 'normal'}</div>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge tone={RISK3[m.risk.level].tone} size="sm">{RISK3[m.risk.level].label}</StatusBadge>
                  <div className="mt-1 max-w-48 truncate text-xs text-fg-3" title={m.risk.reason}>{m.risk.reason}</div>
                </td>
                <td className="px-2 py-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); selectMachine(m.id) }} aria-label={`View ${m.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MachineDetail({ m }: { m: FleetMachine }) {
  const f = m.fuel_plan
  return (
    <div className="space-y-5 text-sm">
      <MachineThumb kind={m.kind} size="hero" className="h-44 w-full" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[28px] leading-none font-bold text-fg">{m.id}</div>
          <div className="mt-1 text-fg-3">{m.make} {m.model} · {m.kind}</div>
          <div className="text-fg-3">{m.operator}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[34px] leading-none font-semibold text-fg">{m.health.risk_pct}%</div>
          <StatusBadge tone={RISK[m.health.level].tone} size="sm" className="mt-1">{RISK[m.health.level].label} risk</StatusBadge>
        </div>
      </div>

      <section className={cn('rounded-md border p-3', m.risk.level === 'critical' ? 'border-critical bg-critical-soft' : m.risk.level === 'caution' ? 'border-warning/60 bg-warning-soft' : 'border-border bg-surface-2')}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="label-caps text-fg-3">Risk now</h3>
          <StatusBadge tone={RISK3[m.risk.level].tone} size="sm">{RISK3[m.risk.level].label}</StatusBadge>
        </div>
        <p className="mt-1 font-medium text-fg">{m.risk.reason}</p>
        {m.twin.reasons.length > 0 && (
          <>
            <h4 className="label-caps mt-3 mb-1 text-fg-3">Vs this operator's own usual</h4>
            <ul className="space-y-0.5 text-fg-2">{m.twin.reasons.slice(0, 3).map((r) => <li key={r}>· {r}</li>)}</ul>
          </>
        )}
      </section>

      <section>
        <h3 className="label-caps mb-2 text-fg-3">Why the health model says this</h3>
        {m.health.reasons.length === 0 && <p className="text-fg-3">All readings near their usual values.</p>}
        <ul className="space-y-1.5">
          {m.health.reasons.map((r) => (
            <li key={r.factor} className="flex justify-between gap-3">
              <span className="text-fg-2">{r.factor}: <b className="font-mono font-medium text-fg">{r.value}</b> <span className="text-fg-3">(usual {r.usual})</span></span>
              <span className="font-mono text-serious-text">+{r.points} pts</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-border bg-surface-2 p-2.5 text-fg">
          <Wrench size={15} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />{m.health.action}
        </div>
      </section>

      <section>
        <h3 className="label-caps mb-2 text-fg-3">Idle today, by reason</h3>
        <IdleStack m={m} className="h-3" />
        <dl className="mt-2 space-y-1">
          {IDLE_REASONS.map((r) => (
            <div key={r.key} className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-fg-2"><span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />{r.label}</dt>
              <dd className="font-mono text-fg">{m.idle_by_reason[r.key] ?? 0} min</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="label-caps mb-2 text-fg-3">Fuel plan</h3>
        <p className="text-fg-2">{m.fuel_l} L in tank ({m.fuel_pct}%) · {f.litres_planned} L planned for the rest of today</p>
        {f.runs_out_at
          ? <StatusBadge tone="critical" className="mt-2">Hits reserve ~{f.runs_out_at}. Send the bowser before {f.refuel_before}.</StatusBadge>
          : <StatusBadge tone="good" className="mt-2">Enough for today, {f.fuel_left_end_l} L left at shift end</StatusBadge>}
      </section>

    </div>
  )
}

function FleetMap({ data }: { data: FleetData }) {
  const { selectedMachine, selectMachine, highlight } = useApp()
  const DOT: Record<string, string> = { high: 'var(--critical)', watch: 'var(--warning)', low: 'var(--good)' }
  return (
    <svg viewBox="0 0 100 90" className="w-full rounded-md border border-border bg-surface-2" role="img" aria-label="Site map with machine positions coloured by health risk">
      <rect x="4" y="6" width="92" height="80" rx="2" fill="none" stroke="var(--fg-3)" strokeDasharray="2 1.5" strokeWidth=".4" />
      <text x="6" y="11" fontSize="2.6" fill="var(--fg-3)" fontFamily="var(--font-mono)">Geofence · NH-48 package 3</text>
      {([['A', 8, 16, 28, 44], ['B', 30, 42, 26, 26], ['C', 58, 16, 34, 30]] as const).map(([z, x, y, w, h]) => (
        <g key={z}>
          <rect x={x} y={y} width={w} height={h} rx="1.5" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth=".35" />
          <text x={x + 1.5} y={y + 4} fontSize="2.8" fill="var(--fg-3)" fontWeight="600">Zone {z}</text>
        </g>
      ))}
      <path d="M4 78 L96 74" stroke="var(--border-strong)" strokeWidth="3" />
      <text x="72" y="82.5" fontSize="2.4" fill="var(--fg-3)">Haul road</text>
      <path d="M30 60 L56 60" stroke="var(--serious)" strokeWidth=".6" strokeDasharray="1.5 1" />
      <text x="31" y="64" fontSize="2.2" fill="var(--serious-text)" fontFamily="var(--font-mono)">Fibre 1.2 m</text>
      <path d="M4 70 L96 66" stroke="var(--critical)" strokeWidth=".4" />
      <text x="76" y="64.5" fontSize="2.2" fill="var(--critical-text)" fontFamily="var(--font-mono)">11 kV line</text>
      {data.machines.map((m) => (
        <g key={m.id} onClick={() => selectMachine(m.id)} className="cursor-pointer" role="button" aria-label={`Select ${m.id}`}>
          <circle cx={m.x} cy={m.y} r="6" fill="transparent" />
          {highlight.includes(m.id) && <circle cx={m.x} cy={m.y} r="5.6" fill="none" stroke="var(--brand)" strokeWidth=".9" strokeDasharray="1.4 .9" />}
          {selectedMachine === m.id && <circle cx={m.x} cy={m.y} r="4.4" fill="none" stroke="var(--fg)" strokeWidth=".6" />}
          <circle cx={m.x} cy={m.y} r="2.5" fill={DOT[m.health.level]} stroke="var(--surface)" strokeWidth=".6" />
          <text x={m.x + 3.6} y={m.y + 1} fontSize="2.6" fill="var(--fg)" fontFamily="var(--font-mono)" fontWeight="500">{m.id}</text>
        </g>
      ))}
    </svg>
  )
}

export function FleetOverviewPage() {
  const { data } = useFleet()
  const { selectedMachine, siteDetailsOpen, setSiteDetailsOpen } = useApp()
  if (!data) return null
  const k = data.kpis
  const sel = data.machines.find((m) => m.id === selectedMachine) ?? data.machines[0]
  const highAlerts = data.alerts.filter((a) => a.level === 'high').length

  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow={`SITE SUPERVISOR · TODAY 13:30`} title="Site overview"
        meta={<>
          <span>{data.site}</span><span className="text-fg-3">·</span><span>{data.machines.length} machines, mixed fleet</span>
          {data.machines.some((m) => m.risk.level === 'critical') && (
            <StatusBadge tone="critical">{data.machines.filter((m) => m.risk.level === 'critical').length} critical now</StatusBadge>
          )}
          <ModelStatus live={data.live} />
        </>} />

      <SiteCopilot />

      <div id="site-details" className="scroll-mt-4">
        <Disclosure title="Site details" hint="KPIs, machines, map and every alert" open={siteDetailsOpen} onOpenChange={setSiteDetailsOpen}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={Gauge} label="Utilization" value={k.utilization_pct} unit="%" sub={`${k.cycles} load cycles today`} />
            <Kpi icon={Timer} label="Idle" value={k.idle_pct} unit="%" sub={`${k.idle_justified_pct}% had a reason · ${k.idle_waste_h} h waste`} outcome="Excessive idling" />
            <Kpi icon={Fuel} label="Fuel today · est." value={k.fuel_used_l} unit="L" sub={`≈ ${k.co2_kg.toLocaleString('en-IN')} kg CO₂ · ${inr(k.fuel_used_l * 90)}`} />
            <Kpi icon={CircleDot} label="Seatbelt violations" value={k.seatbelt_violations} valueClassName={k.seatbelt_violations ? 'text-serious-text' : undefined}
              sub="engine running, belt off" outcome="Seatbelt compliance" />
          </div>

          <Card className="min-w-0">
            <CardHeader icon={TableProperties} title="Machines" description="Select a row for the reason behind each number" outcomes={['Identify unusual behaviour in machine usage']} />
            <CardBody className="space-y-3">
              <MachinesTable data={data} />
              <IdleLegend />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            <Card>
              <CardHeader icon={HeartPulse} title="Selected machine" />
              <CardBody><MachineDetail m={sel} /></CardBody>
            </Card>
            <Card>
              <CardHeader icon={MapIcon} title="Site map" description="Dot colour = health risk · select to inspect" outcomes={['Proximity hazards']} />
              <CardBody><FleetMap data={data} /></CardBody>
            </Card>
            <Card id="alerts" className="lg:col-span-2 2xl:col-span-1">
              <CardHeader icon={Bell} title="Alerts"
                description={`Alert budget: ${data.alerts_pushed} of ${data.alerts.length} pushed to phones (high only). The rest wait here.`}
                actions={highAlerts > 0 ? <StatusBadge tone="critical" size="sm">{highAlerts} high</StatusBadge> : undefined} />
              <CardBody>
                {data.alerts.length === 0 ? <EmptyState icon={Bell} title="No alerts">Nothing needs attention on site right now.</EmptyState> : (
                  <ul className="max-h-[520px] divide-y divide-border overflow-y-auto scrollbar-thin">
                    {data.alerts.map((a, i) => (
                      <li key={i} className="flex gap-3 py-2.5 text-sm first:pt-0">
                        <StatusBadge tone={ALERT_TONE[a.level]} size="sm" icon={TriangleAlert} className="w-[84px] shrink-0 justify-center capitalize">{a.level}</StatusBadge>
                        <span className="min-w-0 text-fg-2"><b className="font-mono font-medium text-fg">{a.machine}</b> · {a.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </Disclosure>
      </div>
    </div>
  )
}

export function TelemetryAuditPage() {
  const { data } = useFleet()
  if (!data) return null
  const agree = data.official_rows.filter((r) => r.twin_unusual === (r.alert === 'Yes')).length
  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow="EXC001 · OP1001 · 2025-05-01 → 05-02" title="Telemetry audit"
        meta={<>The official sample from the brief, scored against OP1001's digital twin: his own usual on EXC001, not a site-wide rule. <ModelStatus live={data.live} /></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Rows scored" value={data.official_rows.length} sub="hourly telemetry" />
        <Kpi label="Flagged unusual" value={data.official_rows.filter((r) => r.twin_unusual).length} sub="by Ravi's twin" valueClassName="text-serious-text" />
        <Kpi label="Agreement" value={`${agree}/${data.official_rows.length}`} sub="with the brief's alert column" valueClassName="text-good-text" />
        <Kpi label="Belt-off rows" value={data.official_rows.filter((r) => r.seatbelt === 'Unfastened').length} sub="all during long, low-work idles" outcome="Seatbelt compliance" />
      </div>
      <Card>
        <CardHeader icon={TableProperties} title="Official telemetry sample" outcomes={['Identify unusual behaviour in machine usage']} />
        <CardBody>
          <TelemetryTable rows={data.official_rows.map((r) => ({ time: r.time, fuel: r.fuel_l, cycles: r.load_cycles, idle: r.idle_min, belt: r.seatbelt, alert: r.alert, unusual: r.twin_unusual, reasons: r.twin_reasons }))} />
          <p className="mt-3 text-[13px] text-fg-3">The site-wide isolation forest agrees on {data.official_rows.filter((r) => r.unusual === r.twin_unusual).length} of {data.official_rows.length} rows. Assumption: an “Unfastened” hour is scored as 30 min belt-off. Unbuckling appears only in the high-idle, low-work hours, which is why the docked display has a restart guard.</p>
        </CardBody>
      </Card>
    </div>
  )
}
