// Calls the FastAPI ML server. If it is not running, callers use their fallback,
// so the demo never breaks on stage.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function call(path, body) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(`${BASE}${path}`, body === undefined ? { signal: ctrl.signal } : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(res.statusText)
    return { ...(await res.json()), live: true }
  } finally {
    clearTimeout(timer)
  }
}

export const predictTask = (input) => call('/predict/task', input)
export const classifyIdle = (window) => call('/classify/idle', window)
export const scoreBehaviour = (hour) => call('/score/behaviour', hour)
export const predictHealth = (day) => call('/predict/health', day)
export const forecastFuel = (plan) => call('/forecast/fuel', plan)
export const getFleet = () => call('/fleet')
