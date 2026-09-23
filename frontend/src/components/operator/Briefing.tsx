import { Cable, CircleCheck, Megaphone, Sun, Users, Volume2, Zap } from 'lucide-react'
import { briefing } from '@/data/demo'
import { useApp } from '@/store/app'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

export function BriefingCard() {
  const setBriefingOpen = useApp((s) => s.setBriefingOpen)
  return (
    <Card>
      <CardHeader icon={Megaphone} title="Pre-shift briefing" description="Read to you at 06:40, in your language"
        outcomes={['Safety features (working conditions)']}
        actions={<Button size="sm" variant="ghost" onClick={() => setBriefingOpen(true)}><Volume2 size={15} /> Replay</Button>} />
      <CardBody>
        <ol className="grid gap-3 sm:grid-cols-2">
          {briefing.map((b, i) => {
            const Icon = ICONS[b.icon]
            return (
              <li key={b.text} className="flex gap-3 rounded-md border border-border bg-surface-2 p-3">
                <span className="font-mono text-xs text-fg-3">{String(i + 1).padStart(2, '0')}</span>
                <Icon size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
                <span className="text-[15px] leading-snug text-fg">{b.text}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="good" icon={CircleCheck}>Understood · 2 of 2 check questions</StatusBadge>
          <span className="font-mono text-xs text-fg-3">signed 06:41</span>
        </div>
      </CardBody>
    </Card>
  )
}
