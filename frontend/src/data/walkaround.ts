// Pre-start walkaround for the Cat 320. The checks are general daily-inspection points,
// not a copy of any OEM checklist. What the app adds is the ORDER: the health model's
// component goes first, with the model's reason attached.
import type { HealthResult } from '@/types'

export interface WalkCheck {
  id: string
  title: string
  /** what to look for, 1–2 lines, plain language */
  lookFor: string
  /** canned issue types: one tap to log */
  issues: string[]
  /** marker position on /machines/excavator.webp, in % of the image box (side view, boom left) */
  spot: { x: number; y: number }
  /** matched against the health model's component/action to decide what gets flagged */
  match: RegExp
}

// Walk order when nothing is flagged: engine end, around the tracks, up the boom to the bucket, back to the cab.
export const WALK_CHECKS: WalkCheck[] = [
  {
    id: 'intake', title: 'Air filter & intake',
    lookFor: 'Open the engine side door. Check the filter restriction indicator, the pre-cleaner bowl, and intake hoses and clamps for cracks or dust trails.',
    issues: ['Filter dirty or indicator in red', 'Hose cracked or clamp loose', 'Dust trail inside the intake'],
    spot: { x: 84, y: 57 }, match: /air (filter|intake)|intake/i,
  },
  {
    id: 'fluids', title: 'Fluid levels',
    lookFor: 'Engine off, machine level. Read the engine oil dipstick, the coolant sight glass and the hydraulic tank gauge.',
    issues: ['Engine oil low', 'Coolant low', 'Hydraulic oil low'],
    spot: { x: 92, y: 72 }, match: /coolant|oil level|fluid/i,
  },
  {
    id: 'tracks', title: 'Tracks & undercarriage',
    lookFor: 'Walk both sides. Look for loose or broken shoes, too much sag, oil at the rollers and idlers, and packed mud or rock.',
    issues: ['Track too slack or too tight', 'Shoe bolt loose or missing', 'Oil leak at a roller or idler'],
    spot: { x: 70, y: 88 }, match: /track|undercarriage|roller|idler/i,
  },
  {
    id: 'hoses', title: 'Hydraulic hoses (boom)',
    lookFor: 'Follow the boom and stick hoses and cylinders. Look for wet fittings, drips, chafed covers and scored cylinder rods.',
    issues: ['Leak or wet fitting', 'Hose chafed or bulging', 'Cylinder rod scored'],
    spot: { x: 41, y: 32 }, match: /hydraulic|hose|cylinder/i,
  },
  {
    id: 'bucket', title: 'Bucket teeth & pins',
    lookFor: 'Check each tooth for wear or play, the pins and retainers at the stick and linkage, and the cutting edge for cracks.',
    issues: ['Tooth worn or missing', 'Pin or retainer loose', 'Crack in the cutting edge'],
    spot: { x: 17, y: 82 }, match: /bucket|teeth|tooth|linkage/i,
  },
  {
    id: 'cab', title: 'Cab: mirrors, seatbelt, extinguisher',
    lookFor: 'Mirrors clean and set, seatbelt latches and retracts, fire extinguisher present and charged, steps and handrails clear.',
    issues: ['Mirror damaged or missing', 'Seatbelt not latching', 'Extinguisher missing or discharged'],
    spot: { x: 65, y: 70 }, match: /cab|seat ?belt|mirror|extinguisher/i,
  },
]

/** The check the health model points at, if any (only when the model says watch or high). */
export function flaggedCheckId(h: HealthResult | undefined): string | null {
  if (!h || h.level === 'low') return null
  const text = `${h.component ?? ''} ${h.action}`
  return WALK_CHECKS.find((c) => c.match.test(text))?.id ?? null
}

/** Ordered by prediction: the flagged check first, the rest in walk order. */
export function orderedChecks(flagged: string | null): WalkCheck[] {
  if (!flagged) return WALK_CHECKS
  return [...WALK_CHECKS.filter((c) => c.id === flagged), ...WALK_CHECKS.filter((c) => c.id !== flagged)]
}

// The demo day runs on a scripted clock (clocked in 06:52, first task 07:30).
// The walkaround is signed at this time, whatever the wall clock says.
export const WALKAROUND_SIGNED_AT = '06:58'
