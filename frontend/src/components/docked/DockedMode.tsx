import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { toast } from 'sonner'
import {
  ArrowDownToLine, ArrowUpToLine, BellOff, Box, CircleDashed, CircleHelp, X, Eye, EyeOff, Fuel, Gauge, Mic, OctagonAlert, Power, ShieldAlert, ShieldCheck,
  Thermometer, Timer, TriangleAlert, Truck, Unplug, UserRound, Armchair, type LucideIcon,
} from 'lucide-react'
import SiteScene from './SiteScene'
import { HelpPanel } from './HelpPanel'
import { HELP, type HelpItem } from '@/data/help'
import { useApp } from '@/store/app'
import type { StoryCommand } from '@/lib/story'
import { hourly, machine, operator } from '@/data/demo'
import { classifyIdle, scoreBehaviour, scoreTwin, structureIncident } from '@/lib/api'
import { fuseRisk, latchRisk, RISK_RANK, type RiskLatch } from '@/lib/risk'
import { incidentRules, OFFLINE_SOURCES, type FieldSource } from '@/lib/incident'
import { DIESEL_INR, IDLE_BURN_LPH, SIM_SPEED, logEvent, markTimeline, recordTimeline, siteClock, type Sim } from '@/lib/sim'
import { SupervisorPush, type Push } from './SupervisorPush'
import { isRowUnusual, ruleBasedBehaviour, type HourStats } from '@/lib/behaviour'
import { cn, inr } from '@/lib/utils'
import type { BehaviourResult, RiskState, SimEvent, TwinScore, Zone } from '@/types'
import { Button } from '@/components/ui/button'
import { OutcomeTag } from '@/components/ui/card'
import { Kbd, Meter } from '@/components/ui/controls'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ModelStatus, StatusBadge } from '@/components/ui/status'
import { TONE_TEXT, type Tone } from '@/lib/tones'
import { TelemetryTable } from '@/components/shared/TelemetryTable'

const IDLE_TEXT: Record<string, string> = {
  waiting_for_truck: 'Waiting for truck',
  waste: 'No reason found (waste)',
  heat_rest: 'Heat rest (AC)',
  warm_up: 'Warm-up',
  cool_down: 'Cool-down',
}
const ZONE: Record<Zone, { tone: Tone; label: string }> = {
  clear: { tone: 'good', label: 'Clear' },
  caution: { tone: 'warning', label: 'Caution' },
  danger: { tone: 'critical', label: 'Person inside' },
}

type Snap = Sim & { events: SimEvent[] }
interface BlackBoxSample { t: number; dist: number; zone: Zone; working: boolean; belt: boolean; truck: boolean }
interface Report {
  transcript: string; sampleTranscript: boolean; structured: Record<string, string>
  sources: Record<string, FieldSource>; live: boolean; blackbox: BlackBoxSample[]
}

/* ---------- presentational pieces ---------- */

/** Provenance of a report field: decided by the black box / a rule, or only worded by the LLM. */
function SourceMark({ source }: { source: FieldSource }) {
  const text = source === 'LLM' ? 'LLM wording' : source === 'template' ? 'template' : `from ${source}`
  return <span className={cn('ml-2 font-mono text-[10.5px]', source === 'LLM' ? 'text-info-text' : 'text-fg-3')}>{text}</span>
}

/** ISO-style tell-tale: icon + label + state, never colour alone. */
function Telltale({ icon: Icon, label, state, tone }: { icon: LucideIcon; label: string; state: string; tone: Tone }) {
  return (
    <div className={cn('flex h-12 items-center gap-2.5 rounded-md border px-3',
      tone === 'critical' ? 'border-critical bg-critical-soft' : tone === 'warning' ? 'border-warning/60 bg-warning-soft' : 'border-border bg-surface-2')}>
      <Icon size={18} className={TONE_TEXT[tone]} aria-hidden />
      <div className="leading-tight">
        <div className="label-caps text-[10px] text-fg-3">{label}</div>
        <div className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{state}</div>
      </div>
    </div>
  )
}

function GaugeTile({ icon: Icon, label, value, unit, pct, barClass, valueClass }: {
  icon: LucideIcon; label: string; value: ReactNode; unit?: string; pct?: number; barClass?: string; valueClass?: string
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-fg-3"><Icon size={14} aria-hidden /><span className="label-caps text-[11px]">{label}</span></div>
      <div className={cn('mt-1.5 font-mono text-[26px] leading-none font-medium text-fg tabular', valueClass)}>
        {value}{unit && <span className="ml-1 text-sm text-fg-3">{unit}</span>}
      </div>
      {pct !== undefined && <Meter value={pct} label={label} className="mt-2.5 h-1.5" barClassName={barClass} />}
    </div>
  )
}

function Panel({ title, outcome, aside, children, className, tone }: {
  title: string; outcome?: string; aside?: ReactNode; children: ReactNode; className?: string; tone?: 'warning'
}) {
  return (
    <section className={cn('rounded-md border p-3.5', tone === 'warning' ? 'border-warning/60 bg-warning-soft' : 'border-border bg-surface-2', className)}>
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="label-caps text-fg-2">{title}</h2>
        <div className="flex items-center gap-2">{aside}{outcome && <OutcomeTag>{outcome}</OutcomeTag>}</div>
      </header>
      {children}
    </section>
  )
}

function ScenarioButton({ onClick, icon: Icon, children, hotkey, active }: { onClick: () => void; icon: LucideIcon; children: ReactNode; hotkey: string; active?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn('flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.97]',
        active ? 'border-brand bg-brand text-brand-fg' : 'border-white/15 bg-black/75 text-white hover:bg-black/90')}>
      <Icon size={15} aria-hidden />{children}<Kbd className={active ? 'border-black/30 bg-black/10 text-brand-fg' : 'border-white/20 bg-white/10 text-white/70'}>{hotkey}</Kbd>
    </button>
  )
}

/** Fused Safe / Caution / Critical state with its one-line reason: the display's headline. */
function RiskLamp({ risk }: { risk: RiskState }) {
  const cfg = {
    safe: { icon: ShieldCheck, label: 'Safe', cls: 'border-good/50 bg-good-soft text-good-text' },
    caution: { icon: TriangleAlert, label: 'Caution', cls: 'border-warning bg-warning text-black' },
    critical: { icon: OctagonAlert, label: 'Critical', cls: 'border-critical bg-critical text-white' },
  }[risk.level]
  const Icon = cfg.icon
  return (
    <div role={risk.level === 'critical' ? 'alert' : 'status'} aria-live="polite"
      className={cn('flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md border px-3', cfg.cls)}>
      <span className="relative flex shrink-0">
        {risk.level === 'critical' && <span className="absolute inset-0 rounded-full bg-white/60" style={{ animation: 'var(--animate-pulse-ring)' }} aria-hidden />}
        <Icon size={22} strokeWidth={2.4} className="relative" aria-hidden />
      </span>
      <span className="shrink-0 font-display text-[22px] leading-none font-bold tracking-wide uppercase">{cfg.label}</span>
      <span className="h-6 w-px shrink-0 bg-current opacity-30" aria-hidden />
      <span className="min-w-0 truncate text-[14px] font-medium leading-tight" title={risk.reason}>{risk.reason}</span>
    </div>
  )
}

// What Ravi is doing while docked: T102, loading at Bay 2 on the rental (SAE) Cat 320. The twin
// compares this hour with his usual for exactly these conditions.
const SAFETY_METRICS = new Set(['seatbelt_off_min', 'harsh_swings'])
const safetyDeviation = (tw: TwinScore | null) => (tw?.unusual ? tw.deviations.find((d) => SAFETY_METRICS.has(d.metric)) : undefined)

const TWIN_CONTEXT = { operator_id: operator.id, task_type: 'Material Loading', weather: 'Sunny', machine_id: 'RENTAL-SAE' }

/* ---------- main ---------- */

export function DockedMode({ sim, onUndock }: { sim: Sim; onUndock: () => void }) {
  const [snap, setSnap] = useState<Snap>({ ...sim })
  const [patternOpen, setPatternOpen] = useState(true)
  const [idle, setIdle] = useState<{ reason: string; confidence: number; etaMin: number; live: boolean } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [listening, setListening] = useState(false)
  const [showScenarios, setShowScenarios] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpItem, setHelpItem] = useState<HelpItem | null>(null)
  // a question with a 3D guide points the site view at that control; anything else releases it
  const selectHelp = (item: HelpItem | null) => { setHelpItem(item); sim.focus = item?.focus ?? null }
  const closeHelp = () => { setHelpOpen(false); selectHelp(null) }
  const blackbox = useRef<BlackBoxSample[]>([])
  const idleEpisode = useRef<boolean | null>(null) // seat state the current idle episode was classified with
  const engineStartMin = useRef(7 * 60) // site clock, minutes; engine started at shift start, reset on restart
  const [risk, setRisk] = useState<RiskState>({ level: 'safe', reason: 'Belt on · swing radius clear' })
  const riskLatch = useRef<RiskLatch | null>(null)
  const twinRef = useRef<TwinScore | null>(null)
  const idleStart = useRef<number | null>(null)
  const lastIdleMin = useRef(0)
  const engineWasOn = useRef(sim.engineOn)
  // alert budget: Critical goes to the supervisor's phone; Caution stays on the tablet
  const [push, setPush] = useState<Push | null>(null)
  const clearPush = useCallback(() => setPush(null), [])
  const [budgetNoteFor, setBudgetNoteFor] = useState<number | null>(null)
  const budgetNoted = useRef(false)
  // previous machine state, so the timeline only gets point events on a change
  const prevState = useRef({ seatbelt: sim.seatbelt, zone: sim.zone, engineOn: sim.engineOn, haltReason: sim.haltReason })

  // read the simulation 4x per second, fuse the risk state, keep a 60 s black box
  useEffect(() => {
    const id = setInterval(() => {
      // "Your day" timeline: state segments + point events, appended only on change
      recordTimeline(sim)
      const was = prevState.current
      if (sim.zone === 'danger' && was.zone !== 'danger') markTimeline(sim, 'worker', 'Worker inside the 7 m swing radius · swing held')
      if (!sim.seatbelt && was.seatbelt) markTimeline(sim, 'belt_off', 'Seatbelt unfastened during idle')
      if (!sim.engineOn && was.engineOn)
        markTimeline(sim, 'engine_off', `Switched off, next truck ${((sim.nextTruckEtaSec * SIM_SPEED) / 60).toFixed(0)} min away`)
      if (sim.haltReason === 'seatbelt' && was.haltReason !== 'seatbelt') markTimeline(sim, 'restart_guard', 'Restart guard held the machine: belt off as the truck arrived')
      prevState.current = { seatbelt: sim.seatbelt, zone: sim.zone, engineOn: sim.engineOn, haltReason: sim.haltReason }

      setSnap({ ...sim, events: [...sim.events] })
      if (sim.engineOn && !engineWasOn.current) engineStartMin.current = 9 * 60 + (sim.t * SIM_SPEED) / 60
      engineWasOn.current = sim.engineOn

      // current idle episode, so a restart can say how long the machine sat
      const idleNow = sim.engineOn && !sim.working && !sim.truckPresent
      if (idleNow && idleStart.current === null) idleStart.current = sim.t
      if (idleStart.current !== null) lastIdleMin.current = ((sim.t - idleStart.current) * SIM_SPEED) / 60
      if (!idleNow && sim.working) idleStart.current = null

      const tw = twinRef.current
      const raw = fuseRisk({ zone: sim.zone, workerDist: sim.workerDist, seatbelt: sim.seatbelt, engineOn: sim.engineOn,
        working: sim.working, truckPresent: sim.truckPresent, idleMin: lastIdleMin.current, events: sim.events,
        // only safety-related deviations light the lamp; a slow hour is coaching, not a hazard
        twinUnusual: !!safetyDeviation(tw), twinReason: safetyDeviation(tw)?.reason })
      const prev = riskLatch.current?.shown
      riskLatch.current = latchRisk(riskLatch.current, raw, performance.now())
      const shown = riskLatch.current.shown
      if (!prev || prev.level !== shown.level || prev.reason !== shown.reason) {
        setRisk(shown)
        // explainable alert: every entry into Critical is logged with its reason
        // (the scene already logs the swing-radius entry itself)
        if (shown.level === 'critical' && prev?.level !== 'critical' && sim.zone !== 'danger') logEvent(sim, 'danger', `Critical: ${shown.reason}`)
        // every escalation is an alert on the tablet; only Critical is pushed to the supervisor
        if (RISK_RANK[shown.level] > RISK_RANK[prev?.level ?? 'safe']) {
          sim.alerts.total += 1
          if (shown.level === 'critical') {
            sim.alerts.pushed += 1
            setPush({ id: sim.t, time: siteClock(sim), reason: shown.reason, ...sim.alerts })
            markTimeline(sim, sim.zone === 'danger' ? 'worker' : sim.haltReason === 'seatbelt' ? 'restart_guard' : 'critical', `Critical: ${shown.reason}`)
          } else if (!budgetNoted.current && sim.events[0]) {
            budgetNoted.current = true
            setBudgetNoteFor(sim.events[0].id)
          }
        }
      }
      blackbox.current.push({ t: sim.t, dist: sim.workerDist, zone: sim.zone, working: sim.working, belt: sim.seatbelt, truck: sim.truckPresent })
      blackbox.current = blackbox.current.slice(-240)
      if (sim.engineOn && !sim.seatbelt) sim.seatbeltOffSec += 0.25 * SIM_SPEED
    }, 250)
    return () => clearInterval(id)
  }, [sim])

  // idle reason from the ML model, once per idle episode
  const isIdle = snap.engineOn && !snap.working && !snap.truckPresent
  useEffect(() => {
    if (!isIdle) { idleEpisode.current = null; return }
    if (idleEpisode.current === snap.beltScenario) return
    idleEpisode.current = snap.beltScenario
    const etaMin = (sim.nextTruckEtaSec * SIM_SPEED) / 60
    // every input comes from the sim: site clock (docked 09:00, shift 07:00-19:00), engine run time,
    // the day's heat curve, idle rpm, and the seat (belt off during idle = operator may have left the seat)
    const clockMin = 9 * 60 + (sim.t * SIM_SPEED) / 60
    const hour = clockMin / 60
    const sinceStart = clockMin - engineStartMin.current
    const ambient = 34 + Math.min(Math.max(hour - 10, 0), 4) * 1.75 // 34 °C until 10:00, 41 °C by 14:00
    const window = { mins_since_engine_start: +sinceStart.toFixed(1), mins_to_shift_end: +(19 * 60 - clockMin).toFixed(1),
      hour_of_day: +hour.toFixed(2), ambient_temp_c: +ambient.toFixed(1), next_truck_eta_min: +etaMin.toFixed(1),
      hyd_oil_temp_c: +(35 + 40 * (1 - Math.exp(-sinceStart / 15))).toFixed(1), engine_rpm: sinceStart < 12 ? 1150 : 1000,
      seat_occupied: sim.beltScenario ? 0 : 1, ac_on: ambient >= 32 ? 1 : 0 }
    classifyIdle(window)
      .then((r) => setIdle({ ...r, etaMin }))
      .catch(() => setIdle({ reason: etaMin < 7 ? 'waiting_for_truck' : 'waste', confidence: 0.9, etaMin, live: false }))
  }, [isIdle, snap.beltScenario, sim])

  // unusual behaviour: this shift's per-hour rates, scored every 3 s against Ravi's twin (his own usual for
  // these conditions), with the isolation forest as a second opinion. Idle counted = avoidable idle only.
  // harsh_swings / raised_bucket_travel are fixed: the sim has no signal for them.
  const [beh, setBeh] = useState<(BehaviourResult & { hour: HourStats }) | null>(null)
  const [twin, setTwin] = useState<TwinScore | null>(null)
  useEffect(() => {
    const score = () => {
      const hrs = (sim.t * SIM_SPEED) / 3600
      if (hrs < 0.4) return // per-hour rates from a few minutes are noise
      const perHour = (x: number) => x / hrs
      const cycles = Math.round(perHour(sim.cycles))
      const idleMin = Math.min(perHour(sim.idleWasteSec / 60), 60)
      const hour: HourStats = { fuel_l: +(0.3 * cycles + (idleMin / 60) * IDLE_BURN_LPH).toFixed(1), load_cycles: cycles, idle_min: +idleMin.toFixed(1),
        seatbelt_off_min: +Math.min(perHour(sim.seatbeltOffSec / 60), 60).toFixed(1), harsh_swings: 1, raised_bucket_travel: 0 }
      scoreBehaviour(hour)
        .then((r) => setBeh({ ...r, hour }))
        .catch(() => setBeh({ ...ruleBasedBehaviour(hour), hour, live: false }))
      const hourOfShift = 9 - 7 + 1 + Math.floor((sim.t * SIM_SPEED) / 3600)
      // cycles per hour the operator could actually work: waiting for a truck is justified idle
      // (the idle-reason model says so), so it doesn't count against his loading rate
      const justifiedH = Math.max(sim.idleSec - sim.idleWasteSec, 0) / 3600
      const availableH = Math.max(hrs - justifiedH, 0.1)
      scoreTwin({ ...TWIN_CONTEXT, hour_of_shift: hourOfShift, ...hour, load_cycles: Math.round(sim.cycles / availableH) })
        .then((r) => { twinRef.current = r; setTwin(r) })
        .catch(() => { twinRef.current = null; setTwin(null) })
    }
    score()
    const id = setInterval(score, 3000)
    return () => clearInterval(id)
  }, [sim])
  // the twin decides when it's reachable; offline, the site-wide model + readable rules stand in
  const behFlag = twin ? twin.unusual : !!beh && (beh.unusual || beh.reasons.length > 0)

  const etaMin = (snap.nextTruckEtaSec * SIM_SPEED) / 60
  const idleMin = snap.idleSec / 60
  const rpm = !snap.engineOn ? 0 : snap.working ? 1750 : 1000

  const toggleWorker = useCallback(() => { sim.workerIntrude = !sim.workerIntrude }, [sim])
  const beltOff = useCallback(() => {
    if (!sim.seatbelt) return
    sim.beltScenario = true; sim.seatbelt = false; logEvent(sim, 'warn', 'Seatbelt unfastened during idle')
  }, [sim])
  const fasten = () => { sim.seatbelt = true; sim.beltScenario = false; logEvent(sim, 'ok', 'Seatbelt fastened. Restart guard cleared.') }
  const engineOff = () => {
    sim.engineOn = false
    logEvent(sim, 'ok', `Engine off during truck wait (${etaMin.toFixed(1)} min)`)
    toast.success('Engine off', { description: `Saves about ${((etaMin / 60) * IDLE_BURN_LPH).toFixed(2)} L before the next truck` })
  }
  const engineOn = () => { sim.engineOn = true; logEvent(sim, 'ok', 'Engine started, truck arriving') }

  const startVoice = useCallback(() => {
    if (listening) return
    type SR = { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onerror: () => void; start: () => void }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
    const fallback = 'Dumper peeche se aaya jab main swing kar raha tha, bahut paas tha'
    let done = false
    const finish = (text: string, sampleTranscript = false) => {
      if (done) return
      done = true
      setListening(false)
      const box = blackbox.current.filter((b) => b.t > sim.t - 60)
      const minDist = Math.min(...box.map((b) => b.dist), 99)
      const machineState = box.at(-1)?.working ? 'Working (swinging)' : 'Stationary'
      const decided = incidentRules(text, minDist, machineState)
      const ruleBased: Record<string, string> = {
        type: 'Near-miss',
        category: decided.category,
        severity: decided.severity,
        severity_basis: decided.severity_basis,
        location: 'Zone B, Bay 2 (auto from machine position)',
        machine: `${machine.model} ${machine.id}`,
        operator: operator.id,
        machine_state: machineState,
        suggested_action: 'Spotter at Bay 2 during reversing; review with dumper driver',
      }
      const finishReport = (structured: Record<string, unknown>, live: boolean) => {
        const { live: _drop, sources, ...fields } = structured as Record<string, string> & { live?: unknown; sources?: Record<string, FieldSource> }
        void _drop
        setReport({ transcript: text, sampleTranscript, structured: fields, sources: sources ?? OFFLINE_SOURCES, live,
          blackbox: box.filter((_, i) => i % 20 === 0).slice(-6) })
        logEvent(sim, 'warn', `Near-miss reported by voice${sampleTranscript ? ' (sample transcript)' : ''}${live ? ' · LLM worded' : ''}. Black box attached.`)
        markTimeline(sim, 'near_miss', `Near-miss reported by voice: ${String(fields.category ?? 'Other').toLowerCase()}`)
      }
      // severity/category are decided above by rules from the black box; the LLM only writes the wording
      structureIncident({ transcript: text, machine_model: machine.model, machine_id: machine.id, operator_id: operator.id, machine_state: machineState, min_dist_m: minDist })
        .then((r) => finishReport(r, true))
        .catch(() => finishReport(ruleBased, false))
    }
    setListening(true)
    // no microphone / recognition: use a sample transcript so the demo never stalls, and say so on the report
    if (!Recognition) { setTimeout(() => finish(fallback, true), 1500); return }
    const rec = new Recognition()
    rec.lang = 'hi-IN'
    rec.onresult = (e) => finish(e.results[0][0].transcript)
    rec.onerror = () => finish(fallback, true)
    try { rec.start() } catch { finish(fallback, true); return }
    // some browsers expose the API but never answer (no mic, permission ignored): never hang on stage
    setTimeout(() => finish(fallback, true), 8000)
  }, [listening, sim])

  // story mode drives the cab: close the first-run dialog, start the voice report, open a help guide
  const storyOn = useApp((st) => st.storyOn)
  useEffect(() => {
    const onStory = (e: Event) => {
      const cmd = (e as CustomEvent<StoryCommand>).detail
      if (cmd === 'close-pattern') { setPatternOpen((open) => { if (open) { sim.patternFixed = true; logEvent(sim, 'ok', 'Joystick pattern switched to ISO') } return false }) }
      else if (cmd === 'voice') startVoice()
      else if (cmd === 'help-keyless') { setHelpOpen(true); const item = HELP.find((h) => h.id === 'keyless-start') ?? null; setHelpItem(item); sim.focus = item?.focus ?? null }
      else if (cmd === 'reset') { setHelpOpen(false); setHelpItem(null); setReport(null); sim.focus = null }
    }
    window.addEventListener('story', onStory)
    return () => window.removeEventListener('story', onStory)
  }, [sim, startVoice])

  // presenter hotkeys (keyboard-initiated, so nothing here animates)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea, [role=dialog]')) return
      const k = e.key.toLowerCase()
      if (e.key === '?') setHelpOpen((v) => { if (v) sim.focus = null; return !v })
      else if (k === 'h') setShowScenarios((v) => !v)
      else if (k === 'w') toggleWorker()
      else if (k === 'b') beltOff()
      else if (k === 'v') startVoice()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleWorker, beltOff, startVoice])

  const zone = ZONE[snap.zone]
  const patternLabel = snap.patternFixed ? operator.usualPattern : machine.pattern

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      {/* status bar */}
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <div className="flex h-12 items-center gap-3 rounded-md bg-brand px-3 text-brand-fg">
          <span className="font-display text-2xl leading-none font-bold">{machine.model}</span>
          <span className="font-mono text-xs leading-tight font-medium opacity-80">{machine.id}<br />{operator.id} · {patternLabel}</span>
        </div>
        <RiskLamp risk={risk} />

        <div className={cn('flex h-12 shrink-0 items-center gap-2.5 rounded-md border px-4 text-[15px] font-medium',
          snap.truckPresent ? 'border-good/50 bg-good-soft text-good-text' : 'border-border bg-surface-2 text-fg')}>
          <Truck size={18} aria-hidden />
          {snap.truckPresent ? 'Dumper T-07 at Bay 2 · loading' : <>Next dumper T-03 in <b className="font-mono">{etaMin.toFixed(1)} min</b></>}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Telltale icon={Armchair} label="Seatbelt" state={snap.seatbelt ? 'Fastened' : 'OFF'} tone={snap.seatbelt ? 'good' : 'critical'} />
          <Telltale icon={CircleDashed} label="Swing zone" state={zone.label} tone={zone.tone} />
        </div>
        <div className="hidden px-2 text-right xl:block">
          <div className="font-mono text-[26px] leading-none font-medium tabular">{siteClock(snap)}</div>
          <div className="label-caps text-[10px] text-fg-3">site time</div>
        </div>
        <Button variant={helpOpen ? 'inverse' : 'secondary'} size="md" onClick={() => (helpOpen ? closeHelp() : setHelpOpen(true))}
          aria-expanded={helpOpen} aria-label="Help and how-to videos (?)"><CircleHelp size={18} /> Help</Button>
        <Button variant="secondary" size="md" onClick={() => { sim.focus = null; onUndock() }}><Unplug size={17} /> Undock</Button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* 3D site view */}
        <div className="relative min-w-0 flex-1">
          <SiteScene sim={sim} />

          {snap.zone === 'danger' && (
            <div className="pointer-events-none absolute inset-0 border-[6px] border-critical" role="alert">
              <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md bg-critical px-5 py-3 font-display text-xl font-bold tracking-wide text-white uppercase shadow-3">
                <TriangleAlert size={22} aria-hidden /> Person in swing radius · swing held
              </div>
            </div>
          )}
          {snap.zone === 'caution' && (
            <div className="pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md bg-warning px-5 py-2.5 font-display text-lg font-bold tracking-wide text-black uppercase shadow-3" role="status">
              <TriangleAlert size={20} aria-hidden /> Worker approaching · 4 s to conflict
            </div>
          )}

          {helpItem?.focus && (
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-md bg-brand py-1.5 pr-1.5 pl-3 text-brand-fg shadow-3" role="status">
              <Box size={16} aria-hidden />
              <span className="text-sm font-semibold">3D guide · {helpItem.focusLabel}</span>
              <button onClick={() => selectHelp(null)} aria-label="Leave the 3D guide"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-sm hover:bg-black/10"><X size={16} /></button>
            </div>
          )}

          {listening && (
            <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border border-white/15 bg-black/85 px-5 py-3 text-white" role="status">
              <span className="relative flex h-3 w-3"><span className="absolute inset-0 rounded-full bg-critical" style={{ animation: 'var(--animate-pulse-ring)' }} /><span className="relative h-3 w-3 rounded-full bg-critical" /></span>
              Listening… speak in Hindi or English
            </div>
          )}

          <SupervisorPush push={push} onDone={clearPush} raised={storyOn} />

          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            {storyOn ? null : showScenarios ? (
              <>
                <span className="label-caps rounded-sm bg-black/60 px-2 py-1 text-[10px] text-white/70">Demo scenarios</span>
                <ScenarioButton icon={UserRound} hotkey="W" onClick={toggleWorker} active={snap.workerIntrude}>{snap.workerIntrude ? 'Worker leaves' : 'New worker walks in'}</ScenarioButton>
                <ScenarioButton icon={Armchair} hotkey="B" onClick={beltOff} active={!snap.seatbelt}>Unbuckle during idle</ScenarioButton>
                <ScenarioButton icon={Mic} hotkey="V" onClick={startVoice} active={listening}>{listening ? 'Listening…' : 'Report near-miss'}</ScenarioButton>
                <button onClick={() => setShowScenarios(false)} aria-label="Hide demo scenarios (H)" className="flex h-11 w-11 items-center justify-center rounded-md bg-black/60 text-white/70 hover:text-white"><EyeOff size={16} /></button>
              </>
            ) : (
              <button onClick={() => setShowScenarios(true)} aria-label="Show demo scenarios (H)" className="flex h-9 items-center gap-2 rounded-md bg-black/40 px-2.5 text-xs text-white/60 hover:text-white"><Eye size={14} /> <Kbd className="border-white/20 bg-white/10 text-white/70">H</Kbd></button>
            )}
          </div>
        </div>

        {/* right rail */}
        <aside aria-label="Machine data" className="flex w-[380px] shrink-0 flex-col gap-3 overflow-y-auto scrollbar-thin border-l border-border bg-surface p-3">
          <div className="grid grid-cols-2 gap-2">
            <GaugeTile icon={Fuel} label="Fuel" value={machine.fuelPct} unit="%" pct={machine.fuelPct} barClass={machine.fuelPct < 25 ? 'bg-serious' : 'bg-good'} />
            <GaugeTile icon={Gauge} label="Engine" value={rpm} unit="rpm" pct={(rpm / 2200) * 100} barClass="bg-s1" valueClass={snap.engineOn ? '' : 'text-fg-3'} />
            <GaugeTile icon={Thermometer} label="Hyd. oil" value={71} unit="°C" pct={71} barClass="bg-good" />
            <GaugeTile icon={Timer} label="Load cycles" value={snap.cycles} valueClass="text-brand" />
          </div>

          <Panel title="Idle today" outcome="Excessive idling" tone={isIdle ? 'warning' : undefined}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[30px] leading-none font-medium tabular">{idleMin.toFixed(1)}<span className="ml-1 text-sm text-fg-3">min</span></span>
              <span className="font-mono text-sm text-fg-2">{snap.idleFuelL.toFixed(2)} L · {inr(snap.idleFuelL * DIESEL_INR)}</span>
            </div>
            {isIdle && idle && (
              <div className="mt-2 text-[15px]">
                Reason: <b className="text-fg">{IDLE_TEXT[idle.reason] || idle.reason}</b>{' '}
                <span className="font-mono text-xs text-fg-3">{Math.round(idle.confidence * 100)}%</span>
                <ModelStatus live={idle.live} className="ml-2" />
              </div>
            )}
            {isIdle && idle && etaMin > 3 && (
              <Button variant="primary" size="lg" className="mt-3 w-full" onClick={engineOff}>
                <Power size={18} /> Next truck in {etaMin.toFixed(0)} min · switch off
              </Button>
            )}
            {!snap.engineOn && (
              <Button variant="success" size="lg" className="mt-3 w-full" onClick={engineOn}>
                <Power size={18} /> {snap.truckPresent ? 'Truck here · start engine' : `Start engine · truck in ${etaMin.toFixed(1)} min`}
              </Button>
            )}
          </Panel>

          <Panel title="Unusual behaviour · vs your twin" outcome="Unusual behaviour"
            aside={(twin || beh) && <ModelStatus live={twin ? twin.live : beh?.live} />} tone={behFlag ? 'warning' : undefined}>
            {!beh && !twin ? <div className="text-sm text-fg-3">Scoring after the first few minutes…</div> : (
              <>
                <StatusBadge tone={behFlag ? 'serious' : 'good'}>{behFlag ? 'Unusual for you' : 'Normal for you'}</StatusBadge>
                <ul className="mt-2 space-y-1 text-sm text-fg-2">
                  {(twin ? twin.reasons : beh?.reasons ?? []).slice(0, 3).map((r) => <li key={r}>· {r}</li>)}
                  {!twin && beh?.unusual && beh.reasons.length === 0 && <li>· Flagged by the anomaly model; no single rule matched</li>}
                </ul>
                {twin && (
                  <p className="mt-2 text-[12.5px] text-fg-3">
                    Compared with your usual for {twin.context} · {twin.context_hours} h of your history
                    {beh && <> · site-wide model {beh.unusual ? 'also flags it' : 'sees nothing unusual'}</>}
                  </p>
                )}
                {beh && (
                  <div className="mt-1.5 font-mono text-[11px] text-fg-3">
                    {beh.hour.load_cycles} cycles/h · {beh.hour.idle_min} min avoidable idle/h · belt off {beh.hour.seatbelt_off_min} min/h
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel title="Limits from site data" outcome="Proximity hazards">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-fg-2"><ArrowDownToLine size={15} aria-hidden />E-floor · fibre at 1.2 m</dt><dd className="font-mono font-medium text-serious-text">0.9 m</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-fg-2"><ArrowUpToLine size={15} aria-hidden />E-ceiling · 11 kV line</dt><dd className="font-mono font-medium text-critical-text">6.0 m</dd></div>
              <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-fg-2"><CircleDashed size={15} aria-hidden />Swing radius watch</dt><dd><StatusBadge tone={zone.tone} size="sm">{zone.label}</StatusBadge></dd></div>
            </dl>
          </Panel>

          <Tabs.Root defaultValue="events" className="flex min-h-[240px] flex-1 flex-col rounded-md border border-border bg-surface-2">
            <Tabs.List aria-label="Records" className="flex border-b border-border px-1">
              {[['events', 'Event log'], ['telemetry', 'Telemetry sample']].map(([v, l]) => (
                <Tabs.Trigger key={v} value={v}
                  className="label-caps -mb-px h-11 border-b-2 border-transparent px-3 text-fg-3 data-[state=active]:border-brand data-[state=active]:text-fg">
                  {l}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Tabs.Content value="events" className="p-3 focus-visible:outline-none">
              <div className="mb-2"><OutcomeTag>Incident logging</OutcomeTag></div>
              <ul className="space-y-2">
                {snap.events.map((e) => (
                  <li key={e.id} className="text-[13px]">
                    <div className="flex gap-2.5">
                      <span className="font-mono text-fg-3">{e.time}</span>
                      <span className={e.level === 'danger' ? 'text-critical-text' : e.level === 'warn' ? 'text-warning-text' : 'text-fg-2'}>{e.text}</span>
                    </div>
                    {e.id === budgetNoteFor && (
                      <div className="mt-1 flex items-center gap-1.5 pl-[3.1rem] text-[12px] text-fg-3">
                        <BellOff size={12} aria-hidden /> Not pushed · kept on the tablet (alert budget)
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Tabs.Content>
            <Tabs.Content value="telemetry" className="p-3 focus-visible:outline-none">
              <div className="mb-2"><OutcomeTag>Unusual behaviour</OutcomeTag></div>
              <TelemetryTable dense showAlert={false} rows={hourly.map((r) => ({ ...r, time: r.time.replace('2025-05-02 ', '+1d '), unusual: isRowUnusual(r) }))} />
            </Tabs.Content>
          </Tabs.Root>
        </aside>

        {helpOpen && <HelpPanel selected={helpItem} onSelect={selectHelp} onClose={closeHelp} />}
      </div>

      {/* joystick pattern mismatch */}
      <Dialog open={patternOpen}>
        <DialogContent tone="warning" locked label="Joystick pattern mismatch">
          <DialogTitle className="flex items-center gap-2.5 font-display text-2xl font-bold text-warning-text">
            <TriangleAlert size={24} aria-hidden /> Different joystick pattern
          </DialogTitle>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
            This rental {machine.model} is set to <b className="text-fg">{machine.pattern}</b>. You have run <b className="text-fg">{operator.usualPattern}</b> for your last 1,400 hours.
            A mismatch is a common cause of wrong movements in the first minutes.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="primary" size="lg" onClick={() => { sim.patternFixed = true; logEvent(sim, 'ok', 'Joystick pattern switched to ISO'); setPatternOpen(false) }}>Switch to ISO</Button>
            <Button variant="secondary" size="lg" onClick={() => { logEvent(sim, 'warn', 'Kept SAE pattern · gentle coaching for 30 min'); setPatternOpen(false) }}>Keep SAE + 60 s drill</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* restart guard: an interlock, resolved not dismissed */}
      <Dialog open={snap.haltReason === 'seatbelt'}>
        <DialogContent tone="critical" locked label="Restart guard">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 font-display text-2xl font-bold text-critical-text">
              <ShieldAlert size={26} aria-hidden /> Restart guard
            </DialogTitle>
            <OutcomeTag>Seatbelt compliance</OutcomeTag>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
            The truck is here and work is about to restart after {idleMin.toFixed(0)} min idle, but your seatbelt is off.
            In your data, unbuckling happens during long idles and carries into the restart.
          </p>
          <Button variant="success" size="lg" className="mt-6 w-full text-lg" onClick={fasten}><ShieldCheck size={20} /> Seatbelt fastened</Button>
        </DialogContent>
      </Dialog>

      {/* voice near-miss report */}
      <Dialog open={!!report} onOpenChange={(o) => { if (!o) setReport(null) }}>
        {report && (
          <DialogContent tone="brand" label="Near-miss report" className="w-[min(600px,calc(100vw-32px))]">
            <div className="flex flex-wrap items-center gap-2.5">
              <Mic size={20} className="text-brand" aria-hidden />
              <DialogTitle className="font-display text-2xl font-bold">Near-miss report</DialogTitle>
              <OutcomeTag>Incident logging</OutcomeTag>
              <span className={cn('ml-auto font-mono text-[11px]', report.live ? 'text-good-text' : 'text-fg-3')}>{report.live ? '● rules + LLM wording' : '○ rules only (LLM offline)'}</span>
            </div>
            <blockquote className="mt-4 rounded-md border-l-4 border-brand bg-surface-2 p-3 text-[15px] text-fg-2 italic">“{report.transcript}”</blockquote>
            {report.sampleTranscript && (
              <p className="mt-1.5 font-mono text-[11px] text-warning-text">Sample transcript (no microphone): speech recognition unavailable</p>
            )}
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(report.structured).map(([k, v]) => (
                <div key={k} className="contents"><dt className="label-caps pt-0.5 text-[11px] text-fg-3">{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-fg">{String(v)}{report.sources[k] && <SourceMark source={report.sources[k]} />}</dd></div>
              ))}
            </dl>
            <div className="label-caps mt-5 text-fg-3">Black box · last 60 s</div>
            <div className="mt-2 grid grid-cols-6 gap-1.5 text-center font-mono text-[11px]">
              {report.blackbox.map((b) => (
                <div key={b.t} className={cn('rounded-sm border p-1.5',
                  b.zone === 'danger' ? 'border-critical bg-critical-soft' : b.zone === 'caution' ? 'border-warning bg-warning-soft' : 'border-border bg-surface-2')}>
                  <div className="text-fg-2">{b.working ? 'work' : 'idle'}</div><div className="font-medium text-fg">{b.dist.toFixed(0)} m</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-fg-3">The black box is your witness: it shows what the machine and site were doing, not only what was said.</p>
            <Button variant="primary" size="lg" className="mt-5 w-full"
              onClick={() => { setReport(null); toast.success('Sent to the safety officer', { description: 'Near-miss with 60 s black box attached' }) }}>
              Send to safety officer
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
