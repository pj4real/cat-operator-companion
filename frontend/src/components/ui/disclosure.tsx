import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Folds secondary content away. Closed by default so the Copilot is the first thing on the page;
 * the open state is remembered per device (storageKey) or driven by the caller (open/onOpenChange).
 */
export function Disclosure({ title, hint, storageKey, open: controlled, onOpenChange, children }: {
  title: ReactNode; hint?: ReactNode; storageKey?: string; open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode
}) {
  const id = useId()
  const [local, setLocal] = useState(() => {
    try { return storageKey ? localStorage.getItem(storageKey) === '1' : false } catch { return false }
  })
  const open = controlled ?? local
  const toggle = () => {
    const next = !open
    if (onOpenChange) onOpenChange(next)
    else setLocal(next)
    try { if (storageKey) localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* private mode */ }
  }
  return (
    <section>
      <button type="button" onClick={toggle} aria-expanded={open} aria-controls={id}
        className="flex w-full items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left shadow-1 transition-colors hover:bg-surface-2">
        <ChevronDown size={18} className={cn('shrink-0 text-fg-3 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
        <span className="font-display text-[17px] font-semibold tracking-wide text-fg uppercase">{title}</span>
        {hint && <span className="ml-auto truncate text-sm text-fg-3">{hint}</span>}
      </button>
      {open && <div id={id} className="mt-6 space-y-6" style={{ animation: 'var(--animate-enter)' }}>{children}</div>}
    </section>
  )
}
