import { useEffect, useState } from 'react'
import { BellRing, OctagonAlert, Smartphone, X } from 'lucide-react'
import { machine, operator } from '@/data/demo'

export interface Push { id: number; time: string; reason: string; pushed: number; total: number }

const SHOW_MS = 6000
const EXIT_MS = 150
const SITE = operator.site.split(' ')[0] // "NH-48"

/**
 * What the site supervisor's phone receives when the cab goes Critical. Only high severity
 * escalates; Caution stays on the tablet (the alert budget), so the push stays worth reading.
 * A new push replaces the one on screen.
 */
export function SupervisorPush({ push, onDone, raised = false }: { push: Push | null; onDone: () => void; raised?: boolean }) {
  // which push is on its way out; a new push (new id) is never "leaving"
  const [leavingId, setLeavingId] = useState<number | null>(null)
  const leaving = !!push && leavingId === push.id

  useEffect(() => {
    if (!push) return
    const hide = setTimeout(() => setLeavingId(push.id), SHOW_MS)
    return () => clearTimeout(hide)
  }, [push])

  useEffect(() => {
    if (!leaving) return
    const done = setTimeout(onDone, EXIT_MS)
    return () => clearTimeout(done)
  }, [leaving, onDone])

  if (!push) return null
  return (
    <div key={push.id} role="status" aria-live="polite"
      className={`absolute right-3 z-10 w-[340px] max-w-[calc(100%-24px)] ${raised ? 'bottom-[150px]' : 'bottom-[68px]'}`}
      style={{ animation: leaving ? 'var(--animate-notify-out)' : 'var(--animate-notify-in)' }}>
      <div className="label-caps mb-1.5 flex items-center gap-1.5 text-[10px] text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
        <Smartphone size={12} aria-hidden /> Site supervisor's phone
      </div>
      <div className="rounded-xl border border-border-strong bg-surface p-3 shadow-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg"><BellRing size={13} strokeWidth={2.4} aria-hidden /></span>
          <span className="text-[12.5px] font-semibold text-fg-2">Supervisor · {SITE}</span>
          <span className="ml-auto font-mono text-[11px] text-fg-3">{push.time}</span>
          <button onClick={() => setLeavingId(push.id)} aria-label="Dismiss supervisor notification"
            className="-my-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X size={15} />
          </button>
        </div>
        <p className="mt-1.5 flex gap-2 text-[14px] leading-snug text-fg">
          <OctagonAlert size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-critical-text" aria-hidden />
          <span><b className="font-semibold">{machine.id} · Critical:</b> {push.reason}</span>
        </p>
        <p className="mt-2.5 border-t border-border pt-2 text-[12px] text-fg-3 tabular">
          Pushed: high severity only · {push.pushed} of {push.total} alerts today
        </p>
      </div>
    </div>
  )
}
