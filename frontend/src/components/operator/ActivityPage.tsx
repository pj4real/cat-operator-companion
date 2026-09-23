import { Activity, Clock, Fuel, Gauge, TableProperties, Timer } from 'lucide-react'
import { hourly, machine, weeklyStats } from '@/data/demo'
import { weekTotals } from '@/lib/stats'
import { inr } from '@/lib/utils'
import { isRowUnusual } from '@/lib/behaviour'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Kpi } from '@/components/ui/kpi'
import { PageHeader } from '@/components/shared/PageHeader'
import { TelemetryTable } from '@/components/shared/TelemetryTable'
import { IdleReasonBars, WeeklyHoursChart } from './charts'

export function ActivityPage() {
  const { total, ot } = weekTotals()
  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow={`WEEK 39 · ${machine.id}`} title="Hours & activity"
        meta="Your hours are verified from clock-in and engine data, so they count for pay and for your passport." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Clock} label="Verified hours" value={total.toFixed(1)} unit="h" sub="Mon–Thu" />
        <Kpi icon={Timer} label="Overtime" value={ot.toFixed(1)} unit="h" sub="time beyond 10 h a day" />
        <Kpi icon={Gauge} label="Utilization" value={weeklyStats.utilizationPct} unit="%" sub={`${weeklyStats.idlePct}% idle`} />
        <Kpi icon={Fuel} label="Idle cost" value={inr(weeklyStats.idleCostINR)} sub={`${weeklyStats.idleFuelL} L diesel`} outcome="Excessive idling" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={Clock} title="Verified hours this week" />
          <CardBody><WeeklyHoursChart /></CardBody>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader icon={Activity} title="Why the engine idled" description="Share of idle minutes this week, from the idle-reason model's output (cached)" outcomes={['Excessive idling']} />
          <CardBody>
            <IdleReasonBars />
            <p className="mt-4 text-[13px] text-fg-3">Only the avoidable share counts against you. Waiting for a truck or a heat rest is part of the job.</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={TableProperties} title="Your machine data" description="Official telemetry sample for EXC001 · OP1001, each hour scored by the unusual-behaviour model"
          outcomes={['Identify unusual behaviour in machine usage']} />
        <CardBody>
          <TelemetryTable rows={hourly.map((r) => ({ ...r, unusual: isRowUnusual(r) }))} />
        </CardBody>
      </Card>
    </div>
  )
}
