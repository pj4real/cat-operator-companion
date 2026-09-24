// Narration: tries ElevenLabs via the backend proxy (real voice, key stays
// server-side); falls back to the browser's own speech synthesis if the key
// isn't configured or the server is unreachable, so narration never silently
// does nothing. onAmplitude(0..1) drives the voice orb in real time.
import { API_BASE as BASE } from '@/lib/api'

type AmpFn = (v: number) => void

export function speak(text: string, { onAmplitude, lang = 'en-IN' }: { onAmplitude?: AmpFn; lang?: string } = {}): Promise<{ live: boolean }> {
  return elevenSpeak(text, onAmplitude).catch(() => browserSpeak(text, lang, onAmplitude))
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

async function elevenSpeak(text: string, onAmplitude?: AmpFn) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let res: Response
  try {
    res = await fetch(`${BASE}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error('tts unavailable')
  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  try {
    await playWithAnalyser(audio, onAmplitude)
  } finally {
    URL.revokeObjectURL(url)
  }
  return { live: true }
}

function playWithAnalyser(audio: HTMLAudioElement, onAmplitude?: AmpFn) {
  return new Promise<void>((resolve) => {
    let ctx: AudioContext | undefined
    let raf = 0
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctx()
      const src = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyser.connect(ctx.destination)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        onAmplitude?.(avg)
        raf = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // Web Audio graph is optional polish; playback still works without it.
    }
    const cleanup = () => { cancelAnimationFrame(raf); onAmplitude?.(0); ctx?.close?.(); resolve() }
    audio.onended = cleanup
    audio.onerror = cleanup
    audio.play().catch(cleanup)
  })
}

function browserSpeak(text: string, lang: string, onAmplitude?: AmpFn) {
  return new Promise<{ live: boolean }>((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) { resolve({ live: false }); return }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.98
    let raf = 0
    let settled = false
    const pulse = () => { onAmplitude?.(0.3 + Math.random() * 0.3); raf = requestAnimationFrame(pulse) }
    if (onAmplitude) pulse()
    const done = () => {
      if (settled) return
      settled = true
      cancelAnimationFrame(raf)
      onAmplitude?.(0)
      resolve({ live: false })
    }
    utter.onend = done
    utter.onerror = done
    synth.speak(utter)
    // some browsers (esp. headless / no TTS voices installed) never fire onend
    setTimeout(done, Math.max(1500, text.length * 65))
  })
}

/**
 * Short in-cab voice alert: the browser's own voice, so it is instant and works offline.
 * A new alert replaces one still speaking (the latest state is what matters).
 */
export function sayNow(text: string) {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-IN'
  u.rate = 1.02
  synth.speak(u)
}
