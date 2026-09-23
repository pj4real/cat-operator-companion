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
      {captionsOn && (
        <p key={storyIndex} className="max-w-3xl rounded-md bg-black/85 px-4 py-2 text-center text-[15px] leading-snug text-white shadow-3"
          style={{ animation: 'var(--animate-enter)' }}>
          <span className="mr-2 font-mono text-xs text-[#ffcd11]">{ch.time}</span>{ch.caption}
        </p>
      )}
      <nav aria-label="Story chapters" className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-[#101216] p-1 text-white shadow-3">
        <button onClick={() => go(storyIndex - 1)} disabled={storyIndex === 0} aria-label="Previous chapter"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={18} /></button>
        <ol className="flex items-center gap-1">
          {CHAPTERS.map((c, i) => (
            <li key={c.title}>
              <button onClick={() => go(i)} aria-current={i === storyIndex ? 'step' : undefined} title={`${c.time} · ${c.title}`}
                className={cn('flex h-9 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                  i === storyIndex ? 'bg-[#ffcd11] text-black' : i < storyIndex ? 'text-white/70 hover:bg-white/10' : 'text-white/40 hover:bg-white/10')}>
                {i === storyIndex ? <><span className="mr-1.5 font-mono">{i + 1}</span>{c.title}</> : <span className="font-mono">{i + 1}</span>}
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
