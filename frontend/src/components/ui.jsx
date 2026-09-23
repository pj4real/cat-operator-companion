// Small shared pieces. OutcomeTag names the problem statement's expected outcome a block covers.
export function OutcomeTag({ children }) {
  return (
    <span className="rounded-full border border-cat/40 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-cat">
      {children}
    </span>
  )
}

export function Card({ title, icon: Icon, outcome, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
      <h3 className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {Icon && <Icon size={14} />} {title}
        {outcome && <span className="ml-auto"><OutcomeTag>{outcome}</OutcomeTag></span>}
      </h3>
      {children}
    </section>
  )
}

export function LiveBadge({ live }) {
  return <span className={`text-[10px] ${live ? 'text-safe' : 'text-muted'}`}>{live ? '● ML model live' : '○ cached estimate'}</span>
}

export const RISK_TONE = { high: 'bg-danger/20 text-danger', watch: 'bg-warn/20 text-warn', low: 'bg-safe/15 text-safe' }
