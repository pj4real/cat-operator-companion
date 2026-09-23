import { useEffect, useState } from 'react'
import { Cable, Zap, Users, Sun, PlugZap, GraduationCap, BadgeCheck, Clock, PlayCircle, CheckCircle2, Activity } from 'lucide-react'
import { operator, machine, tasks, briefing, lessons } from '../data/demo'
import { predictTask } from '../lib/api'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {Icon && <Icon size={14} />} {title}
      </h3>
      {children}
    </section>
  )
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
  useEffect(() => {
    predictTask(task.input).then(setPred).catch(() => setPred({ ...task.fallback, planner_estimate: task.input.planner_estimate_min, live: false }))
  }, [task])
  const p = pred || { ...task.fallback, planner_estimate: task.input.planner_estimate_min }
  return (
    <div className="rounded-xl border border-line bg-black/20 p-3">
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
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(p.reasons || []).map((r) => (
          <span key={r.factor} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
            {r.minutes > 0 ? '+' : ''}{r.minutes} min · {r.factor}: {r.value}
          </span>
        ))}
        <span className={`ml-auto text-[10px] ${pred?.live ? 'text-safe' : 'text-muted'}`}>{pred?.live ? '● ML model live' : '○ cached estimate'}</span>
      </div>
    </div>
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

        <Card title="Pre-shift briefing · read aloud in Hindi" icon={PlayCircle}>
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

        <Card title="Today's tasks · time range from past jobs, weather and skill" icon={Activity}>
          <div className="space-y-3">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
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

        {today && (
          <Card title="Today so far" icon={Activity}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="text-2xl font-bold">{today.cycles}</div><div className="text-[11px] text-muted">load cycles</div></div>
              <div><div className="text-2xl font-bold">{today.idleFuelL.toFixed(1)} L</div><div className="text-[11px] text-muted">idle fuel</div></div>
              <div><div className="text-2xl font-bold">{today.events}</div><div className="text-[11px] text-muted">safety events</div></div>
            </div>
          </Card>
        )}

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

        <Card title="Lessons from your own shifts" icon={GraduationCap}>
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

        <Card title="Skill passport" icon={BadgeCheck}>
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
