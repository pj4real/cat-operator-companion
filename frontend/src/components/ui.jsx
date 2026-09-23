// Shared light-dashboard primitives. Elevation comes from a soft shadow +
// hairline ring, not a hard border, so the page doesn't read as a grid of boxes.
export function Surface({ as: As = 'div', className = '', children, ...props }) {
  return (
    <As
      className={`rounded-2xl bg-card shadow-[0_1px_2px_rgba(11,11,11,0.04),0_10px_28px_-16px_rgba(11,11,11,0.16)] ring-1 ring-black/[0.05] ${className}`}
      {...props}
    >
      {children}
    </As>
  )
}

export function SectionLabel({ icon: Icon, children, action }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink3">
        {Icon && <Icon size={13} />} {children}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

export function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cat/15 text-ink1">
          <Icon size={15} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-ink3">{label}</div>
        <div className={`text-xl font-bold leading-tight ${tone || 'text-ink1'}`}>{value}</div>
        {sub && <div className="truncate text-[11px] text-ink3">{sub}</div>}
      </div>
    </div>
  )
}
