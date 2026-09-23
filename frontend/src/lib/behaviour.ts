// Mirrors the readable rules in ml/api.py's /score/behaviour, used when the API is unreachable.
import type { BehaviourResult } from '@/types'

export interface HourStats {
  fuel_l: number
  load_cycles: number
  idle_min: number
  seatbelt_off_min: number
  harsh_swings: number
  raised_bucket_travel: number
}

export function ruleBasedBehaviour(h: HourStats): BehaviourResult {
  const reasons: string[] = []
  if (h.idle_min > 40 && h.load_cycles <= 3) reasons.push(`Idle ${h.idle_min.toFixed(0)} min with only ${h.load_cycles} load cycles`)
  if (h.seatbelt_off_min > 5) reasons.push(`Seatbelt off for ${h.seatbelt_off_min.toFixed(0)} min while engine running`)
  if (h.harsh_swings >= 5) reasons.push(`${h.harsh_swings} harsh swings this hour`)
  if (h.raised_bucket_travel >= 2) reasons.push('Travelling with bucket raised')
  return { unusual: reasons.length > 0, score: reasons.length ? 0.8 : 0.1, reasons }
}

// Same rule on the static official-telemetry rows (fixed demo data, no need to round-trip the API).
export function isRowUnusual(row: { idle: number; cycles: number; belt: string }) {
  return (row.idle > 40 && row.cycles <= 3) || row.belt === 'Unfastened'
}
