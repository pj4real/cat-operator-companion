import { create } from 'zustand'
import type { ShiftSummary } from '@/types'

export type Workspace = 'operator' | 'supervisor'
export type OperatorPage = 'today' | 'safety' | 'training' | 'activity' | 'twin' | 'walkaround'
export type SupervisorPage = 'overview' | 'telemetry'
export type Page = OperatorPage | SupervisorPage
export type DeviceMode = 'handheld' | 'docking' | 'docked'
export type Theme = 'light' | 'dark'

const DEFAULT_PAGE: Record<Workspace, Page> = { operator: 'today', supervisor: 'overview' }
const OPERATOR_PAGES: Page[] = ['today', 'safety', 'training', 'activity', 'twin', 'walkaround']
const SUPERVISOR_PAGES: Page[] = ['overview', 'telemetry']

export function readHash(): { workspace: Workspace; page: Page } {
  const [, ws, pg] = window.location.hash.split('/')
  if (ws === 'supervisor') return { workspace: 'supervisor', page: SUPERVISOR_PAGES.includes(pg as Page) ? (pg as Page) : 'overview' }
  return { workspace: 'operator', page: OPERATOR_PAGES.includes(pg as Page) ? (pg as Page) : 'today' }
}

/** One pre-start check: passed, or an issue logged against it (one of the canned issue types). */
export type CheckResult = { status: 'ok' } | { status: 'issue'; issue: string }

export interface Walkaround {
  /** keyed by check id (see data/walkaround.ts) */
  results: Record<string, CheckResult>
  /** demo-clock time the operator signed the walkaround, null until signed */
  signedAt: string | null
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
  walkaround: Walkaround
  recordCheck: (id: string, result: CheckResult) => void
  clearCheck: (id: string) => void
  signWalkaround: (at: string) => void
  resetWalkaround: () => void
}

export const useApp = create<AppState>((set) => ({
  ...readHash(),
  device: 'handheld',
  theme: readTheme(),
  sidebarCollapsed: false,
  paletteOpen: false,
  selectedMachine: 'EXC001',
  today: null,
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
  walkaround: { results: {}, signedAt: null },
  recordCheck: (id, result) => set((s) => ({ walkaround: { ...s.walkaround, results: { ...s.walkaround.results, [id]: result } } })),
  clearCheck: (id) => set((s) => {
    const results = { ...s.walkaround.results }
    delete results[id]
    return { walkaround: { results, signedAt: null } }
  }),
  signWalkaround: (signedAt) => set((s) => ({ walkaround: { ...s.walkaround, signedAt } })),
  resetWalkaround: () => set({ walkaround: { results: {}, signedAt: null } }),
}))
