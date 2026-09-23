import type { HTMLAttributes, ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Single-choice control. Fewer taps than a dropdown and readable at arm's length. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: {
  label: string; value: T; options: readonly T[]; onChange: (v: T) => void; size?: 'sm' | 'md'
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-caps text-fg-3" id={`seg-${label}`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              'rounded-[5px] px-3 font-medium transition-colors duration-150',
              size === 'md' ? 'h-10 text-sm' : 'h-8 text-[13px]',
              value === o ? 'bg-surface text-fg shadow-1 ring-1 ring-border-strong' : 'text-fg-3 hover:text-fg',
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-strong bg-surface-2 px-1 font-mono text-[10.5px] text-fg-3', className)}>
      {children}
    </kbd>
  )
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-fg px-2.5 py-1.5 text-xs text-bg shadow-2">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3', className)} aria-hidden {...props} />
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
      <Icon size={20} className="text-fg-3" aria-hidden />
      <div className="text-sm font-semibold text-fg">{title}</div>
      {children && <div className="max-w-xs text-[13px] text-fg-3">{children}</div>}
    </div>
  )
}

/** Horizontal meter. Colour is supplied by the caller from the status or series tokens. */
export function Meter({ value, max = 100, className, barClassName, label }: {
  value: number; max?: number; className?: string; barClassName?: string; label: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}
      className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cn('h-full origin-left rounded-full bg-fg', barClassName)}
        style={{ width: `${pct}%`, animation: 'bar-in 600ms var(--ease-out) both' }} />
    </div>
  )
}
