// Calls the FastAPI ML server. If it is not running, callers use their fallback,
// so the demo never breaks on stage.
import type { BehaviourResult, FleetData, FuelPlan, HealthResult, Insight, InsightsResponse, SiteInsightsResponse, TaskPrediction, TwinProfile, TwinScore } from '@/types'

export const API_BASE: string = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type Live<T> = T & { live: true }

async function call<T>(path: string, body?: unknown, timeoutMs = 2500): Promise<Live<T>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, body === undefined ? { signal: ctrl.signal } : {
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

export const predictTask = (input: object) => call<TaskPrediction>('/predict/task', input)
export const classifyIdle = (window: object) => call<{ reason: string; confidence: number }>('/classify/idle', window)
export const scoreBehaviour = (hour: object) => call<BehaviourResult>('/score/behaviour', hour)
export const structureIncident = (input: object) => call<Record<string, string>>('/structure/incident', input, 8000)
export const predictHealth = (day: object) => call<HealthResult>('/predict/health', day)
export const forecastFuel = (plan: object) => call<FuelPlan>('/forecast/fuel', plan)
export const getFleet = () => call<FleetData>('/fleet')
export const getApiHealth = () => call<{ ok: boolean }>('/health', undefined, 1500)
export const getTwin = (operatorId: string) => call<TwinProfile>(`/twin/${operatorId}`)
export const scoreTwin = (hour: object) => call<TwinScore>('/twin/score', hour)
export const updateTwin = (hour: object) => call<{ twin_hours_before: number; twin_hours: number; updates_today: number }>('/twin/update', hour)
export const getInsights = (payload: object) => call<InsightsResponse>('/insights', payload, 4000)
export const getSiteInsights = (now: string) => call<SiteInsightsResponse>(`/insights/site?now=${encodeURIComponent(now)}`, undefined, 4000)
export const sendMessage = (to: string, sender: string, insight: Insight) => call<{ id: string }>('/inbox', { to, sender, insight })
export const sendInsightFeedback = (rule: string, person: string, action: 'done' | 'dismissed' | 'helpful') =>
  call<{ factor: number }>('/insights/feedback', { rule, person, action })
