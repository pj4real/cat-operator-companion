// Server state. Every query resolves (never errors): when the ML API is down the
// cached fallback is returned with live: false, so the UI shows "cached" instead of breaking.
import { useQuery } from '@tanstack/react-query'
import { forecastFuel, getApiHealth, getFleet, getInsights, getSiteInsights, getTwin, predictHealth, predictTask } from '@/lib/api'
import { operatorInsightPayload } from '@/lib/insightContext'
import { machine, tasks } from '@/data/demo'
import cachedFleet from '@/data/fleet_fallback.json'
import cachedTwin from '@/data/twin_fallback.json'
import cachedInsights from '@/data/insights_fallback.json'
import cachedSiteInsights from '@/data/site_insights_fallback.json'
import type { FleetData, FuelPlan, HealthResult, InsightsResponse, SiteInsightsResponse, Task, TaskInput, TaskPrediction, TwinProfile } from '@/types'

export function useTaskPrediction(task: Task, override: Partial<TaskInput>) {
  const whatIf = Object.keys(override).length > 0
  const baseline: TaskPrediction = { ...task.fallback, planner_estimate: task.input.planner_estimate_min, live: false }
  return useQuery({
    queryKey: ['task', task.id, override],
    queryFn: (): Promise<TaskPrediction> =>
      predictTask({ ...task.input, ...override }).catch(() => ({ ...baseline, offline: whatIf })),
    placeholderData: (prev) => prev ?? baseline,
  })
}

export function useHealth() {
  return useQuery({
    queryKey: ['health', machine.id],
    queryFn: (): Promise<HealthResult> => predictHealth(machine.healthDay).catch(() => ({ ...machine.healthFallback, live: false })),
  })
}

export function useFuelPlan() {
  return useQuery({
    queryKey: ['fuel', machine.id],
    queryFn: (): Promise<FuelPlan> =>
      forecastFuel({
        fuel_l: machine.fuelL, tank_l: machine.tankL, now: '07:00', reserve_l: 15,
        tasks: tasks.map((t) => ({ ...t.input, start: t.start, title: t.id })),
      }).catch(() => ({ ...machine.fuelFallback, live: false })),
  })
}

export function useFleet() {
  return useQuery({
    queryKey: ['fleet'],
    queryFn: (): Promise<FleetData> => getFleet().catch(() => ({ ...(cachedFleet as FleetData), live: false })),
    placeholderData: { ...(cachedFleet as FleetData), live: false },
  })
}

/** The operator's twin profile. Refetched after undock, when the shift is folded in. */
export function useTwin(operatorId: string) {
  return useQuery({
    queryKey: ['twin', operatorId],
    queryFn: (): Promise<TwinProfile> => getTwin(operatorId).catch(() => ({ ...(cachedTwin as TwinProfile), live: false })),
    placeholderData: { ...(cachedTwin as TwinProfile), live: false },
    staleTime: 0,
  })
}

// Saved real responses per demo time; the nearest earlier one stands in when the API is down.
function cachedAt<T>(byTime: Record<string, unknown>, now: string): T {
  const times = Object.keys(byTime).sort()
  const key = [...times].reverse().find((t) => t <= now) ?? times[0]
  return byTime[key] as T
}

/** Shift Copilot. Refetched every 10 s so a supervisor's message arrives without a reload. */
export function useInsights(now: string) {
  return useQuery({
    queryKey: ['insights', now],
    queryFn: (): Promise<InsightsResponse> => getInsights(operatorInsightPayload(now))
      .catch(() => ({ ...cachedAt<InsightsResponse>(cachedInsights, now), live: false })),
    placeholderData: (prev) => prev ?? { ...cachedAt<InsightsResponse>(cachedInsights, now), live: false },
    refetchInterval: 10000,
  })
}

/** Site Copilot. Refetched every 10 s so operators' messages arrive without a reload. */
export function useSiteInsights(now: string) {
  return useQuery({
    queryKey: ['site-insights', now],
    queryFn: (): Promise<SiteInsightsResponse> => getSiteInsights(now)
      .catch(() => ({ ...cachedAt<SiteInsightsResponse>(cachedSiteInsights, now), live: false })),
    placeholderData: (prev) => prev ?? { ...cachedAt<SiteInsightsResponse>(cachedSiteInsights, now), live: false },
    refetchInterval: 10000,
  })
}

/** Polls /health so the top bar can say honestly whether predictions are live. */
export function useApiStatus() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: () => getApiHealth().then(() => true).catch(() => false),
    refetchInterval: 15000,
  })
}
