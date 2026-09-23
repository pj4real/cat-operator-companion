import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional Tailwind classes; later utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
export const fixed = (n: number, d = 1) => n.toFixed(d)
export const firstName = (name: string) => name.split(' ')[0]
