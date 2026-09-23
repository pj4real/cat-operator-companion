import { useEffect, useRef, useState } from 'react'
import { Fuel, Gauge, Thermometer, Timer, Truck, ShieldAlert, ShieldCheck, Power, Mic, UserRound, Unplug, AlertTriangle, CircleDot } from 'lucide-react'
import SiteScene from './SiteScene'
import { machine, operator } from '../data/demo'
import { classifyIdle } from '../lib/api'
import { SIM_SPEED, DIESEL_INR, logEvent } from '../lib/sim'

const IDLE_TEXT = {
  waiting_for_truck: 'Waiting for truck',
  waste: 'No reason found (waste)',
  heat_rest: 'Heat rest (AC)',
  warm_up: 'Warm-up',
  cool_down: 'Cool-down',
}

function Stat({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className="rounded-xl border border-line bg-black/25 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted"><Icon size={12} />{label}</div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
    </div>
  )
}

function Modal({ children, tone = 'cat' }) {
  const border = tone === 'danger' ? 'border-danger' : tone === 'warn' ? 'border-warn' : 'border-cat'
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className={`w-[460px] rounded-2xl border-2 ${border} bg-panel p-6`}>{children}</div>
    </div>
  )
}

export default function DockedMode({ sim, onUndock }) {
  const [snap, setSnap] = useState({ ...sim })
  const [patternOpen, setPatternOpen] = useState(true)
  const [idle, setIdle] = useState(null)
  const [report, setReport] = useState(null)
  const [listening, setListening] = useState(false)
  const blackbox = useRef([])
  const idleEpisode = useRef(false)

  // read the simulation 4x per second + keep a 60 s black box
  useEffect(() => {
    const id = setInterval(() => {
      setSnap({ ...sim, events: [...sim.events] })
      blackbox.current.push({ t: sim.t, dist: sim.workerDist, zone: sim.zone, working: sim.working, belt: sim.seatbelt, truck: sim.truckPresent })
      blackbox.current = blackbox.current.slice(-240)
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

  const etaMin = (snap.nextTruckEtaSec * SIM_SPEED) / 60
  const idleMin = snap.idleSec / 60
  const rpm = !snap.engineOn ? 0 : snap.working ? 1750 : 1000

  const triggerWorker = () => { sim.workerIntrude = true }
  const clearWorker = () => { sim.workerIntrude = false }
  const beltOff = () => { sim.beltScenario = true; sim.seatbelt = false; logEvent(sim, 'warn', 'Seatbelt unfastened during idle') }
  const fasten = () => { sim.seatbelt = true; sim.beltScenario = false; logEvent(sim, 'ok', 'Seatbelt fastened. Restart guard cleared.') }
  const engineOff = () => { sim.engineOn = false; logEvent(sim, 'ok', `Engine off during truck wait (${etaMin.toFixed(1)} min)`) }
  const engineOn = () => { sim.engineOn = true; logEvent(sim, 'ok', 'Engine started, truck arriving') }

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const fallback = 'Dumper peeche se aaya jab main swing kar raha tha, bahut paas tha'
    const finish = (text) => {
      setListening(false)
      const box = blackbox.current.filter((b) => b.t > sim.t - 60)
      const minDist = Math.min(...box.map((b) => b.dist), 99)
      setReport({
        transcript: text,
        structured: {
          type: 'Near-miss',
          category: /dumper|truck|tipper/i.test(text) ? 'Vehicle interaction' : /worker|aadmi|labour|person/i.test(text) ? 'Person in swing zone' : 'Other',
          severity: minDist < 7 ? 'High' : 'Medium',
          location: 'Zone B, Bay 2 (auto from machine position)',
          machine: `${machine.model} ${machine.id}`,
          operator: operator.id,
          machine_state: box.at(-1)?.working ? 'Working (swinging)' : 'Stationary',
          suggested_action: 'Spotter at Bay 2 during reversing; review with dumper driver',
        },
        blackbox: box.filter((_, i) => i % 20 === 0).slice(-6),
      })
      logEvent(sim, 'warn', 'Near-miss reported by voice. Black box attached.')
    }
    if (!SR) { setListening(true); setTimeout(() => finish(fallback), 1500); return }
    const rec = new SR()
    rec.lang = 'hi-IN'
    rec.onresult = (e) => finish(e.results[0][0].transcript)
    rec.onerror = () => finish(fallback)
    setListening(true)
    rec.start()
  }

  return (
    <div className="flex h-full flex-col">
      {/* top strip */}
      <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <div className="rounded-md bg-cat px-2 py-0.5 text-sm font-extrabold text-black">{machine.model}</div>
        <div className="text-sm text-muted">{machine.id} · {operator.name} · pattern {snap.patternFixed ? 'ISO' : machine.pattern}</div>
        <div className="mx-auto flex items-center gap-2 rounded-full border border-line bg-black/30 px-3 py-1 text-sm">
          <Truck size={15} className={snap.truckPresent ? 'text-safe' : 'text-cat'} />
          {snap.truckPresent ? 'Dumper T-07 at Bay 2, loading' : `Next dumper T-03 in ${etaMin.toFixed(1)} min`}
        </div>
        <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${snap.seatbelt ? 'bg-safe/15 text-safe' : 'bg-danger/20 text-danger'}`}>
          <CircleDot size={12} /> Seatbelt {snap.seatbelt ? 'on' : 'OFF'}
        </div>
        <button onClick={onUndock} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-sm hover:bg-white/5"><Unplug size={14} /> Undock</button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 3D */}
        <div className="relative min-w-0 flex-1">
          <SiteScene sim={sim} />
          {snap.zone === 'danger' && (
            <div className="pointer-events-none absolute inset-0 border-[6px] border-danger/80">
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-xl bg-danger px-5 py-2 text-lg font-bold text-white shadow-lg">
                PERSON IN SWING RADIUS · SWING HELD
              </div>
            </div>
          )}
          {snap.zone === 'caution' && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-xl bg-warn px-5 py-2 font-bold text-black">Worker approaching · 4 s to conflict</div>
          )}
          {/* demo controls */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className="self-center text-[11px] uppercase tracking-wider text-muted">Demo</span>
            <button onClick={snap.workerIntrude ? clearWorker : triggerWorker} className="flex items-center gap-1 rounded-lg bg-black/70 px-3 py-1.5 text-xs hover:bg-black"><UserRound size={13} />{snap.workerIntrude ? 'Worker leaves' : 'New worker walks in'}</button>
            <button onClick={beltOff} className="flex items-center gap-1 rounded-lg bg-black/70 px-3 py-1.5 text-xs hover:bg-black"><CircleDot size={13} />Unbuckle during idle</button>
            <button onClick={startVoice} className="flex items-center gap-1 rounded-lg bg-black/70 px-3 py-1.5 text-xs hover:bg-black"><Mic size={13} />{listening ? 'Listening…' : 'Report near-miss (voice)'}</button>
          </div>
        </div>

        {/* right panel */}
        <aside className="flex w-[330px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line bg-panel p-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat icon={Fuel} label="Fuel" value={`${machine.fuelPct}%`} />
            <Stat icon={Gauge} label="Engine" value={`${rpm} rpm`} tone={snap.engineOn ? '' : 'text-muted'} />
            <Stat icon={Thermometer} label="Hyd. oil" value="71 °C" />
            <Stat icon={Timer} label="Load cycles" value={snap.cycles} tone="text-cat" />
          </div>

          <div className={`rounded-xl border p-3 ${isIdle ? 'border-warn/60 bg-warn/10' : 'border-line bg-black/20'}`}>
            <div className="text-[11px] uppercase tracking-wider text-muted">Idle today</div>
            <div className="flex items-baseline gap-3">
              <div className="text-2xl font-bold">{idleMin.toFixed(1)} min</div>
              <div className="text-sm text-muted">{snap.idleFuelL.toFixed(2)} L · ₹{(snap.idleFuelL * DIESEL_INR).toFixed(0)}</div>
            </div>
            {isIdle && idle && (
              <>
                <div className="mt-1 text-sm">Reason: <b className="text-cat">{IDLE_TEXT[idle.reason] || idle.reason}</b> <span className="text-[11px] text-muted">({Math.round(idle.confidence * 100)}%{idle.live ? ', ML live' : ''})</span></div>
                {etaMin > 3 && (
                  <button onClick={engineOff} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-cat py-2 text-sm font-bold text-black"><Power size={15} />Next truck in {etaMin.toFixed(0)} min · switch off</button>
                )}
              </>
            )}
            {!snap.engineOn && (
              <button onClick={engineOn} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-safe py-2 text-sm font-bold text-safe"><Power size={15} />{snap.truckPresent ? 'Truck here · start engine' : `Engine off · truck in ${etaMin.toFixed(1)} min`}</button>
            )}
          </div>

          <div className="rounded-xl border border-line bg-black/20 p-3 text-sm">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">Limits from site data</div>
            <div className="flex items-center justify-between"><span>E-floor (fibre at 1.2 m)</span><b className="text-orange-300">0.9 m</b></div>
            <div className="flex items-center justify-between"><span>E-ceiling (11 kV line)</span><b className="text-red-300">6.0 m</b></div>
            <div className="flex items-center justify-between"><span>Swing radius watch</span><b className={snap.zone === 'clear' ? 'text-safe' : snap.zone === 'caution' ? 'text-warn' : 'text-danger'}>{snap.zone}</b></div>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-line bg-black/20 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">Event log</div>
            <ul className="space-y-1.5">
              {snap.events.map((e) => (
                <li key={e.id} className="flex gap-2 text-xs">
                  <span className="text-muted">{e.time}</span>
                  <span className={e.level === 'danger' ? 'text-danger' : e.level === 'warn' ? 'text-warn' : 'text-slate-300'}>{e.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {patternOpen && (
        <Modal tone="warn">
          <div className="mb-2 flex items-center gap-2 text-warn"><AlertTriangle size={20} /><b>Different joystick pattern</b></div>
          <p className="text-sm text-slate-300">This rental {machine.model} is set to <b>{machine.pattern}</b>. You have run <b>{operator.usualPattern}</b> for your last 1,400 hours. A mismatch is a common cause of wrong movements in the first minutes.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => { sim.patternFixed = true; logEvent(sim, 'ok', 'Joystick pattern switched to ISO'); setPatternOpen(false) }} className="rounded-lg bg-cat py-2 font-bold text-black">Switch to ISO</button>
            <button onClick={() => { logEvent(sim, 'warn', 'Kept SAE pattern · gentle coaching for 30 min'); setPatternOpen(false) }} className="rounded-lg border border-line py-2">Keep SAE + 60 s drill</button>
          </div>
        </Modal>
      )}

      {snap.haltReason === 'seatbelt' && (
        <Modal tone="danger">
          <div className="mb-2 flex items-center gap-2 text-danger"><ShieldAlert size={22} /><b className="text-lg">Restart guard</b></div>
          <p className="text-sm text-slate-300">The truck is here and work is about to restart after {idleMin.toFixed(0)} min idle, but your seatbelt is off. In your data, unbuckling happens during long idles and carries into the restart.</p>
          <button onClick={fasten} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-safe py-2.5 font-bold text-black"><ShieldCheck size={18} />Seatbelt fastened</button>
        </Modal>
      )}

      {report && (
        <Modal>
          <div className="mb-2 flex items-center gap-2"><Mic size={18} className="text-cat" /><b>Near-miss report</b></div>
          <div className="rounded-lg bg-black/30 p-2 text-sm italic text-slate-300">"{report.transcript}"</div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {Object.entries(report.structured).map(([k, v]) => (
              <div key={k} className="contents"><span className="text-muted">{k.replace('_', ' ')}</span><span>{v}</span></div>
            ))}
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-wider text-muted">Black box · last 60 s</div>
          <div className="mt-1 grid grid-cols-6 gap-1 text-center text-[10px]">
            {report.blackbox.map((b) => (
              <div key={b.t} className={`rounded p-1 ${b.zone === 'danger' ? 'bg-danger/30' : b.zone === 'caution' ? 'bg-warn/20' : 'bg-white/5'}`}>
                <div>{b.working ? 'work' : 'idle'}</div><div>{b.dist.toFixed(0)} m</div>
              </div>
            ))}
          </div>
          <button onClick={() => setReport(null)} className="mt-4 w-full rounded-lg bg-cat py-2 font-bold text-black">Send to safety officer</button>
        </Modal>
      )}
    </div>
  )
}
