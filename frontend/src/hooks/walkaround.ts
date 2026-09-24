import { machine } from '@/data/demo'
import { flaggedCheckId, orderedChecks } from '@/data/walkaround'
import { useApp } from '@/store/app'
import { useHealth } from './queries'

/** The walkaround's state for any screen: store results + the health model's ordering. */
export function useWalkaround() {
  const { data: h } = useHealth()
  const walk = useApp((s) => s.walkaround)
  const flagged = flaggedCheckId(h ?? machine.healthFallback)
  const checks = orderedChecks(flagged)
  const done = checks.filter((c) => walk.results[c.id]).length
  const issues = checks.filter((c) => walk.results[c.id]?.status === 'issue')
  return {
    checks, flagged, health: h, signedAt: walk.signedAt,
    total: checks.length, done, issues,
    flaggedIssue: flagged ? walk.results[flagged]?.status === 'issue' : false,
  }
}
