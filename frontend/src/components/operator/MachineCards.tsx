import { useState, type ReactNode } from 'react'
import { ChevronDown, ClipboardCheck, TriangleAlert, Fuel, HeartPulse, PlugZap, Wrench } from 'lucide-react'
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
import { useWalkaround } from '@/hooks/walkaround'
import { IssueNote } from './WalkaroundPage'

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
  const signed = useApp((s) => s.walkaround.signedAt !== null)
  const mismatch = machine.pattern !== operator.usualPattern
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-fg px-5 pt-4 pb-4 text-bg">
        <div className="relative z-10 max-w-[46%]">
          <div className="label-caps opacity-70">Your machine today</div>
          <div className="mt-1 font-display text-[30px] leading-none font-bold tracking-tight">{machine.model}</div>
          <div className="mt-1.5 font-mono text-xs opacity-75">{machine.id} · rental</div>
          <div className="mt-0.5 text-xs leading-snug opacity-75">{machine.owner.replace(/^Rental · /, '')}</div>
        </div>
        <MachineThumb kind="Excavator" plate={false} className="absolute -right-4 bottom-0 h-[112%] w-[56%]" />
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
        <WalkaroundStep />
        <Button variant={signed ? 'primary' : 'ghost'} size={signed ? 'lg' : 'md'}
          className={cn('w-full', signed ? 'mt-4 font-display text-lg tracking-wide uppercase' : 'mt-2 text-fg-2')}
          onClick={() => setDevice('docking')}>
          <PlugZap size={signed ? 20 : 17} strokeWidth={signed ? 2.4 : 2} /> {signed ? `Dock to ${machine.id}` : `Dock anyway`}
        </Button>
      </CardBody>
    </Card>
  )
}

/** Pre-start walkaround: the step before docking. Primary until it's signed, then a one-line record. */
function WalkaroundStep() {
  const navigate = useApp((s) => s.navigate)
  const w = useWalkaround()
  const open = () => navigate('operator', 'walkaround')
  if (w.signedAt) {
    return (
      <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge tone="good" icon={ClipboardCheck}>Walkaround signed {w.signedAt}</StatusBadge>
          <button onClick={open} className="h-9 rounded-sm px-1 text-sm font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline">View</button>
        </div>
        <div className="mt-1.5 text-[13px] text-fg-2">
          {w.total} of {w.total} checked · {w.issues.length} {w.issues.length === 1 ? 'issue' : 'issues'} reported
          {w.issues.length > 0 && <span className="text-fg-3"> ({w.issues.map((c) => c.title.split(/[:&(]/)[0].trim()).join(', ')})</span>}
        </div>
        {w.issues.length > 0 && <IssueNote flaggedIssue={w.flaggedIssue} className="mt-2" />}
      </div>
    )
  }
  const flagged = w.checks.find((c) => c.id === w.flagged)
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-caps text-fg-3">Before you dock</span>
        <span className="font-mono text-xs text-fg-3">{w.done > 0 ? `${w.done} of ${w.total} done` : `${w.total} checks${flagged ? ' · 1 flagged' : ''}`}</span>
      </div>
      <Button variant="primary" size="lg" className="mt-1.5 w-full font-display text-lg tracking-wide uppercase" onClick={open}>
        <ClipboardCheck size={20} strokeWidth={2.4} /> {w.done > 0 ? 'Continue walkaround' : 'Start walkaround'}
      </Button>
      {flagged && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-fg-2">
          <HeartPulse size={14} className="mt-0.5 shrink-0 text-warning-text" aria-hidden />
          <span><b className="font-semibold text-fg">{flagged.title}</b> first: flagged by the health model</span>
        </p>
      )}
    </div>
  )
}

export function HealthCard() {
  const { data: h, isPending } = useHealth()
  const [why, setWhy] = useState(false)
  return (
    <Card>
      <CardHeader icon={HeartPulse} title="Machine health" outcomes={['Safety features']} actions={h && <ModelStatus live={h.live} />} />
      <CardBody>
        {isPending || !h ? <Skeleton className="h-28" /> : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-[40px] leading-none font-semibold text-fg">{h.risk_pct}<span className="text-2xl text-fg-3">%</span></div>
                <div className="mt-1 text-sm text-fg-3">failure risk, next 50 h</div>
              </div>
              <StatusBadge tone={RISK[h.level].tone} size="lg">{RISK[h.level].label}</StatusBadge>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-surface-2 p-3">
              <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
              <div className="text-sm">
                <div className="label-caps text-fg-3">Check first on your walkaround</div>
                <div className="mt-0.5 font-medium text-fg">{h.action}</div>
              </div>
            </div>
            {h.reasons.length > 0 && (
              <>
                <button onClick={() => setWhy((v) => !v)} aria-expanded={why}
                  className="mt-3 flex h-9 items-center gap-1 text-sm font-medium text-fg-2 hover:text-fg">
                  Why? <ChevronDown size={15} className={cn('transition-transform duration-200', why && 'rotate-180')} />
                </button>
                {why && (
                  <ul className="mt-1 space-y-2.5" style={{ animation: 'var(--animate-enter)' }}>
                    {h.reasons.map((r) => (
                      <li key={r.factor}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-fg-2">{r.factor} <b className="font-mono font-medium text-fg">{r.value}</b> <span className="text-fg-3">· usual {r.usual}</span></span>
                          <span className="font-mono text-[13px] font-medium text-serious-text">+{r.points} pts</span>
                        </div>
                        <Meter value={r.points} max={Math.max(h.risk_pct, 1)} label={`${r.factor} adds ${r.points} points`} className="mt-1.5 h-1.5" barClassName="bg-serious" />
                      </li>
                    ))}
                    <li className="flex items-center gap-1.5 text-[13px] text-fg-3"><Wrench size={13} aria-hidden /> From the S·O·S oil sample and sensors</li>
                  </ul>
                )}
              </>
            )}
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
  return (
    <div className={cn('mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-4 py-3', x.runs_out_at ? 'border-serious/40 bg-serious-soft' : 'border-border bg-surface-2')}>
      <Fuel size={19} className={cn('shrink-0', x.runs_out_at ? 'text-serious-text' : 'text-good-text')} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-fg">
          {x.runs_out_at ? `Refuel before ${x.refuel_before}` : 'Enough fuel for today'}
        </div>
        <div className="text-[13px] text-fg-2">
          {x.runs_out_at ? `Tank reaches reserve around ${x.runs_out_at} · ${x.litres_planned} L planned today` : `${x.fuel_left_end_l} L left at shift end`}
        </div>
      </div>
      <div className="w-32">
        <Meter value={machine.fuelPct} label={`Fuel ${machine.fuelPct} percent`} barClassName={x.runs_out_at ? 'bg-serious' : 'bg-good'} />
        <div className="mt-1 text-right font-mono text-[11px] text-fg-3">{machine.fuelL} L · {machine.fuelPct}%</div>
      </div>
    </div>
  )
}
