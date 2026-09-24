import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { PortalContainer } from '@/lib/portal'
import { cn } from '@/lib/utils'

// A 10" rugged tablet: 1280×800 CSS px screen (16:10), thick rubber bezel.
const SCREEN_W = 1280
const SCREEN_H = 800
const BEZEL = 28
const OUTER_W = SCREEN_W + BEZEL * 2
const OUTER_H = SCREEN_H + BEZEL * 2
const CRADLE = 64 // room under the tablet for the cab dock

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

/**
 * Presentation stage: the app runs on a rugged tablet, the way it would on site. The screen is a
 * fixed 1280×800 and is scaled to the display. `cover` makes the screen fill the whole display
 * (bezel off-screen); switching to fit animates the pull-back into the device. Overlays render into
 * the screen through PortalContainer; the transform keeps position:fixed children inside it too.
 */
export function DeviceFrame({ children, enabled, docked, cover, bottomReserve = 24, overlay }: {
  children: ReactNode
  enabled: boolean
  docked: boolean
  /** screen fills the display (used right after the full-screen briefing, then released) */
  cover: boolean
  /** space kept free under the device (story captions) */
  bottomReserve?: number
  /** presenter UI drawn on the stage, outside the device */
  overlay?: ReactNode
}) {
  const vp = useViewport()
  const [screen, setScreen] = useState<HTMLDivElement | null>(null)

  if (!enabled) {
    return (
      <>
        <div ref={setScreen} className="relative h-full w-full">
          <PortalContainer.Provider value={screen}>{children}</PortalContainer.Provider>
        </div>
        {overlay}
      </>
    )
  }

  const margin = 18
  const availH = vp.h - margin - bottomReserve - (docked ? CRADLE : 0)
  const fit = Math.min((vp.w - margin * 2) / OUTER_W, availH / OUTER_H)
  const fx = (vp.w - OUTER_W * fit) / 2
  const fy = margin + Math.max(0, (availH - OUTER_H * fit) / 2)
  const cs = Math.max(vp.w / SCREEN_W, vp.h / SCREEN_H)
  const cx = (vp.w - SCREEN_W * cs) / 2 - BEZEL * cs
  const cy = (vp.h - SCREEN_H * cs) / 2 - BEZEL * cs
  const [s, x, y] = cover ? [cs, cx, cy] : [fit, fx, fy]

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: 'radial-gradient(120% 90% at 50% 20%, #1c2027 0%, #0a0b0d 60%, #060708 100%)' }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: OUTER_W, height: OUTER_H + CRADLE,
          transform: `translate(${x}px, ${y}px) scale(${s})`,
          transition: cover ? 'none' : 'transform 1400ms cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      >
        <Cradle docked={docked} />
        {/* rugged shell: rubber bezel, corner bumpers, camera */}
        <div className={cn('absolute top-0 left-0 rounded-[34px] transition-transform duration-700 ease-out', docked && 'translate-y-[10px]')}
          style={{
            width: OUTER_W, height: OUTER_H,
            background: 'linear-gradient(180deg, #25282d 0%, #16181b 100%)',
            boxShadow: '0 0 0 1.5px #0b0c0e, inset 0 1px 0 rgb(255 255 255 / 0.08), 0 50px 120px -30px rgb(0 0 0 / 0.9), 0 20px 40px -20px rgb(0 0 0 / 0.8)',
          }}>
          {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([r, b]) => (
            <span key={`${r}${b}`} aria-hidden className="absolute h-[92px] w-[92px] bg-[#101114]"
              style={{
                [r ? 'right' : 'left']: -6, [b ? 'bottom' : 'top']: -6,
                borderRadius: `${!r && !b ? 40 : 18}px ${r && !b ? 40 : 18}px ${r && b ? 40 : 18}px ${!r && b ? 40 : 18}px`,
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
              }} />
          ))}
          <span aria-hidden className="absolute top-[11px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-[#0a0b0d] ring-1 ring-white/10" />
          <span aria-hidden className="absolute bottom-[8px] left-1/2 -translate-x-1/2 font-display text-[10px] font-semibold tracking-[0.3em] text-white/25 uppercase">
            Operator Companion
          </span>
          <div ref={setScreen} className="absolute overflow-hidden rounded-[10px] bg-bg ring-1 ring-black"
            style={{ left: BEZEL, top: BEZEL, width: SCREEN_W, height: SCREEN_H, transform: 'translateZ(0)' }}>
            <PortalContainer.Provider value={screen}>{children}</PortalContainer.Provider>
          </div>
        </div>
      </div>
      {overlay}
    </div>
  )
}

/** Cab dock: rises under the tablet when it docks; the connector LED shows the J1939 link. */
function Cradle({ docked }: { docked: boolean }) {
  return (
    <div aria-hidden className={cn('absolute left-1/2 -translate-x-1/2 transition-[top,opacity] duration-700 ease-out',
      docked ? 'opacity-100' : 'opacity-0')}
      style={{ top: docked ? OUTER_H - 16 : OUTER_H + 30, width: OUTER_W * 0.62 }}>
      <div className="relative h-[72px] rounded-b-[18px] rounded-t-[6px]"
        style={{ background: 'linear-gradient(180deg, #2c3036 0%, #1a1c20 100%)', boxShadow: '0 20px 40px -12px rgb(0 0 0 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.07)' }}>
        <span className="absolute top-[18px] left-5 h-[34px] w-[54px] rounded-md bg-[#ffcd11] shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]" />
        <span className="absolute top-[18px] right-5 h-[34px] w-[54px] rounded-md bg-[#ffcd11] shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]" />
        <div className="absolute top-[40px] left-1/2 flex -translate-x-1/2 items-center gap-2.5 font-mono text-[12px] tracking-widest text-white/55">
          <span className={cn('h-2.5 w-2.5 rounded-full', docked ? 'bg-[#22c55e] shadow-[0_0_12px_2px_rgb(34_197_94/0.7)]' : 'bg-white/20')} />
          CAB DOCK · CAN / J1939
        </div>
      </div>
    </div>
  )
}

/** Starts covering the display, then releases to the fitted device (the pull-back), each time `trigger` changes. */
export function usePullBack(trigger: number) {
  const [cover, setCover] = useState(false)
  useLayoutEffect(() => {
    if (!trigger) return
    setCover(true)
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => setCover(false)) })
    return () => cancelAnimationFrame(id)
  }, [trigger])
  return cover
}
