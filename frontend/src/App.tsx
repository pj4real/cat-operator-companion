import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast, Toaster } from 'sonner'
import { useApp } from '@/store/app'
import { updateTwin } from '@/lib/api'
import { operator } from '@/data/demo'
import { createSim, logEvent, IDLE_BURN_LPH, SIM_SPEED, type Sim } from '@/lib/sim'
import type { Lesson, ShiftSummary } from '@/types'
import { AppShell } from '@/components/shared/AppShell'
import { TodayPage } from '@/components/operator/TodayPage'
import { SafetyPage } from '@/components/operator/SafetyPage'
import { TrainingPage } from '@/components/operator/TrainingPage'
import { ActivityPage } from '@/components/operator/ActivityPage'
import { TwinPage } from '@/components/operator/TwinPage'
import { WalkaroundPage } from '@/components/operator/WalkaroundPage'
import { FleetOverviewPage, TelemetryAuditPage } from '@/components/fleet/FleetPages'
import { DockTransition } from '@/components/docked/DockTransition'
import { DockedMode } from '@/components/docked/DockedMode'
import { StoryBar } from '@/components/shared/StoryBar'
import { DeviceFrame, usePullBack } from '@/components/shared/DeviceFrame'
import { StoryCard } from '@/components/shared/StoryCard'
import { CHAPTERS } from '@/lib/story'
import type { StoryContext } from '@/lib/story'

// The voice briefing's three.js orb loads on demand. The docked display is imported normally:
// its 3D labels (drei <Html>) run their own React roots and break when mounted under a Suspense boundary.
const AssistantIntro = lazy(() => import('@/components/operator/AssistantIntro').then((m) => ({ default: m.AssistantIntro })))

// lessons generated from what actually happened in this shift
function shiftLessons(s: Sim): Lesson[] {
  const text = s.events.map((e) => e.text).join(' | ')
  const out: Lesson[] = []
  if (s.beltScenario || /Seatbelt unfastened/.test(text)) out.push({ title: 'Restart after a long idle: seat, belt, look', from: 'Today · belt off at restart', mins: 1.5 })
  if (/swing radius/i.test(text)) out.push({ title: 'New worker near the swing: stop, horn, eye contact', from: 'Today · person inside swing radius', mins: 2 })
  if (s.idleWasteSec / 60 > 5) out.push({ title: 'Truck more than 3 min away? Switch off', from: `Today · ${(s.idleWasteSec / 60).toFixed(0)} min avoidable idle`, mins: 1 })
  if (/Near-miss/.test(text)) out.push({ title: 'Dumper reversing near Bay 2: agree hand signals', from: 'Today · your near-miss report', mins: 2 })
  return out.slice(0, 2)
}

function summarise(s: Sim): ShiftSummary {
  return {
    cycles: s.cycles,
    dockedMin: (s.t * SIM_SPEED) / 60,
    idleMin: s.idleSec / 60,
    idleFuelL: s.idleFuelL,
    wasteMin: s.idleWasteSec / 60,
    wasteFuelL: (s.idleWasteSec / 3600) * IDLE_BURN_LPH,
    beltOffMin: s.seatbeltOffSec / 60,
    events: s.events.filter((e) => e.level !== 'ok'),
    lessons: shiftLessons(s),
    // a copy, so the summary on Today stays fixed if Ravi docks again
    timeline: s.timeline.map((it) => ({ ...it })),
    engineOffWaitMin: s.engineOffWaitSec / 60,
    alerts: { ...s.alerts },
  }
}

const PAGES = {
  today: TodayPage,
  safety: SafetyPage,
  training: TrainingPage,
  activity: ActivityPage,
  twin: TwinPage,
  walkaround: WalkaroundPage,
  overview: FleetOverviewPage,
  telemetry: TelemetryAuditPage,
}

export default function App() {
  const { device, page, theme, briefingOpen, setDevice, setToday, setBriefingOpen, navigate, syncFromUrl, storyOn, storyIndex } = useApp()
  const sim = useRef<Sim>(createSim())
  const { frame, captionsOn, toggleFrame } = useApp()
  // count briefing endings: each one triggers the pull-back into the device
  const [pull, setPull] = useState(0)
  const wasIntro = useRef(false)
  const introNow = briefingOpen && page === 'today' && device === 'handheld'
  useEffect(() => {
    if (wasIntro.current && !introNow) setPull((n) => n + 1)
    wasIntro.current = introNow
  }, [introNow])
  const pullingBack = usePullBack(frame ? pull : 0)

  // F toggles the tablet frame (presenter shortcut)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea, [role=dialog]')) return
      if (e.key.toLowerCase() === 'f') toggleFrame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFrame])
  const queryClient = useQueryClient()

  // The in-cab display is always dark (glare, night work); the handheld follows the user's theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', device !== 'handheld' || theme === 'dark')
  }, [device, theme])

  // back/forward and pasted links
  useEffect(() => {
    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)
    return () => { window.removeEventListener('popstate', syncFromUrl); window.removeEventListener('hashchange', syncFromUrl) }
  }, [syncFromUrl])

  const dockDone = useCallback(() => {
    logEvent(sim.current, 'ok', 'Docked to EXC001. Limits from site data accepted.')
    setDevice('docked')
  }, [setDevice])

  const undock = () => {
    const today = summarise(sim.current)
    setToday(today)
    navigate('operator', 'today')
    // fold today's shift into Ravi's twin (per-hour rates, same context the docked display scored against)
    const hrs = today.dockedMin / 60
    if (hrs < 0.25) return
    const perHour = (x: number) => +Math.min(x / hrs, 60).toFixed(1)
    updateTwin({ operator_id: operator.id, task_type: 'Material Loading', weather: 'Sunny', machine_id: 'RENTAL-SAE',
      hour_of_shift: 3, idle_min: perHour(today.wasteMin),
      // per workable hour: truck waits are justified idle and don't count against the loading rate
      load_cycles: Math.round(today.cycles / Math.max(hrs - (today.idleMin - today.wasteMin) / 60, 0.1)),
      fuel_l: 5, seatbelt_off_min: perHour(today.beltOffMin), harsh_swings: 1 })
      .then((r) => {
        queryClient.invalidateQueries({ queryKey: ['twin'] })
        toast.success('Your twin learned from today', { description: `${r.twin_hours_before} → ${r.twin_hours} hours of your own history` })
      })
      .catch(() => { /* offline: the shift is kept on the tablet and synced later */ })
  }

  const story: StoryContext = {
    sim: sim.current,
    navigate,
    setBriefingOpen,
    dock: (instant) => {
      if (!instant) { setDevice('docking'); return }
      logEvent(sim.current, 'ok', 'Docked to EXC001. Limits from site data accepted.')
      setDevice('docked')
    },
    undock,
    isDocked: () => useApp.getState().device !== 'handheld',
  }
  const finishBriefing = () => {
    setBriefingOpen(false)
    const st = useApp.getState()
    if (st.storyOn && CHAPTERS[st.storyIndex]?.title === 'Morning briefing') st.setStory(true, st.storyIndex + 1)
  }

  const Page = PAGES[page]
  const intro = briefingOpen && page === 'today' && device === 'handheld'
  const screen =
    device === 'docking' ? <DockTransition onDone={dockDone} />
      : device === 'docked' ? <DockedMode sim={sim.current} onUndock={undock} />
        : intro ? <Suspense fallback={<div className="h-full" style={{ background: 'rgb(6,8,12)' }} />}><AssistantIntro onFinish={finishBriefing} /></Suspense>
          : <AppShell><Page /></AppShell>
  const card = storyOn ? CHAPTERS[storyIndex]?.card : undefined
  const storyBar = <StoryBar ctx={story} hidden={intro && !card} />
  const storyCard = card ? <StoryCard kind={card} /> : null
  // the briefing plays full-screen; when it ends, the app pulls back into the tablet
  if (intro) return <>{screen}{storyCard}{storyBar}</>
  return (
    <DeviceFrame enabled={frame} docked={device !== 'handheld'} cover={pullingBack}
      bottomReserve={storyOn ? (captionsOn ? 112 : 64) : 18}
      overlay={<>{storyCard}{storyBar}</>}>
      {screen}
      <Toaster position="bottom-right" closeButton />
    </DeviceFrame>
  )
}
