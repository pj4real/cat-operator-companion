import { Truck } from 'lucide-react'
import { siteMap } from '../data/demo'

const ZONE_FILL = { neutral: '#eef0ea', hazard: '#fdeee6' }
const ZONE_STROKE = { neutral: '#c3c2b7', hazard: '#ec835a' }

export default function SiteMap() {
  const { zones, powerline, fibre, excavator, dumper, workers, heatRest } = siteMap
  return (
    <div className="relative">
      <svg viewBox="0 0 100 60" className="w-full" style={{ aspectRatio: '5 / 3' }}>
        <rect x="0" y="0" width="100" height="60" rx="3" fill="#f9f9f7" />

        {/* geofenced zones */}
        {zones.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="2"
              fill={ZONE_FILL[z.tone]} stroke={ZONE_STROKE[z.tone]} strokeWidth="0.4" strokeDasharray={z.tone === 'hazard' ? '1.5 1' : undefined} />
            <text x={z.x + 1.5} y={z.y + 3.2} fontSize="2.4" fill="#52514e" fontWeight="600">{z.label}</text>
          </g>
        ))}

        {/* 11kV powerline */}
        <line x1="2" y1={powerline.y} x2="98" y2={powerline.y} stroke="#0b0b0b" strokeWidth="0.35" />
        {powerline.poles.map((x) => (
          <g key={x}>
            <line x1={x} y1={powerline.y} x2={x} y2={powerline.y + 4} stroke="#0b0b0b" strokeWidth="0.5" />
            <circle cx={x} cy={powerline.y} r="0.8" fill="#0b0b0b" />
          </g>
        ))}
        <text x="2" y={powerline.y - 1.2} fontSize="2.2" fill="#52514e">11 kV line · 6.0 m ceiling</text>

        {/* fibre route (Call Before u Dig) */}
        <polyline points={fibre.map((p) => p.join(',')).join(' ')} fill="none" stroke="#eb6834" strokeWidth="0.6" strokeDasharray="1.6 1" />
        <text x={fibre[0][0]} y={Math.min(fibre[0][1], fibre[1][1]) - 2.6} fontSize="2.2" fill="#eb6834" fontWeight="600">Fibre · 0.9 m floor</text>

        {/* heat rest bay */}
        <circle cx={heatRest.x} cy={heatRest.y} r="1.6" fill="#eda100" opacity="0.25" />
        <text x={heatRest.x + 2.4} y={heatRest.y + 0.8} fontSize="2" fill="#898781">{heatRest.label}</text>

        {/* excavator */}
        <g transform={`translate(${excavator.x} ${excavator.y})`}>
          <circle r="7" fill="#0ca30c" opacity="0.08" />
          <circle r="2.4" fill="#f2b705" stroke="#0b0b0b" strokeWidth="0.3" />
          <text x="0" y="0.7" fontSize="2" fontWeight="700" textAnchor="middle">EX</text>
          <text x="0" y="4.6" fontSize="2" textAnchor="middle" fill="#52514e">EXC001</text>
        </g>

        {/* dumper */}
        <g transform={`translate(${dumper.x} ${dumper.y})`}>
          <rect x="-2.2" y="-1.6" width="4.4" height="3.2" rx="0.6" fill="#2a78d6" />
          <text x="0" y="4.4" fontSize="2" textAnchor="middle" fill="#52514e">T-07</text>
        </g>

        {/* workers, day-3 highlighted */}
        {workers.map((w) => (
          <g key={w.tag} transform={`translate(${w.x} ${w.y})`}>
            <circle r="3" fill="none" stroke="#4a3aa7" strokeWidth="0.3" opacity="0.5" />
            <circle r="1.3" fill="#4a3aa7" />
          </g>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink3">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f2b705]" />Excavator EXC001</span>
        <span className="flex items-center gap-1.5"><Truck size={11} />Dumper T-07</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4a3aa7]" />New workers (Day 3)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#eb6834]" style={{ borderTop: '1.5px dashed #eb6834', background: 'none' }} />Fibre route</span>
      </div>
    </div>
  )
}
