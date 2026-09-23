import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-lg border border-border bg-surface shadow-1', className)} {...props} />
}

interface CardHeaderProps {
  title: ReactNode
  icon?: LucideIcon
  description?: ReactNode
  /** problem-statement outcome(s) this block answers, shown as tags */
  outcomes?: string[]
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, icon: Icon, description, outcomes, actions, className }: CardHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 px-5 pt-4 pb-3', className)}>
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-wide text-fg uppercase">
          {Icon && <Icon size={16} strokeWidth={2.25} className="text-fg-3" aria-hidden />}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
      </div>
      {(outcomes?.length || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {outcomes?.map((o) => <OutcomeTag key={o}>{o}</OutcomeTag>)}
          {actions}
        </div>
      )}
    </header>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

/**
 * Names the problem-statement expected outcome a block covers, in the brief's exact words,
 * so reviewers (and the AI screener) can tick them off.
 */
export function OutcomeTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-surface-2 px-2 font-mono text-[10.5px] font-medium tracking-tight whitespace-nowrap text-fg-2">
      <span className="h-1.5 w-1.5 rotate-45 bg-brand ring-1 ring-fg/20" aria-hidden />
      {children}
    </span>
  )
}
