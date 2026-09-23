// Tiny shared simulation state. The 3D scene writes to it every frame,
// the React panels read it a few times per second.
// 1 real second = 15 site seconds, so a 24 s gap between trucks reads as "6 min".
import type { EventLevel, SimEvent, Zone } from '@/types'

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
