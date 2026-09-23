// Narration: tries ElevenLabs via the backend proxy (real voice, key stays
// server-side); falls back to the browser's own speech synthesis if the key
// isn't configured or the server is unreachable, so narration never silently
// does nothing. onAmplitude(0..1) drives the voice orb in real time.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function speak(text, { onAmplitude, lang = 'en-IN' } = {}) {
  return elevenSpeak(text, onAmplitude).catch(() => browserSpeak(text, lang, onAmplitude))
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

async function elevenSpeak(text, onAmplitude) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let res
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

function playWithAnalyser(audio, onAmplitude) {
  return new Promise((resolve) => {
    let ctx, raf
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
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

function browserSpeak(text, lang, onAmplitude) {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    if (!synth) { resolve({ live: false }); return }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    utter.rate = 0.98
    let raf, settled = false
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
