import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { BatteryMedium, ChevronRight, Menu, Search, Wifi } from 'lucide-react'
import { useApp } from '@/store/app'
import { useApiStatus } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import { usePortalContainer } from '@/lib/portal'
import { Kbd } from '@/components/ui/controls'
import { pageLabel, WORKSPACE_LABEL } from './nav'
import { SidebarContent } from './Sidebar'

export function TopBar() {
  const { workspace, page, setPaletteOpen, navigate } = useApp()
  const { data: apiLive } = useApiStatus()
  const [drawer, setDrawer] = useState(false)
  const portal = usePortalContainer()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform)

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md md:px-6">
      {/* mobile navigation drawer */}
      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Trigger asChild>
          <button aria-label="Open navigation" className="-ml-1 flex h-11 w-11 items-center justify-center rounded-md text-fg-2 hover:bg-surface-3 md:hidden">
            <Menu size={20} />
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal container={portal}>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-overlay-in" />
          <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface shadow-3">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          <li>
            <button onClick={() => navigate(workspace)} className="text-fg-3 transition-colors hover:text-fg">{WORKSPACE_LABEL[workspace]}</button>
          </li>
          <li aria-hidden><ChevronRight size={14} className="text-fg-3" /></li>
          <li aria-current="page" className="truncate font-semibold text-fg">{pageLabel(workspace, page)}</li>
        </ol>
      </nav>

      <button
        onClick={() => setPaletteOpen(true)}
        className="ml-auto flex h-10 w-10 items-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-fg-3 transition-colors hover:border-border-strong hover:text-fg-2 sm:w-72 sm:px-3 justify-center sm:justify-start"
        aria-label="Search pages, machines and actions"
      >
        <Search size={16} aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
        <span className="hidden gap-0.5 sm:flex"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
      </button>

      <div className="hidden items-center gap-4 border-l border-border pl-4 lg:flex">
        <span className={cn('flex items-center gap-1.5 font-mono text-[11.5px]', apiLive ? 'text-good-text' : 'text-fg-3')}
          title={apiLive ? 'ML API reachable: predictions are computed live' : 'ML API unreachable: showing cached predictions'}>
          <span className={cn('h-2 w-2 rounded-full', apiLive ? 'bg-good' : 'border border-fg-3')} aria-hidden />
          {apiLive ? 'Models live' : 'Offline · cached'}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-fg-3" title="Tablets on this site that share position and alerts">
          <Wifi size={14} aria-hidden /> Site mesh · 6
        </span>
        <span className="flex items-center gap-1 font-mono text-[11.5px] text-fg-3" aria-label="Tablet battery 82 percent">
          <BatteryMedium size={16} aria-hidden /> 82%
        </span>
      </div>
    </header>
  )
}
