import { useEffect, useState } from 'react'
import { Cable, Zap, Users, Sun, PlugZap, GraduationCap, BadgeCheck, Clock, PlayCircle, CheckCircle2, Activity, HeartPulse, Fuel, Wrench, FlaskConical, ClipboardCheck } from 'lucide-react'
import { operator, machine, tasks, briefing, lessons } from '../data/demo'
import { predictTask, predictHealth, forecastFuel } from '../lib/api'
import { DIESEL_INR } from '../lib/sim'
import { Card, LiveBadge, RISK_TONE } from './ui'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }
const WHAT_IF = {
  weather: ['Sunny', 'Cloudy', 'Rainy', 'Windy'],
  operator_skill: ['Beginner', 'Intermediate', 'Expert'],
  soil: ['Sand', 'Loam', 'Clay', 'Rock'],
}

function RangeBar({ p10, p50, p90, planner }) {
  const max = Math.max(p90, planner) * 1.15
  const pct = (v) => `${(v / max) * 100}%`
  return (
    <div className="relative mt-2 h-6">
      <div className="absolute top-2.5 h-1 w-full rounded bg-line" />
      <div className="absolute top-1.5 h-3 rounded bg-cat/30" style={{ left: pct(p10), width: `calc(${pct(p90)} - ${pct(p10)})` }} />
      <div className="absolute top-0.5 h-5 w-1 rounded bg-cat" style={{ left: pct(p50) }} />
      <div className="absolute top-1 h-4 w-0.5 bg-muted" style={{ left: pct(planner) }} title="planner estimate" />
    </div>
  )
}

function TaskRow({ task }) {
  const [pred, setPred] = useState(null)
  const [override, setOverride] = useState({})
  const [open, setOpen] = useState(false)
  const whatIf = Object.keys(override).length > 0
  useEffect(() => {
    predictTask({ ...task.input, ...override })
      .then(setPred)
      .catch(() => setPred(whatIf ? { ...task.fallback, planner_estimate: task.input.planner_estimate_min, live: false, offline: true }
        : { ...task.fallback, planner_estimate: task.input.planner_estimate_min, live: false }))
  }, [task, override, whatIf])
  const p = pred || { ...task.fallback, planner_estimate: task.input.planner_estimate_min }
  const setField = (k, v) => setOverride((o) => {
    const next = { ...o, [k]: v }
    if (v === task.input[k]) delete next[k]
    return next
  })
  return (
    <div className={`rounded-xl border bg-black/20 p-3 ${whatIf ? 'border-cat/50' : 'border-line'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{task.title}</div>
          <div className="text-xs text-muted">{task.start} · Zone {task.zone}{task.note ? ` · ${task.note}` : ''}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-cat">{p.p50} min</div>
          <div className="text-[11px] text-muted">likely {p.p10}–{p.p90} · planner said {p.planner_estimate}</div>
        </div>
      </div>
      <RangeBar p10={p.p10} p50={p.p50} p90={p.p90} planner={p.planner_estimate} />
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {(p.reasons || []).map((r) => (
          <span key={r.factor} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
            {r.minutes > 0 ? '+' : ''}{r.minutes} min · {r.factor}: {r.value}
          </span>
        ))}
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-white">
          <FlaskConical size={11} /> What if
        </button>
        <span className="ml-auto"><LiveBadge live={pred?.live} /></span>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {Object.entries(WHAT_IF).map(([k, opts]) => (
            <select key={k} value={override[k] ?? task.input[k]} onChange={(e) => setField(k, e.target.value)}
              className="rounded-md border border-line bg-black/40 px-1.5 py-1">
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
          {whatIf && <button onClick={() => setOverride({})} className="text-muted underline">reset</button>}
          {pred?.offline && <span className="text-warn">What-if needs the ML API running</span>}
        </div>
      )}
    </div>
  )
}

function HealthCard() {
  const [h, setH] = useState(null)
  useEffect(() => {
    predictHealth(machine.healthDay).then(setH).catch(() => setH({ ...machine.healthFallback, live: false }))
  }, [])
  const x = h || machine.healthFallback
  return (
    <Card title={`Machine health before you start · ${machine.id}`} icon={HeartPulse}>
      <div className="flex items-center justify-between">
        <div className="text-sm">Failure risk, next 50 engine hours</div>
        <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${RISK_TONE[x.level]}`}>{x.risk_pct}% · {x.level}</span>
      </div>
      {x.reasons.map((r) => (
        <div key={r.factor} className="mt-1 text-xs text-muted">{r.factor} <b className="text-white">{r.value}</b> (usual {r.usual}) · +{r.points} pts</div>
      ))}
      <div className="mt-2 flex items-start gap-2 rounded-lg bg-black/30 p-2 text-sm">
        <ClipboardCheck size={16} className="mt-0.5 shrink-0 text-cat" />
        <span>Walkaround, first item today: {x.action.toLowerCase()}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
        <span className="flex items-center gap-1"><Wrench size={11} /> Service due in {machine.serviceDueIn} h · from S·O·S oil sample + sensors</span>
        <LiveBadge live={h?.live} />
      </div>
    </Card>
  )
}

function FuelPlan() {
  const [f, setF] = useState(null)
  useEffect(() => {
    forecastFuel({ fuel_l: machine.fuelL, tank_l: machine.tankL, now: '07:00', reserve_l: 15,
      tasks: tasks.map((t) => ({ ...t.input, start: t.start, title: t.id })) })
      .then(setF).catch(() => setF({ ...machine.fuelFallback, live: false }))
  }, [])
  const x = f || machine.fuelFallback
  return (
    <div className={`mt-3 flex items-center gap-3 rounded-xl border p-3 text-sm ${x.runs_out_at ? 'border-warn/50 bg-warn/10' : 'border-line bg-black/20'}`}>
      <Fuel size={18} className={x.runs_out_at ? 'text-warn' : 'text-safe'} />
      <div className="flex-1">
        {x.runs_out_at
          ? <>Fuel {machine.fuelL} L ({machine.fuelPct}%). Hits reserve around <b>{x.runs_out_at}</b>. <b className="text-cat">Refuel before {x.refuel_before}.</b></>
          : <>Fuel is enough for today's tasks, {x.fuel_left_end_l} L left.</>}
        <div className="text-[11px] text-muted">{x.litres_planned} L planned today · ≈ {x.co2_kg} kg CO₂ · burn rate per task from the fuel model</div>
      </div>
      <LiveBadge live={f?.live} />
    </div>
  )
}

function ShiftSummary({ today }) {
  const justifiedMin = today.idleMin - today.wasteMin
  return (
    <Card title="End of shift summary" icon={Activity} outcome="Identify unusual behaviour in machine usage">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-bold">{(today.dockedMin / 60).toFixed(1)} h</div><div className="text-[11px] text-muted">verified on EXC001</div></div>
        <div><div className="text-2xl font-bold">{today.cycles}</div><div className="text-[11px] text-muted">load cycles</div></div>
        <div><div className="text-2xl font-bold">{today.events.length}</div><div className="text-[11px] text-muted">safety events</div></div>
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-muted">Idle {today.idleMin.toFixed(0)} min · {today.idleFuelL.toFixed(1)} L · ₹{(today.idleFuelL * DIESEL_INR).toFixed(0)}</div>
      <div className="mt-1 flex h-2 overflow-hidden rounded bg-line">
        <div className="bg-sky-500/70" style={{ width: `${(justifiedMin / Math.max(today.idleMin, 1)) * 100}%` }} />
        <div className="bg-danger" style={{ width: `${(today.wasteMin / Math.max(today.idleMin, 1)) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px]">
        <span className="text-sky-300">{justifiedMin.toFixed(0)} min justified (truck close)</span>
        <span className="text-danger">{today.wasteMin.toFixed(0)} min avoidable · ₹{(today.wasteFuelL * DIESEL_INR).toFixed(0)}</span>
      </div>
      {today.beltOffMin > 0 && <div className="mt-1 text-[11px] text-warn">Seatbelt off with engine running: {today.beltOffMin.toFixed(0)} min</div>}
      {today.events.length > 0 && (
        <ul className="mt-2 space-y-1">
          {today.events.slice(0, 4).map((e) => <li key={e.id} className="text-xs text-slate-300"><span className="text-muted">{e.time}</span> {e.text}</li>)}
        </ul>
      )}
      {today.lessons.length > 0 && (
        <div className="mt-3 rounded-lg bg-black/30 p-2">
          <div className="text-[11px] uppercase tracking-wider text-muted">New lessons from today</div>
          {today.lessons.map((l) => <div key={l.title} className="text-sm">{l.title} <span className="text-[11px] text-muted">· {l.mins} min · {l.from}</span></div>)}
        </div>
      )}
      <div className="mt-2 text-[11px] text-muted">Skill passport: +{(today.dockedMin / 60).toFixed(1)} verified hours → {(operator.passport.hours + today.dockedMin / 60).toFixed(0)} h</div>
    </Card>
  )
}

export default function NormalMode({ onDock, today }) {
  const total = operator.weekHours.reduce((a, d) => a + d.h, 0)
  const ot = operator.weekHours.reduce((a, d) => a + d.ot, 0)
  return (
    <div className="mx-auto grid h-full max-w-7xl grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-muted">Good morning · {operator.site}</div>
            <h1 className="text-3xl font-bold">Namaste, {operator.name.split(' ')[0]}</h1>
            <div className="text-sm text-muted">{operator.role} · Shift {operator.shift}</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-safe/40 bg-safe/10 px-3 py-1.5 text-sm text-safe">
            <Clock size={14} /> Clocked in 06:52 · badge + face
          </div>
        </div>

        {today && <ShiftSummary today={today} />}

        <Card title="Pre-shift briefing · read aloud in Hindi" icon={PlayCircle} outcome="Safety features (working conditions)">
          <ul className="space-y-2">
            {briefing.map((b) => {
              const I = ICONS[b.icon]
              return (
                <li key={b.text} className="flex gap-3 text-sm"><I size={18} className="mt-0.5 shrink-0 text-cat" />{b.text}</li>
              )
            })}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <CheckCircle2 size={14} className="text-safe" /> Understood: 2 of 2 check questions correct · signed 06:41
          </div>
        </Card>

        <Card title="Today's tasks · time range from past jobs, weather and skill" icon={Activity} outcome="Daily task dashboard · Task time estimation">
          <div className="space-y-3">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          <FuelPlan />
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <button onClick={onDock}
          className="group flex items-center justify-between rounded-2xl bg-cat p-5 text-left text-black shadow-[0_0_40px_-10px_#ffcd11] transition hover:brightness-105">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Your machine today</div>
            <div className="text-2xl font-extrabold">{machine.model} · {machine.id}</div>
            <div className="text-sm opacity-80">{machine.owner}</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <PlugZap size={34} className="transition group-hover:scale-110" />
            <span className="text-xs font-bold">DOCK</span>
          </div>
        </button>

        <HealthCard />

        <Card title="Verified hours this week" icon={Clock}>
          <div className="flex h-24 items-end gap-2">
            {operator.weekHours.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-col justify-end" style={{ height: 80 }}>
                  <div className="w-full rounded-t bg-cat/80" style={{ height: `${(d.ot / 12) * 80}px` }} />
                  <div className="w-full bg-slate-500/60" style={{ height: `${((d.h - d.ot) / 12) * 80}px` }} />
                </div>
                <div className="text-[11px] text-muted">{d.day}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm">{total.toFixed(1)} h worked · <span className="text-cat">{ot.toFixed(1)} h overtime</span> · from clock-in + engine data</div>
        </Card>

        <Card title="Lessons from your own shifts" icon={GraduationCap} outcome="Operator training hub">
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={l.title} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 p-2">
                <div>
                  <div className={`text-sm ${l.done ? 'text-muted line-through' : ''}`}>{l.title}</div>
                  <div className="text-[11px] text-muted">{l.from}</div>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px]">{l.mins} min</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Skill passport" icon={BadgeCheck} outcome="Operator training hub">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-bold">{operator.passport.hours}</div><div className="text-[11px] text-muted">verified hours</div></div>
            <div><div className="text-2xl font-bold">{operator.passport.machines}</div><div className="text-[11px] text-muted">machine types</div></div>
            <div><div className="text-2xl font-bold text-safe">{operator.passport.noStrikeDays}</div><div className="text-[11px] text-muted">days, 0 utility strikes</div></div>
          </div>
          <div className="mt-3 h-2 rounded bg-line"><div className="h-2 rounded bg-cat" style={{ width: `${operator.passport.nextLevelPct}%` }} /></div>
          <div className="mt-1 text-[11px] text-muted">Level {operator.passport.level} → {operator.passport.level + 1}: {operator.passport.nextLevelPct}% · instructor assessment bookable</div>
        </Card>
      </div>
    </div>
  )
}
