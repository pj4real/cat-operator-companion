import { operator } from '@/data/demo'

export function weekTotals() {
  const total = operator.weekHours.reduce((a, d) => a + d.h, 0)
  const ot = operator.weekHours.reduce((a, d) => a + d.ot, 0)
  return { total, ot }
}
