import { Compass, OctagonAlert, Send, ShieldCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { Insight } from '@/types'
import { useFleet, useSiteInsights } from '@/hooks/queries'
import { useApp } from '@/store/app'
import { sendInsightFeedback, sendMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Segmented } from '@/components/ui/controls'
import { ModelStatus } from '@/components/ui/status'
import { CopilotList } from '@/components/shared/CopilotList'

const DEMO_TIMES = ['13:30', '15:30'] as const
const STATUS = {
  safe: { icon: ShieldCheck, label: 'Safe', cls: 'border-good/50 bg-good-soft text-good-text' },
  caution: { icon: TriangleAlert, label: 'Caution', cls: 'border-warning bg-warning-soft text-warning-text' },
  critical: { icon: OctagonAlert, label: 'Critical', cls: 'border-critical bg-critical-soft text-critical-text' },
}

/**
 * Site Copilot: every machine, every operator, the shared dumpers and bowser, the forecast and
 * the operators' messages, joined into at most five decisions, each with an owner and what
 * happens if nobody acts.
 */
export function SiteCopilot() {
  const { siteNow, setSiteNow, setInsightState, focusMachines, highlight } = useApp()
  const { data } = useSiteInsights(siteNow)
  const { data: fleet } = useFleet()
  if (!data) return null

  // who drives each machine, to send an item to the people it concerns
  const driver = Object.fromEntries((fleet?.machines ?? []).map((m) => {
    const [name, id] = m.operator.replace(')', '').split(' (')
    return [m.id, { id, name: name.split(' ')[0] }]
  }))
  const names = Object.fromEntries(Object.values(driver).map((d) => [d.id, d.name]))
  const recipients = (i: Insight) => {
    const ids = i.people.length ? i.people : i.machines.map((m) => driver[m]?.id).filter(Boolean)
    return [...new Set(ids)].filter((id) => names[id])
  }

  const primary = (i: Insight) => {
    if (i.action?.type === 'assign') {
      setInsightState(i.id, 'assigned')
      toast.success(`Assigned to the ${i.owner}`, { description: i.title })
    } else {
      setInsightState(i.id, 'done')
      sendInsightFeedback(i.rule, 'supervisor', 'done').catch(() => { /* offline */ })
      toast.success('Marked done', { description: i.title })
    }
  }

  const sendTo = (i: Insight, ids: string[]) => {
    Promise.all(ids.map((id) => sendMessage(id, 'supervisor', i)))
      .then(() => { setInsightState(i.id, 'sent'); toast.success(`Sent to ${ids.map((id) => names[id]).join(' and ')}`, { description: i.title }) })
      .catch(() => toast.error('Could not reach the operators', { description: 'Try again in a moment.' }))
  }

  const extra = (i: Insight) => {
    if (i.rule === 'from-operator') return null
    const ids = recipients(i)
    if (!ids.length) return null
    return (
      <Button size="sm" variant="secondary" onClick={() => sendTo(i, ids)}>
        <Send size={14} /> Send to {ids.length === 1 ? names[ids[0]] : `${ids.length} operators`}
      </Button>
    )
  }

  const select = (i: Insight) => {
    if (!i.machines.length) return
    focusMachines(i.machines)
    setTimeout(() => document.getElementById('site-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  const s = STATUS[data.status.level]
  const StatusIcon = s.icon
  return (
    <Card>
      <CardHeader icon={Compass} title="Site Copilot"
        description="What needs a decision now, who does it and what else it affects, joined from every machine, operator and the forecast"
        outcomes={['Safety features', 'Identify unusual behaviour in machine usage']}
        actions={<ModelStatus live={data.live} />} />
      <CardBody>
        <div role={data.status.level === 'critical' ? 'alert' : 'status'}
          className={cn('mb-4 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3', s.cls)}>
          <StatusIcon size={22} strokeWidth={2.4} aria-hidden />
          <span className="font-display text-[22px] leading-none font-bold tracking-wide uppercase">{s.label}</span>
          <span className="text-[15px] font-medium">{data.status.text}</span>
        </div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-md text-sm text-fg-3">Select an item to see its machines in the table and on the map. Demo clock re-ranks the list.</p>
          <Segmented label="Clock" size="sm" value={siteNow as (typeof DEMO_TIMES)[number]} options={DEMO_TIMES} onChange={setSiteNow} />
        </div>
        <CopilotList items={[...data.insights, ...data.more]} variant="site" person="supervisor" primary={primary} extra={extra}
          onSelect={select} selectedId={[...data.insights, ...data.more].find((i) => i.machines.join() === highlight.join() && highlight.length)?.id}
          emptyText="The site is running to plan. New items appear here as soon as they need a decision." />
      </CardBody>
    </Card>
  )
}
