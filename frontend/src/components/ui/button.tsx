import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'inverse'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-fg hover:bg-brand-hover shadow-1',
  secondary: 'bg-surface text-fg border border-border-strong hover:bg-surface-2',
  ghost: 'text-fg-2 hover:bg-surface-3 hover:text-fg',
  danger: 'bg-critical text-white hover:brightness-110',
  success: 'bg-good text-white hover:brightness-110',
  inverse: 'bg-fg text-bg hover:opacity-90',
}

// Operator screens are used with gloves: md and up clear the 44 px target.
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-14 px-5 text-base gap-2.5',
  icon: 'h-11 w-11',
  'icon-sm': 'h-9 w-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold whitespace-nowrap',
        'transition-[transform,background-color,opacity,filter] duration-150 ease-out active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANT[variant], SIZE[size], className,
      )}
      {...props}
    />
  )
})
