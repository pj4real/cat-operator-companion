import { useCallback, useRef, useState } from 'react'
import { BatteryCharging, Battery, Wifi, PlugZap, LayoutDashboard, UserRound } from 'lucide-react'
import NormalMode from './components/NormalMode'
import DockTransition from './components/DockTransition'
import DockedMode from './components/DockedMode'
import FleetView from './components/FleetView'
import { createSim, logEvent, IDLE_BURN_LPH, SIM_SPEED } from './lib/sim'

// lessons generated from what actually happened in this shift
function shiftLessons(s) {
  const text = s.events.map((e) => e.text).join(' | ')
  const out = []
  if (s.beltScenario || /Seatbelt unfastened/.test(text)) out.push({ title: 'Restart after a long idle: seat, belt, look', from: 'Today · belt off at restart', mins: 1.5 })
  if (/swing radius/i.test(text)) out.push({ title: 'New worker near the swing: stop, horn, eye contact', from: 'Today · person inside swing radius', mins: 2 })
  if (s.idleWasteSec / 60 > 5) out.push({ title: 'Truck more than 3 min away? Switch off', from: `Today · ${(s.idleWasteSec / 60).toFixed(0)} min avoidable idle`, mins: 1 })
  if (/Near-miss/.test(text)) out.push({ title: 'Dumper reversing near Bay 2: agree hand signals', from: 'Today · your near-miss report', mins: 2 })
  return out.slice(0, 2)
}

export default function App() {
  const [mode, setMode] = useState('normal') // normal | docking | docked | fleet
  const [today, setToday] = useState(null)
  const sim = useRef(createSim())

  const dockDone = useCallback(() => {
    logEvent(sim.current, 'ok', 'Docked to EXC001. Limits from site data accepted.')
    setMode('docked')
  }, [])

  const undock = () => {
    const s = sim.current
    const wasteFuelL = (s.idleWasteSec / 3600) * IDLE_BURN_LPH
    setToday({
      cycles: s.cycles,
      dockedMin: (s.t * SIM_SPEED) / 60,
      idleMin: s.idleSec / 60,
      idleFuelL: s.idleFuelL,
      wasteMin: s.idleWasteSec / 60,
      wasteFuelL,
      beltOffMin: s.seatbeltOffSec / 60,
      events: s.events.filter((e) => e.level !== 'ok'),
      lessons: shiftLessons(s),
    })
    setMode('normal')
  }

  const docked = mode === 'docked'
  const fleet = mode === 'fleet'
  return (
    <div className="flex h-full flex-col">
      {/* device status bar: light for the handheld tablet, dark once docked as the machine display */}
      <div className={docked
        ? 'flex items-center gap-3 bg-black px-4 py-1.5 text-xs text-muted'
        : 'flex items-center gap-3 bg-card px-4 py-1.5 text-xs text-ink2 shadow-sm ring-1 ring-black/[0.06]'}>
        <span className={`flex items-center gap-1.5 font-bold ${docked ? 'text-cat' : 'text-ink1'}`}>
          {!docked && <span className="h-2.5 w-2.5 rounded-[3px] bg-cat" />}OPERATOR COMPANION
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${docked ? 'bg-cat text-black' : 'bg-black/5'}`}>
          <PlugZap size={12} /> {docked ? 'Docked · EXC001 · J1939' : mode === 'docking' ? 'Docking…' : fleet ? 'Supervisor tablet' : 'Handheld'}
        </span>
        {(mode === 'normal' || fleet) && (
          <button onClick={() => setMode(fleet ? 'normal' : 'fleet')}
            className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-ink1 transition hover:bg-black/10">
            {fleet ? <><UserRound size={12} /> Operator view</> : <><LayoutDashboard size={12} /> Supervisor view</>}
          </button>
        )}
        <span className="ml-auto flex items-center gap-1"><Wifi size={12} /> Site mesh · 6 devices</span>
        <span className="flex items-center gap-1">{docked ? <BatteryCharging size={14} className="text-safe" /> : <Battery size={14} />} 82%</span>
      </div>
      <div className="min-h-0 flex-1">
        {mode === 'normal' && <NormalMode onDock={() => setMode('docking')} today={today} />}
        {mode === 'docking' && <DockTransition onDone={dockDone} />}
        {docked && <DockedMode sim={sim.current} onUndock={undock} />}
        {fleet && <FleetView />}
      </div>
    </div>
  )
}
