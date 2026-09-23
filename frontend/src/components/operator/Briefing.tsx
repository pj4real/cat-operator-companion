import { Cable, CircleCheck, Megaphone, Sun, Users, Volume2, Zap } from 'lucide-react'
import { briefing } from '@/data/demo'
import { useApp } from '@/store/app'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

const ICONS = { cable: Cable, zap: Zap, users: Users, sun: Sun }

export function BriefingCard() {
  const setBriefingOpen = useApp((s) => s.setBriefingOpen)
  return (
    <Card>
      <CardHeader icon={Megaphone} title="Today's hazards" outcomes={['Safety features (working conditions)']}
        actions={<Button size="icon-sm" variant="ghost" onClick={() => setBriefingOpen(true)} aria-label="Replay the voice briefing"><Volume2 size={16} /></Button>} />
      <CardBody>
        <ul className="space-y-3">
          {briefing.map((b) => {
            const Icon = ICONS[b.icon]
            return (
              <li key={b.text} className="flex gap-3 text-[15px] leading-snug text-fg" title={b.text}>
                <Icon size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
                {b.text.split('.')[0]}
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex items-center gap-2 text-[13px] text-fg-3">
          <CircleCheck size={15} className="text-good-text" aria-hidden /> Heard and understood · 06:41
        </div>
      </CardBody>
    </Card>
  )
}
