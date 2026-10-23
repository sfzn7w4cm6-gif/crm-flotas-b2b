import { useState } from 'react'
import { Icon } from '../Icon'
import './charts.css'

/** Vista de tabla alternativa para un grafico, plegada por defecto. Sirve de
 *  respaldo accesible y de via para inspeccionar/exportar los valores exactos. */
export function TableTwin({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="table-twin">
      <button type="button" className="table-twin-toggle" onClick={() => setAbierto((v) => !v)}>
        <Icon name={abierto ? 'chevronDown' : 'chevronRight'} size={14} />
        Ver como tabla
      </button>
      {abierto && (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="data-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
