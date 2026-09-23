import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'info' | 'neutral'

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-good-text', warning: 'text-warning-text', serious: 'text-serious-text',
  critical: 'text-critical-text', info: 'text-info-text', neutral: 'text-fg-2',
}
export const TONE_SOFT: Record<Tone, string> = {
  good: 'bg-good-soft', warning: 'bg-warning-soft', serious: 'bg-serious-soft',
  critical: 'bg-critical-soft', info: 'bg-info-soft', neutral: 'bg-surface-3',
}
export const TONE_FILL: Record<Tone, string> = {
  good: 'bg-good', warning: 'bg-warning', serious: 'bg-serious',
  critical: 'bg-critical', info: 'bg-info', neutral: 'bg-fg-3',
}
export const TONE_ICON: Record<Tone, LucideIcon> = {
  good: CircleCheck, warning: TriangleAlert, serious: TriangleAlert,
  critical: OctagonAlert, info: Info, neutral: Info,
}

