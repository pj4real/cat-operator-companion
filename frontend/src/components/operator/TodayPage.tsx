import { Clock, ListChecks, Volume2 } from 'lucide-react'
import { operator, tasks } from '@/data/demo'
import { useTaskPrediction } from '@/hooks/queries'
import { useApp } from '@/store/app'
import { firstName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ModelStatus, StatusBadge } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'
import { TaskEstimate } from './TaskEstimate'
import { FuelPlanStrip, HealthCard, MachineCard } from './MachineCards'
import { BriefingCard } from './Briefing'
import { ShiftSummaryCard } from './ShiftSummary'

export function TodayPage() {
  const { today, setBriefingOpen } = useApp()
  const { data: first } = useTaskPrediction(tasks[0], {})
  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow={`WED 23 SEP · ${operator.site.toUpperCase()}`}
        title={`Good morning, ${firstName(operator.name)}`}
        meta={<>
          <StatusBadge tone="good" icon={Clock}>Clocked in 06:52</StatusBadge>
          <span>Shift {operator.shift} · {tasks.length} tasks · first at {tasks[0].start}</span>
        </>}
        actions={<Button variant="ghost" onClick={() => setBriefingOpen(true)}><Volume2 size={17} /> Replay briefing</Button>}
      />

      {today && <ShiftSummaryCard today={today} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader icon={ListChecks} title="Today's tasks"
            description="Likely time from past jobs, today's weather, soil and your skill. Tap a task for the details."
            outcomes={['Daily task dashboard', 'Task time estimation']}
            actions={<ModelStatus live={first?.live} />} />
          <CardBody>
            <ol>{tasks.map((t) => <TaskEstimate key={t.id} task={t} />)}</ol>
            <FuelPlanStrip />
          </CardBody>
        </Card>
        <div className="space-y-6 xl:col-span-4">
          <MachineCard />
          <HealthCard />
          <BriefingCard />
        </div>
      </div>
    </div>
  )
}
