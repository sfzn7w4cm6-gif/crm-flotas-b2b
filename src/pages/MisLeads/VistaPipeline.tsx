import { Link } from 'react-router-dom'
import { FASE_COLORS } from '../../components/StatusBadge'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'

const COLUMNAS: Fase[] = [...FASES_ACTIVAS, Fase.Perdido]
const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** "hace 3 días", "hace 2 semanas"... */
function haceCuanto(fecha: Date, ahora: number): string {
  const dias = Math.round((fecha.getTime() - ahora) / 86400000)
  if (Math.abs(dias) < 7) return RELATIVO.format(dias, 'day')
  if (Math.abs(dias) < 60) return RELATIVO.format(Math.round(dias / 7), 'week')
  return RELATIVO.format(Math.round(dias / 30), 'month')
}

/** Vista por columnas de fase (solo lectura: el cambio de fase se hace en la ficha). */
export function VistaPipeline({
  leads,
  enFaseDesde,
  ahora,
  soloFase,
}: {
  leads: Lead[]
  /** Fecha de entrada en la fase actual, por lead (de fl_fasehistorico). */
  enFaseDesde: Map<string, Date>
  ahora: number
  soloFase?: Fase
}) {
  const columnas = soloFase !== undefined ? [soloFase] : COLUMNAS

  return (
    <div className="pipeline">
      {columnas.map((fase) => {
        const enColumna = leads.filter((l) => l.fl_faseactual === fase)
        const vehiculos = enColumna.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0)
        return (
          <section key={fase} className={`pipeline-col${fase === Fase.Perdido ? ' is-perdido' : ''}`}>
            <header className="pipeline-col-cabecera">
              <span className="pipeline-punto" style={{ background: FASE_COLORS[fase].bg }} />
              <span className="pipeline-col-nombre">{FaseLabel[fase]}</span>
              <span className="pipeline-col-cuenta">{enColumna.length}</span>
            </header>
            {vehiculos > 0 && <p className="pipeline-col-resumen">{vehiculos} vehículos</p>}
            <div className="pipeline-tarjetas">
              {enColumna.length === 0 ? (
                <p className="pipeline-vacio">Sin leads</p>
              ) : (
                enColumna.map((l) => {
                  const desde = enFaseDesde.get(l.fl_leadid) ?? new Date(l.fl_fechaprimercontacto || l.createdon)
                  const accion = l.fl_fechaproximaaccion ? new Date(l.fl_fechaproximaaccion) : null
                  const vencida = accion !== null && fase !== Fase.Perdido && accion.getTime() < ahora - 86400000
                  return (
                    <Link key={l.fl_leadid} to={`/lead/${l.fl_leadid}`} className="pipeline-tarjeta">
                      <span className="pipeline-empresa">{l.fl_razonsocial}</span>
                      <span className="pipeline-linea">{[l.fl_numero, l.fl_nombreresponsable].filter(Boolean).join(' · ')}</span>
                      {l.fl_modelosinteres && <span className="pipeline-modelos">{l.fl_modelosinteres}</span>}
                      {accion && fase !== Fase.Perdido && (
                        <span className={`pipeline-accion${vencida ? ' is-vencida' : ''}`}>
                          {vencida ? 'Vencida: ' : ''}
                          {l.fl_proximaaccion || 'Próxima acción'} ·{' '}
                          {accion.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <span className="pipeline-pie">
                        <span title="Tiempo en esta fase">{haceCuanto(desde, ahora)}</span>
                        {l.fl_numvehiculosrenovarampliar > 0 && (
                          <span className="pipeline-vehiculos">{l.fl_numvehiculosrenovarampliar} veh.</span>
                        )}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
