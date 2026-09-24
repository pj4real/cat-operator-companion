import { Activity, BellRing, GraduationCap } from 'lucide-react'
import type { ShiftSummary } from '@/types'
import { machine, operator } from '@/data/demo'
import { DIESEL_INR, IDLE_BURN_LPH } from '@/lib/sim'
import { inr } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status'
import { DayTimeline } from './DayTimeline'

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-display text-[24px] leading-none font-semibold text-fg">{value}</div>
      <div className="mt-1 text-[13px] text-fg-3">{label}</div>
    </div>
  )
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** One sentence for the day, computed from what the machine recorded (nothing invented). */
function dayHeadline(t: ShiftSummary) {
  const docked = t.dockedMin >= 60 ? `${(t.dockedMin / 60).toFixed(1)} h docked` : `${Math.round(t.dockedMin)} min docked`
  const loads = `${t.cycles} ${t.cycles === 1 ? 'load' : 'loads'}`
  const offs = t.timeline?.filter((i) => i.kind === 'mark' && i.mark === 'engine_off').length ?? 0
  // fuel the switch-offs saved: site minutes engine-off while no truck was at the bay × idle burn
  const saved = ((t.engineOffWaitMin ?? 0) / 60) * IDLE_BURN_LPH * DIESEL_INR
  const idle = offs > 0
    ? `switched off ${times(offs)} for trucks, saving ${inr(saved)}`
    : t.wasteMin >= 1 ? `${t.wasteMin.toFixed(0)} min avoidable idle (${inr(t.wasteFuelL * DIESEL_INR)})` : 'no avoidable idle'
  return `${docked} · ${loads} · ${idle}`
}

export function ShiftSummaryCard({ today }: { today: ShiftSummary }) {
  const alerts = today.alerts
  return (
    <Card className="border-fg/15" style={{ animation: 'var(--animate-enter)' }}>
      <CardHeader icon={Activity} title="End of shift summary" description="From the machine, while you were docked"
        outcomes={['Identify unusual behaviour in machine usage']} />
      <CardBody>
        <p className="font-display text-[22px] leading-tight font-semibold text-fg">{dayHeadline(today)}</p>

        {today.timeline && today.timeline.length > 0 && (
          <div className="mt-4">
            <div className="label-caps text-fg-3">Your day on {machine.id}</div>
            <DayTimeline timeline={today.timeline} />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <Figure value={`${(today.dockedMin / 60).toFixed(1)} h`} label={`verified on ${machine.id}`} />
          <Figure value={today.cycles} label="load cycles" />
          <Figure value={`${today.idleMin.toFixed(0)} min`} label={`idle · ${today.idleFuelL.toFixed(1)} L · ${inr(today.idleFuelL * DIESEL_INR)}`} />
          <Figure value={today.events.length} label="safety events" />
        </div>

        {(today.beltOffMin > 0 || today.lessons.length > 0) && (
          <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-3">
            {today.beltOffMin > 0 && (
              <StatusBadge tone="serious">Seatbelt off with engine running: {today.beltOffMin.toFixed(0)} min</StatusBadge>
            )}
            {today.lessons.length > 0 && (
              <div className="min-w-[16rem] flex-1">
                <div className="label-caps mb-1 flex items-center gap-1.5 text-fg-3"><GraduationCap size={14} aria-hidden /> New lessons from today</div>
                {today.lessons.map((l) => (
                  <div key={l.title} className="text-[15px] text-fg">{l.title} <span className="font-mono text-xs text-fg-3">· {l.mins} min</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-fg-3">
          <span>Skill passport: +{(today.dockedMin / 60).toFixed(1)} verified hours → {(operator.passport.hours + today.dockedMin / 60).toFixed(0)} h</span>
          {alerts && alerts.total > 0 && (
            <span className="flex items-center gap-1.5">
              <BellRing size={13} aria-hidden />
              {alerts.pushed} of {alerts.total} alerts went to your supervisor (high severity only)
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
