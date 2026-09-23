import { useMemo, useState } from 'react'
import { ArrowLeft, Box, CirclePlay, Search, X } from 'lucide-react'
import { HELP, type HelpItem } from '@/data/help'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function Thumb({ item, className }: { item: HelpItem; className?: string }) {
  return (
    <span className={cn('relative block shrink-0 overflow-hidden rounded-md bg-surface-3', className)}>
      <img src={thumb(item.video.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
      <span className="absolute right-1 bottom-1 rounded-sm bg-black/80 px-1 font-mono text-[10px] text-white">{mmss(item.video.seconds)}</span>
    </span>
  )
}

function Badge3D() {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-sm bg-brand px-1.5 font-mono text-[10px] font-semibold text-brand-fg">
      <Box size={11} aria-hidden /> 3D guide
    </span>
  )
}

/**
 * Help manual on the machine display: short how-to videos. Questions with a 3D guide also move the
 * site view into the cab and light up the control the video is about.
 */
export function HelpPanel({ selected, onSelect, onClose }: {
  selected: HelpItem | null
  onSelect: (item: HelpItem | null) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? HELP.filter((h) => `${h.question} ${h.category} ${h.video.title}`.toLowerCase().includes(needle)) : HELP
  }, [q])
  const featured = results.filter((h) => h.featured)
  const rest = results.filter((h) => !h.featured)

  return (
    <aside aria-label="Help and how-to videos" className="absolute inset-y-0 right-0 z-30 flex w-[420px] max-w-full flex-col border-l border-border bg-surface shadow-3"
      style={{ animation: 'var(--animate-enter)' }}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        {selected ? (
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}><ArrowLeft size={16} /> All questions</Button>
        ) : (
          <h2 className="px-1 font-display text-lg font-bold tracking-wide uppercase">Help & how-to</h2>
        )}
        <button onClick={onClose} aria-label="Close help" className="ml-auto flex h-10 w-10 items-center justify-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
          <X size={18} />
        </button>
      </header>

      {selected ? (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="aspect-video w-full bg-black">
            <iframe
              key={selected.video.id}
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${selected.video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={selected.video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <div className="space-y-4 p-4">
            <div>
              <div className="label-caps text-fg-3">{selected.category}</div>
              <h3 className="mt-1 text-lg leading-snug font-semibold text-fg">{selected.question}</h3>
              <p className="mt-1 text-[13px] text-fg-3">{selected.video.title} · {selected.video.channel} · {mmss(selected.video.seconds)}</p>
            </div>
            {selected.focus && (
              <div className="flex items-start gap-3 rounded-md border border-brand/60 bg-brand-soft p-3">
                <Box size={18} className="mt-0.5 shrink-0 text-fg" aria-hidden />
                <p className="text-sm text-fg">
                  <b>On your machine:</b> the site view has moved into the cab. The glowing control is the <b>{selected.focusLabel?.toLowerCase()}</b>.
                </p>
              </div>
            )}
            {selected.steps && (
              <ol className="space-y-2">
                {selected.steps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[15px] text-fg">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-xs text-fg-2">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <label className="relative mb-4 block">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the manual"
              className="h-11 w-full rounded-md border border-border bg-surface-2 pr-3 pl-9 text-[15px] text-fg outline-none placeholder:text-fg-3 focus:border-border-strong" />
          </label>

          {featured.length > 0 && (
            <>
              <div className="label-caps mb-2 px-1 text-fg-3">Asked most on this site</div>
              <ul className="mb-5 space-y-2">
                {featured.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => onSelect(h)}
                      className={cn('flex w-full gap-3 rounded-md border p-2 text-left transition-colors hover:border-border-strong hover:bg-surface-2',
                        h.focus ? 'border-brand/70' : 'border-border')}>
                      <Thumb item={h} className="h-[68px] w-[120px]" />
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="block text-[15px] leading-snug font-semibold text-fg">{h.question}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-3">
                          {h.focus && <Badge3D />}{h.category}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {rest.length > 0 && <div className="label-caps mb-1 px-1 text-fg-3">All topics</div>}
          <ul className="divide-y divide-border">
            {rest.map((h) => (
              <li key={h.id}>
                <button onClick={() => onSelect(h)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-1 py-2.5 text-left hover:bg-surface-2">
                  <CirclePlay size={18} className="shrink-0 text-fg-3" aria-hidden />
                  <span className="flex-1 text-[15px] text-fg">{h.question}</span>
                  <span className="font-mono text-xs text-fg-3">{mmss(h.video.seconds)}</span>
                </button>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p className="px-1 py-6 text-center text-sm text-fg-3">Nothing matches “{q}”.</p>}
        </div>
      )}
    </aside>
  )
}
