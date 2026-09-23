// Story mode: Ravi's day as chapters. Each chapter puts the app into the exact state the presenter
// is about to narrate (including moving site time), so the demo never has to "wait for the truck".
import type { Page, Workspace } from '@/store/app'
import { logEvent, TRUCK_PERIOD, type Sim } from '@/lib/sim'

/** Commands for DockedMode, which owns the in-cab state (dialogs, voice, help). */
export type StoryCommand = 'close-pattern' | 'voice' | 'help-keyless' | 'reset'
export const emitStory = (cmd: StoryCommand) => window.dispatchEvent(new CustomEvent('story', { detail: cmd }))

export interface StoryContext {
  sim: Sim
  navigate: (w: Workspace, p?: Page) => void
  setBriefingOpen: (open: boolean) => void
  dock: (instant: boolean) => void
  undock: () => void
  isDocked: () => boolean
}

export interface Chapter {
  time: string
  title: string
  /** audience-facing subtitle: what is happening in Ravi's day */
  caption: string
  enter: (ctx: StoryContext) => void
}

/** Move site time forward to a point in the truck loop (never backwards). */
function toTruckPhase(sim: Sim, phase: number) {
  const base = Math.floor(sim.t / TRUCK_PERIOD) * TRUCK_PERIOD + phase
  sim.t = base > sim.t ? base : base + TRUCK_PERIOD
}

/** Make sure we are in the cab, without the dock animation, with the first-run dialog out of the way. */
function inCab(ctx: StoryContext) {
  if (!ctx.isDocked()) ctx.dock(true)
  setTimeout(() => emitStory('close-pattern'), 50)
  emitStory('reset')
  ctx.sim.focus = null
}

function calm(sim: Sim) {
  sim.workerIntrude = false
  sim.engineOn = true
  if (!sim.seatbelt) { sim.seatbelt = true; sim.beltScenario = false }
}

export const CHAPTERS: Chapter[] = [
  {
    time: '06:40', title: 'Morning briefing',
    caption: 'Ravi picks up his tablet at home. Before he leaves, it briefs him in his language.',
    enter: (ctx) => { ctx.navigate('operator', 'today'); ctx.setBriefingOpen(true) },
  },
  {
    time: '06:52', title: "Today's plan",
    caption: 'On site: three tasks, each with a likely time from past jobs, weather, soil and his own skill.',
    enter: (ctx) => { ctx.setBriefingOpen(false); ctx.navigate('operator', 'today') },
  },
  {
    time: '06:58', title: 'Walkaround',
    caption: 'His walkaround is ordered by prediction: the health model flagged dust in the oil, so the air filter comes first.',
    enter: (ctx) => { ctx.setBriefingOpen(false); if (ctx.isDocked()) ctx.undock(); ctx.navigate('operator', 'walkaround') },
  },
  {
    time: '07:05', title: 'Dock to the machine',
    caption: 'He docks into a rental Cat 320. His profile, the site hazards and the machine data come together.',
    enter: (ctx) => { ctx.setBriefingOpen(false); if (!ctx.isDocked()) ctx.dock(false) },
  },
  {
    time: '09:10', title: 'Idle, with a reason',
    caption: 'The truck leaves. The idle-reason model says why the engine is running, and whether to switch off.',
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); toTruckPhase(ctx.sim, 38) },
  },
  {
    time: '09:25', title: 'Someone walks in',
    caption: 'A new worker walks into the swing radius. The risk lamp turns Critical and the swing is held.',
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); toTruckPhase(ctx.sim, 10); ctx.sim.workerIntrude = true },
  },
  {
    time: '10:05', title: 'Restart guard',
    caption: 'Ravi unbuckled during a long idle. When the truck returns, work cannot restart until the belt is on.',
    enter: (ctx) => {
      inCab(ctx); calm(ctx.sim); toTruckPhase(ctx.sim, 50)
      const s = ctx.sim
      s.beltScenario = true; s.seatbelt = false
      logEvent(s, 'warn', 'Seatbelt unfastened during idle')
    },
  },
  {
    time: '11:20', title: 'Near-miss, by voice',
    caption: 'A dumper reversed too close. He reports it in Hindi, and the black box adds what the machine saw.',
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); setTimeout(() => emitStory('voice'), 300) },
  },
  {
    time: '13:40', title: 'Help on the machine',
    caption: 'On a new machine, help is a question away: the video plays and the control lights up in his cab.',
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); setTimeout(() => emitStory('help-keyless'), 300) },
  },
  {
    time: '19:00', title: 'End of shift',
    caption: 'He undocks. Verified hours, idle split into justified and avoidable, and lessons from his own day.',
    enter: (ctx) => { ctx.sim.focus = null; if (ctx.isDocked()) ctx.undock(); else ctx.navigate('operator', 'today') },
  },
  {
    time: '19:02', title: 'His twin learned',
    caption: 'Every alert compared Ravi with himself in the same conditions. Tonight his twin learns from today.',
    enter: (ctx) => { if (ctx.isDocked()) ctx.undock(); ctx.navigate('operator', 'twin') },
  },
  {
    time: '19:05', title: "The supervisor's view",
    caption: 'The same predictions, fleet-wide. Only high-severity alerts are pushed; the rest wait here.',
    enter: (ctx) => { if (ctx.isDocked()) ctx.undock(); ctx.navigate('supervisor', 'overview') },
  },
]
