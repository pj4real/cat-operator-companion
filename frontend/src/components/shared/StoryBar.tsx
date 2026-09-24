import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, Captions, X } from 'lucide-react'
import { useApp } from '@/store/app'
import { CHAPTERS, type StoryContext } from '@/lib/story'
import { cn } from '@/lib/utils'

/**
 * Presenter bar for narrating Ravi's day. ← / → step through chapters, C toggles the subtitle,
 * S (or ⌘K → Story mode) shows/hides the bar. Keyboard-driven, so nothing here animates.
 */
export function StoryBar({ ctx, hidden }: { ctx: StoryContext; hidden?: boolean }) {
  const { storyOn, storyIndex, setStory, captionsOn, toggleCaptions } = useApp()

  const go = (i: number) => {
    const next = Math.max(0, Math.min(CHAPTERS.length - 1, i))
    setStory(true, next)
    CHAPTERS[next].enter(ctx)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea')) return
      if (e.key.toLowerCase() === 's' && !(e.target as HTMLElement)?.closest('[role=dialog]')) { setStory(!useApp.getState().storyOn); return }
      if (!useApp.getState().storyOn) return
      const i = useApp.getState().storyIndex
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1) }
      else if (e.key.toLowerCase() === 'c') toggleCaptions()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!storyOn || hidden) return null
  const ch = CHAPTERS[storyIndex]

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {captionsOn && !ch.slide && (
        <div key={storyIndex} className="w-full max-w-[1080px] rounded-xl border border-black/10 bg-white/95 px-5 py-3 text-[#111214] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.35)] backdrop-blur"
          style={{ animation: 'var(--animate-enter)' }}>
          {ch.question ? (
            <>
              <div className="flex items-baseline gap-3">
                {ch.time && <span className="font-mono text-[13px] text-[#80838a]">{ch.time}</span>}
                <span className="shrink-0 rounded-md bg-[#ffcd11] px-1.5 font-display text-[15px] font-bold">Q</span>
                <span className="font-display text-[22px] leading-tight font-bold">{ch.question}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[3px]">
                <span className="text-[15px] leading-snug text-[#44474d]"><b className="text-[#111214]">→</b> {ch.answer}</span>
              </div>
              {ch.data && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 font-mono text-[11px] tracking-wider text-[#80838a]">DATA</span>
                  {ch.data.map((d) => <span key={d} className="rounded-full bg-[#fff4c2] px-2.5 py-0.5 text-[12.5px] font-medium text-[#111214]">{d}</span>)}
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-[15px] leading-snug">{ch.time && <span className="mr-2 font-mono text-xs text-[#80838a]">{ch.time}</span>}{ch.caption}</p>
          )}
        </div>
      )}
      <nav aria-label="Story chapters" className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#101216] p-1 text-white shadow-3">
        <button onClick={() => go(storyIndex - 1)} disabled={storyIndex === 0} aria-label="Previous chapter"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={18} /></button>
        <ol className="flex items-center gap-1">
          {CHAPTERS.map((c, i) => (
            <li key={c.title}>
              <button onClick={() => go(i)} aria-current={i === storyIndex ? 'step' : undefined} title={c.slide ? `Slide · ${c.title}` : `${c.time} · ${c.title}`}
                className={cn('flex h-9 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                  i === storyIndex ? 'bg-[#ffcd11] text-black' : i < storyIndex ? 'text-white/70 hover:bg-white/10' : 'text-white/40 hover:bg-white/10')}>
                {i === storyIndex ? <><span className="mr-1.5 font-mono">{i + 1}</span>{c.title}</> : <span className={cn('font-mono', c.slide && 'underline decoration-[#ffcd11] decoration-2 underline-offset-4')}>{i + 1}</span>}
              </button>
            </li>
          ))}
        </ol>
        <button onClick={() => go(storyIndex + 1)} disabled={storyIndex === CHAPTERS.length - 1} aria-label="Next chapter"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronRight size={18} /></button>
        <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
        <button onClick={toggleCaptions} aria-pressed={captionsOn} aria-label="Toggle subtitles (C)"
          className={cn('flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10', !captionsOn && 'text-white/40')}><Captions size={17} /></button>
        <button onClick={() => setStory(false)} aria-label="Close story mode (S)"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><X size={16} /></button>
      </nav>
    </div>
  )
}
