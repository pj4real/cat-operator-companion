import { create } from 'zustand'
import type { ShiftSummary } from '@/types'

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
  /** story mode: presenter chapter bar for Ravi's day */
  /** presentation: run the app inside a rugged tablet mockup */
  frame: boolean
  toggleFrame: () => void
  storyOn: boolean
  storyIndex: number
  captionsOn: boolean
  setStory: (on: boolean, index?: number) => void
  toggleCaptions: () => void
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
}

export const useApp = create<AppState>((set) => ({
  ...readHash(),
  device: 'handheld',
  theme: readTheme(),
  sidebarCollapsed: false,
  paletteOpen: false,
  selectedMachine: 'EXC001',
  today: null,
  frame: (() => { try { return localStorage.getItem('cc_frame') !== '0' } catch { return true } })(),
  toggleFrame: () => set((s) => {
    try { localStorage.setItem('cc_frame', s.frame ? '0' : '1') } catch { /* ignore */ }
    return { frame: !s.frame }
  }),
  storyOn: new URLSearchParams(window.location.search).has('story'),
  storyIndex: 0,
  captionsOn: true,
  setStory: (storyOn, index) => set((s) => ({ storyOn, storyIndex: index ?? s.storyIndex })),
  toggleCaptions: () => set((s) => ({ captionsOn: !s.captionsOn })),
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
}))
