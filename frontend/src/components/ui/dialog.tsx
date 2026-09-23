import type { ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { usePortalContainer } from '@/lib/portal'

export const Dialog = DialogPrimitive.Root
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description
export const DialogClose = DialogPrimitive.Close

const TONE = {
  neutral: 'border-border',
  brand: 'border-brand',
  warning: 'border-warning',
  critical: 'border-critical',
}

/**
 * Centered modal (modals stay centered; they don't scale from a trigger).
 * `locked` removes every dismiss path: used for interlocks that must be resolved, not closed.
 */
export function DialogContent({ children, tone = 'neutral', locked = false, className, label }: {
  children: ReactNode; tone?: keyof typeof TONE; locked?: boolean; className?: string; label?: string
}) {
  const block = (e: Event) => { if (locked) e.preventDefault() }
  const portal = usePortalContainer()
  return (
    <DialogPrimitive.Portal container={portal}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-overlay-in" />
      <DialogPrimitive.Content
        aria-label={label}
        aria-describedby={undefined}
        onEscapeKeyDown={block}
        onPointerDownOutside={block}
        onInteractOutside={block}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border-2 bg-surface p-6 text-fg shadow-3 focus:outline-none data-[state=open]:animate-dialog-in',
          TONE[tone], className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
