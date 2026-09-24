// Tiny shared simulation state. The 3D scene writes to it every frame,
// the React panels read it a few times per second.
// 1 real second = 15 site seconds, so a 24 s gap between trucks reads as "6 min".
import type { DayMark, DayState, EventLevel, SimEvent, TimelineItem, Zone } from '@/types'

export const SIM_SPEED = 15
export const TRUCK_PERIOD = 60 // real seconds per truck
export const IDLE_BURN_LPH = 3.8 // litres per hour at idle, Cat 320 class
export const DIESEL_INR = 90

export interface Sim {
  t: number
  engineOn: boolean
  seatbelt: boolean
  beltScenario: boolean
  halted: boolean
  haltReason: 'person' | 'seatbelt' | null
  workerIntrude: boolean
  workerDist: number
  zone: Zone
  truckPresent: boolean
  truckX: number
  nextTruckEtaSec: number
  working: boolean
  idleSec: number
  idleFuelL: number
  idleWasteSec: number
  cycles: number
  events: SimEvent[]
  idleSinceSec: number
  seatbeltOffSec: number
  patternFixed?: boolean
  /** help manual: a part of the machine the 3D view is focused on (e.g. 'start-button') */
  focus?: string | null
  /** the docked session, state by state, for the end-of-shift "Your day" strip */
  timeline: TimelineItem[]
  /** site seconds with the engine off while no truck was at the bay (fuel the nudge saved) */
  engineOffWaitSec: number
  /** alert budget: every Caution/Critical raised on the tablet vs the Critical ones pushed to the supervisor */
  alerts: { total: number; pushed: number }
  /** sim.t at the previous timeline sample */
  lastSampleT?: number
}

export function createSim(): Sim {
  return {
    t: 0,
    engineOn: true,
    seatbelt: true,
    beltScenario: false,
    halted: false,
    haltReason: null,
    workerIntrude: false,
    workerDist: 99,
    zone: 'clear',
    truckPresent: false,
    truckX: -60,
    nextTruckEtaSec: 0,
    working: false,
    idleSec: 0, // site seconds
    idleFuelL: 0,
    idleWasteSec: 0, // site seconds of idle with the next truck > 3 min away
    cycles: 0,
    events: [],
    idleSinceSec: 0,
    seatbeltOffSec: 0, // accumulated while engine is on and belt is off
    timeline: [],
    engineOffWaitSec: 0,
    alerts: { total: 0, pushed: 0 },
  }
}

// where the truck is in its 60 s loop
export function truckPhase(t: number) {
  const p = t % TRUCK_PERIOD
  if (p < 6) return { present: false, x: -40 + (p / 6) * 40, eta: 6 - p }
  if (p < 32) return { present: true, x: 0, eta: 0 }
  if (p < 38) return { present: false, x: ((p - 32) / 6) * 45, eta: TRUCK_PERIOD - p + 6 }
  return { present: false, x: -60, eta: TRUCK_PERIOD - p + 6 }
}

export function siteClock(sim: Pick<Sim, 't'>) {
  const mins = Math.floor((sim.t * SIM_SPEED) / 60)
  return `${String(9 + Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

export function logEvent(sim: Sim, level: EventLevel, text: string) {
  sim.events.unshift({ id: Math.random(), time: siteClock(sim), level, text })
  sim.events = sim.events.slice(0, 12)
}

/** Site minutes after 09:00. */
export const siteMin = (sim: Pick<Sim, 't'>) => (sim.t * SIM_SPEED) / 60

/** Same rule as the switch-off nudge: idle with the next truck more than 3 site-minutes away is avoidable. */
export function dayState(sim: Sim): DayState {
  if (sim.halted) return 'halted'
  if (!sim.engineOn) return 'off'
  if (sim.working) return 'working'
  return !sim.truckPresent && (sim.nextTruckEtaSec * SIM_SPEED) / 60 > 3 ? 'idle' : 'waiting'
}

/**
 * Sample the machine state into the timeline. Called from the docked display's 250 ms loop:
 * a new segment is appended only when the state changes; otherwise the open one is extended.
 */
export function recordTimeline(sim: Sim) {
  const now = siteMin(sim)
  const dtSite = sim.lastSampleT === undefined ? 0 : Math.max(sim.t - sim.lastSampleT, 0) * SIM_SPEED
  sim.lastSampleT = sim.t
  if (!sim.engineOn && !sim.truckPresent) sim.engineOffWaitSec += dtSite
  const state = dayState(sim)
  let open: Extract<TimelineItem, { kind: 'seg' }> | undefined
  for (let i = sim.timeline.length - 1; i >= 0; i--) {
    const it = sim.timeline[i]
    if (it.kind === 'seg') { open = it; break }
  }
  if (open?.state === state) { open.end = now; return }
  if (open) open.end = now
  sim.timeline.push({ kind: 'seg', state, start: open ? now : 0, end: now })
}

/** A point event on the timeline. The same kind within `dedupeMin` site minutes counts once. */
export function markTimeline(sim: Sim, mark: DayMark, text: string, dedupeMin = 2) {
  const at = siteMin(sim)
  const dup = sim.timeline.some((it) => it.kind === 'mark' && it.mark === mark && at - it.at < dedupeMin)
  if (!dup) sim.timeline.push({ kind: 'mark', mark, at, text })
}
