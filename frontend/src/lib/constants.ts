import type { IdleReason, RiskLevel } from '@/types'
import type { Tone } from '@/lib/tones'

export const RISK: Record<RiskLevel, { tone: Tone; label: string }> = {
  high: { tone: 'critical', label: 'High' },
  watch: { tone: 'warning', label: 'Watch' },
  low: { tone: 'good', label: 'Low' },
}

/**
 * Idle-reason identity, shared by every idle chart (handheld, fleet, docked).
 * Order validated for CVD + normal-vision separation in both themes: waste leads the stack.
 */
export const IDLE_REASONS: { key: IdleReason; label: string; color: string; justified: boolean }[] = [
  { key: 'waste', label: 'No reason (waste)', color: 'var(--s8)', justified: false },
  { key: 'waiting_for_truck', label: 'Waiting for truck', color: 'var(--s1)', justified: true },
  { key: 'heat_rest', label: 'Heat rest', color: 'var(--s2)', justified: true },
  { key: 'warm_up', label: 'Warm-up', color: 'var(--s3)', justified: true },
  { key: 'cool_down', label: 'Cool-down', color: 'var(--s4)', justified: true },
]
