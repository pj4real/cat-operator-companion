import type { ReactNode } from 'react'
import { useApp } from '@/store/app'
import { cn } from '@/lib/utils'
import { SidebarContent } from './Sidebar'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'

export function AppShell({ children }: { children: ReactNode }) {
  const { sidebarCollapsed, page, workspace } = useApp()
  return (
    <div className="flex h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-brand-fg">
        Skip to content
      </a>
      <aside
        aria-label="Sidebar"
        className={cn('hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 ease-out md:block',
          sidebarCollapsed ? 'w-[72px]' : 'w-[72px] lg:w-64')}
      >
        {/* md: icon rail; lg: full unless collapsed */}
        <div className="h-full lg:hidden"><SidebarContent collapsed /></div>
        <div className="hidden h-full lg:block"><SidebarContent collapsed={sidebarCollapsed} /></div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" key={`${workspace}/${page}`} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
