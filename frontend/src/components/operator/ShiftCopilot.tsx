import { Compass } from 'lucide-react'
import { toast } from 'sonner'
import type { Insight } from '@/types'
import { operator } from '@/data/demo'
import { useInsights } from '@/hooks/queries'
import { useApp } from '@/store/app'
import { sendInsightFeedback, sendMessage } from '@/lib/api'
import { speak } from '@/lib/voice'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { ModelStatus } from '@/components/ui/status'
import { CopilotList } from '@/components/shared/CopilotList'

const DEMO_TIMES = ['07:00', '09:00', '12:30', '15:30'] as const

/**
 * Shift Copilot: everything the tablet knows (plan, weather, site hazards, machine health, fuel,
 * the operator's own twin, yesterday's events, the supervisor's messages) joined into at most
 * five things to do, each with its reason and sources.
 */
export function ShiftCopilot() {
  const { copilotNow, setCopilotNow, setInsightState, navigate } = useApp()
  const { data } = useInsights(copilotNow)
  if (!data) return null

  const done = (i: Insight) => {
    setInsightState(i.id, 'done')
    sendInsightFeedback(i.rule, operator.id, 'done').catch(() => { /* offline */ })
  }

  const primary = (i: Insight) => {
    switch (i.action?.type) {
      case 'notify_supervisor':
        sendMessage('supervisor', operator.id, i)
          .then(() => { setInsightState(i.id, 'sent'); toast.success('Sent to your supervisor', { description: i.title }) })
          .catch(() => toast.error('Could not reach the site server', { description: 'Kept on the tablet. Try again when back in range.' }))
        break
      case 'refuel_stop':
        done(i)
        toast.success(`Refuel stop added · ${i.when}`, { description: i.why })
        break
      case 'play_voice':
        speak(`${i.title}. ${i.why}.`)
        break
      case 'open_lesson':
        navigate('operator', 'training')
        break
      default:
        done(i)
    }
  }

  return (
    <Card>
      <CardHeader icon={Compass} title="Shift Copilot"
        description="The few things that matter, joined from the weather, your tasks, your machine, the site and your past shifts"
        outcomes={['Daily task dashboard', 'Safety features']}
        actions={<ModelStatus live={data.live} />} />
      <CardBody>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-md text-sm text-fg-3">
            Demo clock: move the time and the list re-ranks. What is past drops off, what is close moves up.
          </p>
          <Segmented label="Clock" size="sm" value={copilotNow as (typeof DEMO_TIMES)[number]} options={DEMO_TIMES} onChange={setCopilotNow} />
        </div>
        <CopilotList items={[...data.insights, ...data.more]} variant="operator" person={operator.id} primary={primary}
          emptyText="Everything for this part of the shift is done. The next item appears when it matters." />
      </CardBody>
    </Card>
  )
}
