import { Activity, GraduationCap } from 'lucide-react'
import type { ShiftSummary } from '@/types'
import { operator } from '@/data/demo'
import { DIESEL_INR } from '@/lib/sim'
import { inr } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status'

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-display text-[32px] leading-none font-semibold text-fg">{value}</div>
      <div className="mt-1 text-[13px] text-fg-3">{label}</div>
    </div>
  )
}

export function ShiftSummaryCard({ today }: { today: ShiftSummary }) {
  const justified = Math.max(today.idleMin - today.wasteMin, 0)
  const total = Math.max(today.idleMin, 1)
  return (
    <Card className="border-fg/15" style={{ animation: 'var(--animate-enter)' }}>
      <CardHeader icon={Activity} title="End of shift summary" description="From the machine, while you were docked"
        outcomes={['Identify unusual behaviour in machine usage']} />
      <CardBody>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Figure value={`${(today.dockedMin / 60).toFixed(1)} h`} label="verified on EXC001" />
          <Figure value={today.cycles} label="load cycles" />
          <Figure value={`${today.idleMin.toFixed(0)} min`} label={`idle · ${today.idleFuelL.toFixed(1)} L · ${inr(today.idleFuelL * DIESEL_INR)}`} />
          <Figure value={today.events.length} label="safety events" />
        </div>

        <div className="mt-5">
          <div className="flex h-3 overflow-hidden rounded-sm bg-surface-3" role="img"
            aria-label={`${justified.toFixed(0)} minutes justified idle, ${today.wasteMin.toFixed(0)} minutes avoidable`}>
            <div className="bg-s1" style={{ width: `${(justified / total) * 100}%` }} />
            <div className="border-l-2 border-surface bg-s8" style={{ width: `${(today.wasteMin / total) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 text-fg-2"><span className="h-2.5 w-2.5 rounded-sm bg-s1" />{justified.toFixed(0)} min justified (truck close)</span>
            <span className="flex items-center gap-1.5 text-fg-2"><span className="h-2.5 w-2.5 rounded-sm bg-s8" />{today.wasteMin.toFixed(0)} min avoidable · {inr(today.wasteFuelL * DIESEL_INR)}</span>
          </div>
        </div>

        {today.beltOffMin > 0 && (
          <StatusBadge tone="serious" className="mt-4">Seatbelt off with engine running: {today.beltOffMin.toFixed(0)} min</StatusBadge>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {today.events.length > 0 && (
            <div>
              <div className="label-caps mb-2 text-fg-3">Events</div>
              <ul className="space-y-1.5">
                {today.events.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm"><span className="font-mono text-fg-3">{e.time}</span><span className="text-fg-2">{e.text}</span></li>
                ))}
              </ul>
            </div>
          )}
          {today.lessons.length > 0 && (
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <div className="label-caps mb-2 flex items-center gap-1.5 text-fg-3"><GraduationCap size={14} /> New lessons from today</div>
              {today.lessons.map((l) => (
                <div key={l.title} className="text-[15px] text-fg">{l.title} <span className="font-mono text-xs text-fg-3">· {l.mins} min</span></div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-4 text-[13px] text-fg-3">
          Skill passport: +{(today.dockedMin / 60).toFixed(1)} verified hours → {(operator.passport.hours + today.dockedMin / 60).toFixed(0)} h
        </p>
      </CardBody>
    </Card>
  )
}
