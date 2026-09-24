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

/** Full-screen presentation slides between the live app chapters. */
export type SlideKind =
  | 'title' | 'problem' | 'exists' | 'idea' | 'data' | 'models' | 'ai'
  | 'stack' | 'design' | 'impact' | 'future' | 'thanks'

export interface Chapter {
  time: string
  title: string
  /** audience-facing subtitle: what is happening in Ravi's day (also the presenter's cue) */
  caption: string
  /** full-screen slide instead of the app */
  slide?: SlideKind
  /** the question someone on site (or a reviewer) has at this moment */
  question?: string
  /** how the feature answers it, in one line */
  answer?: string
  /** the data joined to answer it */
  data?: string[]
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


const slide = (title: string, kind: SlideKind, caption: string): Chapter => ({ time: '', title, slide: kind, caption, enter: () => {} })

export const CHAPTERS: Chapter[] = [
  slide('Operator Companion', 'title', 'One tablet per operator: his companion in hand, the machine display when docked.'),
  slide('The problem', 'problem', 'Every team got the same brief. This is the day of one operator, Ravi, on one rental Cat 320.'),
  slide('What exists', 'exists', 'Cat already ships a lot for the machine. Nothing follows the person from machine to machine.'),
  slide('Our idea', 'idea', 'One operator, three layers: me, my machine, my site. All five outcomes from the brief.'),
  {
    time: '06:40', title: 'Morning briefing',
    caption: 'Ravi picks up his tablet at home. Before he leaves, it briefs him in his language.',
    question: 'What do I need to know before I even reach site?',
    answer: 'A 40-second spoken briefing built from today’s plan, site hazards and weather, in his language.',
    data: ['Task plan', 'Call Before u Dig', 'Weather', 'New-worker list'],
    enter: (ctx) => { ctx.navigate('operator', 'today'); ctx.setBriefingOpen(true) },
  },
  {
    time: '06:52', title: "Today's plan",
    caption: 'Three tasks, each with a likely time range. The Shift Copilot ranks the few things that matter.',
    question: 'How long will today’s jobs really take, and what should I do first?',
    answer: 'A P10–P90 time range per task, with the reason in minutes. The Shift Copilot ranks the top 5 actions.',
    data: ['3,000 past jobs', 'Weather', 'Soil', 'His skill', 'Fuel + health models'],
    enter: (ctx) => { ctx.setBriefingOpen(false); if (ctx.isDocked()) ctx.undock(); ctx.navigate('operator', 'today') },
  },
  {
    time: '06:58', title: 'Walkaround',
    caption: 'His walkaround is ordered by prediction: the health model flagged dust in the oil, so the air filter comes first.',
    question: 'The machine looks fine. What should I check first?',
    answer: 'The health model read last night’s oil sample and moved the air filter to the top of the walkaround.',
    data: ['S·O·S oil sample', 'Engine sensors', 'Fault codes', 'Service history'],
    enter: (ctx) => { ctx.setBriefingOpen(false); if (ctx.isDocked()) ctx.undock(); ctx.navigate('operator', 'walkaround') },
  },
  slide('How we use data', 'data', 'Every screen is a join: machine, plan, site, weather, history and the operator’s own twin.'),
  {
    time: '07:05', title: 'Dock to the machine',
    caption: 'He docks into a rental Cat 320. His profile, the site hazards and the machine data come together.',
    question: 'Is this rental machine set up for me?',
    answer: 'Docking reads the machine over CAN/J1939, loads his profile and flags SAE vs ISO before the first move.',
    data: ['Machine settings (J1939)', 'His operator profile', 'Site limits'],
    enter: (ctx) => { ctx.setBriefingOpen(false); if (!ctx.isDocked()) ctx.dock(false) },
  },
  {
    time: '09:10', title: 'Idle, with a reason',
    caption: 'The truck leaves. The idle-reason model says why the engine is running, and whether to switch off.',
    question: 'Why is the engine running with no work, and should I switch off?',
    answer: 'The idle-reason model labels it “waiting for truck”. Next truck in 6 min, so it nudges a switch-off.',
    data: ['Truck ETA', 'Engine + hydraulic temp', 'Heat index', 'Shift clock'],
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); toTruckPhase(ctx.sim, 38) },
  },
  {
    time: '09:25', title: 'Someone walks in',
    caption: 'A new worker walks into the swing radius. The risk lamp turns Critical and the swing is held.',
    question: 'Is anyone inside my swing radius right now?',
    answer: 'Proximity and the site plan fuse into one risk lamp. Critical holds the swing and alerts only the supervisor.',
    data: ['Worker positions', 'Swing radius', 'New-worker list', 'Alert budget'],
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); toTruckPhase(ctx.sim, 10); ctx.sim.workerIntrude = true },
  },
  {
    time: '10:05', title: 'Restart guard',
    caption: 'Ravi unbuckled during a long idle. When the truck returns, work cannot restart until the belt is on.',
    question: 'Is it safe to restart after a long idle?',
    answer: 'A rule from the brief’s own data: belts come off in long idles, so the restart waits for the buckle.',
    data: ['Seatbelt switch', 'Idle duration', 'Truck arrival'],
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
    question: 'How do I report a near-miss without typing, in my own language?',
    answer: 'He speaks in Hindi. The LLM only words the report; severity comes from the black box, by rule.',
    data: ['Voice (hi-IN)', '60 s black box', 'Machine position'],
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); setTimeout(() => emitStory('voice'), 300) },
  },
  {
    time: '13:40', title: 'Help on the machine',
    caption: 'On a new machine, help is a question away: the video plays and the control lights up in his cab.',
    question: 'New machine. How do I start it without a key?',
    answer: 'The help panel plays the short video and flies the 3D view into his cab to light up the button.',
    data: ['Machine model', 'Help library', '3D cab model'],
    enter: (ctx) => { inCab(ctx); calm(ctx.sim); setTimeout(() => emitStory('help-keyless'), 300) },
  },
  slide('The models', 'models', 'Five models and a twin, each answering one question on site, each tested on held-out data.'),
  slide('How the AI works', 'ai', 'How the models are trained, calibrated and explained, and where the LLM is and is not allowed.'),
  {
    time: '19:00', title: 'End of shift',
    caption: 'He undocks. Verified hours, idle split into justified and avoidable, and lessons from his own day.',
    question: 'What did my day actually look like?',
    answer: 'Verified hours, idle split into justified and avoidable, and two short lessons from his own events.',
    data: ['Shift timeline', 'Idle-reason model', 'Event log'],
    enter: (ctx) => { ctx.sim.focus = null; if (ctx.isDocked()) ctx.undock(); else ctx.navigate('operator', 'today') },
  },
  {
    time: '19:02', title: 'His twin learned',
    caption: 'Every alert compared Ravi with himself in the same conditions. Tonight his twin learns from today.',
    question: 'Unusual compared to whom?',
    answer: 'His own twin: a baseline per condition. It flags when he is unlike himself, not unlike a site average.',
    data: ['600 h of his history', 'Task × weather context', 'Today’s shift'],
    enter: (ctx) => { if (ctx.isDocked()) ctx.undock(); ctx.navigate('operator', 'twin') },
  },
  {
    time: '19:05', title: "The supervisor's view",
    caption: 'The same predictions, site-wide. The Site Copilot ranks the decisions and names who owns each.',
    question: 'What needs a decision on site right now, and who owns it?',
    answer: 'The Site Copilot ranks 5 decisions with an owner and “if nobody acts”. Only Critical reaches a phone.',
    data: ['6 machines, mixed fleet', 'Health + fuel models', 'Operator twins', 'Forecast'],
    enter: (ctx) => { if (ctx.isDocked()) ctx.undock(); ctx.navigate('supervisor', 'overview') },
  },
  slide('Tech stack', 'stack', 'Each tool is there for one job: run on a rugged tablet, offline-first, with explainable models.'),
  slide('Design choices', 'design', 'Coaching, not surveillance. Every number has a reason. Light in hand, dark in the cab.'),
  slide('Impact', 'impact', 'Fuel, safety and skills, from one model of the operator that the whole site can learn from.'),
  slide('What’s next', 'future', 'From demo to pilot: real telemetry, a mesh between tablets, and E-fences drawn from site data.'),
  slide('Thank you', 'thanks', 'Questions welcome.'),
]
