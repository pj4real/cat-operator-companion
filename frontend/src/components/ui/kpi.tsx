import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutcomeTag } from './card'

interface KpiProps {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  icon?: LucideIcon
  valueClassName?: string
  outcome?: string
  className?: string
}

export function Kpi({ label, value, unit, sub, icon: Icon, valueClassName, outcome, className }: KpiProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps text-fg-3">{label}</span>
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-fg-2" aria-hidden>
            <Icon size={15} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className={cn('font-display text-[34px] leading-none font-semibold text-fg', valueClassName)}>
        {value}{unit && <span className="ml-1 text-lg font-medium text-fg-3">{unit}</span>}
      </div>
      {sub && <div className="truncate text-[13px] text-fg-3">{sub}</div>}
      {outcome && <div className="mt-1"><OutcomeTag>{outcome}</OutcomeTag></div>}
    </div>
  )
}
