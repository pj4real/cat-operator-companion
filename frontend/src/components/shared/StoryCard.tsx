import { IDLE_BURN_LPH, DIESEL_INR } from '@/lib/sim'

// Impact estimate, from stated assumptions (shown on the card): idle cut from the ~30% North American
// excavator average to 20%, on 1,000 engine hours a year, at our idle burn and diesel price.
const HOURS = 1000
const IDLE_FROM = 0.3
const IDLE_TO = 0.2
const idleHoursSaved = Math.round(HOURS * (IDLE_FROM - IDLE_TO))
const litresSaved = idleHoursSaved * IDLE_BURN_LPH
const rupeesSaved = litresSaved * DIESEL_INR

function Stat({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="border-t border-white/15 pt-4" style={{ animation: 'rise-in 1200ms var(--ease-out) both' }}>
      <div className="font-display text-[44px] leading-none font-semibold text-white">{value}</div>
      <div className="mt-2 text-[15px] leading-snug text-white/75">{label}</div>
      <div className="mt-2 font-mono text-[11px] text-white/40">{source}</div>
    </div>
  )
}

/** Full-stage title cards that open and close the story: the problem, and the impact. */
export function StoryCard({ kind }: { kind: 'problem' | 'impact' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden px-8 pb-28"
      style={{ background: 'radial-gradient(90% 70% at 50% 30%, #161a21 0%, #07080a 70%)' }}>
      {kind === 'problem' ? (
        <div className="w-full max-w-5xl">
          <div className="label-caps text-[#ffcd11]" style={{ animation: 'rise-in 1000ms var(--ease-out) both' }}>The problem</div>
          <h1 className="mt-4 max-w-4xl font-display text-[56px] leading-[1.05] font-bold text-white" style={{ animation: 'rise-in 1200ms var(--ease-out) 150ms both' }}>
            The machine knows everything about itself. Nothing on site knows the person driving it.
          </h1>
          <div className="mt-14 grid gap-8 md:grid-cols-3 [&>*:nth-child(2)]:[animation-delay:250ms] [&>*:nth-child(3)]:[animation-delay:450ms]">
            <Stat value="~30%" label="of an excavator's engine hours are spent idling. The telematics shows how much, never why."
              source="Construction Equipment · North American average" />
            <Stat value="668,999" label="buried utilities hit in the US in 2025, costing $83.2 billion a year. The operator rarely knows what is below."
              source="Common Ground Alliance · Aug 2026" />
            <Stat value="2 of 4" label="hours in the brief's own sample had the seatbelt off, and both were long, low-work idles."
              source="Problem statement telemetry · EXC001 / OP1001" />
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <div className="label-caps text-[#ffcd11]" style={{ animation: 'rise-in 1000ms var(--ease-out) both' }}>What it changes</div>
          <h1 className="mt-4 max-w-4xl font-display text-[52px] leading-[1.05] font-bold text-white" style={{ animation: 'rise-in 1200ms var(--ease-out) 150ms both' }}>
            One tablet that follows the operator, compares him with himself, and coaches instead of watching.
          </h1>
          <div className="mt-14 grid gap-8 md:grid-cols-3 [&>*:nth-child(2)]:[animation-delay:250ms] [&>*:nth-child(3)]:[animation-delay:450ms]">
            <Stat value={`₹${Math.round(rupeesSaved / 1000)}k`}
              label={`fuel a year per excavator if idle drops from 30% to 20%: ${idleHoursSaved} h and ${Math.round(litresSaved)} L of diesel.`}
              source={`Estimate · ${HOURS} h/yr · ${IDLE_BURN_LPH} L/h idle · ₹${DIESEL_INR}/L`} />
            <Stat value="3" label="interlocks from context, not from a single sensor: swing held for a person, restart guard for the belt, depth limit from the fibre route."
              source="Built and shown in this demo" />
            <Stat value="95%" label="of unusual hours caught by the operator's own twin, against 81% for one site-wide threshold, with fewer false alarms."
              source="Held-out test on synthetic data · ml/train.py" />
          </div>
          <div className="mt-12 flex flex-wrap gap-2" style={{ animation: 'rise-in 1200ms var(--ease-out) 700ms both' }}>
            <span className="mr-2 self-center font-mono text-xs text-white/40">NEXT</span>
            {['Site mesh between tablets', 'Auto E-fence from Call Before u Dig', 'Mentor matching for new operators', 'Fusion with Cat Detect cameras', 'Real telemetry pilot'].map((r) => (
              <span key={r} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/75">{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
