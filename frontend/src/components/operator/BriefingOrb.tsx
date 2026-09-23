import { useEffect, useRef } from 'react'
import { MODE_FRAMES, paintFrame, resolvePreset } from 'thinking-orbs/engine'

const PRESET = 64 // the engine's tuned design size; we paint it scaled up, so it stays vector-sharp

/**
 * thinking-orbs' "composing" orb, driven directly from its engine so it can be large and change
 * continuously: colour and speed are read from refs every frame (no effect restarts), time is
 * accumulated so a speed change eases instead of jumping, and the frame is painted with a scale
 * transform at full device resolution.
 */
export function BriefingOrb({ size = 176, color, speed, darkBackground, label }: {
  size?: number
  /** [r, g, b] 0–255 */
  color: number[]
  /** animation speed multiplier; eased toward, never jumped to */
  speed: number
  /** ink shading ramp: toward black on dark backgrounds, toward white on light ones */
  darkBackground: boolean
  label: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ color, speed, darkBackground })
  live.current = { color, speed, darkBackground }

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    el.width = Math.round(size * dpr)
    el.height = Math.round(size * dpr)
    const { mode, speed: base, opts } = resolvePreset('composing', PRESET)
    const frameFn = MODE_FRAMES[mode]
    const scale = (size / PRESET) * dpr
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let t = 0.6, v = live.current.speed, last = performance.now(), raf = 0
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      v += (live.current.speed - v) * Math.min(dt * 2.5, 1) // ease speed changes over ~0.4 s
      if (!reduced) t += dt * base * v
      const [r, g, b] = live.current.color
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, PRESET, PRESET)
      paintFrame(ctx, frameFn(PRESET, t, opts), live.current.darkBackground, { r, g, b })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvas} role="img" aria-label={label} style={{ width: size, height: size, display: 'block' }} />
}
