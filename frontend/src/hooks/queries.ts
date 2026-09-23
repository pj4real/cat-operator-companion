// Server state. Every query resolves (never errors): when the ML API is down the
// cached fallback is returned with live: false, so the UI shows "cached" instead of breaking.
import { useQuery } from '@tanstack/react-query'
import { forecastFuel, getApiHealth, getFleet, getTwin, predictHealth, predictTask } from '@/lib/api'
import { machine, tasks } from '@/data/demo'
import cachedFleet from '@/data/fleet_fallback.json'
import cachedTwin from '@/data/twin_fallback.json'
import type { FleetData, FuelPlan, HealthResult, Task, TaskInput, TaskPrediction, TwinProfile } from '@/types'

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

/** Polls /health so the top bar can say honestly whether predictions are live. */
export function useApiStatus() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: () => getApiHealth().then(() => true).catch(() => false),
    refetchInterval: 15000,
  })
}
