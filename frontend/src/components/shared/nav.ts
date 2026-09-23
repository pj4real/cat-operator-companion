import { Activity, GraduationCap, HardHat, LayoutDashboard, ListChecks, TableProperties, type LucideIcon } from 'lucide-react'
import type { Page, Workspace } from '@/store/app'

export interface NavItem { page: Page; label: string; icon: LucideIcon; description: string }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV: Record<Workspace, NavGroup[]> = {
  operator: [
    {
      label: 'My shift',
      items: [
        { page: 'today', label: 'Today', icon: ListChecks, description: 'Briefing, tasks with time estimates, machine health, fuel' },
        { page: 'safety', label: 'Site & safety', icon: HardHat, description: 'Site map, limits from site data, incidents' },
      ],
    },
    {
      label: 'My record',
      items: [
        { page: 'training', label: 'Training hub', icon: GraduationCap, description: 'Lessons from your shifts, skill passport, instructor booking' },
        { page: 'activity', label: 'Hours & activity', icon: Activity, description: 'Verified hours, idle reasons, machine data' },
      ],
    },
  ],
  supervisor: [
    {
      label: 'Site',
      items: [
        { page: 'overview', label: 'Site overview', icon: LayoutDashboard, description: 'KPIs, machines, predictions, alerts' },
        { page: 'telemetry', label: 'Telemetry audit', icon: TableProperties, description: 'Official sample scored by the unusual-behaviour model' },
      ],
    },
  ],
}

export const WORKSPACE_LABEL: Record<Workspace, string> = { operator: 'Operator', supervisor: 'Supervisor' }

export function pageLabel(workspace: Workspace, page: Page) {
  return NAV[workspace].flatMap((g) => g.items).find((i) => i.page === page)?.label ?? ''
}
