import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { toast } from 'sonner'
import {
  ArrowDownToLine, ArrowUpToLine, CircleDashed, Eye, EyeOff, Fuel, Gauge, Mic, Power, ShieldAlert, ShieldCheck,
  Thermometer, Timer, TriangleAlert, Truck, Unplug, UserRound, Armchair, type LucideIcon,
} from 'lucide-react'
import SiteScene from './SiteScene'
import { hourly, machine, operator } from '@/data/demo'
import { classifyIdle, scoreBehaviour, structureIncident } from '@/lib/api'
import { DIESEL_INR, IDLE_BURN_LPH, SIM_SPEED, logEvent, siteClock, type Sim } from '@/lib/sim'
import { isRowUnusual, ruleBasedBehaviour, type HourStats } from '@/lib/behaviour'
import { cn, inr } from '@/lib/utils'
import type { BehaviourResult, SimEvent, Zone } from '@/types'
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
interface Report { transcript: string; structured: Record<string, string>; live: boolean; blackbox: BlackBoxSample[] }

/* ---------- presentational pieces ---------- */

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

/* ---------- main ---------- */

export function DockedMode({ sim, onUndock }: { sim: Sim; onUndock: () => void }) {
  const [snap, setSnap] = useState<Snap>({ ...sim })
  const [patternOpen, setPatternOpen] = useState(true)
  const [idle, setIdle] = useState<{ reason: string; confidence: number; etaMin: number; live: boolean } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [listening, setListening] = useState(false)
  const [showScenarios, setShowScenarios] = useState(true)
  const blackbox = useRef<BlackBoxSample[]>([])
  const idleEpisode = useRef(false)

  // read the simulation 4x per second + keep a 60 s black box
  useEffect(() => {
    const id = setInterval(() => {
      setSnap({ ...sim, events: [...sim.events] })
      blackbox.current.push({ t: sim.t, dist: sim.workerDist, zone: sim.zone, working: sim.working, belt: sim.seatbelt, truck: sim.truckPresent })
      blackbox.current = blackbox.current.slice(-240)
      if (sim.engineOn && !sim.seatbelt) sim.seatbeltOffSec += 0.25 * SIM_SPEED
    }, 250)
    return () => clearInterval(id)
  }, [sim])

  // idle reason from the ML model, once per idle episode
  const isIdle = snap.engineOn && !snap.working && !snap.truckPresent
  useEffect(() => {
    if (!isIdle) { idleEpisode.current = false; return }
    if (idleEpisode.current) return
    idleEpisode.current = true
    const etaMin = (sim.nextTruckEtaSec * SIM_SPEED) / 60
    const window = { mins_since_engine_start: 190, mins_to_shift_end: 300, hour_of_day: 10.2, ambient_temp_c: 34,
      next_truck_eta_min: etaMin, hyd_oil_temp_c: 71, engine_rpm: 1000, seat_occupied: 1, ac_on: 1 }
    classifyIdle(window)
      .then((r) => setIdle({ ...r, etaMin }))
      .catch(() => setIdle({ reason: etaMin < 7 ? 'waiting_for_truck' : 'waste', confidence: 0.9, etaMin, live: false }))
  }, [isIdle, sim])

  // unusual behaviour: this shift's per-hour rates (the model was trained on hourly stats), scored every 3 s.
  // Idle counted = avoidable idle only. harsh_swings / raised_bucket_travel are fixed: the sim has no signal for them.
  const [beh, setBeh] = useState<(BehaviourResult & { hour: HourStats }) | null>(null)
  useEffect(() => {
    const score = () => {
      const hrs = (sim.t * SIM_SPEED) / 3600
      if (hrs < 0.1) return
      const perHour = (x: number) => x / hrs
      const cycles = Math.round(perHour(sim.cycles))
      const idleMin = Math.min(perHour(sim.idleWasteSec / 60), 60)
      const hour: HourStats = { fuel_l: +(0.3 * cycles + (idleMin / 60) * IDLE_BURN_LPH).toFixed(1), load_cycles: cycles, idle_min: +idleMin.toFixed(1),
        seatbelt_off_min: +Math.min(perHour(sim.seatbeltOffSec / 60), 60).toFixed(1), harsh_swings: 1, raised_bucket_travel: 0 }
      scoreBehaviour(hour)
        .then((r) => setBeh({ ...r, hour }))
        .catch(() => setBeh({ ...ruleBasedBehaviour(hour), hour, live: false }))
    }
    score()
    const id = setInterval(score, 3000)
    return () => clearInterval(id)
  }, [sim])
  const behFlag = !!beh && (beh.unusual || beh.reasons.length > 0)

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
    const finish = (text: string) => {
      if (done) return
      done = true
      setListening(false)
      const box = blackbox.current.filter((b) => b.t > sim.t - 60)
      const minDist = Math.min(...box.map((b) => b.dist), 99)
      const machineState = box.at(-1)?.working ? 'Working (swinging)' : 'Stationary'
      const ruleBased: Record<string, string> = {
        type: 'Near-miss',
        category: /dumper|truck|tipper/i.test(text) ? 'Vehicle interaction' : /worker|aadmi|labour|person/i.test(text) ? 'Person in swing zone' : 'Other',
        severity: minDist < 7 ? 'High' : 'Medium',
        location: 'Zone B, Bay 2 (auto from machine position)',
        machine: `${machine.model} ${machine.id}`,
        operator: operator.id,
        machine_state: machineState,
        suggested_action: 'Spotter at Bay 2 during reversing; review with dumper driver',
      }
      const finishReport = (structured: Record<string, string>, live: boolean) => {
        const { live: _drop, ...fields } = structured as Record<string, string> & { live?: unknown }
        void _drop
        setReport({ transcript: text, structured: fields, live, blackbox: box.filter((_, i) => i % 20 === 0).slice(-6) })
        logEvent(sim, 'warn', `Near-miss reported by voice${live ? ' · LLM structured' : ''}. Black box attached.`)
      }
      // the LLM only formats what the operator said and the real black-box distance; it never decides
      structureIncident({ transcript: text, machine_model: machine.model, machine_id: machine.id, operator_id: operator.id, machine_state: machineState, min_dist_m: minDist })
        .then((r) => finishReport(r, true))
        .catch(() => finishReport(ruleBased, false))
    }
    setListening(true)
    if (!Recognition) { setTimeout(() => finish(fallback), 1500); return }
    const rec = new Recognition()
    rec.lang = 'hi-IN'
    rec.onresult = (e) => finish(e.results[0][0].transcript)
    rec.onerror = () => finish(fallback)
    try { rec.start() } catch { finish(fallback); return }
    // some browsers expose the API but never answer (no mic, permission ignored): never hang on stage
    setTimeout(() => finish(fallback), 8000)
  }, [listening, sim])

  // presenter hotkeys (keyboard-initiated, so nothing here animates)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea, [role=dialog]')) return
      const k = e.key.toLowerCase()
      if (k === 'h') setShowScenarios((v) => !v)
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
          <span className="font-mono text-xs leading-tight font-medium opacity-80">{machine.id}<br />J1939</span>
        </div>
        <div className="hidden min-w-0 leading-tight lg:block">
          <div className="truncate text-[15px] font-semibold">{operator.name}</div>
          <div className="font-mono text-xs text-fg-3">{operator.id} · pattern {patternLabel}</div>
        </div>

        <div className={cn('mx-auto flex h-12 items-center gap-2.5 rounded-md border px-4 text-[15px] font-medium',
          snap.truckPresent ? 'border-good/50 bg-good-soft text-good-text' : 'border-border bg-surface-2 text-fg')}>
          <Truck size={18} aria-hidden />
          {snap.truckPresent ? 'Dumper T-07 at Bay 2 · loading' : <>Next dumper T-03 in <b className="font-mono">{etaMin.toFixed(1)} min</b></>}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Telltale icon={Armchair} label="Seatbelt" state={snap.seatbelt ? 'Fastened' : 'OFF'} tone={snap.seatbelt ? 'good' : 'critical'} />
          <Telltale icon={Power} label="Engine" state={snap.engineOn ? `${rpm} rpm` : 'Off'} tone={snap.engineOn ? 'good' : 'neutral'} />
          <Telltale icon={CircleDashed} label="Swing zone" state={zone.label} tone={zone.tone} />
        </div>
        <div className="hidden px-2 text-right xl:block">
          <div className="font-mono text-[26px] leading-none font-medium tabular">{siteClock(snap)}</div>
          <div className="label-caps text-[10px] text-fg-3">site time</div>
        </div>
        <Button variant="secondary" size="md" onClick={onUndock}><Unplug size={17} /> Undock</Button>
      </header>

      <div className="flex min-h-0 flex-1">
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

          {listening && (
            <div className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md border border-white/15 bg-black/85 px-5 py-3 text-white" role="status">
              <span className="relative flex h-3 w-3"><span className="absolute inset-0 rounded-full bg-critical" style={{ animation: 'var(--animate-pulse-ring)' }} /><span className="relative h-3 w-3 rounded-full bg-critical" /></span>
              Listening… speak in Hindi or English
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            {showScenarios ? (
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

          <Panel title="Unusual behaviour · per hour" outcome="Unusual behaviour" aside={beh && <ModelStatus live={beh.live} />} tone={behFlag ? 'warning' : undefined}>
            {!beh ? <div className="text-sm text-fg-3">Scoring after the first few minutes…</div> : (
              <>
                <StatusBadge tone={behFlag ? 'serious' : 'good'}>{behFlag ? 'Unusual for you' : 'Normal for you'}</StatusBadge>
                <ul className="mt-2 space-y-1 text-sm text-fg-2">
                  {beh.reasons.map((r) => <li key={r}>· {r}</li>)}
                  {beh.unusual && beh.reasons.length === 0 && <li>· Flagged by the anomaly model; no single rule matched</li>}
                </ul>
                <div className="mt-2 font-mono text-[11px] text-fg-3">
                  {beh.hour.load_cycles} cycles/h · {beh.hour.idle_min} min avoidable idle/h · belt off {beh.hour.seatbelt_off_min} min/h{beh.score !== undefined ? ` · score ${beh.score}` : ''}
                </div>
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
                  <li key={e.id} className="flex gap-2.5 text-[13px]">
                    <span className="font-mono text-fg-3">{e.time}</span>
                    <span className={e.level === 'danger' ? 'text-critical-text' : e.level === 'warn' ? 'text-warning-text' : 'text-fg-2'}>{e.text}</span>
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
              <span className={cn('ml-auto font-mono text-[11px]', report.live ? 'text-good-text' : 'text-fg-3')}>{report.live ? '● LLM structured' : '○ rule-based'}</span>
            </div>
            <blockquote className="mt-4 rounded-md border-l-4 border-brand bg-surface-2 p-3 text-[15px] text-fg-2 italic">“{report.transcript}”</blockquote>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(report.structured).map(([k, v]) => (
                <div key={k} className="contents"><dt className="label-caps pt-0.5 text-[11px] text-fg-3">{k.replace(/_/g, ' ')}</dt><dd className="text-fg">{String(v)}</dd></div>
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
