import { Link } from 'react-router-dom'
import { FASE_COLORS } from '../StatusBadge'
import { FASES_ACTIVAS, FaseLabel } from '../../lib/types'
import type { Fase, Lead } from '../../lib/types'
import './charts.css'

/**
 * Oportunidades abiertas por fase en columnas. La altura es la cantidad (un solo color de tinta);
 * el punto de color junto al nombre es el mismo de las etiquetas de fase, para reconocerla.
 * Cada columna lleva su cifra encima y abre la lista filtrada por esa fase.
 */
export function FaseColumnas({ leads, destino }: { leads: Lead[]; /** Ruta de la lista a la que lleva cada columna. */ destino?: string }) {
  const datos = FASES_ACTIVAS.map((fase) => {
    const enFase = leads.filter((l) => l.fl_faseactual === fase)
    return { fase, leads: enFase.length, vehiculos: enFase.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0) }
  })
  const max = Math.max(1, ...datos.map((d) => d.leads))
  const total = datos.reduce((acc, d) => acc + d.leads, 0)

  return (
    <div className="fase-columnas" role="list">
      {datos.map((d) => {
        const nombre = FaseLabel[d.fase].replace(/^\d+\.\s*/, '')
        const pct = total ? Math.round((d.leads / total) * 100) : 0
        const contenido = (
          <>
            <span className="fase-columnas-valor">{d.leads}</span>
            <span className="fase-columnas-pista">
              <span className="fase-columnas-barra" style={{ height: d.leads ? `${Math.max(4, (d.leads / max) * 100)}%` : 0 }} />
            </span>
            <span className="fase-columnas-nombre">
              <span className="fase-columnas-punto" style={{ background: FASE_COLORS[d.fase as Fase].dot }} />
              {nombre}
            </span>
            <span className="fase-columnas-veh">{d.vehiculos > 0 ? `${d.vehiculos} veh.` : '—'}</span>
            <span className="fase-columnas-tip" role="tooltip">
              <strong>{FaseLabel[d.fase]}</strong>
              {d.leads} {d.leads === 1 ? 'oportunidad' : 'oportunidades'} · {pct} %
              <br />
              {d.vehiculos} vehículos
            </span>
          </>
        )
        return destino ? (
          <Link key={d.fase} role="listitem" to={`${destino}?fase=${d.fase}`} className="fase-columnas-col" aria-label={`${nombre}: ${d.leads}`}>
            {contenido}
          </Link>
        ) : (
          <div key={d.fase} role="listitem" className="fase-columnas-col" aria-label={`${nombre}: ${d.leads}`}>
            {contenido}
          </div>
        )
      })}
    </div>
  )
}
