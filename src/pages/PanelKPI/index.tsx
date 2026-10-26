import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatTile } from '../../components/charts/StatTile'
import { BarChart } from '../../components/charts/BarChart'
import { TableTwin } from '../../components/charts/TableTwin'
import { RiesgoBadge, FASE_COLORS } from '../../components/StatusBadge'
import { fetchTodosLosLeads } from '../../lib/leadsService'
import { listRecords, Tables } from '../../lib/dataverseClient'
import { fetchConcesionarios } from '../../lib/usuariosService'
import {
  embudoPorFase,
  filtrarPorPeriodo,
  leadsEnRiesgo,
  leadsPorConcesionario,
  OBJETIVOS_KPI,
  PERIODO_OBJETIVO_LABEL,
  statsResumen,
  tasasConversion,
  tiempoMedioPorFase,
  type Periodo,
} from '../../lib/kpiService'
import type { Concesionario, FaseHistorico, Lead } from '../../lib/types'
import '../../components/charts/charts.css'

export function PanelKPI() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [historico, setHistorico] = useState<FaseHistorico[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>(0)

  useEffect(() => {
    Promise.all([fetchTodosLosLeads(), listRecords<FaseHistorico>(Tables.FaseHistorico, { top: 5000 }), fetchConcesionarios()]).then(
      ([l, h, c]) => {
        setLeads(l)
        setHistorico(h)
        setConcesionarios(c)
        setCargando(false)
      },
    )
  }, [])

  const leadsPeriodo = useMemo(() => filtrarPorPeriodo(leads, periodo), [leads, periodo])
  const idsPeriodo = useMemo(() => new Set(leadsPeriodo.map((l) => l.fl_leadid)), [leadsPeriodo])
  const historicoPeriodo = useMemo(() => historico.filter((h) => idsPeriodo.has(h._fl_lead_value)), [historico, idsPeriodo])

  const resumen = useMemo(() => statsResumen(leadsPeriodo, historicoPeriodo), [leadsPeriodo, historicoPeriodo])
  const embudo = useMemo(() => embudoPorFase(leads), [leads]) // embudo = foto actual, no depende del periodo
  const conversion = useMemo(() => tasasConversion(historicoPeriodo), [historicoPeriodo])
  const tiempos = useMemo(() => tiempoMedioPorFase(historicoPeriodo), [historicoPeriodo])
  const porConcesionario = useMemo(() => leadsPorConcesionario(leadsPeriodo, concesionarios), [leadsPeriodo, concesionarios])
  const enRiesgo = useMemo(() => leadsEnRiesgo(leads, historico), [leads, historico])
  const periodoLabel = PERIODO_OBJETIVO_LABEL[periodo]

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>Panel KPI</h1>
      </div>

      <div className="period-filter">
        {([0, 30, 90] as Periodo[]).map((p) => (
          <button key={p} type="button" className={periodo === p ? 'is-active' : ''} onClick={() => setPeriodo(p)}>
            {p === 0 ? 'Todo' : `Últimos ${p} días`}
          </button>
        ))}
      </div>

      <div className="kpi-row">
        <StatTile
          label="Leads captados"
          value={resumen.leadsNuevos}
          objetivo={{ meta: OBJETIVOS_KPI.leadsNuevos[periodo], periodoLabel }}
        />
        <StatTile
          label="Reuniones de diagnóstico"
          value={resumen.reunionesDiagnostico}
          objetivo={{ meta: OBJETIVOS_KPI.reunionesDiagnostico[periodo], periodoLabel }}
        />
        <StatTile
          label="Propuestas enviadas"
          value={resumen.propuestasEnviadas}
          objetivo={{ meta: OBJETIVOS_KPI.propuestasEnviadas[periodo], periodoLabel }}
        />
        <StatTile
          label="Pedidos cerrados"
          value={resumen.cierres}
          tono="success"
          objetivo={{ meta: OBJETIVOS_KPI.cierres[periodo], periodoLabel }}
        />
        <StatTile label="Seguimientos completados" value={resumen.seguimientosCompletados} />
        <StatTile label="Unidades entregadas" value={resumen.unidadesEntregadas} tono="success" />
        <StatTile label="Nuevos clientes empresa" value={resumen.nuevosClientesEmpresa} />
        <StatTile label="Renovaciones gestionadas" value={resumen.renovacionesGestionadas} />
        <StatTile
          label="Tasa de cierre"
          value={resumen.tasaCierre}
          sufijo="%"
          objetivo={{ meta: OBJETIVOS_KPI.tasaCierre[periodo], periodoLabel }}
        />
        <StatTile label="Tasa de pérdida" value={resumen.tasaPerdida} sufijo="%" tono={resumen.tasaPerdida > 0 ? 'danger' : 'default'} />
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-title">Embudo de pipeline por fase (actual)</div>
          <BarChart data={embudo.map((e) => ({ label: e.label, value: e.cantidad, color: FASE_COLORS[e.fase].bg, textColor: FASE_COLORS[e.fase].fg }))} />
          <TableTwin headers={['Fase', 'Leads']} rows={embudo.map((e) => [e.label, e.cantidad])} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Tiempo medio en cada fase</div>
          <BarChart
            data={tiempos.map((t) => ({ label: t.label, value: t.diasMedio, color: FASE_COLORS[t.fase].bg, textColor: FASE_COLORS[t.fase].fg }))}
            unidad=" d"
          />
          <TableTwin headers={['Fase', 'Días medio']} rows={tiempos.map((t) => [t.label, t.diasMedio])} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Tasa de conversión entre fases</div>
          <BarChart data={conversion.map((c) => ({ label: c.label, value: c.porcentaje }))} flatColor="#1d1d1b" unidad="%" />
          <TableTwin headers={['Transición', '%']} rows={conversion.map((c) => [c.label, c.porcentaje])} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Leads por concesionario</div>
          <BarChart data={porConcesionario.map((c) => ({ label: c.nombre, value: c.cantidad }))} flatColor="#1d1d1b" maxBars={8} />
          <TableTwin headers={['Concesionario', 'Leads']} rows={porConcesionario.map((c) => [c.nombre, c.cantidad])} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-title">Leads en riesgo / estancados</div>
        {enRiesgo.length === 0 ? (
          <p className="flow-meta">No hay leads estancados por ahora.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enRiesgo.map(({ lead, diasEnFaseActual }) => (
                  <tr key={lead.fl_leadid}>
                    <td className="cell-strong">{lead.fl_numero}</td>
                    <td>{lead.fl_razonsocial}</td>
                    <td>
                      <RiesgoBadge dias={diasEnFaseActual} />
                    </td>
                    <td>
                      <Link to={`/lead/${lead.fl_leadid}`} className="btn-link">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
