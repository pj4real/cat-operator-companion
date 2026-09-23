import { useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, BookOpenCheck, CalendarCheck, CalendarClock, CircleCheck, GraduationCap, Play } from 'lucide-react'
import { instructorSlots, lessons, operator } from '@/data/demo'
import { useApp } from '@/store/app'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { StatusBadge } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'

export function TrainingPage() {
  const today = useApp((s) => s.today)
  const [selected, setSelected] = useState(instructorSlots[0].id)
  const [booked, setBooked] = useState<string | null>(null)
  const all = [...(today?.lessons ?? []).map((l) => ({ ...l, isNew: true })), ...lessons.map((l) => ({ ...l, isNew: false }))]
  const p = operator.passport
  const slot = instructorSlots.find((s) => s.id === selected)!

  const book = () => {
    setBooked(slot.id)
    toast.success(`Booked with ${slot.instructor}`, { description: `${slot.day}, ${slot.time} · ${slot.topic}` })
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader eyebrow="OPERATOR TRAINING HUB" title="Training"
        meta="Short lessons built from your own shifts, not a generic course. Each one takes under three minutes." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={BookOpenCheck} title="Lessons from your own shifts" outcomes={['Operator training hub']} />
          <CardBody>
            <ul className="divide-y divide-border">
              {all.map((l) => (
                <li key={l.title} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                    l.done ? 'bg-good-soft text-good-text' : 'bg-surface-3 text-fg-2')}>
                    {l.done ? <CircleCheck size={18} aria-label="Completed" /> : <GraduationCap size={18} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[15px] font-semibold', l.done ? 'text-fg-3 line-through' : 'text-fg')}>{l.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
                      {l.isNew && <StatusBadge tone="info" size="sm" icon={null}>New today</StatusBadge>}
                      <span>{l.from}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-fg-3">{l.mins} min</span>
                  {!l.done && (
                    <Button size="sm" variant="secondary" aria-label={`Start lesson: ${l.title}`}
                      onClick={() => toast(`Lesson queued for your heat break`, { description: l.title })}>
                      <Play size={14} /> Start
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader icon={BadgeCheck} title="Skill passport" description="Travels with you to any machine, any contractor" outcomes={['Operator training hub']} />
          <CardBody>
            <div className="grid grid-cols-3 gap-4">
              <div><div className="font-display text-[34px] leading-none font-semibold text-fg">{p.hours.toLocaleString('en-IN')}</div><div className="mt-1 text-[13px] text-fg-3">verified hours</div></div>
              <div><div className="font-display text-[34px] leading-none font-semibold text-fg">{p.machines}</div><div className="mt-1 text-[13px] text-fg-3">machine types</div></div>
              <div><div className="font-display text-[34px] leading-none font-semibold text-good-text">{p.noStrikeDays}</div><div className="mt-1 text-[13px] text-fg-3">days, 0 utility strikes</div></div>
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold text-fg">Level {p.level} → {p.level + 1}</span>
                <span className="font-mono text-fg-2">{p.nextLevelPct}%</span>
              </div>
              <Meter value={p.nextLevelPct} label={`Progress to level ${p.level + 1}`} className="h-3" barClassName="bg-brand" />
              <p className="mt-2 text-[13px] text-fg-3">Next step: instructor assessment on trenching near utilities.</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader icon={CalendarClock} title="Book an instructor" description="Site training cabin, Bay 1 · outside your shift hours" outcomes={['Operator training hub']} />
        <CardBody>
          <div role="radiogroup" aria-label="Available slots" className="grid gap-3 md:grid-cols-3">
            {instructorSlots.map((s) => {
              const on = s.id === selected
              return (
                <button key={s.id} role="radio" aria-checked={on} onClick={() => setSelected(s.id)}
                  className={cn('rounded-md border p-4 text-left transition-colors duration-150',
                    on ? 'border-fg bg-surface ring-1 ring-fg' : 'border-border bg-surface-2 hover:border-border-strong')}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-fg-2">{s.day}</span>
                    {booked === s.id && <StatusBadge tone="good" size="sm">Booked</StatusBadge>}
                  </div>
                  <div className="mt-1 font-display text-[28px] leading-none font-semibold text-fg">{s.time}</div>
                  <div className="mt-2 text-sm font-medium text-fg">{s.topic}</div>
                  <div className="mt-0.5 text-[13px] text-fg-3">{s.instructor}</div>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <span className="text-[13px] text-fg-3">Your supervisor is told you booked, not what you scored.</span>
            <Button variant="primary" onClick={book} disabled={booked === selected}>
              <CalendarCheck size={17} /> {booked === selected ? 'Booked' : `Book ${slot.day.split(' ')[0]} ${slot.time}`}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
