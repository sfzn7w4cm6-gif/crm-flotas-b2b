import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { StatTile } from '../../components/charts/StatTile'
import { BarChart } from '../../components/charts/BarChart'
import { FaseBadge } from '../../components/StatusBadge'
import { fetchMisLeads } from '../../lib/leadsService'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'
import { FASE_COLORS } from '../../components/StatusBadge'

export function MiActividad() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetchMisLeads()
      .then(setLeads)
      .finally(() => setCargando(false))
  }, [])

  const activos = useMemo(() => leads.filter((l) => l.fl_faseactual !== Fase.Perdido), [leads])
  const totalVehiculos = useMemo(() => activos.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0), [activos])
  const requierenAccion = useMemo(() => {
    const en7dias = Date.now() + 7 * 24 * 60 * 60 * 1000
    return activos
      .filter((l) => l.fl_fechaproximaaccion && new Date(l.fl_fechaproximaaccion).getTime() <= en7dias)
      .sort((a, b) => new Date(a.fl_fechaproximaaccion).getTime() - new Date(b.fl_fechaproximaaccion).getTime())
  }, [activos])

  const porFase = useMemo(
    () =>
      FASES_ACTIVAS.map((f) => ({
        label: FaseLabel[f],
        value: activos.filter((l) => l.fl_faseactual === f).length,
        color: FASE_COLORS[f].bg,
        textColor: FASE_COLORS[f].fg,
      })),
    [activos],
  )

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>Mi actividad</h1>
      </div>

      <div className="kpi-row">
        <StatTile label="Leads activos" value={activos.length} />
        <StatTile label="Vehículos en pipeline" value={totalVehiculos} />
        <StatTile label="Requieren acción (7 días)" value={requierenAccion.length} tono={requierenAccion.length > 0 ? 'danger' : 'default'} />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-title">Mis leads por fase</div>
          <BarChart data={porFase} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Próximas acciones (7 días)</div>
          {requierenAccion.length === 0 ? (
            <p className="flow-meta">Nada pendiente para esta semana.</p>
          ) : (
            <ul className="approval-list">
              {requierenAccion.slice(0, 6).map((l) => (
                <li key={l.fl_leadid} className="approval-card">
                  <div>
                    <div className="approval-title">
                      <Icon name="warning" size={15} />
                      {l.fl_razonsocial}
                    </div>
                    <div className="approval-meta">
                      {l.fl_proximaaccion} · {new Date(l.fl_fechaproximaaccion).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                  <div className="approval-actions">
                    <FaseBadge fase={l.fl_faseactual} size="sm" />
                    <Link to={`/lead/${l.fl_leadid}`} className="btn-link">
                      Ver
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
