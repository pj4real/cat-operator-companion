import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status'

export interface TelemetryRow {
  time: string
  fuel: number
  cycles: number
  idle: number
  belt: string
  alert?: string
  unusual: boolean
  reasons?: string[]
}

/** The official sample from the problem statement, with our model's verdict per row. */
export function TelemetryTable({ rows, dense = false, showAlert = true }: { rows: TelemetryRow[]; dense?: boolean; showAlert?: boolean }) {
  const cell = dense ? 'px-2 py-2' : 'px-3 py-3'
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-2">
          <tr className="label-caps text-fg-3">
            <th scope="col" className={cell}>Timestamp</th>
            <th scope="col" className={cn(cell, 'text-right')}>Fuel L</th>
            <th scope="col" className={cn(cell, 'text-right')}>Cycles</th>
            <th scope="col" className={cn(cell, 'text-right')}>Idle min</th>
            <th scope="col" className={cell}>Seatbelt</th>
            {showAlert && <th scope="col" className={cell}>Their alert</th>}
            <th scope="col" className={cell}>Our model</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px] tabular">
          {rows.map((r) => (
            <tr key={r.time} className="border-t border-border">
              <td className={cn(cell, 'text-fg-2')}>{r.time}</td>
              <td className={cn(cell, 'text-right text-fg')}>{r.fuel.toFixed(1)}</td>
              <td className={cn(cell, 'text-right text-fg')}>{r.cycles}</td>
              <td className={cn(cell, 'text-right text-fg')}>{r.idle}</td>
              <td className={cn(cell, r.belt === 'Fastened' ? 'text-fg-2' : 'font-medium text-critical-text')}>{r.belt}</td>
              {showAlert && <td className={cn(cell, 'text-fg-2')}>{r.alert}</td>}
              <td className={cn(cell, 'font-sans')}>
                <StatusBadge tone={r.unusual ? 'serious' : 'good'} size="sm">{r.unusual ? 'Unusual' : 'Normal'}</StatusBadge>
                {r.reasons && r.reasons.length > 0 && <div className="mt-1 text-xs text-fg-3">{r.reasons.join(' · ')}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
