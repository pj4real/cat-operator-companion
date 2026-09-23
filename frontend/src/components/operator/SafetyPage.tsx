import { ArrowDownToLine, ArrowUpToLine, CircleDashed, Cable, HardHat, Map as MapIcon, ShieldAlert, Sun, Users, Zap } from 'lucide-react'
import { briefing, weeklyStats } from '@/data/demo'
import { useApp } from '@/store/app'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/controls'
import { StatusBadge, type Tone } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'
import { SiteMap } from './SiteMap'

const LIMITS = [
  { icon: ArrowDownToLine, name: 'E-floor', value: '0.9 m', source: 'Fibre route at 1.2 m · Call Before u Dig', tone: 'serious' as Tone },
  { icon: ArrowUpToLine, name: 'E-ceiling', value: '6.0 m', source: '11 kV line over the haul road', tone: 'critical' as Tone },
  { icon: CircleDashed, name: 'Swing watch', value: '7 / 11 m', source: 'Hold swing under 7 m · caution under 11 m', tone: 'warning' as Tone },
]
const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

export function SafetyPage() {
  const today = useApp((s) => s.today)
  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow="ZONE B · BAY 2 · CHAINAGE 4+200" title="Site & safety"
        meta="Limits are proposed from site data before you dock. You accept them; nobody types them in." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader icon={MapIcon} title="Site map" description="Zones, buried utilities, overhead lines and people near your machine" outcomes={['Proximity hazards']} />
          <CardBody><SiteMap /></CardBody>
        </Card>

        <div className="space-y-6 xl:col-span-4">
          <Card>
            <CardHeader icon={HardHat} title="Limits from site data" outcomes={['Proximity hazards']} />
            <CardBody>
              <ul className="divide-y divide-border">
                {LIMITS.map((l) => (
                  <li key={l.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-2"><l.icon size={18} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-fg">{l.name}</div>
                      <div className="text-[13px] text-fg-3">{l.source}</div>
                    </div>
                    <StatusBadge tone={l.tone} icon={null} className="font-mono">{l.value}</StatusBadge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={ShieldAlert} title="Safety record" outcomes={['Seatbelt compliance', 'Incident logging']} />
            <CardBody>
              <div className="grid grid-cols-2 gap-4">
                <div><div className="font-display text-[32px] leading-none font-semibold text-good-text">{weeklyStats.safetyScore}</div><div className="mt-1 text-[13px] text-fg-3">safety score</div></div>
                <div><div className="font-display text-[32px] leading-none font-semibold text-fg">{weeklyStats.incidentsThisWeek}</div><div className="mt-1 text-[13px] text-fg-3">incidents this week</div></div>
              </div>
              <div className="label-caps mt-5 mb-2 text-fg-3">Logged today</div>
              {today && today.events.length > 0 ? (
                <ul className="space-y-2">
                  {today.events.map((e) => (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <span className="font-mono text-fg-3">{e.time}</span>
                      <span className={e.level === 'danger' ? 'text-critical-text' : 'text-fg-2'}>{e.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={ShieldAlert} title="Nothing logged yet today">
                  Seatbelt, swing-radius and near-miss events from the docked display appear here.
                </EmptyState>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Hazards on today's plan" description="From the pre-shift briefing" outcomes={['Safety features (working conditions)']} />
        <CardBody>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {briefing.map((b) => {
              const Icon = ICONS[b.icon]
              return (
                <li key={b.text} className="rounded-md border border-border bg-surface-2 p-4">
                  <Icon size={20} className="text-fg-2" aria-hidden />
                  <p className="mt-2 text-[15px] leading-snug text-fg">{b.text}</p>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
