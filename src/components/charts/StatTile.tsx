import './charts.css'

export function StatTile({
  label,
  value,
  sufijo,
  tono,
  objetivo,
}: {
  label: string
  value: string | number
  sufijo?: string
  tono?: 'default' | 'success' | 'danger'
  objetivo?: { meta: number; periodoLabel: string }
}) {
  const pct = objetivo && typeof value === 'number' ? Math.min(100, Math.round((value / objetivo.meta) * 100)) : null

  return (
    <div className={`stat-tile stat-tile-${tono ?? 'default'}`}>
      <span className="stat-tile-value">
        {value}
        {sufijo && <span className="stat-tile-sufijo">{sufijo}</span>}
      </span>
      <span className="stat-tile-label">{label}</span>
      {objetivo && pct !== null && (
        <>
          <div className="stat-tile-progress-track">
            <div className={`stat-tile-progress-fill${pct >= 100 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="stat-tile-objetivo">
            Objetivo {objetivo.periodoLabel}: {objetivo.meta}
            {sufijo ?? ''} ({pct}%)
          </span>
        </>
      )}
    </div>
  )
}
