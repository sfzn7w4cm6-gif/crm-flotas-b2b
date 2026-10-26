import { useState } from 'react'
import { Icon } from '../Icon'
import { descargarExcel } from '../../lib/excelExport'
import './charts.css'

/** Vista de tabla alternativa para un grafico: se abre en una ventana modal
 *  (mas grande, mas facil de leer) en vez de desplegarse dentro de la
 *  tarjeta del grafico. Incluye tambien la descarga de los mismos datos
 *  como Excel. */
export function TableTwin({ titulo, headers, rows }: { titulo: string; headers: string[]; rows: (string | number)[][] }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <div className="table-twin-actions">
        <button type="button" className="table-twin-toggle" onClick={() => setAbierto(true)}>
          <Icon name="expand" size={14} />
          Ver como tabla
        </button>
        <button type="button" className="table-twin-toggle" onClick={() => descargarExcel(titulo, headers, rows)}>
          <Icon name="download" size={14} />
          Descargar Excel
        </button>
      </div>
      {abierto && (
        <TableModal titulo={titulo} headers={headers} rows={rows} onClose={() => setAbierto(false)} />
      )}
    </>
  )
}

export function TableModal({
  titulo,
  headers,
  rows,
  onClose,
}: {
  titulo: string
  headers: string[]
  rows: (string | number)[][]
  onClose: () => void
}) {
  return (
    <div className="table-modal-backdrop" onClick={onClose}>
      <div className="table-modal" onClick={(e) => e.stopPropagation()}>
        <div className="table-modal-header">
          <h2>{titulo}</h2>
          <div className="table-modal-header-actions">
            <button type="button" className="btn-secondary" onClick={() => descargarExcel(titulo, headers, rows)}>
              <Icon name="download" size={14} />
              Descargar Excel
            </button>
            <button type="button" className="table-modal-close" aria-label="Cerrar" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
        <div className="table-modal-body">
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
      </div>
    </div>
  )
}
