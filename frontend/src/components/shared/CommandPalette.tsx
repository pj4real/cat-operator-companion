import { useEffect } from 'react'
import { Command } from 'cmdk'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRightLeft, Moon, PlugZap, Volume2 } from 'lucide-react'
import { useApp, type Workspace } from '@/store/app'
import { useFleet } from '@/hooks/queries'
import { machine } from '@/data/demo'
import { NAV, WORKSPACE_LABEL } from './nav'
import { MachineThumb } from '@/components/ui/machine-thumb'

const ITEM = 'flex h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-[15px] text-fg-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-fg'
const GROUP = '[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-fg-3'

/**
 * Global ⌘K. Opened hundreds of times a day by a supervisor, so it deliberately has no
 * open/close animation: it should feel instant.
 */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, navigate, setDevice, toggleTheme, workspace, selectMachine, setBriefingOpen } = useApp()
  const { data: fleet } = useFleet()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(!useApp.getState().paletteOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen])

  const run = (fn: () => void) => () => { setPaletteOpen(false); fn() }
  const other: Workspace = workspace === 'operator' ? 'supervisor' : 'operator'

  return (
    <DialogPrimitive.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface text-fg shadow-3">
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command label="Command palette" loop>
            <Command.Input autoFocus placeholder="Search pages, machines, actions…"
              className="h-14 w-full border-b border-border bg-transparent px-5 text-base text-fg outline-none placeholder:text-fg-3" />
            <Command.List className="max-h-[min(440px,60vh)] overflow-y-auto scrollbar-thin p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-fg-3">No results. Try a machine ID like EXC001.</Command.Empty>

              {(['operator', 'supervisor'] as const).map((ws) => (
                <Command.Group key={ws} heading={`${WORKSPACE_LABEL[ws]} pages`} className={GROUP}>
                  {NAV[ws].flatMap((g) => g.items).map((item) => (
                    <Command.Item key={item.page} value={`${ws} ${item.label} ${item.description}`} onSelect={run(() => navigate(ws, item.page))} className={ITEM}>
                      <item.icon size={17} className="text-fg-3" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      <span className="hidden truncate text-xs text-fg-3 sm:block">{item.description}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}

              <Command.Group heading="Actions" className={GROUP}>
                <Command.Item value="dock machine display" onSelect={run(() => { navigate('operator'); setDevice('docking') })} className={ITEM}>
                  <PlugZap size={17} className="text-fg-3" aria-hidden /> Dock to {machine.model} · {machine.id}
                </Command.Item>
                <Command.Item value="replay voice briefing" onSelect={run(() => setBriefingOpen(true))} className={ITEM}>
                  <Volume2 size={17} className="text-fg-3" aria-hidden /> Replay voice briefing
                </Command.Item>
                <Command.Item value="switch workspace" onSelect={run(() => navigate(other))} className={ITEM}>
                  <ArrowRightLeft size={17} className="text-fg-3" aria-hidden /> Switch to {WORKSPACE_LABEL[other]} workspace
                </Command.Item>
                <Command.Item value="toggle theme dark light" onSelect={run(toggleTheme)} className={ITEM}>
                  <Moon size={17} className="text-fg-3" aria-hidden /> Toggle light / dark theme
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Machines" className={GROUP}>
                {fleet?.machines.map((m) => (
                  <Command.Item key={m.id} value={`${m.id} ${m.make} ${m.model} ${m.kind} ${m.operator}`}
                    onSelect={run(() => { selectMachine(m.id); navigate('supervisor', 'overview') })} className={ITEM}>
                    <MachineThumb kind={m.kind} size="xs" />
                    <span className="font-mono text-sm font-medium text-fg">{m.id}</span>
                    <span className="flex-1 truncate">{m.make} {m.model} · {m.kind}</span>
                    <span className="font-mono text-xs text-fg-3">{m.health.risk_pct}% risk</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
