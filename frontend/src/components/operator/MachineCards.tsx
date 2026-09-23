import type { ReactNode } from 'react'
import { ClipboardCheck, TriangleAlert, Fuel, HeartPulse, PlugZap, Wrench } from 'lucide-react'
import { machine, operator } from '@/data/demo'
import { useFuelPlan, useHealth } from '@/hooks/queries'
import { useApp } from '@/store/app'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Meter, Skeleton } from '@/components/ui/controls'
import { MachineThumb } from '@/components/ui/machine-thumb'
import { ModelStatus, StatusBadge } from '@/components/ui/status'
import { RISK } from '@/lib/constants'

function Spec({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps text-fg-3">{label}</dt>
      <dd className={cn('mt-0.5 font-mono text-[15px] font-medium text-fg', tone)}>{value}</dd>
    </div>
  )
}

/** The product's key action: this tablet becomes the machine display. */
export function MachineCard() {
  const setDevice = useApp((s) => s.setDevice)
  const mismatch = machine.pattern !== operator.usualPattern
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-fg px-5 pt-4 pb-4 text-bg">
        <div className="relative z-10 max-w-[55%]">
          <div className="label-caps opacity-70">Your machine today</div>
          <div className="mt-1 font-display text-[30px] leading-none font-bold tracking-tight">{machine.model}</div>
          <div className="mt-1.5 font-mono text-xs opacity-75">{machine.id}</div>
          <div className="mt-0.5 text-xs opacity-75">{machine.owner}</div>
        </div>
        <MachineThumb kind="Excavator" plate={false} className="absolute -right-3 bottom-0 h-[118%] w-[62%]" />
      </div>
      <div className="h-1.5 hazard-stripe" aria-hidden />
      <CardBody className="pt-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Spec label="Engine hours" value={machine.engineHours.toLocaleString('en-IN', { minimumFractionDigits: 1 })} />
          <Spec label="Fuel" value={`${machine.fuelL} L · ${machine.fuelPct}%`} tone={machine.fuelPct < 25 ? 'text-serious-text' : undefined} />
          <Spec label="Service due" value={`in ${machine.serviceDueIn} h`} />
          <Spec label="Joystick" value={<>{machine.pattern} <span className="text-fg-3">· you {operator.usualPattern}</span></>} tone={mismatch ? 'text-warning-text' : undefined} />
        </dl>
        {mismatch && (
          <p className="mt-3 flex items-start gap-2 rounded-sm bg-warning-soft px-2.5 py-2 text-[13px] font-medium text-warning-text">
            <TriangleAlert size={15} className="mt-px shrink-0" aria-hidden />
            Joystick pattern differs from yours. You'll be asked to switch when you dock.
          </p>
        )}
        <Button variant="primary" size="lg" className="mt-4 w-full font-display text-lg tracking-wide uppercase" onClick={() => setDevice('docking')}>
          <PlugZap size={20} strokeWidth={2.4} /> Dock to {machine.id}
        </Button>
      </CardBody>
    </Card>
  )
}

export function HealthCard() {
  const { data: h, isPending } = useHealth()
  return (
    <Card>
      <CardHeader icon={HeartPulse} title="Machine health" description={`Before you start · ${machine.id}`} outcomes={['Safety features']} />
      <CardBody>
        {isPending || !h ? <Skeleton className="h-40" /> : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="font-display text-[44px] leading-none font-semibold text-fg">{h.risk_pct}<span className="text-2xl text-fg-3">%</span></div>
                <div className="mt-1 text-sm text-fg-3">Failure risk, next 50 engine hours</div>
              </div>
              <StatusBadge tone={RISK[h.level].tone} size="lg">{RISK[h.level].label}</StatusBadge>
            </div>

            {h.reasons.length > 0 && (
              <ul className="mt-4 space-y-2.5">
                {h.reasons.map((r) => (
                  <li key={r.factor}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-fg-2">{r.factor} <b className="font-mono font-medium text-fg">{r.value}</b> <span className="text-fg-3">· usual {r.usual}</span></span>
                      <span className="font-mono text-[13px] font-medium text-serious-text">+{r.points} pts</span>
                    </div>
                    <Meter value={r.points} max={Math.max(h.risk_pct, 1)} label={`${r.factor} adds ${r.points} points`} className="mt-1.5 h-1.5" barClassName="bg-serious" />
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-surface-2 p-3">
              <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
              <div className="text-sm">
                <div className="label-caps text-fg-3">Walkaround · first item</div>
                <div className="mt-0.5 font-medium text-fg">{h.action}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-[13px] text-fg-3">
              <span className="flex items-center gap-1.5"><Wrench size={13} aria-hidden /> From S·O·S oil sample + sensors</span>
              <ModelStatus live={h.live} />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

/** Fuel-rate model × task-time model: when the tank hits reserve against today's plan. */
export function FuelPlanStrip() {
  const { data: f } = useFuelPlan()
  const x = f ?? machine.fuelFallback
  const reservePct = (15 / machine.tankL) * 100
  return (
    <div className={cn('mt-2 grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_auto]', x.runs_out_at ? 'border-serious/40 bg-serious-soft' : 'border-border bg-surface-2')}>
      <div className="flex min-w-0 gap-3">
        <Fuel size={20} className={cn('mt-0.5 shrink-0', x.runs_out_at ? 'text-serious-text' : 'text-good-text')} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-fg">
            {x.runs_out_at ? <>Hits reserve around {x.runs_out_at}. Refuel before {x.refuel_before}.</> : <>Enough fuel for today, {x.fuel_left_end_l} L left at shift end.</>}
          </div>
          <div className="mt-0.5 text-[13px] text-fg-2">{x.litres_planned} L planned today · ≈ {x.co2_kg} kg CO₂ · burn rate per task from the fuel model</div>
          <div className="relative mt-3 max-w-md">
            <Meter value={machine.fuelPct} label={`Fuel ${machine.fuelPct} percent`} barClassName={x.runs_out_at ? 'bg-serious' : 'bg-good'} />
            <div className="absolute -top-1 h-4 w-px bg-fg" style={{ left: `${reservePct}%` }} aria-hidden />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-fg-3">
              <span>reserve 15 L</span><span>{machine.fuelL} / {machine.tankL} L</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-end sm:flex-col sm:justify-between"><ModelStatus live={f?.live} /></div>
    </div>
  )
}
