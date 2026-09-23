// Shared domain types. Field names mirror the FastAPI responses in ml/api.py.

export type Weather = 'Sunny' | 'Cloudy' | 'Rainy' | 'Windy'
export type Skill = 'Beginner' | 'Intermediate' | 'Expert'
export type Soil = 'Sand' | 'Loam' | 'Clay' | 'Rock'
export type RiskLevel = 'high' | 'watch' | 'low'
export type Zone = 'clear' | 'caution' | 'danger'
export type EventLevel = 'ok' | 'warn' | 'danger'
export type IdleReason = 'waiting_for_truck' | 'waste' | 'heat_rest' | 'warm_up' | 'cool_down'

export interface TaskInput {
  task_type: string
  weather: Weather
  operator_skill: Skill
  soil: Soil
  machine_age_yrs: number
  ambient_temp_c: number
  volume_m3: number
  planner_estimate_min: number
}

export interface Reason { factor: string; value: string; minutes: number }

export interface TaskPrediction {
  p10: number
  p50: number
  p90: number
  planner_estimate: number
  reasons: Reason[]
  live: boolean
  /** a what-if was asked for but only the cached baseline is available */
  offline?: boolean
}

export interface Task {
  id: string
  title: string
  zone: string
  start: string
  input: TaskInput
  fallback: { p10: number; p50: number; p90: number; reasons: Reason[] }
  note?: string
}

export interface HealthReason { factor: string; value: string; usual: string; points: number; component?: string; action?: string }
export interface HealthResult {
  risk_pct: number
  level: RiskLevel
  component: string | null
  action: string
  reasons: HealthReason[]
  live?: boolean
}

export interface FuelPlan {
  runs_out_at: string | null
  refuel_before: string | null
  litres_planned: number
  co2_kg: number
  fuel_left_end_l: number
  live?: boolean
}

export interface BehaviourResult { unusual: boolean; score?: number; reasons: string[]; live?: boolean }

export interface SimEvent { id: number; time: string; level: EventLevel; text: string }

export interface ShiftSummary {
  cycles: number
  dockedMin: number
  idleMin: number
  idleFuelL: number
  wasteMin: number
  wasteFuelL: number
  beltOffMin: number
  events: SimEvent[]
  lessons: Lesson[]
}

export interface Lesson { title: string; from: string; mins: number; done?: boolean }

export interface FleetMachine {
  id: string
  make: string
  model: string
  kind: string
  operator: string
  zone: string
  x: number
  y: number
  hours: number
  tank_l: number
  fuel_l: number
  fuel_pct: number
  working_h: number
  service_due_h: number
  cycles: number
  seatbelt_violations: number
  faults: { code: string; severity: string; text: string }[]
  idle_min: number
  idle_waste_min: number
  idle_by_reason: Partial<Record<IdleReason, number>>
  health: HealthResult
  fuel_plan: FuelPlan
  behaviour: BehaviourResult
}

export interface FleetAlert { machine: string; level: 'high' | 'medium' | 'low'; text: string }

export interface OfficialRow {
  time: string
  fuel_l: number
  load_cycles: number
  idle_min: number
  seatbelt: string
  alert: string
  unusual: boolean
  reasons: string[]
}

export interface FleetData {
  site: string
  kpis: {
    utilization_pct: number
    idle_pct: number
    idle_justified_pct: number
    idle_waste_h: number
    fuel_used_l: number
    co2_kg: number
    seatbelt_violations: number
    cycles: number
  }
  machines: FleetMachine[]
  alerts: FleetAlert[]
  alerts_pushed: number
  official_rows: OfficialRow[]
  live?: boolean
}
