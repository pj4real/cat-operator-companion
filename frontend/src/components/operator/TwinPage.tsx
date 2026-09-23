import { Radar, CircleCheck, GitCompare, History, Layers, Lightbulb, Table2, TriangleAlert } from 'lucide-react'
import { operator } from '@/data/demo'
import { useTwin } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Kpi } from '@/components/ui/kpi'
import { Skeleton } from '@/components/ui/controls'
import { ModelStatus, StatusBadge } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'
import type { TwinAxis } from '@/types'

/** You vs the comparison, on one scale, with both values labelled (never colour alone). */
function AxisRow({ a }: { a: TwinAxis }) {
  const max = Math.max(a.you, a.site) * 1.15 || 1
  const sign = a.delta_pct > 0 ? '+' : ''
  return (
    <li className="grid grid-cols-[132px_1fr_auto] items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-[15px] font-semibold text-fg">{a.axis}</div>
        <div className="text-[12.5px] text-fg-3">{a.metric}</div>
      </div>
      <div className="space-y-1.5" role="img" aria-label={`You ${a.you} ${a.unit}, ${a.compare} ${a.site} ${a.unit}`}>
        <div className="flex items-center gap-2">
          <div className="h-2.5 rounded-sm bg-s1" style={{ width: `${(a.you / max) * 100}%`, animation: 'bar-in 600ms var(--ease-out) both' }} />
          <span className="font-mono text-xs whitespace-nowrap text-fg">{a.you}{a.unit.startsWith('/') ? '' : ' '}{a.unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 rounded-sm bg-fg-3/45" style={{ width: `${(a.site / max) * 100}%`, animation: 'bar-in 600ms var(--ease-out) both' }} />
          <span className="font-mono text-xs whitespace-nowrap text-fg-3">{a.site} · {a.compare}</span>
        </div>
      </div>
      <StatusBadge tone={a.good ? 'good' : 'warning'} size="sm" className="justify-self-end font-mono">{sign}{a.delta_pct}%</StatusBadge>
    </li>
  )
}

export function TwinPage() {
  const { data: t, isFetching } = useTwin(operator.id)
  if (!t) return <Skeleton className="h-96" />
  const ev = t.evaluation
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow={`DIGITAL TWIN · ${t.operator_id}`} title="Your working pattern"
        meta={<>
          Every alert compares you with <b className="font-semibold text-fg">yourself, in the same conditions</b>, not with one rule for the whole site.
          <ModelStatus live={t.live} />
        </>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={History} label="Hours learned" value={t.hours.toLocaleString('en-IN')}
          sub={t.updates_today > 0 ? `+${t.updates_today} from today's shift` : 'your own telemetry, no labels'}
          valueClassName={cn(isFetching && 'opacity-60')} />
        <Kpi icon={Layers} label="Conditions learned" value={t.contexts} sub="task × weather × machine, 20 h minimum each" />
        {ev && <Kpi icon={Radar} label="Unusual hours caught" value={pct(ev.twin.recall)} valueClassName="text-good-text"
          sub={`one site-wide threshold: ${pct(ev.site_threshold.recall)}`} outcome="Identify unusual behaviour in machine usage" />}
        {ev && <Kpi icon={CircleCheck} label="Flags that were real" value={pct(ev.twin.precision)}
          sub={`site-wide threshold: ${pct(ev.site_threshold.precision)} · ${ev.test_hours} held-out hours`} />}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={GitCompare} title="How you work" description="Your averages against operators doing the same kind of work" />
          <CardBody>
            <div className="mb-3 flex items-center gap-4 text-[13px] text-fg-2" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-s1" />You</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-fg-3/45" />Comparison</span>
            </div>
            <ul className="divide-y divide-border">{t.axes.map((a) => <AxisRow key={a.axis} a={a} />)}</ul>
          </CardBody>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader icon={Lightbulb} title="What your twin has learned" description="Where you differ from your own average. Found in the data, not set by hand." />
          <CardBody>
            <ul className="space-y-3">
              {t.insights.map((i) => (
                <li key={i.text} className="flex gap-3 rounded-md border border-border bg-surface-2 p-3">
                  {i.kind === 'watch'
                    ? <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning-text" aria-label="Watch" />
                    : <CircleCheck size={18} className="mt-0.5 shrink-0 text-good-text" aria-label="Strength" />}
                  <div>
                    <div className="text-[15px] font-semibold text-fg">{i.text}</div>
                    <div className="mt-0.5 text-[13px] text-fg-3">{i.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={Table2} title="Your usual, by condition"
          description="What “normal for you” means in each condition. The docked display scores every hour against the matching row." />
        <CardBody>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-2">
                <tr className="label-caps text-fg-3">
                  <th scope="col" className="px-3 py-2.5">Task</th>
                  <th scope="col" className="px-3 py-2.5">Weather</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Hours</th>
                  <th scope="col" className="px-3 py-2.5">Idle, min/h</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Load cycles/h</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px] tabular">
                {t.by_context.map((r) => (
                  <tr key={r.task_type + r.weather} className="border-t border-border">
                    <td className="px-3 py-2.5 font-sans text-fg">{r.task_type}</td>
                    <td className="px-3 py-2.5 font-sans text-fg-2">{r.weather}</td>
                    <td className="px-3 py-2.5 text-right text-fg-3">{r.hours}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-sm bg-surface-3">
                          <div className="h-full rounded-sm bg-s1" style={{ width: `${Math.min(r.idle_min / 40, 1) * 100}%` }} />
                        </div>
                        <span className="text-fg">{r.idle_min}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-fg">{r.load_cycles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-fg-3">Synthetic history for the demo. On a real site the twin fills from the tablet's own telemetry, one hour at a time.</p>
        </CardBody>
      </Card>
    </div>
  )
}
