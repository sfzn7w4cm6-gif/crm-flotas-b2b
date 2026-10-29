import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { BarChart } from '../../components/charts/BarChart'
import { TableTwin } from '../../components/charts/TableTwin'
import { RiesgoBadge, FASE_COLORS } from '../../components/StatusBadge'
import { descargarExcel } from '../../lib/excelExport'
import { rangoPeriodo } from '../../lib/actividadService'
import { leadsEnRiesgo, leadsPorConcesionario, OBJETIVOS_KPI, statsResumen, tasasConversion, tiempoMedioPorFase } from '../../lib/kpiService'
import { InicioPanel, type DatosInicio } from '../MiActividad'
import '../../components/charts/charts.css'
import './PanelKPI.css'

/**
 * Inicio del equipo de ventas: las mismas cifras que ve cada concesionario, pero de toda la red y
 * con filtros por concesionario, empresa y modelo. Debajo, el análisis del pipeline con los
 * indicadores del Excel "KPI Dashboard", con los mismos filtros.
 */
export function PanelKPI() {
  return <InicioPanel modo="red" debajo={(d) => <Analisis {...d} />} />
}

function Analisis({ leads, historico, periodo, concesionarios }: DatosInicio) {
  // Los indicadores del plan comercial cuentan los leads dados de alta en el periodo.
  const { desde, hasta } = rangoPeriodo(periodo)
  const leadsPeriodo = useMemo(
    () =>
      leads.filter((l) => {
        const f = l.fl_fechaprimercontacto ? new Date(l.fl_fechaprimercontacto) : null
        return f !== null && f >= desde && f < hasta
      }),
    [leads, desde, hasta],
  )
  const ids = useMemo(() => new Set(leadsPeriodo.map((l) => l.fl_leadid)), [leadsPeriodo])
  const historicoPeriodo = useMemo(() => historico.filter((h) => ids.has(h._fl_lead_value)), [historico, ids])

  const resumen = useMemo(() => statsResumen(leadsPeriodo, historicoPeriodo), [leadsPeriodo, historicoPeriodo])
  const conversion = useMemo(() => tasasConversion(historico), [historico])
  const tiempos = useMemo(() => tiempoMedioPorFase(historico), [historico])
  const porConcesionario = useMemo(() => leadsPorConcesionario(leadsPeriodo, concesionarios), [leadsPeriodo, concesionarios])
  const enRiesgo = useMemo(() => leadsEnRiesgo(leads, historico), [leads, historico])
  // Objetivos del Excel: mensuales con un mes elegido, anuales con un año.
  const obj = (k: keyof typeof OBJETIVOS_KPI) => OBJETIVOS_KPI[k][periodo.tipo === 'mes' ? 30 : 0]

  const indicadores: { label: string; valor: number; sufijo?: string; meta?: number }[] = [
    { label: 'Leads captados', valor: resumen.leadsNuevos, meta: obj('leadsNuevos') },
    { label: 'Reuniones de diagnóstico', valor: resumen.reunionesDiagnostico, meta: obj('reunionesDiagnostico') },
    { label: 'Propuestas enviadas', valor: resumen.propuestasEnviadas, meta: obj('propuestasEnviadas') },
    { label: 'Pedidos cerrados', valor: resumen.cierres, meta: obj('cierres') },
    { label: 'Tasa de cierre', valor: resumen.tasaCierre, sufijo: ' %', meta: obj('tasaCierre') },
    { label: 'Tasa de pérdida', valor: resumen.tasaPerdida, sufijo: ' %' },
    { label: 'Seguimientos completados', valor: resumen.seguimientosCompletados },
    { label: 'Unidades entregadas', valor: resumen.unidadesEntregadas },
    { label: 'Nuevos clientes empresa', valor: resumen.nuevosClientesEmpresa },
    { label: 'Renovaciones gestionadas', valor: resumen.renovacionesGestionadas },
  ]

  return (
    <>
      <h2 className="analisis-titulo">Análisis del pipeline</h2>

      <section className="inicio-bloque">
        <div className="inicio-bloque-cabecera">
          <h2>Indicadores del plan comercial</h2>
          <span className="inicio-bloque-nota">Leads dados de alta en el periodo</span>
        </div>
        <div className="indicadores">
          {indicadores.map((i) => (
            <div key={i.label} className="indicador">
              <span className="indicador-valor">
                {i.valor}
                {i.sufijo}
              </span>
              <span className="indicador-label">{i.label}</span>
              {i.meta !== undefined && (
                <span className={`indicador-meta${i.valor >= i.meta ? ' is-cumplido' : ''}`}>
                  Objetivo {i.meta}
                  {i.sufijo}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-title">Tiempo medio en cada fase</div>
          <BarChart
            data={tiempos.map((t) => ({ label: t.label, value: t.diasMedio, color: FASE_COLORS[t.fase].dot, textColor: FASE_COLORS[t.fase].onDot }))}
            unidad=" d"
          />
          <TableTwin titulo="Tiempo medio en cada fase" headers={['Fase', 'Días medio']} rows={tiempos.map((t) => [t.label, t.diasMedio])} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Tasa de conversión entre fases</div>
          <BarChart data={conversion.map((c) => ({ label: c.label, value: c.porcentaje }))} flatColor="var(--color-text)" unidad="%" />
          <TableTwin titulo="Tasa de conversión entre fases" headers={['Transición', '%']} rows={conversion.map((c) => [c.label, c.porcentaje])} />
        </div>

        <div className="chart-card">
          <div className="chart-card-title">Leads por concesionario</div>
          <BarChart data={porConcesionario.map((c) => ({ label: c.nombre, value: c.cantidad }))} flatColor="var(--color-text)" maxBars={8} />
          <TableTwin titulo="Leads por concesionario" headers={['Concesionario', 'Leads']} rows={porConcesionario.map((c) => [c.nombre, c.cantidad])} />
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-title-row">
          <div className="chart-card-title">Leads en riesgo / estancados</div>
          {enRiesgo.length > 0 && (
            <button
              type="button"
              className="btn-mini"
              onClick={() =>
                descargarExcel(
                  'Leads en riesgo',
                  ['Nº', 'Empresa', 'Días en fase actual'],
                  enRiesgo.map(({ lead, diasEnFaseActual }) => [lead.fl_numero, lead.fl_razonsocial, diasEnFaseActual]),
                )
              }
            >
              <Icon name="download" size={14} />
              Excel
            </button>
          )}
        </div>
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
    </>
  )
}
