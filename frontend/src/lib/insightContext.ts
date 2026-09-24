// What the operator's tablet sends to the Shift Copilot: only its own operator, machine and
// tasks. Site facts (forecast, breaks, hazards) are added on the server from one file, so the
// operator and supervisor screens can't disagree.
import { idleBreakdown, machine, operator, tasks, weeklyStats } from '@/data/demo'

const pct = (reason: string) => idleBreakdown.find((r) => r.reason === reason)?.pct ?? 0

export function operatorInsightPayload(now: string) {
  return {
    operator_id: operator.id,
    now,
    operator: { name: operator.name, usual_pattern: operator.usualPattern, skill: 'Intermediate' },
    machine: {
      id: machine.id, fuel_l: machine.fuelL, tank_l: machine.tankL, pattern: machine.pattern,
      rental: machine.owner.startsWith('Rental'), service_due_h: machine.serviceDueIn, health_day: machine.healthDay,
    },
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, zone: t.zone, start: t.start, ...t.input })),
    truck_gap_min: 6,
    idle_week: { waiting_for_truck_pct: pct('Waiting for truck'), waste_pct: pct('No reason found'), idle_fuel_l: weeklyStats.idleFuelL },
  }
}
