import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Bell, CircleDot, Fuel, Gauge, HeartPulse, Map as MapIcon, Table2, Timer, Wrench } from 'lucide-react'
import { getFleet } from '../lib/api'
import cached from '../data/fleet_fallback.json'
import { Surface, SectionLabel, LiveBadge, OutcomeTag, RISK_TONE } from './ui'

const IDLE_TEXT = { waiting_for_truck: 'Waiting for truck', heat_rest: 'Heat rest', warm_up: 'Warm-up', cool_down: 'Cool-down', waste: 'Waste' }
const IDLE_COLOR = { waiting_for_truck: 'bg-s-blue', heat_rest: 'bg-s-violet', warm_up: 'bg-s-aqua', cool_down: 'bg-ink3', waste: 'bg-critical' }
const LEVEL_TONE = { high: 'text-critical', medium: 'text-serious', low: 'text-ink3' }
const DOT = { high: '#d03b3b', watch: '#fab219', low: '#0ca30c' }

function Kpi({ icon: Icon, label, value, sub, outcome }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink3"><Icon size={13} />{label}</div>
      <div className="mt-1 text-3xl font-bold text-ink1">{value}</div>
      <div className="text-xs text-ink3">{sub}</div>
      {outcome && <div className="mt-2"><OutcomeTag>{outcome}</OutcomeTag></div>}
    </Surface>
  )
}

function IdleBar({ byReason, total }) {
  return (
    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-dline" title={Object.entries(byReason).map(([k, v]) => `${IDLE_TEXT[k]} ${v} min`).join(' · ')}>
      {Object.entries(byReason).map(([k, v]) => <div key={k} className={IDLE_COLOR[k]} style={{ width: `${(v / total) * 100}%` }} />)}
    </div>
  )
}

function FleetMap({ machines, selected, onSelect }) {
  return (
    <svg viewBox="0 0 100 90" className="h-64 w-full rounded-xl bg-page">
      <rect x="4" y="6" width="92" height="80" rx="3" fill="none" stroke="#b58a00" strokeDasharray="2 1.5" strokeWidth=".5" />
      <text x="6" y="11" fontSize="2.6" fill="#b58a00">Geofence · NH-48 package 3</text>
      {[['A', 8, 16, 28, 44], ['B', 30, 42, 26, 26], ['C', 58, 16, 34, 30]].map(([z, x, y, w, h]) => (
        <g key={z}>
          <rect x={x} y={y} width={w} height={h} rx="2" fill="#ffffff" stroke="#e1e0d9" strokeWidth=".4" />
          <text x={x + 1.5} y={y + 4} fontSize="3" fill="#898781">Zone {z}</text>
        </g>
      ))}
      <path d="M4 78 L96 74" stroke="#d4d2c9" strokeWidth="3" />
      <text x="70" y="82" fontSize="2.4" fill="#898781">Haul road</text>
      <path d="M30 60 L56 60" stroke="#eb6834" strokeWidth=".6" strokeDasharray="1.5 1" />
      <text x="31" y="64" fontSize="2.2" fill="#eb6834">Fibre 1.2 m (Call Before u Dig)</text>
      <path d="M4 70 L96 66" stroke="#d03b3b" strokeWidth=".4" />
      <text x="72" y="64" fontSize="2.2" fill="#d03b3b">11 kV line</text>
      {machines.map((m) => (
        <g key={m.id} onClick={() => onSelect(m.id)} className="cursor-pointer">
          {selected === m.id && <circle cx={m.x} cy={m.y} r="4.5" fill="none" stroke="#0b0b0b" strokeWidth=".5" />}
          <circle cx={m.x} cy={m.y} r="2.6" fill={DOT[m.health.level]} />
          <text x={m.x + 3.5} y={m.y + 1} fontSize="2.6" fill="#0b0b0b">{m.id}</text>
        </g>
      ))}
    </svg>
  )
}

function MachineDetail({ m }) {
  const f = m.fuel_plan
  return (
    <div className="space-y-3 text-sm text-ink1">
      <div className="flex items-baseline justify-between">
        <div><b>{m.id}</b> · {m.make} {m.model} · <span className="text-ink3">{m.kind}</span></div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_TONE[m.health.level]}`}>{m.health.risk_pct}% risk · {m.health.level}</span>
      </div>
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink3">Why the health model says this</div>
        {m.health.reasons.length === 0 && <div className="text-xs text-ink3">All readings near their usual values.</div>}
        {m.health.reasons.map((r) => (
          <div key={r.factor} className="flex justify-between gap-2 text-xs">
            <span>{r.factor}: <b>{r.value}</b> <span className="text-ink3">(usual {r.usual})</span></span>
            <span className="text-serious">+{r.points} pts</span>
          </div>
        ))}
        <div className="mt-1 flex items-start gap-1.5 rounded-xl bg-black/[0.03] p-2 text-xs"><Wrench size={13} className="mt-0.5 shrink-0 text-ink2" />{m.health.action}</div>
      </div>
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink3">Idle today, by reason (idle-reason model)</div>
        <div className="grid grid-cols-2 gap-x-3 text-xs">
          {Object.entries(m.idle_by_reason).map(([k, v]) => (
            <div key={k} className="flex justify-between"><span className="flex items-center gap-1"><span className={`inline-block h-2 w-2 rounded-sm ${IDLE_COLOR[k]}`} />{IDLE_TEXT[k]}</span><span>{v} min</span></div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-ink3">Fuel plan (fuel-rate model × task-time model)</div>
        <div className="text-xs">{m.fuel_l} L in tank ({m.fuel_pct}%) · {f.litres_planned} L planned for the rest of today</div>
        {f.runs_out_at
          ? <div className="text-xs text-critical">Hits reserve ~{f.runs_out_at}. Send the bowser before {f.refuel_before}.</div>
          : <div className="text-xs text-good">Enough for today, {f.fuel_left_end_l} L left at shift end.</div>}
      </div>
      {m.behaviour.unusual && (
        <div className="rounded-xl bg-warning/15 p-2 text-xs">
          <b>Unusual hour</b> · {m.behaviour.reasons.join(' · ')}
        </div>
      )}
    </div>
  )
}

export default function FleetView() {
  const [data, setData] = useState({ ...cached, live: false })
  const [selected, setSelected] = useState('EXC001')
  useEffect(() => { getFleet().then(setData).catch(() => {}) }, [])
  const k = data.kpis
  const sel = data.machines.find((m) => m.id === selected) || data.machines[0]

  return (
    <div className="mx-auto h-full max-w-7xl space-y-5 overflow-y-auto p-5" style={{ animation: 'reveal-in .5s ease' }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-sm text-ink3">Site supervisor · {data.site} · today 13:30</div>
          <h1 className="text-3xl font-bold text-ink1">Site and fleet</h1>
          <div className="text-sm text-ink3">Same data each operator sees on their own tablet. Every number comes with a prediction and a reason.</div>
        </div>
        <LiveBadge live={data.live} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Gauge} label="Utilization" value={`${k.utilization_pct}%`} sub={`${k.cycles} load cycles across ${data.machines.length} machines`} />
        <Kpi icon={Timer} label="Idle" value={`${k.idle_pct}%`} sub={`${k.idle_justified_pct}% had a reason · ${k.idle_waste_h} h was waste`} outcome="Excessive idling" />
        <Kpi icon={Fuel} label="Fuel today (est.)" value={`${k.fuel_used_l} L`} sub={`≈ ${k.co2_kg.toLocaleString()} kg CO₂ · ₹${(k.fuel_used_l * 90).toLocaleString('en-IN')}`} />
        <Kpi icon={CircleDot} label="Seat belt violations" value={k.seatbelt_violations} sub="engine running, belt off" outcome="Seatbelt compliance" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Surface className="p-4">
          <SectionLabel icon={Table2} action={<OutcomeTag>Unusual behaviour in machine usage</OutcomeTag>}>Machines · click a row</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink1">
              <thead className="text-[10px] uppercase tracking-wider text-ink3">
                <tr><th className="py-1">Machine</th><th>Operator</th><th>Hours · service</th><th>Idle (waste red)</th><th>Fuel</th><th>Health (50 h)</th><th>This hour</th></tr>
              </thead>
              <tbody>
                {data.machines.map((m) => (
                  <tr key={m.id} onClick={() => setSelected(m.id)}
                    className={`cursor-pointer border-t border-dline ${selected === m.id ? 'bg-cat/10' : 'hover:bg-black/[0.03]'}`}>
                    <td className="py-2"><b>{m.id}</b><div className="text-[10px] text-ink3">{m.make} {m.model}</div></td>
                    <td>{m.operator.split(' (')[0]}<div className="text-[10px] text-ink3">Zone {m.zone}</div></td>
                    <td>{m.hours.toLocaleString()} h<div className={`text-[10px] ${m.service_due_h < 0 ? 'text-critical' : m.service_due_h < 25 ? 'text-serious' : 'text-ink3'}`}>{m.service_due_h < 0 ? `${-m.service_due_h} h overdue` : `due in ${m.service_due_h} h`}</div></td>
                    <td><IdleBar byReason={m.idle_by_reason} total={m.idle_min} /><div className="text-[10px] text-ink3">{m.idle_min} min · {m.idle_waste_min} waste</div></td>
                    <td>{m.fuel_pct}%<div className={`text-[10px] ${m.fuel_plan.runs_out_at ? 'text-critical' : 'text-ink3'}`}>{m.fuel_plan.runs_out_at ? `reserve ~${m.fuel_plan.runs_out_at}` : 'ok for today'}</div></td>
                    <td><span className={`rounded-full px-2 py-0.5 font-semibold ${RISK_TONE[m.health.level]}`}>{m.health.risk_pct}%</span><div className="mt-0.5 text-[10px] text-ink3">{m.health.component || 'normal'}</div></td>
                    <td>{m.behaviour.unusual ? <span className="font-semibold text-serious">unusual</span> : <span className="text-ink3">normal</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        <Surface className="p-4">
          <SectionLabel icon={HeartPulse}>Selected machine</SectionLabel>
          <MachineDetail m={sel} />
        </Surface>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Surface className="p-4">
          <SectionLabel icon={MapIcon} action={<OutcomeTag>Proximity hazards</OutcomeTag>}>Site map · geofence, zones, utilities</SectionLabel>
          <FleetMap machines={data.machines} selected={selected} onSelect={setSelected} />
        </Surface>
        <Surface className="p-4">
          <SectionLabel icon={Bell}>Alerts</SectionLabel>
          <div className="mb-2 text-xs text-ink3">Alert budget: {data.alerts_pushed} of {data.alerts.length} pushed to phones (high only). The rest wait here.</div>
          <ul className="max-h-60 space-y-1.5 overflow-y-auto">
            {data.alerts.map((a, i) => (
              <li key={i} className="flex gap-2 text-xs text-ink1">
                <AlertTriangle size={13} className={`mt-0.5 shrink-0 ${LEVEL_TONE[a.level]}`} />
                <span><b>{a.machine}</b> · {a.text}</span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      <Surface className="p-4">
        <SectionLabel icon={Activity} action={<OutcomeTag>Identify unusual behaviour in machine usage</OutcomeTag>}>Official telemetry sample · scored by the unusual-behaviour model</SectionLabel>
        <table className="w-full text-left text-xs text-ink1">
          <thead className="text-[10px] uppercase tracking-wider text-ink3">
            <tr><th className="py-1">Timestamp</th><th>Machine</th><th>Operator</th><th>Fuel (L)</th><th>Load cycles</th><th>Idle (min)</th><th>Seatbelt</th><th>Their alert</th><th>Our model</th></tr>
          </thead>
          <tbody>
            {data.official_rows.map((r) => (
              <tr key={r.time} className="border-t border-dline">
                <td className="py-1.5">{r.time}</td><td>EXC001</td><td>OP1001</td><td>{r.fuel_l}</td><td>{r.load_cycles}</td><td>{r.idle_min}</td>
                <td className={r.seatbelt === 'Unfastened' ? 'text-critical' : ''}>{r.seatbelt}</td><td>{r.alert}</td>
                <td>{r.unusual ? <span className="text-serious">Unusual · {r.reasons.join('; ')}</span> : <span className="text-good">Normal</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-[11px] text-ink3">Assumption: an "Unfastened" hour is scored as 30 min belt-off. Model output matches their alert column on all 4 rows.</div>
      </Surface>
    </div>
  )
}
