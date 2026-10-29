import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { FaseColumnas } from '../../components/charts/FaseColumnas'
import { FiltroMulti } from '../../components/filtros/Filtros'
import { CalendarioTareas, FilaTarea } from '../../components/tareas/Tareas'
import { fetchMisLeads, fetchTodosLosLeads } from '../../lib/leadsService'
import { calcularHitos, fetchMiHistorico, formatoEuros, nombrePeriodo, periodoActual, rangoPeriodo, resumenPeriodo } from '../../lib/actividadService'
import type { Periodo } from '../../lib/actividadService'
import { fetchModelos } from '../../lib/catalogosService'
import { coincideModelo } from '../../lib/filtrosLeads'
import { crearNotaConAdjuntos } from '../../lib/notasService'
import {
  cambiarEstadoTarea,
  fetchImportesVenta,
  fetchMisTareas,
  fetchObjetivoLeadsMes,
  fetchObjetivos,
  objetivoDeRed,
  tareaAbierta,
  tareaVencida,
} from '../../lib/tareasService'
import { fetchConcesionarios, fetchUbicaciones } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import { Fase } from '../../lib/types'
import type { Concesionario, EstadoTarea, FaseHistorico, Lead, Modelo, Objetivo, Tarea, Ubicacion, Zona } from '../../lib/types'
import { PeriodoFiltro } from './PeriodoFiltro'
import './MiActividad.css'

const TAREAS_VISIBLES = 5

type Evento = { fecha: Date; valor: number }

/** Lo que la pantalla de inicio de la red pasa al análisis de debajo, ya filtrado. */
export interface DatosInicio {
  leads: Lead[]
  historico: FaseHistorico[]
  periodo: Periodo
  concesionarios: Concesionario[]
}

/** Pantalla de entrada del concesionario. */
export function MiActividad() {
  return <InicioPanel modo="concesionario" />
}

/**
 * Inicio: las mismas cifras para el concesionario (sus oportunidades, con sus tareas) y para el
 * equipo de ventas (toda la red, con filtros por concesionario, empresa y modelo).
 */
export function InicioPanel({ modo, debajo }: { modo: 'concesionario' | 'red'; debajo?: (d: DatosInicio) => ReactNode }) {
  const red = modo === 'red'
  const { usuario, concesionario } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [historico, setHistorico] = useState<FaseHistorico[]>([])
  // null = la tabla/columna aun no existe en el entorno (ver 15-tareas-objetivos.ps1)
  const [importes, setImportes] = useState<Map<string, number> | null>(null)
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  const [objetivo, setObjetivo] = useState<number | null | undefined>(undefined)
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null)
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [cargando, setCargando] = useState(true)
  // Un solo periodo para todas las cifras de la pantalla.
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual())
  const [verTodas, setVerTodas] = useState(false)
  const [calendario, setCalendario] = useState(false)
  // Tareas cerradas desde esta pantalla: se siguen mostrando (tachadas) hasta recargar.
  const [cambiadas, setCambiadas] = useState<Set<string>>(new Set())
  const [filtroZona, setFiltroZona] = useState<string[]>([])
  const [filtroConc, setFiltroConc] = useState<string[]>([])
  const [filtroUbicacion, setFiltroUbicacion] = useState<string[]>([])
  const [filtroEmpresa, setFiltroEmpresa] = useState<string[]>([])
  const [filtroModelo, setFiltroModelo] = useState<string[]>([])

  useEffect(() => {
    if (red) {
      Promise.all([
        fetchTodosLosLeads(),
        fetchMiHistorico(),
        fetchImportesVenta(),
        fetchObjetivos().catch(() => null),
        fetchConcesionarios(),
        fetchUbicaciones(),
        fetchZonas(),
        fetchModelos().catch(() => []),
      ])
        .then(([l, h, imp, obj, c, u, z, m]) => {
          setLeads(l)
          setHistorico(h)
          setImportes(imp)
          setObjetivos(obj)
          setConcesionarios(c)
          setUbicaciones(u)
          setZonas(z)
          setModelos(m)
        })
        .finally(() => setCargando(false))
      return
    }
    Promise.all([
      fetchMisLeads(),
      fetchMiHistorico(),
      fetchImportesVenta(),
      fetchMisTareas().catch(() => null),
      fetchObjetivoLeadsMes(concesionario?.fl_concesionarioid).catch(() => undefined),
    ])
      .then(([l, h, imp, t, obj]) => {
        setLeads(l)
        setHistorico(h)
        setImportes(imp)
        setTareas(t)
        setObjetivo(obj)
      })
      .finally(() => setCargando(false))
  }, [red, concesionario?.fl_concesionarioid])

  // ---------------------------------------------------------------- filtros (solo red)

  const nombreConc = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])
  const ubicacionesDeZona = useMemo(
    () => (filtroZona.length ? ubicaciones.filter((u) => u._fl_zona_value && filtroZona.includes(u._fl_zona_value)) : ubicaciones),
    [ubicaciones, filtroZona],
  )
  const ubicacionIdsDeZona = useMemo(() => new Set(ubicacionesDeZona.map((u) => u.fl_ubicacionid)), [ubicacionesDeZona])
  const concesionarioIdsDeZona = useMemo(() => new Set(ubicacionesDeZona.map((u) => u._fl_concesionario_value)), [ubicacionesDeZona])
  const concesionariosDeZona = useMemo(
    () => (filtroZona.length ? concesionarios.filter((c) => concesionarioIdsDeZona.has(c.fl_concesionarioid)) : concesionarios),
    [concesionarios, filtroZona, concesionarioIdsDeZona],
  )
  const ubicacionesDelConcesionario = useMemo(
    () => (filtroConc.length ? ubicacionesDeZona.filter((u) => filtroConc.includes(u._fl_concesionario_value)) : ubicacionesDeZona),
    [ubicacionesDeZona, filtroConc],
  )
  const opcionesEmpresa = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) if (l._fl_empresa_value && (filtroConc.length === 0 || filtroConc.includes(l._fl_concesionario_value))) m.set(l._fl_empresa_value, l.fl_razonsocial)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }))
  }, [leads, filtroConc])

  const leadsFiltrados = useMemo(() => {
    if (!red) return leads
    const mods = modelos.filter((m) => filtroModelo.includes(m.fl_modeloid))
    return leads.filter(
      (l) =>
        (filtroZona.length === 0 || ubicacionIdsDeZona.has(l._fl_ubicacion_value)) &&
        (filtroConc.length === 0 || filtroConc.includes(l._fl_concesionario_value)) &&
        (filtroUbicacion.length === 0 || filtroUbicacion.includes(l._fl_ubicacion_value)) &&
        (filtroEmpresa.length === 0 || (!!l._fl_empresa_value && filtroEmpresa.includes(l._fl_empresa_value))) &&
        (mods.length === 0 || coincideModelo(l, mods)),
    )
  }, [red, leads, modelos, filtroZona, ubicacionIdsDeZona, filtroConc, filtroUbicacion, filtroEmpresa, filtroModelo])
  const idsFiltrados = useMemo(() => new Set(leadsFiltrados.map((l) => l.fl_leadid)), [leadsFiltrados])
  const historicoFiltrado = useMemo(() => historico.filter((h) => idsFiltrados.has(h._fl_lead_value)), [historico, idsFiltrados])
  const hayFiltros = filtroZona.length + filtroConc.length + filtroUbicacion.length + filtroEmpresa.length + filtroModelo.length > 0

  // ---------------------------------------------------------------- cifras

  const hitos = useMemo(() => calcularHitos(leadsFiltrados, historicoFiltrado), [leadsFiltrados, historicoFiltrado])
  const leadPorId = useMemo(() => new Map(leads.map((l) => [l.fl_leadid, l])), [leads])
  const infoLead = useCallback(
    (id: string) => {
      const l = leadPorId.get(id)
      return { nombre: l?.fl_razonsocial ?? 'Oportunidad', numero: l?.fl_numero }
    },
    [leadPorId],
  )

  const eventosActivados = useMemo<Evento[]>(
    () => [...hitos.values()].filter((h) => h.activado).map((h) => ({ fecha: h.activado!, valor: 1 })),
    [hitos],
  )
  const cierres = useMemo(
    () =>
      [...hitos.entries()]
        .filter(([, h]) => h.cerrado)
        .map(([id, h]) => ({ lead: leadPorId.get(id)!, fecha: h.cerrado! }))
        // Un lead que llego a cierre y luego se perdio no cuenta como venta.
        .filter((c) => c.lead && c.lead.fl_faseactual !== Fase.Perdido)
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
    [hitos, leadPorId],
  )
  const eventosVentas = useMemo<Evento[]>(() => cierres.map((c) => ({ fecha: c.fecha, valor: 1 })), [cierres])
  // Importe de cada venta en la fecha de cierre; null si la columna aun no existe.
  const eventosFacturado = useMemo<Evento[] | null>(
    () => (importes ? cierres.map((c) => ({ fecha: c.fecha, valor: importes.get(c.lead.fl_leadid) ?? 0 })) : null),
    [cierres, importes],
  )
  const eventosCreados = useMemo<Evento[]>(
    () => leadsFiltrados.filter((l) => l.fl_fechaprimercontacto).map((l) => ({ fecha: new Date(l.fl_fechaprimercontacto), valor: 1 })),
    [leadsFiltrados],
  )
  // Primer año que se ofrece en el filtro: el del dato mas antiguo, y como minimo el anterior al actual.
  const primerAnio = useMemo(() => {
    const anios = leads.filter((l) => l.fl_fechaprimercontacto).map((l) => new Date(l.fl_fechaprimercontacto).getFullYear())
    return Math.min(new Date().getFullYear() - 1, ...anios)
  }, [leads])

  // En la red, el objetivo es la suma del de cada concesionario elegido (o de
  // todos los que caen dentro de la zona filtrada, si no hay concesionario elegido).
  const objetivoMes = red
    ? objetivos === null
      ? undefined
      : objetivoDeRed(objetivos, filtroConc.length ? filtroConc : concesionariosDeZona.map((c) => c.fl_concesionarioid))
    : objetivo

  // Ventas y facturado por concesionario en el periodo (solo red).
  const ranking = useMemo(() => {
    if (!red) return []
    const { desde, hasta } = rangoPeriodo(periodo)
    const m = new Map<string, { ventas: number; importe: number }>()
    for (const c of cierres) {
      if (c.fecha < desde || c.fecha >= hasta) continue
      const k = c.lead._fl_concesionario_value
      const fila = m.get(k) ?? { ventas: 0, importe: 0 }
      fila.ventas += 1
      fila.importe += importes?.get(c.lead.fl_leadid) ?? 0
      m.set(k, fila)
    }
    return [...m]
      .map(([id, v]) => ({ id, nombre: nombreConc.get(id) ?? 'Sin concesionario', ...v }))
      .sort((a, b) => b.ventas - a.ventas || b.importe - a.importe)
  }, [red, cierres, periodo, importes, nombreConc])

  const tareasLista = useMemo(() => (tareas ?? []).filter((t) => tareaAbierta(t) || cambiadas.has(t.fl_tareaid)), [tareas, cambiadas])
  const pendientes = (tareas ?? []).filter(tareaAbierta)
  const vencidas = pendientes.filter(tareaVencida).length

  const cambiarEstado = async (tarea: Tarea, estado: EstadoTarea) => {
    await cambiarEstadoTarea(tarea.fl_tareaid, estado)
    setTareas((ts) => (ts ?? []).map((t) => (t.fl_tareaid === tarea.fl_tareaid ? { ...t, fl_estado: estado } : t)))
    setCambiadas((s) => new Set(s).add(tarea.fl_tareaid))
  }
  // Las notas se guardan en la tarea pero aquí no se muestran: se ven en la ficha de la oportunidad.
  const guardarNota = async (tarea: Tarea, texto: string, archivos: File[]) => {
    if (!usuario) throw new Error('No se pudo identificar tu usuario.')
    await crearNotaConAdjuntos(tarea._fl_lead_value, texto, archivos, usuario, tarea.fl_tareaid)
  }

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  const hoy = new Date()
  const tareasMostradas = verTodas ? tareasLista : tareasLista.slice(0, TAREAS_VISIBLES)
  const etiquetaPeriodo = nombrePeriodo(periodo)
  const abiertos = leadsFiltrados.filter((l) => l.fl_faseactual !== Fase.Perdido)
  const vehiculosAbiertos = abiertos.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0)

  return (
    <div className="inicio">
      <header className="inicio-cabecera">
        <div>
          <p className="inicio-fecha">
            {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            {red ? ' · Toda la red' : concesionario ? ` · ${concesionario.fl_nombre}` : ''}
          </p>
          <h1 className="inicio-saludo">Hola{usuario?.fl_nombre ? `, ${usuario.fl_nombre.split(' ')[0]}` : ''}</h1>
        </div>
        <div className="inicio-acciones">
          <PeriodoFiltro value={periodo} onChange={setPeriodo} primerAnio={primerAnio} etiqueta={etiquetaPeriodo} />
          {!red && (
            <Link to="/nuevo-lead" className="btn-primary inicio-nuevo">
              <Icon name="add" size={15} /> Nuevo lead
            </Link>
          )}
        </div>
      </header>

      {red && (
        <div className="lista-filtros inicio-filtros">
          <FiltroMulti
            etiqueta="Zona"
            opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))}
            value={filtroZona}
            onChange={(v) => {
              setFiltroZona(v)
              setFiltroConc([])
              setFiltroUbicacion([])
              setFiltroEmpresa([])
            }}
          />
          <FiltroMulti
            etiqueta="Concesionario"
            opciones={concesionariosDeZona.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
            value={filtroConc}
            onChange={(v) => {
              setFiltroConc(v)
              setFiltroUbicacion([])
              setFiltroEmpresa([])
            }}
          />
          <FiltroMulti
            etiqueta="Sede"
            opciones={ubicacionesDelConcesionario.map((u) => ({ value: u.fl_ubicacionid, label: u.fl_nombre }))}
            value={filtroUbicacion}
            onChange={setFiltroUbicacion}
          />
          <FiltroMulti etiqueta="Empresa" opciones={opcionesEmpresa} value={filtroEmpresa} onChange={setFiltroEmpresa} />
          <FiltroMulti
            etiqueta="Modelo"
            opciones={modelos.map((m) => ({ value: m.fl_modeloid, label: m.fl_nombre }))}
            value={filtroModelo}
            onChange={setFiltroModelo}
          />
          {hayFiltros && (
            <button
              type="button"
              className="lista-limpiar"
              onClick={() => {
                setFiltroZona([])
                setFiltroConc([])
                setFiltroUbicacion([])
                setFiltroEmpresa([])
                setFiltroModelo([])
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <section className="inicio-resumen" aria-label={`Resumen de ${etiquetaPeriodo}`}>
        <Metrica titulo="Leads activados" ayuda="Leads con los que ya hubo al menos un primer contacto" eventos={eventosActivados} periodo={periodo} />
        <Metrica titulo="Ventas" ayuda="Leads que han llegado a la fase de cierre" eventos={eventosVentas} periodo={periodo} />
        <MetricaObjetivo objetivo={objetivoMes} eventos={eventosCreados} periodo={periodo} red={red} />
        {eventosFacturado ? (
          <Metrica
            titulo="Facturado"
            ayuda="Suma del importe de venta de los leads cerrados, en la fecha de cierre"
            eventos={eventosFacturado}
            periodo={periodo}
            formato={formatoEuros}
          />
        ) : (
          <div className="inicio-metrica">
            <span className="inicio-metrica-titulo">Facturado</span>
            <span className="inicio-metrica-valor is-vacio">—</span>
          </div>
        )}
      </section>

      <div className="inicio-grid">
        <section className="inicio-bloque">
          <div className="inicio-bloque-cabecera">
            <h2>Últimas ventas</h2>
            {cierres.length > 0 && <span className="inicio-bloque-nota">{cierres.length} en total</span>}
          </div>
          {cierres.length === 0 ? (
            <p className="inicio-vacio">Aún no hay ventas cerradas.</p>
          ) : (
            <ul className="inicio-lista">
              {cierres.slice(0, red ? 6 : 5).map(({ lead, fecha }) => {
                const importe = importes?.get(lead.fl_leadid)
                const detalle = [
                  red ? nombreConc.get(lead._fl_concesionario_value) : '',
                  lead.fl_modelosinteres,
                  lead.fl_numvehiculosrenovarampliar ? `${lead.fl_numvehiculosrenovarampliar} vehículos` : '',
                ].filter(Boolean)
                return (
                  <li key={lead.fl_leadid}>
                    <Link to={`/lead/${lead.fl_leadid}`} className="venta-fila">
                      <span className="venta-cuerpo">
                        <span className="venta-empresa">{lead.fl_razonsocial}</span>
                        <span className="venta-meta">
                          {fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}
                          {detalle.length > 0 && ` · ${detalle.join(' · ')}`}
                        </span>
                      </span>
                      <span className="venta-importe">{importe != null ? formatoEuros(importe) : '—'}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {red ? (
          <section className="inicio-bloque">
            <div className="inicio-bloque-cabecera">
              <h2>Ventas por concesionario</h2>
              <span className="inicio-bloque-nota">{etiquetaPeriodo}</span>
            </div>
            {ranking.length === 0 ? (
              <p className="inicio-vacio">Sin ventas en este periodo.</p>
            ) : (
              <ol className="ranking">
                {ranking.slice(0, 8).map((r) => (
                  <li key={r.id} className="ranking-fila">
                    <span className="ranking-nombre">{r.nombre}</span>
                    <span className="ranking-barra" aria-hidden="true">
                      <span style={{ width: `${(r.ventas / ranking[0].ventas) * 100}%` }} />
                    </span>
                    <span className="ranking-valor">
                      {r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'}
                    </span>
                    <span className="ranking-importe">{importes ? formatoEuros(r.importe) : ''}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : (
          <section className="inicio-bloque">
            <div className="inicio-bloque-cabecera">
              <h2>Tareas</h2>
              {tareas && (
                <span className="inicio-bloque-nota">
                  {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
                  {vencidas > 0 && (
                    <span className="inicio-vencidas">
                      {' '}
                      · {vencidas} vencida{vencidas === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
              )}
              {tareas && (
                <button type="button" className="inicio-icono-btn" onClick={() => setCalendario(true)} title="Ver en el calendario" aria-label="Ver en el calendario">
                  <Icon name="calendar" size={16} />
                </button>
              )}
            </div>
            {tareas === null ? (
              <p className="inicio-vacio">Las tareas aún no están activadas en la base de datos.</p>
            ) : tareasLista.length === 0 ? (
              <p className="inicio-vacio">Nada pendiente. Las tareas se crean desde la ficha de cada lead.</p>
            ) : (
              <>
                <ul className={`tarea-lista${verTodas ? ' is-desplazable' : ''}`}>
                  {tareasMostradas.map((t) => (
                    <FilaTarea
                      key={t.fl_tareaid}
                      tarea={t}
                      lead={{ id: t._fl_lead_value, ...infoLead(t._fl_lead_value) }}
                      onCambiarEstado={(e) => cambiarEstado(t, e)}
                      onGuardarNota={(texto, archivos) => guardarNota(t, texto, archivos)}
                    />
                  ))}
                </ul>
                {tareasLista.length > TAREAS_VISIBLES && (
                  <button type="button" className="inicio-ver-mas" onClick={() => setVerTodas((v) => !v)}>
                    {verTodas ? 'Ver menos' : `Ver todas (${tareasLista.length})`}
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </div>

      <section className="inicio-bloque">
        <div className="inicio-bloque-cabecera">
          <h2>Oportunidades por fase</h2>
          <span className="inicio-bloque-nota">
            {abiertos.length} oportunidades · {vehiculosAbiertos} vehículos
          </span>
        </div>
        <FaseColumnas leads={abiertos} destino={red ? '/seguimiento' : '/mis-leads'} />
      </section>

      {debajo?.({ leads: leadsFiltrados, historico: historicoFiltrado, periodo, concesionarios })}

      {calendario && tareas && (
        <CalendarioTareas tareas={tareas} infoLead={infoLead} onCambiarEstado={cambiarEstado} onGuardarNota={guardarNota} onClose={() => setCalendario(false)} />
      )}
    </div>
  )
}

function Metrica({
  titulo,
  ayuda,
  eventos,
  periodo,
  formato = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-ES'),
}: {
  titulo: string
  ayuda: string
  eventos: Evento[]
  periodo: Periodo
  formato?: (n: number) => string
}) {
  const r = resumenPeriodo(eventos, periodo)
  const diff = r.comparado > 0 ? Math.round(((r.valor - r.comparado) / r.comparado) * 100) : null

  return (
    <div className="inicio-metrica">
      <span className="inicio-metrica-titulo" title={ayuda}>
        {titulo}
      </span>
      <span className="inicio-metrica-valor">{formato(r.valor)}</span>
      <span className="inicio-metrica-nota">
        {diff === null ? (
          'Sin datos para comparar'
        ) : (
          <>
            <span className={diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}>
              {diff > 0 ? '+' : diff < 0 ? '−' : ''}
              {Math.abs(diff)} %
            </span>{' '}
            {r.comparadoEtiqueta.replace('vs. ', 'frente a ')}
          </>
        )}
      </span>
    </div>
  )
}

function MetricaObjetivo({ objetivo, eventos, periodo, red }: { objetivo: number | null | undefined; eventos: Evento[]; periodo: Periodo; red: boolean }) {
  if (!objetivo) {
    return (
      <div className="inicio-metrica">
        <span className="inicio-metrica-titulo">Objetivo de leads</span>
        <span className="inicio-metrica-valor is-vacio">—</span>
        <span className="inicio-metrica-nota">{objetivo === undefined ? 'Objetivos aún no activados' : 'Sin objetivo asignado'}</span>
      </div>
    )
  }
  const { desde, hasta, meses } = rangoPeriodo(periodo)
  const meta = objetivo * meses
  const creados = eventos.filter((e) => e.fecha >= desde && e.fecha < hasta).length
  const pct = Math.round((creados / meta) * 100)

  return (
    <div className="inicio-metrica">
      <span
        className="inicio-metrica-titulo"
        title={red ? 'Leads creados frente a la suma de los objetivos de cada concesionario' : 'Leads creados frente al objetivo asignado'}
      >
        Objetivo de leads
      </span>
      <span className="inicio-metrica-valor">
        {creados}
        <span className="inicio-metrica-meta"> / {meta}</span>
      </span>
      <div className="objetivo-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`objetivo-fill${creados >= meta ? ' is-completo' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="inicio-metrica-nota">{pct} % del objetivo</span>
    </div>
  )
}
