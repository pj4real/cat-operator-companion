import { cn } from '@/lib/utils'

/** Product mark: a tablet on its dock connector, in safety yellow. */
export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="6" fill="var(--brand)" />
      <rect x="7" y="6" width="18" height="15" rx="2" fill="#121314" />
      <rect x="9.5" y="8.5" width="13" height="10" rx="1" fill="var(--brand)" />
      <path d="M12 21h8l-1.5 5h-5z" fill="#121314" />
    </svg>
  )
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-wide text-fg uppercase">Operator Companion</div>
          <div className="mt-1 font-mono text-[10.5px] text-fg-3">NH-48 · Package 3</div>
        </div>
      )}
    </div>
  )
}
