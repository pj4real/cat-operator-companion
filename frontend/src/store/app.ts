import { create } from 'zustand'
import type { InsightState, ShiftSummary } from '@/types'

export type Workspace = 'operator' | 'supervisor'
export type OperatorPage = 'today' | 'safety' | 'training' | 'activity' | 'twin'
export type SupervisorPage = 'overview' | 'telemetry'
export type Page = OperatorPage | SupervisorPage
export type DeviceMode = 'handheld' | 'docking' | 'docked'
export type Theme = 'light' | 'dark'

const DEFAULT_PAGE: Record<Workspace, Page> = { operator: 'today', supervisor: 'overview' }
const OPERATOR_PAGES: Page[] = ['today', 'safety', 'training', 'activity', 'twin']
const SUPERVISOR_PAGES: Page[] = ['overview', 'telemetry']

export function readHash(): { workspace: Workspace; page: Page } {
  const [, ws, pg] = window.location.hash.split('/')
  if (ws === 'supervisor') return { workspace: 'supervisor', page: SUPERVISOR_PAGES.includes(pg as Page) ? (pg as Page) : 'overview' }
  return { workspace: 'operator', page: OPERATOR_PAGES.includes(pg as Page) ? (pg as Page) : 'today' }
}

const INTRO_KEY = 'cc_intro_done'
function readIntro(): boolean {
  try { return sessionStorage.getItem(INTRO_KEY) !== '1' } catch { return true }
}

// Copilot item state (done / dismissed / assigned / sent) is kept for the day on this tablet
const INSIGHT_KEY = 'cc_insights_2026-09-23'
function readInsightState(): Record<string, InsightState> {
  try { return JSON.parse(localStorage.getItem(INSIGHT_KEY) || '{}') } catch { return {} }
}

function readTheme(): Theme {
  try { return localStorage.getItem('cc_theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

interface AppState {
  workspace: Workspace
  page: Page
  device: DeviceMode
  theme: Theme
  sidebarCollapsed: boolean
  paletteOpen: boolean
  selectedMachine: string
  today: ShiftSummary | null
  /** the spoken pre-shift briefing is showing */
  briefingOpen: boolean
  setBriefingOpen: (open: boolean) => void
  navigate: (workspace: Workspace, page?: Page) => void
  setDevice: (device: DeviceMode) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setPaletteOpen: (open: boolean) => void
  selectMachine: (id: string) => void
  setToday: (s: ShiftSummary) => void
  syncFromUrl: () => void
  /** demo clocks: the operator's and the supervisor's "now" for the Copilots */
  copilotNow: string
  siteNow: string
  setCopilotNow: (now: string) => void
  setSiteNow: (now: string) => void
  insightState: Record<string, InsightState>
  setInsightState: (id: string, state: InsightState | null) => void
  /** machines named by the Site Copilot item the supervisor is looking at */
  highlight: string[]
  siteDetailsOpen: boolean
  focusMachines: (ids: string[]) => void
  setSiteDetailsOpen: (open: boolean) => void
}

export const useApp = create<AppState>((set) => ({
  ...readHash(),
  device: 'handheld',
  theme: readTheme(),
  sidebarCollapsed: false,
  paletteOpen: false,
  selectedMachine: 'EXC001',
  today: null,
  briefingOpen: readIntro(),
  setBriefingOpen: (briefingOpen) => {
    try { if (briefingOpen) sessionStorage.removeItem(INTRO_KEY); else sessionStorage.setItem(INTRO_KEY, '1') } catch { /* ignore */ }
    set(briefingOpen ? { briefingOpen, workspace: 'operator', page: 'today', device: 'handheld' } : { briefingOpen })
  },
  navigate: (workspace, page) => {
    const next = page ?? DEFAULT_PAGE[workspace]
    const hash = `#/${workspace}/${next}`
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    set({ workspace, page: next, device: 'handheld' })
  },
  setDevice: (device) => set({ device }),
  toggleTheme: () => set((s) => {
    const theme = s.theme === 'light' ? 'dark' : 'light'
    try { localStorage.setItem('cc_theme', theme) } catch { /* private mode: theme just won't persist */ }
    return { theme }
  }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  selectMachine: (selectedMachine) => set({ selectedMachine }),
  setToday: (today) => set({ today }),
  syncFromUrl: () => set({ ...readHash(), device: 'handheld' }),
  copilotNow: '07:00',
  siteNow: '13:30',
  setCopilotNow: (copilotNow) => set({ copilotNow }),
  setSiteNow: (siteNow) => set({ siteNow }),
  insightState: readInsightState(),
  setInsightState: (id, state) => set((s) => {
    const next = { ...s.insightState }
    if (state) next[id] = state
    else delete next[id]
    try { localStorage.setItem(INSIGHT_KEY, JSON.stringify(next)) } catch { /* private mode: state lasts for this session */ }
    return { insightState: next }
  }),
  highlight: [],
  siteDetailsOpen: false,
  focusMachines: (ids) => set((s) => ({ highlight: ids, siteDetailsOpen: true, selectedMachine: ids[0] ?? s.selectedMachine })),
  setSiteDetailsOpen: (siteDetailsOpen) => set({ siteDetailsOpen }),
}))
