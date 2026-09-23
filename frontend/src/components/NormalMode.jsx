import { useEffect, useState } from 'react'
import { Activity, BadgeCheck, Cable, CheckCircle2, ClipboardCheck, Clock, FlaskConical, Fuel, GraduationCap, HeartPulse, PlayCircle, PlugZap, ShieldCheck, Sun, Users, Volume2, Wrench, Zap } from 'lucide-react'
import { operator, machine, tasks, briefing, lessons, weeklyStats } from '../data/demo'
import { predictTask, predictHealth, forecastFuel } from '../lib/api'
import { DIESEL_INR } from '../lib/sim'
import { speak, stopSpeaking } from '../lib/voice'
import { Surface, SectionLabel, Stat, OutcomeTag, LiveBadge, RISK_TONE } from './ui'
import SiteMap from './SiteMap'
import { WeeklyHoursChart, IdleReasonDonut } from './DashboardCharts'
import AssistantIntro from './AssistantIntro'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }
const INTRO_KEY = 'cc_intro_done'
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
      <div className="absolute top-2.5 h-1 w-full rounded-full bg-dline" />
      <div className="absolute top-1.5 h-3 rounded-full bg-s-blue/25" style={{ left: pct(p10), width: `calc(${pct(p90)} - ${pct(p10)})` }} />
      <div className="absolute top-0.5 h-5 w-1 rounded-full bg-s-blue" style={{ left: pct(p50) }} />
      <div className="absolute top-1 h-4 w-0.5 bg-ink3" style={{ left: pct(planner) }} title="planner estimate" />
    </div>
  )
}

function TaskRow({ task }) {
  const [pred, setPred] = useState(null)
  const [speaking, setSpeaking] = useState(false)
  const [override, setOverride] = useState({})
  const [open, setOpen] = useState(false)
  const whatIf = Object.keys(override).length > 0
  useEffect(() => {
    predictTask({ ...task.input, ...override })
      .then(setPred)
      .catch(() => setPred({ ...task.fallback, planner_estimate: task.input.planner_estimate_min, live: false, offline: whatIf }))
  }, [task, override, whatIf])
  const p = pred || { ...task.fallback, planner_estimate: task.input.planner_estimate_min }
  const setField = (k, v) => setOverride((o) => {
    const next = { ...o, [k]: v }
    if (v === task.input[k]) delete next[k]
    return next
  })

  const narrate = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const top = (p.reasons || [])[0]
    const why = top ? `, mainly because of ${top.factor.toLowerCase()}: ${top.value}` : ''
    setSpeaking(true)
    speak(`${task.title}. Likely ${p.p50} minutes${why}. The planner estimated ${p.planner_estimate}.`)
      .finally(() => setSpeaking(false))
  }

  return (
    <div className={`border-b border-dline/70 py-3.5 last:border-0 ${whatIf ? 'rounded-xl bg-cat/[0.07] px-2' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink1">{task.title}</div>
          <div className="text-xs text-ink3">{task.start} · Zone {task.zone}{task.note ? ` · ${task.note}` : ''}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={narrate} title="Hear this task"
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${speaking ? 'bg-cat text-ink1' : 'text-ink3 hover:bg-black/5'}`}>
            <Volume2 size={14} />
          </button>
          <div className="text-right">
            <div className="text-lg font-bold text-ink1">{p.p50} min</div>
            <div className="text-[11px] text-ink3">likely {p.p10}–{p.p90} · planner {p.planner_estimate}</div>
          </div>
        </div>
      </div>
      <RangeBar p10={p.p10} p50={p.p50} p90={p.p90} planner={p.planner_estimate} />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {(p.reasons || []).map((r) => (
          <span key={r.factor} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-ink2">
            {r.minutes > 0 ? '+' : ''}{r.minutes} min · {r.factor}: {r.value}
          </span>
        ))}
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-ink3 ring-1 ring-black/10 hover:text-ink1">
          <FlaskConical size={11} /> What if
        </button>
        <span className="ml-auto"><LiveBadge live={pred?.live} /></span>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {Object.entries(WHAT_IF).map(([k, opts]) => (
            <select key={k} value={override[k] ?? task.input[k]} onChange={(e) => setField(k, e.target.value)}
              className="rounded-md bg-card px-1.5 py-1 text-ink1 ring-1 ring-black/10">
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
          {whatIf && <button onClick={() => setOverride({})} className="text-ink3 underline">reset</button>}
          {pred?.offline && <span className="text-serious">What-if needs the ML API running</span>}
        </div>
      )}
    </div>
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
    <div className={`mt-2 flex items-center gap-3 rounded-xl p-3 text-sm ${x.runs_out_at ? 'bg-warning/15' : 'bg-black/[0.03]'}`}>
      <Fuel size={18} className={x.runs_out_at ? 'text-serious' : 'text-good'} />
      <div className="flex-1 text-ink2">
        {x.runs_out_at
          ? <>Fuel {machine.fuelL} L ({machine.fuelPct}%). Hits reserve around <b className="text-ink1">{x.runs_out_at}</b>. <b className="text-ink1">Refuel before {x.refuel_before}.</b></>
          : <>Fuel is enough for today's tasks, {x.fuel_left_end_l} L left.</>}
        <div className="text-[11px] text-ink3">{x.litres_planned} L planned today · ≈ {x.co2_kg} kg CO₂ · burn rate per task from the fuel model</div>
      </div>
      <LiveBadge live={f?.live} />
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
    <Surface className="p-4">
      <SectionLabel icon={HeartPulse}>Machine health before you start · {machine.id}</SectionLabel>
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink1">Failure risk, next 50 engine hours</div>
        <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${RISK_TONE[x.level]}`}>{x.risk_pct}% · {x.level}</span>
      </div>
      {x.reasons.map((r) => (
        <div key={r.factor} className="mt-1 text-xs text-ink3">{r.factor} <b className="text-ink1">{r.value}</b> (usual {r.usual}) · +{r.points} pts</div>
      ))}
      <div className="mt-2 flex items-start gap-2 rounded-xl bg-black/[0.03] p-2.5 text-sm text-ink1">
        <ClipboardCheck size={16} className="mt-0.5 shrink-0 text-ink2" />
        <span>Walkaround, first item today: {x.action.toLowerCase()}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink3">
        <span className="flex items-center gap-1"><Wrench size={11} /> Service due in {machine.serviceDueIn} h · from S·O·S oil sample + sensors</span>
        <LiveBadge live={h?.live} />
      </div>
    </Surface>
  )
}

function ShiftSummary({ today }) {
  const justifiedMin = today.idleMin - today.wasteMin
  return (
    <Surface className="p-4">
      <SectionLabel icon={Activity} action={<OutcomeTag>Identify unusual behaviour in machine usage</OutcomeTag>}>End of shift summary</SectionLabel>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div><div className="text-2xl font-bold text-ink1">{(today.dockedMin / 60).toFixed(1)} h</div><div className="text-[11px] text-ink3">verified on EXC001</div></div>
        <div><div className="text-2xl font-bold text-ink1">{today.cycles}</div><div className="text-[11px] text-ink3">load cycles</div></div>
        <div><div className="text-2xl font-bold text-ink1">{today.events.length}</div><div className="text-[11px] text-ink3">safety events</div></div>
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-ink3">Idle {today.idleMin.toFixed(0)} min · {today.idleFuelL.toFixed(1)} L · ₹{(today.idleFuelL * DIESEL_INR).toFixed(0)}</div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-dline">
        <div className="bg-s-blue" style={{ width: `${(justifiedMin / Math.max(today.idleMin, 1)) * 100}%` }} />
        <div className="bg-critical" style={{ width: `${(today.wasteMin / Math.max(today.idleMin, 1)) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px]">
        <span className="text-s-blue">{justifiedMin.toFixed(0)} min justified (truck close)</span>
        <span className="text-critical">{today.wasteMin.toFixed(0)} min avoidable · ₹{(today.wasteFuelL * DIESEL_INR).toFixed(0)}</span>
      </div>
      {today.beltOffMin > 0 && <div className="mt-1 text-[11px] text-serious">Seatbelt off with engine running: {today.beltOffMin.toFixed(0)} min</div>}
      {today.events.length > 0 && (
        <ul className="mt-2 space-y-1">
          {today.events.slice(0, 4).map((e) => <li key={e.id} className="text-xs text-ink2"><span className="text-ink3">{e.time}</span> {e.text}</li>)}
        </ul>
      )}
      {today.lessons.length > 0 && (
        <div className="mt-3 rounded-xl bg-black/[0.03] p-2.5">
          <div className="text-[11px] uppercase tracking-wider text-ink3">New lessons from today</div>
          {today.lessons.map((l) => <div key={l.title} className="text-sm text-ink1">{l.title} <span className="text-[11px] text-ink3">· {l.mins} min · {l.from}</span></div>)}
        </div>
      )}
      <div className="mt-2 text-[11px] text-ink3">Skill passport: +{(today.dockedMin / 60).toFixed(1)} verified hours → {(operator.passport.hours + today.dockedMin / 60).toFixed(0)} h</div>
    </Surface>
  )
}

export default function NormalMode({ onDock, today }) {
  const [showIntro, setShowIntro] = useState(() => sessionStorage.getItem(INTRO_KEY) !== '1')
  const finishIntro = () => { sessionStorage.setItem(INTRO_KEY, '1'); setShowIntro(false) }
  const replay = () => { sessionStorage.removeItem(INTRO_KEY); setShowIntro(true) }

  const total = operator.weekHours.reduce((a, d) => a + d.h, 0)
  const ot = operator.weekHours.reduce((a, d) => a + d.ot, 0)

  if (showIntro) return <AssistantIntro onFinish={finishIntro} />

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-5" style={{ animation: 'reveal-in .5s ease' }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-ink3">Good morning · {operator.site}</div>
          <h1 className="text-3xl font-bold text-ink1">Namaste, {operator.name.split(' ')[0]}</h1>
          <div className="text-sm text-ink3">{operator.role} · Shift {operator.shift}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={replay}
            className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-ink2 shadow-sm ring-1 ring-black/5 transition hover:ring-black/10">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cat/25"><Volume2 size={11} className="text-ink1" /></span>
            Replay briefing
          </button>
          <div className="flex items-center gap-2 rounded-full bg-good/10 px-3 py-1.5 text-sm text-good">
            <Clock size={14} /> Clocked in 06:52
          </div>
        </div>
      </div>

      <Surface className="mb-5 grid grid-cols-2 gap-5 p-4 sm:grid-cols-4">
        <Stat icon={Clock} label="Hours this week" value={`${total.toFixed(1)} h`} sub={`${ot.toFixed(1)} h overtime`} />
        <Stat icon={Activity} label="Utilization" value={`${weeklyStats.utilizationPct}%`} sub={`${weeklyStats.idlePct}% idle`} />
        <Stat icon={Fuel} label="Idle cost (week)" value={`₹${weeklyStats.idleCostINR.toLocaleString('en-IN')}`} sub={`${weeklyStats.idleFuelL} L diesel`} />
        <Stat icon={ShieldCheck} label="Safety score" value={weeklyStats.safetyScore} sub={`${weeklyStats.incidentsThisWeek} incidents this week`} tone="text-good" />
      </Surface>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          {today && <ShiftSummary today={today} />}

          <Surface className="p-4">
            <SectionLabel icon={PlayCircle} action={<OutcomeTag>Safety features (working conditions)</OutcomeTag>}>Pre-shift briefing</SectionLabel>
            <ul className="space-y-2.5">
              {briefing.map((b) => {
                const I = ICONS[b.icon]
                return <li key={b.text} className="flex gap-3 text-sm text-ink2"><I size={17} className="mt-0.5 shrink-0 text-cat" />{b.text}</li>
              })}
            </ul>
            <div className="mt-3 flex items-center gap-2 text-xs text-ink3">
              <CheckCircle2 size={14} className="text-good" /> Understood: 2 of 2 check questions correct · signed 06:41
            </div>
          </Surface>

          <Surface className="p-4">
            <SectionLabel icon={Activity} action={<OutcomeTag>Daily task dashboard · Task time estimation</OutcomeTag>}>Today's tasks · time range from past jobs, weather and skill</SectionLabel>
            <div>{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
            <FuelPlan />
          </Surface>

          <Surface className="p-4">
            <SectionLabel action={<OutcomeTag>Proximity hazards</OutcomeTag>}>Site map · zones, fibre route, 11 kV line</SectionLabel>
            <SiteMap />
          </Surface>
        </div>

        <div className="flex flex-col gap-5">
          <button onClick={onDock}
            className="group flex items-center justify-between rounded-2xl bg-cat p-5 text-left text-ink1 shadow-[0_14px_32px_-14px_rgba(242,183,5,0.65)] transition hover:brightness-105">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-70">Your machine today</div>
              <div className="text-2xl font-extrabold">{machine.model} · {machine.id}</div>
              <div className="text-sm opacity-80">{machine.owner}</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <PlugZap size={32} className="transition group-hover:scale-110" />
              <span className="text-xs font-bold">DOCK</span>
            </div>
          </button>

          <HealthCard />

          <Surface className="p-4">
            <SectionLabel icon={Clock}>Verified hours this week</SectionLabel>
            <WeeklyHoursChart />
            <div className="mt-2 text-[11px] text-ink3">from clock-in + engine data, not self-reported</div>
          </Surface>

          <Surface className="p-4">
            <SectionLabel icon={Fuel} action={<OutcomeTag>Excessive idling</OutcomeTag>}>Idle reasons this week</SectionLabel>
            <IdleReasonDonut />
          </Surface>

          <Surface className="p-4">
            <SectionLabel icon={GraduationCap} action={<OutcomeTag>Operator training hub</OutcomeTag>}>Lessons from your own shifts</SectionLabel>
            <ul className="space-y-2">
              {lessons.map((l) => (
                <li key={l.title} className="flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] p-2.5">
                  <div>
                    <div className={`text-sm ${l.done ? 'text-ink3 line-through' : 'text-ink1'}`}>{l.title}</div>
                    <div className="text-[11px] text-ink3">{l.from}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-ink2">{l.mins} min</span>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="p-4">
            <SectionLabel icon={BadgeCheck} action={<OutcomeTag>Operator training hub</OutcomeTag>}>Skill passport</SectionLabel>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold text-ink1">{operator.passport.hours}</div><div className="text-[11px] text-ink3">verified hours</div></div>
              <div><div className="text-2xl font-bold text-ink1">{operator.passport.machines}</div><div className="text-[11px] text-ink3">machine types</div></div>
              <div><div className="text-2xl font-bold text-good">{operator.passport.noStrikeDays}</div><div className="text-[11px] text-ink3">days, 0 utility strikes</div></div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-dline"><div className="h-2 rounded-full bg-cat" style={{ width: `${operator.passport.nextLevelPct}%` }} /></div>
            <div className="mt-1 text-[11px] text-ink3">Level {operator.passport.level} → {operator.passport.level + 1}: {operator.passport.nextLevelPct}% · instructor assessment bookable</div>
          </Surface>
        </div>
      </div>
    </div>
  )
}
