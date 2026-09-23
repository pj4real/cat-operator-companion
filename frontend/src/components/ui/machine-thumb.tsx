import { useState } from 'react'
import { Truck } from 'lucide-react'
import { machineImage } from '@/lib/machines'
import { cn } from '@/lib/utils'

const SIZE = {
  xs: 'h-7 w-9',
  sm: 'h-10 w-14',
  md: 'h-20 w-28',
  lg: 'h-32 w-44',
  hero: 'h-40 w-56',
}

/**
 * Product shot of a machine on a quiet plate, the way fleet tools show assets.
 * Falls back to a neutral icon if the kind is unknown or the image fails to load.
 */
export function MachineThumb({ kind, size = 'sm', plate = true, className }: {
  kind: string; size?: keyof typeof SIZE; plate?: boolean; className?: string
}) {
  const img = machineImage(kind)
  const [failed, setFailed] = useState(false)
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden', SIZE[size],
      plate && 'rounded-md bg-gradient-to-b from-surface-2 to-surface-3 ring-1 ring-border', className)}>
      {img && !failed ? (
        <img src={img.src} alt={img.alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)}
          className={cn('h-full w-full object-contain drop-shadow-[0_2px_2px_rgb(0_0_0/0.25)]', size === 'xs' || size === 'sm' ? 'scale-[1.18]' : 'p-[4%]')} />
      ) : (
        <Truck className="h-1/2 w-1/2 text-fg-3" aria-hidden />
      )}
    </span>
  )
}
