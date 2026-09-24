// Fused risk state for the docked display: one Safe / Caution / Critical lamp from
// seatbelt + proximity + today's history + the operator's twin, with a one-line reason.
// Plain rules on purpose (a safety interlock must be predictable). Mirrors fuse_risk()
// in ml/api.py, which the supervisor view uses without live proximity.
import type { RiskState, SimEvent, Zone } from '@/types'

export interface RiskInput {
  zone: Zone
  workerDist: number
  seatbelt: boolean
  engineOn: boolean
  working: boolean
  truckPresent: boolean
  idleMin: number
  events: SimEvent[]
  twinUnusual: boolean
  twinReason?: string
}

const ordinal = (n: number) => (n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

export function fuseRisk(s: RiskInput): RiskState {
  // history: how often this has already happened today makes the reason (and the lesson) sharper
  const swingEntries = s.events.filter((e) => /inside swing radius/i.test(e.text)).length
  const beltEvents = s.events.filter((e) => /Seatbelt unfastened/i.test(e.text)).length
  const again = (n: number) => (n > 1 ? ` · ${ordinal(n)} time today` : '')

  if (s.zone === 'danger')
    return { level: 'critical', reason: `Worker ${s.workerDist.toFixed(0)} m away, inside the swing radius. Swing held${again(swingEntries)}` }
  if (!s.seatbelt && s.engineOn && (s.working || s.truckPresent))
    return { level: 'critical', reason: `Seatbelt off as work restarts after ${s.idleMin.toFixed(0)} min idle${again(beltEvents)}` }
  if (s.zone === 'caution' && !s.seatbelt)
    return { level: 'critical', reason: `Worker approaching (${s.workerDist.toFixed(0)} m) while the seatbelt is off` }
  if (s.zone === 'caution')
    return { level: 'caution', reason: `Worker ${s.workerDist.toFixed(0)} m away, approaching the swing radius` }
  if (!s.seatbelt && s.engineOn)
    return { level: 'caution', reason: `Seatbelt off during idle, engine running${again(beltEvents)}` }
  if (s.twinUnusual && s.twinReason)
    return { level: 'caution', reason: `Unusual for you: ${s.twinReason}` }
  return { level: 'safe', reason: s.working ? 'Loading · belt on · swing radius clear' : 'Belt on · swing radius clear' }
}

export const RISK_RANK = { safe: 0, caution: 1, critical: 2 } as const

export interface RiskLatch { shown: RiskState; lowerSince: number | null }

/**
 * Debounce: escalate at once; step down only after the lower level has held for `holdMs`,
 * so a noisy distance reading can't make the lamp flicker. The reason text always tracks
 * the shown level.
 */
export function latchRisk(latch: RiskLatch | null, raw: RiskState, now: number, holdMs = 1500): RiskLatch {
  if (!latch || RISK_RANK[raw.level] >= RISK_RANK[latch.shown.level]) return { shown: raw, lowerSince: null }
  const since = latch.lowerSince ?? now
  return now - since >= holdMs ? { shown: raw, lowerSince: null } : { shown: latch.shown, lowerSince: since }
}
