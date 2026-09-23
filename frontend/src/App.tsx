import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { useApp } from '@/store/app'
import { createSim, logEvent, IDLE_BURN_LPH, SIM_SPEED, type Sim } from '@/lib/sim'
import type { Lesson, ShiftSummary } from '@/types'
import { AppShell } from '@/components/shared/AppShell'
import { TodayPage } from '@/components/operator/TodayPage'
import { SafetyPage } from '@/components/operator/SafetyPage'
import { TrainingPage } from '@/components/operator/TrainingPage'
import { ActivityPage } from '@/components/operator/ActivityPage'
import { FleetOverviewPage, TelemetryAuditPage } from '@/components/fleet/FleetPages'
import { DockTransition } from '@/components/docked/DockTransition'

// three.js screens load on demand so the handheld dashboard opens fast
const DockedMode = lazy(() => import('@/components/docked/DockedMode').then((m) => ({ default: m.DockedMode })))
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
  }
}

const PAGES = {
  today: TodayPage,
  safety: SafetyPage,
  training: TrainingPage,
  activity: ActivityPage,
  overview: FleetOverviewPage,
  telemetry: TelemetryAuditPage,
}

function Loading({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center bg-bg font-mono text-sm text-fg-3" role="status">{label}…</div>
}

export default function App() {
  const { device, page, theme, briefingOpen, setDevice, setToday, setBriefingOpen, navigate, syncFromUrl } = useApp()
  const sim = useRef<Sim>(createSim())

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
    setToday(summarise(sim.current))
    navigate('operator', 'today')
  }

  if (device === 'docking') return <DockTransition onDone={dockDone} />
  if (device === 'docked') return <Suspense fallback={<Loading label="Starting machine display" />}><DockedMode sim={sim.current} onUndock={undock} /></Suspense>
  if (briefingOpen && page === 'today') return <Suspense fallback={<Loading label="Preparing your briefing" />}><AssistantIntro onFinish={() => setBriefingOpen(false)} /></Suspense>

  const Page = PAGES[page]
  return <AppShell><Page /></AppShell>
}
