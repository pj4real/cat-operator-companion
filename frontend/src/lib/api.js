// Calls the FastAPI ML server. If it is not running, callers use their fallback,
// so the demo never breaks on stage.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function post(path, body) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const res = await fetch(`${BASE}${path}`, {
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

export const predictTask = (input) => post('/predict/task', input)
export const classifyIdle = (window) => post('/classify/idle', window)
export const scoreBehaviour = (hour) => post('/score/behaviour', hour)
export const structureIncident = (input) => post('/structure/incident', input)
