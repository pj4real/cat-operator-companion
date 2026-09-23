import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Check, ClipboardCheck, HeartPulse, PenLine, PlugZap, RotateCcw, TriangleAlert, Undo2 } from 'lucide-react'
import { machine } from '@/data/demo'
import { WALKAROUND_SIGNED_AT, type WalkCheck } from '@/data/walkaround'
import { useWalkaround } from '@/hooks/walkaround'
import { useApp, type CheckResult } from '@/store/app'
import { machineImage } from '@/lib/machines'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Meter } from '@/components/ui/controls'
import { ModelStatus, StatusBadge } from '@/components/ui/status'
import { PageHeader } from '@/components/shared/PageHeader'

function statusOf(r: CheckResult | undefined) {
  return r?.status ?? 'todo'
}

/** Numbered marker on the photo. The flagged one pulses until it is checked. */
function Hotspot({ n, check, result, selected, flagged, onSelect }: {
  n: number; check: WalkCheck; result?: CheckResult; selected: boolean; flagged: boolean; onSelect: () => void
}) {
  const s = statusOf(result)
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      aria-label={`${n}. ${check.title}${flagged ? ', flagged by the health model' : ''}${s === 'ok' ? ', checked OK' : s === 'issue' ? ', issue reported' : ''}`}
      style={{ left: `${check.spot.x}%`, top: `${check.spot.y}%` }}
      className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full">
      {flagged && s === 'todo' && (
        <span className="absolute inset-1 rounded-full bg-warning" style={{ animation: 'var(--animate-pulse-ring)' }} aria-hidden />
      )}
      <span className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-[17px] font-bold shadow-1',
        'transition-[background-color,box-shadow] duration-150 ease-out',
        s === 'ok' && 'border-surface bg-good text-white',
        s === 'issue' && 'border-surface bg-serious text-white',
        s === 'todo' && (flagged ? 'border-surface bg-warning text-brand-fg' : 'border-surface bg-fg text-bg'),
        selected && 'ring-[3px] ring-fg ring-offset-2 ring-offset-surface-2',
      )}>
        {s === 'ok' ? <Check size={17} strokeWidth={3} aria-hidden /> : s === 'issue' ? <TriangleAlert size={15} strokeWidth={2.6} aria-hidden /> : n}
      </span>
    </button>
  )
}

export function WalkaroundPage() {
  const { navigate, setDevice, recordCheck, clearCheck, signWalkaround, resetWalkaround } = useApp()
  const results = useApp((s) => s.walkaround.results)
  const { checks, flagged, health, signedAt, total, done, issues, flaggedIssue } = useWalkaround()
  const firstOpen = checks.find((c) => !results[c.id])?.id ?? checks[0].id
  const [selectedId, setSelectedId] = useState(firstOpen)
  const [reporting, setReporting] = useState(false)
  const img = machineImage('Excavator')
  const h = health ?? machine.healthFallback
  const reason = h.reasons[0]

  const selected = checks.find((c) => c.id === selectedId) ?? checks[0]
  const selIndex = checks.indexOf(selected)
  const selResult = results[selected.id]
  const isFlagged = selected.id === flagged

  const select = (id: string) => { setSelectedId(id); setReporting(false) }
  const nextOpen = (after: string) => {
    const pending = checks.filter((c) => c.id !== after && !results[c.id])
    return pending[0]?.id
  }
  const answer = (result: CheckResult) => {
    recordCheck(selected.id, result)
    setReporting(false)
    if (result.status === 'issue') {
      toast.warning(`Issue logged: ${selected.title}`, { description: `${result.issue}. Maintenance and your supervisor can see it.` })
    }
    const next = nextOpen(selected.id)
    if (next) setSelectedId(next)
  }
  const sign = () => {
    signWalkaround(WALKAROUND_SIGNED_AT)
    toast.success(`Walkaround signed ${WALKAROUND_SIGNED_AT}`, { description: `${total} of ${total} checked · ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'} reported` })
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        eyebrow={`PRE-START · ${machine.id} · ${machine.model.toUpperCase()}`}
        title="Walkaround"
        meta={<>
          {signedAt
            ? <StatusBadge tone="good" icon={PenLine}>Signed {signedAt}</StatusBadge>
            : <StatusBadge tone="neutral" icon={ClipboardCheck}>{done} of {total} checked</StatusBadge>}
          <span>{total} checks{flagged ? ' · 1 flagged by the health model, so it comes first' : ''}</span>
        </>}
        actions={<Button variant="ghost" onClick={() => navigate('operator', 'today')}><ArrowLeft size={17} /> Today</Button>}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-7">
          <CardHeader icon={ClipboardCheck} title="Ordered by prediction"
            description={flagged ? 'Health model first, then the usual walk order. Tap a number or a line.' : 'Usual walk order. Tap a number or a line.'}
            outcomes={['Safety features']} actions={<ModelStatus live={health?.live} />} />
          {/* 3:2 window on the 4:3 photo: crops the empty sky above the boom. Image and markers share one box so % positions line up. */}
          <div className="relative mx-5 aspect-[3/2] overflow-hidden rounded-md bg-gradient-to-b from-surface-2 to-surface-3 ring-1 ring-border">
            <div className="absolute inset-x-0 bottom-[3%] h-px bg-border-strong" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 aspect-[4/3]">
              {img && <img src={img.src} alt={`${img.alt}, left side, with numbered check points`} draggable={false}
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_4px_6px_rgb(0_0_0/0.25)]" />}
              {checks.map((c, i) => (
                <Hotspot key={c.id} n={i + 1} check={c} result={results[c.id]} selected={c.id === selected.id}
                  flagged={c.id === flagged} onSelect={() => select(c.id)} />
              ))}
            </div>
          </div>
          <CardBody className="pt-4">
            <ol className="grid gap-2 md:grid-cols-2">
              {checks.map((c, i) => {
                const r = results[c.id]
                const s = statusOf(r)
                const on = c.id === selected.id
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => select(c.id)} aria-current={on ? 'step' : undefined}
                      className={cn('flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-[background-color,border-color] duration-150',
                        on ? 'border-fg bg-surface-3' : 'border-border bg-surface hover:bg-surface-2')}>
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold',
                        s === 'ok' && 'bg-good-soft text-good-text',
                        s === 'issue' && 'bg-serious-soft text-serious-text',
                        s === 'todo' && (c.id === flagged ? 'bg-warning text-brand-fg' : 'bg-surface-3 text-fg-2'))}>
                        {s === 'ok' ? <Check size={16} strokeWidth={3} aria-hidden /> : s === 'issue' ? <TriangleAlert size={15} aria-hidden /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-tight font-semibold text-fg">{c.title}</span>
                        {r?.status === 'issue'
                          ? <span className="mt-0.5 block truncate text-[13px] text-serious-text">{r.issue}</span>
                          : c.id === flagged
                            ? <span className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-warning-text"><HeartPulse size={13} aria-hidden /> Flagged by the health model</span>
                            : s === 'ok' ? <span className="mt-0.5 block text-[13px] text-good-text">OK</span> : null}
                      </span>
                      {s !== 'todo' && <span className="sr-only">{s === 'ok' ? 'Checked OK' : 'Issue reported'}</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </CardBody>
        </Card>

        <Card className="xl:sticky xl:top-22 xl:col-span-5">
          {/* what to look for + the answer */}
          <CardBody className="pt-5" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-fg-3">CHECK {selIndex + 1} OF {total}</span>
              {isFlagged && <StatusBadge tone="warning" size="sm" icon={HeartPulse}>Flagged by the health model</StatusBadge>}
              {selResult?.status === 'ok' && <StatusBadge tone="good" size="sm">Checked OK</StatusBadge>}
              {selResult?.status === 'issue' && <StatusBadge tone="serious" size="sm">Issue reported</StatusBadge>}
            </div>
            <h2 className="mt-1.5 font-display text-[28px] leading-tight font-semibold text-fg">{selected.title}</h2>
            {isFlagged && (
              <div className="mt-2 rounded-md border border-warning/50 bg-warning-soft px-3 py-2.5 text-sm text-fg">
                <div className="font-semibold">{h.action}</div>
                {reason && (
                  <div className="mt-0.5 text-fg-2">
                    {reason.factor} <b className="font-mono font-medium text-fg">{reason.value}</b>, usual {reason.usual} · {h.risk_pct}% failure risk, next 50 h
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 label-caps text-fg-3">What to look for</div>
            <p className="mt-1 text-[15px] text-fg-2">{selected.lookFor}</p>

            {selResult?.status === 'issue' && (
              <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-serious-text">
                <TriangleAlert size={17} aria-hidden /> {selResult.issue}
              </p>
            )}

            {signedAt ? null : selResult && !reporting ? (
              <Button variant="ghost" className="mt-3 -ml-2" onClick={() => clearCheck(selected.id)}><Undo2 size={17} /> Change answer</Button>
            ) : reporting ? (
              <div className="mt-4">
                <div className="label-caps text-fg-3">What did you find?</div>
                <div className="mt-2 grid gap-2" role="group" aria-label="Issue type">
                  {selected.issues.map((issue) => (
                    <Button key={issue} size="lg" variant="secondary" className="justify-start text-left whitespace-normal"
                      onClick={() => answer({ status: 'issue', issue })}>
                      <TriangleAlert size={18} className="shrink-0 text-serious-text" aria-hidden /> {issue}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" className="mt-2 -ml-2" onClick={() => setReporting(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="success" size="lg" className="font-display text-lg tracking-wide uppercase" onClick={() => answer({ status: 'ok' })}
                  aria-label={`${selected.title}: OK`}>
                  <Check size={20} strokeWidth={2.6} className="shrink-0" aria-hidden /> OK
                </Button>
                <Button variant="secondary" size="lg" className="font-display text-lg tracking-wide uppercase" onClick={() => setReporting(true)}
                  aria-label={`${selected.title}: report issue`}>
                  <TriangleAlert size={19} className="shrink-0 text-serious-text" aria-hidden /> Report issue
                </Button>
              </div>
            )}
          </CardBody>

          <div className="border-t border-border px-5 pt-4 pb-5">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-fg">{done} of {total} checked</span>
              <span className="font-mono text-fg-3">{issues.length} {issues.length === 1 ? 'issue' : 'issues'} reported</span>
            </div>
            <Meter value={done} max={total} label={`${done} of ${total} checks done`} className="h-2" barClassName="bg-brand" />
            {signedAt ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-good/40 bg-good-soft px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-good-text"><PenLine size={17} aria-hidden /> Signed {signedAt}</div>
                  <div className="mt-0.5 text-sm text-fg-2">{total} of {total} checked · {issues.length} {issues.length === 1 ? 'issue' : 'issues'} reported</div>
                </div>
                {issues.length > 0 && <IssueNote flaggedIssue={flaggedIssue} />}
                <Button variant="primary" size="lg" className="w-full font-display text-lg tracking-wide uppercase" onClick={() => setDevice('docking')}>
                  <PlugZap size={20} strokeWidth={2.4} /> Dock to {machine.id}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => { resetWalkaround(); setSelectedId(checks[0].id) }}>
                  <RotateCcw size={16} /> Start a new walkaround
                </Button>
              </div>
            ) : (
              <>
                <Button variant="primary" size="lg" className="mt-4 w-full font-display text-lg tracking-wide uppercase" disabled={done < total} onClick={sign}>
                  <PenLine size={19} /> Sign walkaround
                </Button>
                <p className="mt-2 text-center text-[13px] text-fg-3">
                  {done < total ? `${total - done} left. Every check needs an answer before you sign.` : 'Your name and the time go on the machine record.'}
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

/** Text only: the demo doesn't send anything, it says who can see the log. */
export function IssueNote({ flaggedIssue, className }: { flaggedIssue: boolean; className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 rounded-sm bg-serious-soft px-2.5 py-2 text-[13px] font-medium text-serious-text', className)}>
      <TriangleAlert size={15} className="mt-px shrink-0" aria-hidden />
      {flaggedIssue
        ? 'Your finding matches the health model. Maintenance and your supervisor are informed and can see it on the machine record.'
        : 'Logged on the machine record. Maintenance and your supervisor are informed.'}
    </p>
  )
}
