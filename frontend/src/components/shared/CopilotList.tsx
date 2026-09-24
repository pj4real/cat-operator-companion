import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Check, ChevronDown, CloudRain, Cpu, HardHat, History, ListChecks, MapPin, Truck, UserCog, X, type LucideIcon,
} from 'lucide-react'
import type { Insight, InsightKind, InsightSourceKind, InsightState } from '@/types'
import { useApp } from '@/store/app'
import { sendInsightFeedback } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/controls'
import { StatusBadge, type Tone } from '@/components/ui/status'

export const KIND: Record<InsightKind, { label: string; tone: Tone }> = {
  act_now: { label: 'Act now', tone: 'critical' },
  plan_ahead: { label: 'Plan ahead', tone: 'warning' },
  heads_up: { label: 'Heads-up', tone: 'info' },
  habit: { label: 'Your habit', tone: 'neutral' },
  well_done: { label: 'Well done', tone: 'good' },
}

const SOURCE_ICON: Record<InsightSourceKind, LucideIcon> = {
  model: Cpu, plan: ListChecks, weather: CloudRain, history: History, site: MapPin, machine: Truck,
  supervisor: UserCog, operator: HardHat,
}

const STATE_LABEL: Partial<Record<InsightState, string>> = { assigned: 'Assigned', sent: 'Sent' }

function SourceChip({ kind, label }: { kind: InsightSourceKind; label: string }) {
  const Icon = SOURCE_ICON[kind] ?? ListChecks
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-surface-3 px-1.5 text-[12px] text-fg-2">
      <Icon size={12} className="text-fg-3" aria-hidden />{label}
    </span>
  )
}

function Row({ item, variant, state, person, primary, extra, onSelect, selected }: {
  item: Insight; variant: 'operator' | 'site'; state?: InsightState; person: string
  primary?: (i: Insight) => void; extra?: ReactNode; onSelect?: (i: Insight) => void; selected?: boolean
}) {
  const [open, setOpen] = useState(false)
  const setInsightState = useApp((s) => s.setInsightState)
  const kind = KIND[item.kind]

  const finish = (s: 'done' | 'dismissed') => {
    setInsightState(item.id, s)
    sendInsightFeedback(item.rule, person, s).catch(() => { /* offline: kept on the tablet */ })
    toast(s === 'done' ? 'Marked done' : 'Dismissed', {
      description: item.title,
      action: { label: 'Undo', onClick: () => setInsightState(item.id, null) },
    })
  }

  return (
    <li className={cn('grid grid-cols-[76px_1fr] gap-x-4 border-t border-border py-4 first:border-t-0 sm:grid-cols-[92px_1fr]',
      selected && '-mx-3 rounded-md bg-brand-soft/60 px-3')}>
      <div className="flex flex-col items-start gap-1.5 pt-0.5">
        <span className="font-mono text-[15px] font-medium text-fg">{item.when ?? 'Today'}</span>
        <StatusBadge tone={kind.tone} size="sm">{kind.label}</StatusBadge>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onSelect?.(item)} disabled={!onSelect}
            className={cn('text-left', onSelect && 'cursor-pointer hover:underline decoration-fg-3 underline-offset-4')}>
            <h3 className="font-display text-[19px] leading-snug font-semibold text-fg">{item.title}</h3>
          </button>
          {state && STATE_LABEL[state] && <StatusBadge tone="info" size="sm" icon={Check}>{STATE_LABEL[state]}</StatusBadge>}
        </div>
        <p className="mt-1 text-[15px] leading-snug text-fg-2">{item.why}</p>

        {variant === 'site' && (item.owner || item.impact) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {item.owner && <span className="text-fg-2"><span className="label-caps text-fg-3">Owner</span> {item.owner}</span>}
            {item.impact && <span className="text-fg-2"><span className="label-caps text-fg-3">If nobody acts</span> {item.impact}</span>}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.from && <StatusBadge tone="info" size="sm" icon={variant === 'site' ? HardHat : UserCog}>From {item.from}</StatusBadge>}
          {item.sources.map((s) => <SourceChip key={s.label} {...s} />)}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.action && primary && (
            <Button size="sm" variant="primary" onClick={() => primary(item)}>{item.action.label}</Button>
          )}
          {extra}
          <Button size="sm" variant="ghost" onClick={() => finish('done')}><Check size={15} /> Done</Button>
          <Button size="sm" variant="ghost" onClick={() => finish('dismissed')} aria-label={`Dismiss: ${item.title}`}><X size={15} /> Dismiss</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(!open)} aria-expanded={open}>
            Why this? <ChevronDown size={15} className={cn('transition-transform', open && 'rotate-180')} />
          </Button>
        </div>

        {open && (
          <div className="mt-2 rounded-md border border-border bg-surface-2 p-3 text-[13px]" style={{ animation: 'var(--animate-enter)' }}>
            {item.evidence.length > 0 && (
              <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1">
                {item.evidence.map((e) => (
                  <div key={e.label} className="contents">
                    <dt className="text-fg-3">{e.label}</dt>
                    <dd className="font-mono text-fg">{e.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className={cn('text-fg-3', item.evidence.length > 0 && 'mt-2')}>
              Rule <span className="font-mono text-fg-2">{item.rule}</span> joined {item.sources.length} sources. Ranked by how serious, how soon
              and how sure (score <span className="font-mono text-fg-2">{item.score}</span>). The rules and models decide; no text is generated.
            </p>
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The ranked list both Copilots show. Items the person marked done or dismissed leave the list,
 * and the next one from "more" moves up, so there are never more than `cap` on screen.
 */
export function CopilotList({ items, variant, person, cap = 5, primary, extra, onSelect, selectedId, emptyText }: {
  items: Insight[]; variant: 'operator' | 'site'; person: string; cap?: number
  primary?: (i: Insight) => void; extra?: (i: Insight) => ReactNode; onSelect?: (i: Insight) => void; selectedId?: string; emptyText: string
}) {
  const { insightState, setInsightState } = useApp()
  const [showMore, setShowMore] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const open = items.filter((i) => insightState[i.id] !== 'done' && insightState[i.id] !== 'dismissed')
  const done = items.filter((i) => insightState[i.id] === 'done')
  const top = open.slice(0, cap)
  const rest = open.slice(cap)
  const row = (i: Insight) => (
    <Row key={i.id} item={i} variant={variant} person={person} state={insightState[i.id]} primary={primary}
      extra={extra?.(i)} onSelect={onSelect} selected={selectedId === i.id} />
  )

  return (
    <div>
      {top.length === 0
        ? <EmptyState icon={Check} title="Nothing needs you right now">{emptyText}</EmptyState>
        : <ol aria-label="Ranked actions">{top.map(row)}</ol>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {rest.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
            {showMore ? 'Hide' : `${rest.length} more`} <ChevronDown size={15} className={cn('transition-transform', showMore && 'rotate-180')} />
          </Button>
        )}
        {done.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            <Check size={15} /> {done.length} done today
          </Button>
        )}
      </div>
      {showMore && rest.length > 0 && <ol aria-label="More actions" className="mt-1">{rest.map(row)}</ol>}
      {showDone && done.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {done.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm text-fg-3">
              <Check size={14} className="text-good-text" aria-hidden />
              <span className="min-w-0 truncate line-through">{i.title}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setInsightState(i.id, null)}>Undo</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
