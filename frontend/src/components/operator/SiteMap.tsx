import { siteMap } from '@/data/demo'

/** Top-down site plan. Hazards (fibre, 11 kV) use status colours; they are hazards, not series. */
export function SiteMap() {
  const { zones, powerline, fibre, excavator, dumper, workers, heatRest } = siteMap
  return (
    <figure>
      <svg viewBox="0 0 100 60" className="w-full rounded-md border border-border bg-surface-2" style={{ aspectRatio: '5 / 3' }}
        role="img" aria-label="Site map: Zone B trenching over a fibre route, 11 kV line along the north edge, excavator EXC001 in Zone B, two new workers nearby, dumper at Bay 2.">
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="var(--border)" strokeWidth="0.15" />
          </pattern>
        </defs>
        <rect width="100" height="60" fill="url(#grid)" />

        {zones.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1"
              fill={z.tone === 'hazard' ? 'var(--serious-soft)' : 'var(--surface)'}
              stroke={z.tone === 'hazard' ? 'var(--serious)' : 'var(--border-strong)'} strokeWidth="0.35"
              strokeDasharray={z.tone === 'hazard' ? '1.4 0.8' : undefined} />
            <text x={z.x + 1.4} y={z.y + 3.2} fontSize="2.3" fill="var(--fg-2)" fontWeight="600" fontFamily="var(--font-sans)">{z.label}</text>
          </g>
        ))}

        <line x1="2" y1={powerline.y} x2="98" y2={powerline.y} stroke="var(--critical)" strokeWidth="0.35" />
        {powerline.poles.map((x) => (
          <g key={x}>
            <line x1={x} y1={powerline.y} x2={x} y2={powerline.y + 3.5} stroke="var(--fg)" strokeWidth="0.5" />
            <circle cx={x} cy={powerline.y} r="0.8" fill="var(--fg)" />
          </g>
        ))}
        <text x="21" y={powerline.y - 1.1} fontSize="2.1" fill="var(--critical-text)" fontFamily="var(--font-mono)">11 kV · E-ceiling 6.0 m</text>

        <polyline points={fibre.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--serious)" strokeWidth="0.7" strokeDasharray="1.6 0.9" />
        <text x={fibre[0][0] + 1} y={Math.min(fibre[0][1], fibre[1][1]) - 1.6} fontSize="2.1" fill="var(--serious-text)" fontFamily="var(--font-mono)">Fibre 1.2 m · E-floor 0.9 m</text>

        <circle cx={heatRest.x} cy={heatRest.y} r="1.6" fill="var(--warning)" opacity="0.35" />
        <text x={heatRest.x + 2.4} y={heatRest.y + 0.8} fontSize="2" fill="var(--fg-3)">{heatRest.label}</text>

        <g transform={`translate(${excavator.x} ${excavator.y})`}>
          <circle r="7" fill="var(--good)" opacity="0.08" stroke="var(--good)" strokeWidth="0.2" strokeDasharray="0.8 0.6" />
          <rect x="-2.4" y="-2.4" width="4.8" height="4.8" rx="0.8" fill="var(--brand)" stroke="#121314" strokeWidth="0.35" />
          <text y="0.75" fontSize="1.9" fontWeight="700" textAnchor="middle" fill="#121314" fontFamily="var(--font-display)">EX</text>
          <text y="5" fontSize="2" textAnchor="middle" fill="var(--fg-2)" fontFamily="var(--font-mono)">EXC001</text>
        </g>

        <g transform={`translate(${dumper.x} ${dumper.y})`}>
          <rect x="-2.2" y="-1.6" width="4.4" height="3.2" rx="0.5" fill="var(--s1)" />
          <text y="4.4" fontSize="2" textAnchor="middle" fill="var(--fg-2)" fontFamily="var(--font-mono)">T-07</text>
        </g>

        {workers.map((w) => (
          <g key={w.tag} transform={`translate(${w.x} ${w.y})`}>
            <circle r="2.6" fill="none" stroke="var(--good)" strokeWidth="0.35" />
            <circle r="1.1" fill="var(--fg)" />
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-2">
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-[2px] border border-fg bg-brand" />Excavator EXC001 · swing ring</span>
        <span className="flex items-center gap-2"><span className="h-2.5 w-3.5 rounded-[2px] bg-s1" />Dumper T-07</span>
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-good" />New worker (Day 3)</span>
        <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-serious" />Fibre route</span>
        <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-critical" />11 kV line</span>
      </figcaption>
    </figure>
  )
}
