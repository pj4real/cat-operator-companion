// In-cab "next best action": one item at a time, computed on the tablet from the live sim, so it
// keeps working without network. Safety first, then fuel, then whatever the day plan says is due.
import type { Insight } from '@/types'
import type { Tone } from '@/lib/tones'
import { IDLE_BURN_LPH } from '@/lib/sim'

export interface LiveAction {
  id: string
  tone: Tone
  title: string
  why: string
  button?: { label: string; action: 'engine_off' | 'fasten' | 'ack' }
}

export interface LiveState {
  haltReason: 'person' | 'seatbelt' | null
  seatbelt: boolean
  engineOn: boolean
  working: boolean
  truckPresent: boolean
  etaMin: number
  clockMin: number
}

export function nextAction(s: LiveState, day: Insight[], acked: Set<string>): LiveAction | null {
  // the danger banner owns this moment
  if (s.haltReason === 'person') return null
  if (!s.seatbelt && s.engineOn) {
    return {
      id: 'belt', tone: 'critical', title: 'Belt on before you restart',
      why: s.truckPresent ? 'The truck is here and work restarts now.' : `You unbuckled during the idle. The truck is back in ${s.etaMin.toFixed(0)} min.`,
      button: { label: 'Seatbelt fastened', action: 'fasten' },
    }
  }
  if (s.engineOn && !s.working && !s.truckPresent && s.etaMin > 3) {
    return {
      id: 'switch-off', tone: 'warning', title: `Switch off · next truck in ${s.etaMin.toFixed(0)} min`,
      why: `Saves about ${((s.etaMin / 60) * IDLE_BURN_LPH).toFixed(2)} L before it arrives. Restart when it is 1 min out.`,
      button: { label: 'Switch off', action: 'engine_off' },
    }
  }
  // messages from the supervisor, then day-plan items due within 30 site-minutes
  const open = day.filter((i) => !acked.has(i.id))
  const msg = open.find((i) => i.rule === 'from-supervisor')
  const due = msg ?? open.find((i) => i.at_min !== null && i.at_min >= s.clockMin - 5 && i.at_min <= s.clockMin + 30)
  if (due) {
    return {
      id: due.id, tone: due.kind === 'act_now' ? 'critical' : due.kind === 'plan_ahead' ? 'warning' : 'info',
      title: due.from ? `${due.from}: ${due.title}` : due.title, why: due.why, button: { label: 'OK', action: 'ack' },
    }
  }
  return null
}
