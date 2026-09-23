import type { ReactElement } from 'react'
import { ChevronsUpDown, Moon, PanelLeftClose, PanelLeftOpen, PlugZap, Sun } from 'lucide-react'
import { useApp, type Workspace } from '@/store/app'
import { machine, operator } from '@/data/demo'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/controls'
import { NAV, WORKSPACE_LABEL } from './nav'
import { Wordmark } from './Brand'

const IDENTITY: Record<Workspace, { initials: string; name: string; meta: string }> = {
  operator: { initials: 'RK', name: operator.name, meta: operator.id },
  supervisor: { initials: 'SV', name: 'Site supervisor', meta: 'NH-48' },
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { workspace, page, navigate, setDevice, theme, toggleTheme, toggleSidebar } = useApp()
  const other: Workspace = workspace === 'operator' ? 'supervisor' : 'operator'
  const me = IDENTITY[workspace]

  const wrap = (label: string, node: ReactElement) => (collapsed ? <Tooltip content={label} side="right">{node}</Tooltip> : node)

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        <Wordmark collapsed={collapsed} />
      </div>

      {/* workspace switcher */}
      <div className={cn('border-b border-border', collapsed ? 'p-2' : 'p-3')}>
        {wrap(`Switch to ${WORKSPACE_LABEL[other]}`, (
          <button
            onClick={() => { navigate(other); onNavigate?.() }}
            aria-label={`Signed in as ${me.name}. Switch to ${WORKSPACE_LABEL[other]} workspace`}
            className={cn('flex w-full items-center gap-2.5 rounded-md text-left transition-colors hover:bg-surface-3', collapsed ? 'justify-center p-1.5' : 'p-2')}
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold',
              workspace === 'operator' ? 'bg-fg text-bg' : 'bg-info text-white')}>{me.initials}</span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{me.name}</span>
                  <span className="block truncate font-mono text-[11px] text-fg-3">{WORKSPACE_LABEL[workspace]} · {me.meta}</span>
                </span>
                <ChevronsUpDown size={15} className="text-fg-3" aria-hidden />
              </>
            )}
          </button>
        ))}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {NAV[workspace].map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && <div className="label-caps mb-1.5 px-2 text-fg-3">{group.label}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.page === page
                const Icon = item.icon
                return (
                  <li key={item.page}>
                    {wrap(item.label, (
                      <button
                        onClick={() => { navigate(workspace, item.page); onNavigate?.() }}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex h-11 w-full items-center gap-3 rounded-md text-[15px] font-medium transition-colors',
                          collapsed ? 'justify-center' : 'px-3',
                          active ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
                        )}
                      >
                        {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-brand" aria-hidden />}
                        <Icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden />
                        {!collapsed && item.label}
                      </button>
                    ))}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        {workspace === 'operator' && wrap(`Dock to ${machine.id}`, (
          <button
            onClick={() => { setDevice('docking'); onNavigate?.() }}
            className={cn(
              'group relative flex w-full items-center gap-3 overflow-hidden rounded-md bg-brand text-left text-brand-fg shadow-1 transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]',
              collapsed ? 'h-11 justify-center' : 'h-14 px-3',
            )}
          >
            <span className="absolute inset-x-0 bottom-0 h-1 hazard-stripe opacity-80" aria-hidden />
            <PlugZap size={20} strokeWidth={2.4} aria-hidden />
            {!collapsed && (
              <span className="leading-tight">
                <span className="block font-display text-base font-bold tracking-wide uppercase">Dock to machine</span>
                <span className="block font-mono text-[11px] opacity-75">{machine.model} · {machine.id}</span>
              </span>
            )}
          </button>
        ))}
        <div className={cn('flex gap-1', collapsed && 'flex-col items-center')}>
          {wrap(theme === 'light' ? 'Dark theme' : 'Light theme', (
            <button onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              className="flex h-10 w-10 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg">
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          ))}
          <button onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden h-10 w-10 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg lg:flex">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
      </div>
    </div>
  )
}
