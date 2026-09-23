import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, PlugZap } from 'lucide-react'
import { machine, operator } from '../data/demo'

const STEPS = [
  `Machine found: ${machine.model} · ${machine.id} (rental)`,
  'Reading engine and hydraulics over the dock (CAN / J1939)',
  `Loading ${operator.name.split(' ')[0]}'s profile: language, seat, coaching settings`,
  `Joystick check: machine is ${machine.pattern}, you usually run ${operator.usualPattern}`,
  'Site map synced: fibre route, 11 kV line, 1 dumper, 2 workers nearby',
  'Limits proposed from site data: E-floor 0.9 m, E-ceiling 6 m',
]

export default function DockTransition({ onDone }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(onDone, 450)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 520)
    return () => clearTimeout(t)
  }, [step, onDone])

  return (
    <div className="flex h-full items-center justify-center bg-ink text-slate-100">
      <div className="w-[520px] rounded-3xl border border-cat/40 bg-panel p-8 shadow-[0_0_80px_-20px_#ffcd11]" style={{ animation: 'slide-dock 1s ease' }}>
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-cat p-2 text-black"><PlugZap size={26} /></div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">Docking</div>
            <div className="text-xl font-bold">Becoming the machine display</div>
          </div>
        </div>
        <ul className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 text-sm transition ${i <= step ? 'opacity-100' : 'opacity-25'}`}>
              {i < step ? <CheckCircle2 size={18} className="text-safe" /> : i === step ? <Loader2 size={18} className="animate-spin text-cat" /> : <span className="h-[18px] w-[18px] rounded-full border border-line" />}
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
