import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_ICON, TONE_SOFT, TONE_TEXT, type Tone } from '@/lib/tones'

export type { Tone }

/** Status is never colour alone: icon + label, always. */
export function StatusBadge({ tone, children, icon, className, size = 'md' }: {
  tone: Tone; children: ReactNode; icon?: LucideIcon | null; className?: string; size?: 'sm' | 'md' | 'lg'
}) {
  const Icon = icon === null ? null : icon ?? TONE_ICON[tone]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-sm font-semibold whitespace-nowrap',
      size === 'sm' && 'h-6 px-1.5 text-xs',
      size === 'md' && 'h-7 px-2 text-[13px]',
      size === 'lg' && 'h-9 px-3 text-sm',
      TONE_SOFT[tone], TONE_TEXT[tone], className,
    )}>
      {Icon && <Icon size={size === 'lg' ? 16 : 14} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  )
}

/** Honest provenance for every model number: live model vs cached estimate. */
export function ModelStatus({ live, className }: { live?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap', live ? 'text-good-text' : 'text-fg-3', className)}
      title={live ? 'Computed just now by the ML model' : 'ML API unreachable: showing the last cached estimate'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-good' : 'border border-fg-3')} aria-hidden />
      {live ? 'Model live' : 'Cached'}
    </span>
  )
}
