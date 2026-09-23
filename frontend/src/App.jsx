import { useCallback, useRef, useState } from 'react'
import { BatteryCharging, Battery, Wifi, PlugZap } from 'lucide-react'
import NormalMode from './components/NormalMode'
import DockTransition from './components/DockTransition'
import DockedMode from './components/DockedMode'
import { createSim, logEvent } from './lib/sim'

export default function App() {
  const [mode, setMode] = useState('normal') // normal | docking | docked
  const [today, setToday] = useState(null)
  const sim = useRef(createSim())

  const dockDone = useCallback(() => {
    logEvent(sim.current, 'ok', 'Docked to EXC001. Limits from site data accepted.')
    setMode('docked')
  }, [])

  const undock = () => {
    const s = sim.current
    setToday({ cycles: s.cycles, idleFuelL: s.idleFuelL, events: s.events.filter((e) => e.level !== 'ok').length })
    setMode('normal')
  }

  const docked = mode === 'docked'
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
          <PlugZap size={12} /> {docked ? 'Docked · EXC001 · J1939' : mode === 'docking' ? 'Docking…' : 'Handheld'}
        </span>
        <span className="ml-auto flex items-center gap-1"><Wifi size={12} /> Site mesh · 6 devices</span>
        <span className="flex items-center gap-1">{docked ? <BatteryCharging size={14} className="text-safe" /> : <Battery size={14} />} 82%</span>
      </div>
      <div className="min-h-0 flex-1">
        {mode === 'normal' && <NormalMode onDock={() => setMode('docking')} today={today} />}
        {mode === 'docking' && <DockTransition onDone={dockDone} />}
        {docked && <DockedMode sim={sim.current} onUndock={undock} />}
      </div>
    </div>
  )
}
