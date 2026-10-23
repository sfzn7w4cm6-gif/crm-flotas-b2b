import './charts.css'

export function StatTile({
  label,
  value,
  sufijo,
  tono,
}: {
  label: string
  value: string | number
  sufijo?: string
  tono?: 'default' | 'success' | 'danger'
}) {
  return (
    <div className={`stat-tile stat-tile-${tono ?? 'default'}`}>
      <span className="stat-tile-value">
        {value}
        {sufijo && <span className="stat-tile-sufijo">{sufijo}</span>}
      </span>
      <span className="stat-tile-label">{label}</span>
    </div>
  )
}
