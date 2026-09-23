import { useEffect, useState } from 'react'
import { CircleCheck, LoaderCircle, PlugZap } from 'lucide-react'
import { machine, operator } from '@/data/demo'
import { firstName, cn } from '@/lib/utils'
import { MachineThumb } from '@/components/ui/machine-thumb'

const STEPS = [
  { tag: 'ID', text: `Machine found: ${machine.model} · ${machine.id} (rental)` },
  { tag: 'CAN', text: 'Reading engine and hydraulics over the dock (J1939)' },
  { tag: 'USR', text: `Loading ${firstName(operator.name)}'s profile: language, seat, coaching settings` },
  { tag: 'JOY', text: `Joystick check: machine is ${machine.pattern}, you usually run ${operator.usualPattern}` },
  { tag: 'MAP', text: 'Site map synced: fibre route, 11 kV line, 1 dumper, 2 workers nearby' },
  { tag: 'LIM', text: 'Limits proposed from site data: E-floor 0.9 m, E-ceiling 6 m' },
]

export function DockTransition({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setTimeout(step >= STEPS.length ? onDone : () => setStep((s) => s + 1), step >= STEPS.length ? 450 : 520)
    return () => clearTimeout(t)
  }, [step, onDone])

  const pct = Math.min(step / STEPS.length, 1) * 100
  return (
    <div className="flex h-full items-center justify-center bg-bg px-4 text-fg">
      <div className="w-full max-w-[600px] overflow-hidden rounded-xl border border-border bg-surface shadow-3" style={{ animation: 'var(--animate-enter)' }}>
        <div className="h-1.5 hazard-stripe" aria-hidden />
        <div className="p-8">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg"><PlugZap size={26} strokeWidth={2.4} /></span>
            <div className="min-w-0 flex-1">
              <div className="label-caps text-fg-3">Docking · {machine.id}</div>
              <h1 className="font-display text-[28px] leading-tight font-bold">Becoming the machine display</h1>
            </div>
            <MachineThumb kind="Excavator" size="md"
              className={cn('transition-[opacity,transform] duration-500 ease-out', step >= 1 ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0')} />
          </div>
          <ol className="space-y-3" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s.tag} className={cn('flex items-center gap-3 text-[15px] transition-opacity duration-200', i <= step ? 'opacity-100' : 'opacity-30')}>
                {i < step ? <CircleCheck size={18} className="shrink-0 text-good-text" aria-label="done" />
                  : i === step ? <LoaderCircle size={18} className="shrink-0 animate-spin text-brand" aria-label="in progress" />
                    : <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-border-strong" />}
                <span className="w-9 shrink-0 font-mono text-[11px] text-fg-3">{s.tag}</span>
                <span className="text-fg-2">{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
