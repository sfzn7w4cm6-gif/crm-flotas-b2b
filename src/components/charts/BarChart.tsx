import './charts.css'

export interface BarDatum {
  label: string
  value: number
  color?: string
  textColor?: string
}

/** Barras horizontales con etiqueta directa en la punta. Si cada dato trae su
 *  propio 'color', se usa (rampa ordinal de fase); si no, se usa un unico
 *  color plano para todas las barras (comparacion nominal, ej. por concesionario). */
export function BarChart({
  data,
  flatColor = 'var(--color-primary)',
  unidad = '',
  maxBars,
}: {
  data: BarDatum[]
  flatColor?: string
  unidad?: string
  maxBars?: number
}) {
  const visibles = maxBars ? data.slice(0, maxBars) : data
  const resto = maxBars && data.length > maxBars ? data.slice(maxBars) : []
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="barchart">
      {visibles.map((d) => (
        <div className="barchart-row" key={d.label}>
          <span className="barchart-label" title={d.label}>
            {d.label}
          </span>
          <div className="barchart-track">
            <div
              className="barchart-fill"
              style={{
                width: `${Math.max(2, (d.value / max) * 100)}%`,
                background: d.color ?? flatColor,
              }}
            >
              <span className="barchart-value" style={{ color: d.color ? (d.textColor ?? '#fff') : '#fff' }}>
                {d.value}
                {unidad}
              </span>
            </div>
          </div>
        </div>
      ))}
      {resto.length > 0 && (
        <div className="barchart-row barchart-row-otros">
          <span className="barchart-label">Otros ({resto.length})</span>
          <div className="barchart-track">
            <div
              className="barchart-fill"
              style={{ width: `${Math.max(2, (resto.reduce((a, b) => a + b.value, 0) / max) * 100)}%`, background: 'var(--color-border)' }}
            >
              <span className="barchart-value" style={{ color: 'var(--color-text)' }}>
                {resto.reduce((a, b) => a + b.value, 0)}
                {unidad}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
