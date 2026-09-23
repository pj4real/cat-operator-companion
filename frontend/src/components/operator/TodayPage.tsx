import { Activity, Clock, Fuel, ListChecks, ShieldCheck, Volume2 } from 'lucide-react'
import { machine, operator, tasks, weeklyStats } from '@/data/demo'
import { useApp } from '@/store/app'
import { firstName, inr } from '@/lib/utils'
import { weekTotals } from '@/lib/stats'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Kpi } from '@/components/ui/kpi'
import { StatusBadge } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'
import { TaskEstimate } from './TaskEstimate'
import { FuelPlanStrip, HealthCard, MachineCard } from './MachineCards'
import { BriefingCard } from './Briefing'
import { ShiftSummaryCard } from './ShiftSummary'

export function TodayPage() {
  const { today, setBriefingOpen } = useApp()
  const { total, ot } = weekTotals()
  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow={`WED 23 SEP · SHIFT ${operator.shift}`}
        title={`Good morning, ${firstName(operator.name)}`}
        meta={<>
          <StatusBadge tone="good" icon={Clock}>Clocked in 06:52</StatusBadge>
          <span>{operator.role}</span>
          <span className="text-fg-3">·</span>
          <span>{operator.site}</span>
        </>}
        actions={<Button onClick={() => setBriefingOpen(true)}><Volume2 size={17} /> Replay voice briefing</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Clock} label="Hours this week" value={total.toFixed(1)} unit="h" sub={`${ot.toFixed(1)} h overtime · verified`} />
        <Kpi icon={Activity} label="Utilization" value={weeklyStats.utilizationPct} unit="%" sub={`${weeklyStats.idlePct}% idle on ${machine.id}`} />
        <Kpi icon={Fuel} label="Idle cost · week" value={inr(weeklyStats.idleCostINR)} sub={`${weeklyStats.idleFuelL} L diesel at idle`} />
        <Kpi icon={ShieldCheck} label="Safety score" value={weeklyStats.safetyScore} valueClassName="text-good-text" sub={`${weeklyStats.incidentsThisWeek} incidents this week`} />
      </div>

      {today && <ShiftSummaryCard today={today} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Card>
            <CardHeader icon={ListChecks} title="Today's tasks"
              description="Likely time and range from 3,000 past jobs, today's weather, soil and your skill"
              outcomes={['Daily task dashboard', 'Task time estimation']} />
            <CardBody>
              <ol>{tasks.map((t) => <TaskEstimate key={t.id} task={t} />)}</ol>
              <FuelPlanStrip />
            </CardBody>
          </Card>
          <BriefingCard />
        </div>
        <div className="space-y-6 xl:col-span-4">
          <MachineCard />
          <HealthCard />
        </div>
      </div>
    </div>
  )
}
