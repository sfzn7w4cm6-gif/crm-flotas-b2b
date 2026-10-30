import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { FaseColumnas } from '../../components/charts/FaseColumnas'
import { FiltroMulti, FiltroSimple } from '../../components/filtros/Filtros'
import { CalendarioTareas, FilaTarea } from '../../components/tareas/Tareas'
import { fetchMisLeads, fetchTodosLosLeads } from '../../lib/leadsService'
import { calcularHitos, fetchMiHistorico, nombrePeriodo, periodoActual, rangoPeriodo, resumenPeriodo } from '../../lib/actividadService'
import type { Periodo } from '../../lib/actividadService'
import { fetchModelos } from '../../lib/catalogosService'
import { coincideModelo } from '../../lib/filtrosLeads'
import { crearNotaConAdjuntos } from '../../lib/notasService'
import {
  cambiarEstadoTarea,
  fetchMisTareas,
  fetchObjetivos,
  objetivoDeRed,
  tareaAbierta,
  tareaVencida,
} from '../../lib/tareasService'
import { fetchConcesionarios, fetchUbicaciones } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../../lib/types'
import type { Concesionario, EstadoTarea, FaseHistorico, Lead, Modelo, Objetivo, Tarea, Ubicacion, Zona } from '../../lib/types'
import { PeriodoFiltro } from './PeriodoFiltro'
import './MiActividad.css'

const TAREAS_VISIBLES = 5

type VistaTabla = 'zona' | 'concesionario' | 'ubicacion' | 'modelo'
type VistaId = 'zona-concesionario' | 'concesionario-sede' | 'zona' | 'concesionario' | 'sede' | 'modelo'
// Vistas ya armadas (como un desplegable de informes, no dos selectores
// sueltos que hay que combinar): cada una trae ya decidido que va de fila
// principal y que va anidado debajo, o si es la vista especial de Modelo
// (un ranking aparte, no esta tabla de fases).
const VISTAS: { value: VistaId; label: string; principal: VistaTabla; hijo?: VistaTabla }[] = [
  { value: 'zona-concesionario', label: 'Zona → Concesionario', principal: 'zona', hijo: 'concesionario' },
  { value: 'concesionario-sede', label: 'Concesionario → Sede', principal: 'concesionario', hijo: 'ubicacion' },
  { value: 'zona', label: 'Solo zona', principal: 'zona' },
  { value: 'concesionario', label: 'Solo concesionario', principal: 'concesionario' },
  { value: 'sede', label: 'Solo sede', principal: 'ubicacion' },
  { value: 'modelo', label: 'Modelo (ranking)', principal: 'modelo' },
]
const COLUMNA_PRINCIPAL: Record<VistaTabla, string> = { zona: 'Zona', concesionario: 'Concesionario', ubicacion: 'Sede', modelo: 'Modelo' }
// Nombres cortos de fase para cabeceras de tabla (sin el "N. " del FaseLabel completo).
const FASE_LABEL_CORTO: Record<Fase, string> = Object.fromEntries(
  FASES_ACTIVAS.map((f) => [f, FaseLabel[f].replace(/^\d+\.\s*/, '')]),
) as Record<Fase, string>
// Un tinte clarito del acento de marca (marron tierra) por fase, solo para
// diferenciar las columnas de un vistazo — mismo tono para todas, distinta
// intensidad, nada de colores nuevos fuera de la paleta de la app.
// Un color clarito distinto por fase (progresion fria -> calida, como un
// embudo de ventas), para diferenciar las columnas de un vistazo. Solo se
// usa con FASES_ACTIVAS: "Perdido" sigue con su rojo de badge en el resto
// de la app, nunca este tinte.
const FASE_TINT: Record<Fase, string> = {
  [Fase.Prospeccion]: '#e8eef7',
  [Fase.PrimerContacto]: '#dbe9fb',
  [Fase.Cualificacion]: '#d6f0f1',
  [Fase.Propuesta]: '#d9f3e6',
  [Fase.Negociacion]: '#e3f3d2',
  [Fase.Cierre]: '#faf0c7',
  [Fase.Entrega]: '#fbe3cf',
  [Fase.Perdido]: '#fbe9e7',
}

type Evento = { fecha: Date; valor: number }

interface FilaDetalle {
  id: string
  nombre: string
  total: number
  perdidos: number
  porFase: Partial<Record<Fase, number>>
}
interface FilaPrincipal extends FilaDetalle {
  hijos: FilaDetalle[]
}

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
  const { usuario, concesionario, sedes, concesionarios: misConcesionarios } = useAuth()
  const [todosLeads, setLeads] = useState<Lead[]>([])
  const [historico, setHistorico] = useState<FaseHistorico[]>([])
  const [tareas, setTareas] = useState<Tarea[] | null>(null)
  // null = no se ha podido leer (la tabla aún no existe en el entorno).
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null)
  // Quien lleva varias sedes puede mirar solo algunas (vacío = todas).
  const [filtroSede, setFiltroSede] = useState<string[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [cargando, setCargando] = useState(true)
  // El periodo de arriba mueve las 4 tarjetas; la tabla de leads de abajo
  // (solo red) tiene su propio periodo independiente, porque se quiere mirar
  // por separado (ej. tarjetas del mes en curso, tabla de todo el trimestre pasado).
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoActual())
  const [periodoTabla, setPeriodoTabla] = useState<Periodo>(() => periodoActual())
  const [verTodas, setVerTodas] = useState(false)
  const [calendario, setCalendario] = useState(false)
  // Tareas cerradas desde esta pantalla: se siguen mostrando (tachadas) hasta recargar.
  const [cambiadas, setCambiadas] = useState<Set<string>>(new Set())
  const [vista, setVista] = useState<VistaId>('zona-concesionario')
  const vistaDef = VISTAS.find((v) => v.value === vista)!
  const agruparPor = vistaDef.principal
  const luegoPor = vistaDef.hijo

  useEffect(() => {
    if (red) {
      Promise.all([
        fetchTodosLosLeads(),
        fetchMiHistorico(),
        fetchObjetivos().catch(() => null),
        fetchConcesionarios(),
        fetchUbicaciones(),
        fetchZonas(),
        fetchModelos().catch(() => []),
      ])
        .then(([l, h, obj, c, u, z, m]) => {
          setLeads(l)
          setHistorico(h)
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
      fetchMisTareas().catch(() => null),
      fetchObjetivos().catch(() => null),
    ])
      .then(([l, h, t, obj]) => {
        setLeads(l)
        setHistorico(h)
        setTareas(t)
        setObjetivos(obj)
      })
      .finally(() => setCargando(false))
  }, [red])

  const variasSedes = !red && sedes.length > 1
  // Con filtro de sede, todas las cifras del comercial salen solo de esas sedes.
  const leads = useMemo(
    () => (red || !filtroSede.length ? todosLeads : todosLeads.filter((l) => filtroSede.includes(l._fl_ubicacion_value))),
    [red, todosLeads, filtroSede],
  )

  const nombreConc = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])
  const nombreUbic = useMemo(() => new Map(ubicaciones.map((u) => [u.fl_ubicacionid, u.fl_nombre])), [ubicaciones])
  const idsFiltrados = useMemo(() => new Set(leads.map((l) => l.fl_leadid)), [leads])
  const historicoFiltrado = useMemo(() => historico.filter((h) => idsFiltrados.has(h._fl_lead_value)), [historico, idsFiltrados])

  // Tabla general (solo red): todos los leads, acotados a la fecha de alta
  // dentro de SU PROPIO periodo (periodoTabla) — independiente del periodo
  // de las 4 tarjetas de arriba.
  const leadsTabla = useMemo(() => {
    if (!red) return []
    const { desde, hasta } = rangoPeriodo(periodoTabla)
    return leads.filter((l) => {
      if (!l.fl_fechaprimercontacto) return false
      const f = new Date(l.fl_fechaprimercontacto)
      return f >= desde && f < hasta
    })
  }, [red, leads, periodoTabla])

  const nombreZona = useMemo(() => new Map(zonas.map((z) => [z.fl_zonaid, z.fl_nombre])), [zonas])
  const ubicacionPorId = useMemo(() => new Map(ubicaciones.map((u) => [u.fl_ubicacionid, u])), [ubicaciones])

  // Valores de UNA dimension para un lead. Zona/Concesionario/Sede dan siempre
  // un unico valor; Modelo puede dar varios (o ninguno) porque un lead puede
  // interesarse en mas de un modelo — en ese caso el lead cuenta en cada fila.
  const valoresDeDimension = (l: Lead, dim: VistaTabla): string[] => {
    if (dim === 'concesionario') return [nombreConc.get(l._fl_concesionario_value) ?? 'Sin concesionario']
    if (dim === 'ubicacion') return [nombreUbic.get(l._fl_ubicacion_value) ?? 'Sin sede']
    if (dim === 'zona') {
      const zonaId = ubicacionPorId.get(l._fl_ubicacion_value)?._fl_zona_value
      return [zonaId ? (nombreZona.get(zonaId) ?? 'Sin zona') : 'Sin zona']
    }
    const propios = modelos.filter((m) => coincideModelo(l, [m])).map((m) => m.fl_nombre)
    return propios.length > 0 ? propios : ['Sin modelo']
  }

  const acumular = (mapa: Map<string, FilaDetalle>, nombre: string, l: Lead) => {
    const fila = mapa.get(nombre) ?? { id: nombre, nombre, total: 0, perdidos: 0, porFase: {} }
    fila.total += 1
    if (l.fl_faseactual === Fase.Perdido) fila.perdidos += 1
    else fila.porFase[l.fl_faseactual] = (fila.porFase[l.fl_faseactual] ?? 0) + 1
    mapa.set(nombre, fila)
  }

  // Tabla general, de 2 niveles (como un Excel con subtotales): fila
  // principal = "Agrupar por" (con el subtotal de todos sus leads), filas
  // hijas debajo = "luego por" (opcional). Columnas = fases, con los mismos
  // leads ya acotados por los filtros y el periodo de arriba.
  const gruposAnidados = useMemo<FilaPrincipal[]>(() => {
    if (!red) return []
    const principales = new Map<string, FilaDetalle>()
    const hijosPorPrincipal = new Map<string, Map<string, FilaDetalle>>()
    for (const l of leadsTabla) {
      for (const nombreP of valoresDeDimension(l, agruparPor)) {
        acumular(principales, nombreP, l)
        if (luegoPor) {
          let hijos = hijosPorPrincipal.get(nombreP)
          if (!hijos) {
            hijos = new Map()
            hijosPorPrincipal.set(nombreP, hijos)
          }
          for (const nombreH of valoresDeDimension(l, luegoPor)) acumular(hijos, nombreH, l)
        }
      }
    }
    return [...principales.values()]
      .map((p): FilaPrincipal => ({
        ...p,
        hijos: [...(hijosPorPrincipal.get(p.id)?.values() ?? [])].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valoresDeDimension/acumular dependen de los mapas ya listados
  }, [red, leadsTabla, agruparPor, luegoPor, ubicacionPorId, nombreConc, nombreUbic, nombreZona, modelos])
  // Ranking de modelos (vista "Modelo"): un lead con varios modelos de
  // interes cuenta en cada uno, igual que en la tabla de fases.
  const rankingModelos = useMemo(() => {
    if (!red || vista !== 'modelo') return []
    const m = new Map<string, number>()
    for (const l of leadsTabla) for (const nombre of valoresDeDimension(l, 'modelo')) m.set(nombre, (m.get(nombre) ?? 0) + 1)
    return [...m.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valoresDeDimension depende de "modelos", ya listado
  }, [red, vista, leadsTabla, modelos])
  const maxModelo = Math.max(1, ...rankingModelos.map((r) => r.total))

  // ---------------------------------------------------------------- cifras

  const hitos = useMemo(() => calcularHitos(leads, historicoFiltrado), [leads, historicoFiltrado])
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
  const eventosCreados = useMemo<Evento[]>(
    () => leads.filter((l) => l.fl_fechaprimercontacto).map((l) => ({ fecha: new Date(l.fl_fechaprimercontacto), valor: 1 })),
    [leads],
  )
  // Primer año que se ofrece en el filtro: el del dato mas antiguo, y como minimo el anterior al actual.
  const primerAnio = useMemo(() => {
    const anios = leads.filter((l) => l.fl_fechaprimercontacto).map((l) => new Date(l.fl_fechaprimercontacto).getFullYear())
    return Math.min(new Date().getFullYear() - 1, ...anios)
  }, [leads])

  // El objetivo es la suma del de cada concesionario (el suyo o, si no tiene, el general): en la
  // red, de todos; para el comercial, de los suyos, o solo de los de las sedes que haya filtrado.
  const idsObjetivo = useMemo(() => {
    if (red) return concesionarios.map((c) => c.fl_concesionarioid)
    if (filtroSede.length) return [...new Set(sedes.filter((u) => filtroSede.includes(u.fl_ubicacionid)).map((u) => u._fl_concesionario_value))]
    if (misConcesionarios.length) return misConcesionarios.map((c) => c.fl_concesionarioid)
    return concesionario ? [concesionario.fl_concesionarioid] : []
  }, [red, concesionarios, filtroSede, sedes, misConcesionarios, concesionario])
  const objetivoMes = objetivos == null ? undefined : objetivoDeRed(objetivos, idsObjetivo)

  // Con filtro de sede, solo las tareas de oportunidades de esas sedes.
  const tareasDeSede = useMemo(
    () => (filtroSede.length ? (tareas ?? []).filter((t) => leadPorId.has(t._fl_lead_value)) : (tareas ?? [])),
    [tareas, filtroSede, leadPorId],
  )
  const tareasLista = useMemo(() => tareasDeSede.filter((t) => tareaAbierta(t) || cambiadas.has(t.fl_tareaid)), [tareasDeSede, cambiadas])
  const pendientes = tareasDeSede.filter(tareaAbierta)
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
  const etiquetaPeriodoTabla = nombrePeriodo(periodoTabla)
  const abiertos = leads.filter((l) => l.fl_faseactual !== Fase.Perdido)
  const vehiculosAbiertos = abiertos.reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0)

  return (
    <div className="inicio">
      <header className="inicio-cabecera">
        <div>
          <p className="inicio-fecha">
            {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            {red ? ' · Toda la red' : variasSedes ? ` · ${sedes.length} sedes` : concesionario ? ` · ${concesionario.fl_nombre}` : ''}
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

      {variasSedes && (
        <div className="lista-filtros inicio-filtros">
          <FiltroMulti
            etiqueta="Sede"
            opciones={sedes.map((u) => ({ value: u.fl_ubicacionid, label: u.fl_nombre }))}
            value={filtroSede}
            onChange={setFiltroSede}
          />
          {filtroSede.length > 0 && (
            <button type="button" className="lista-limpiar" onClick={() => setFiltroSede([])}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <section className="inicio-resumen" aria-label={`Resumen de ${etiquetaPeriodo}`}>
        <Metrica titulo="Leads activados" ayuda="Leads con los que ya hubo al menos un primer contacto" eventos={eventosActivados} periodo={periodo} />
        <Metrica titulo="Ventas" ayuda="Leads que han llegado a la fase de cierre" eventos={eventosVentas} periodo={periodo} />
        <MetricaObjetivo objetivo={objetivoMes} eventos={eventosCreados} periodo={periodo} red={red} />
        <MetricaConversion activados={eventosActivados} ventas={eventosVentas} periodo={periodo} />
      </section>

      {red ? (
        <section className="inicio-bloque">
          <div className="inicio-bloque-cabecera">
            <h2>Leads</h2>
            <span className="inicio-bloque-nota">
              {leadsTabla.length} de {etiquetaPeriodoTabla}
            </span>
            <Link to="/seguimiento" className="inicio-icono-btn" title="Ver el listado completo en Seguimiento de Leads" aria-label="Ver el listado completo en Seguimiento de Leads">
              <Icon name="expand" size={15} />
            </Link>
          </div>

          <div className="tabla-grupos-controles">
            <label className="tabla-grupos-control">
              Periodo
              <PeriodoFiltro value={periodoTabla} onChange={setPeriodoTabla} primerAnio={primerAnio} etiqueta={etiquetaPeriodoTabla} />
            </label>
            <label className="tabla-grupos-control">
              Vista
              <FiltroSimple opciones={VISTAS} value={vista} porDefecto={vista} onChange={setVista} />
            </label>
          </div>

          {vista === 'modelo' ? (
            <>
              <p className="tabla-grupos-nota">Un lead interesado en varios modelos cuenta una vez en cada uno.</p>
              {rankingModelos.length === 0 ? (
                <p className="inicio-vacio">No hay leads que coincidan con el periodo y los filtros elegidos.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table tabla-ranking">
                    <thead>
                      <tr>
                        <th>Posición</th>
                        <th>Modelo</th>
                        <th>Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingModelos.map((r, i) => (
                        <tr key={r.nombre}>
                          <td className="flow-meta">{i + 1}</td>
                          <td className="cell-strong">{r.nombre}</td>
                          <td>
                            <span className="grupo-total">
                              <span className="grupo-total-barra" aria-hidden="true">
                                <span style={{ width: `${(r.total / maxModelo) * 100}%` }} />
                              </span>
                              <span className="grupo-total-cifra">{r.total}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : gruposAnidados.length === 0 ? (
            <p className="inicio-vacio">No hay leads que coincidan con el periodo y los filtros elegidos.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table tabla-grupos">
                <thead>
                  <tr>
                    <th>{COLUMNA_PRINCIPAL[agruparPor]}</th>
                    <th>Total</th>
                    {FASES_ACTIVAS.map((f) => (
                      <th key={f} className="col-fase" title={FaseLabel[f]} style={{ background: FASE_TINT[f] }}>
                        {FASE_LABEL_CORTO[f]}
                      </th>
                    ))}
                    <th className="col-fase">Perdido</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposAnidados.map((g) => (
                    <FragmentoGrupo key={g.id} grupo={g} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
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
                {cierres.slice(0, 5).map(({ lead, fecha }) => {
                  const vehiculos = lead.fl_numvehiculosrenovarampliar
                  return (
                    <li key={lead.fl_leadid}>
                      <Link to={`/lead/${lead.fl_leadid}`} className="venta-fila">
                        <span className="venta-cuerpo">
                          <span className="venta-empresa">{lead.fl_razonsocial}</span>
                          <span className="venta-meta">
                            {fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}
                            {lead.fl_modelosinteres && ` · ${lead.fl_modelosinteres}`}
                          </span>
                        </span>
                        <span className="venta-importe">{vehiculos ? `${vehiculos} vehículo${vehiculos === 1 ? '' : 's'}` : '—'}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

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
        </div>
      )}

      <section className="inicio-bloque">
        <div className="inicio-bloque-cabecera">
          <h2>Oportunidades por fase</h2>
          <span className="inicio-bloque-nota">
            {abiertos.length} oportunidades · {vehiculosAbiertos} vehículos
          </span>
        </div>
        <FaseColumnas leads={abiertos} destino={red ? '/seguimiento' : '/mis-leads'} />
      </section>

      {debajo?.({ leads, historico: historicoFiltrado, periodo, concesionarios })}

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
        {red && <span className="inicio-metrica-ayuda">Suma de los objetivos de todos los concesionarios</span>}
        <span className="inicio-metrica-valor is-vacio">—</span>
        <span className="inicio-metrica-nota">
          {objetivo === undefined ? 'Objetivos aún no activados' : red ? 'Ningún concesionario tiene objetivo todavía. Ponlo en Configuración.' : 'Sin objetivo asignado'}
        </span>
      </div>
    )
  }
  const { desde, hasta, meses } = rangoPeriodo(periodo)
  const meta = objetivo * meses
  const creados = eventos.filter((e) => e.fecha >= desde && e.fecha < hasta).length
  const pct = Math.round((creados / meta) * 100)

  return (
    <div className="inicio-metrica">
      <span className="inicio-metrica-titulo">Objetivo de leads</span>
      {red && <span className="inicio-metrica-ayuda">Suma de los objetivos de todos los concesionarios</span>}
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

/** Tasa de conversion: de los leads que tuvieron primer contacto en el
 *  periodo, cuantos de ESOS MISMOS llegaron a venta (en cualquier momento,
 *  no solo dentro del periodo — un lead activado a final de mes puede
 *  cerrarse el mes siguiente). Sustituye a "Facturado" en los dos inicios. */
function MetricaConversion({ activados, ventas, periodo }: { activados: Evento[]; ventas: Evento[]; periodo: Periodo }) {
  const { desde, hasta } = rangoPeriodo(periodo)
  const activadosPeriodo = activados.filter((e) => e.fecha >= desde && e.fecha < hasta).length
  const ventasPeriodo = ventas.filter((e) => e.fecha >= desde && e.fecha < hasta).length
  const pct = activadosPeriodo > 0 ? Math.round((ventasPeriodo / activadosPeriodo) * 100) : null

  return (
    <div className="inicio-metrica">
      <span className="inicio-metrica-titulo">Tasa de conversión</span>
      <span className="inicio-metrica-ayuda">Contactados que acaban en venta</span>
      <span className="inicio-metrica-valor">{pct === null ? '—' : `${pct}%`}</span>
      {pct !== null && (
        <div className="objetivo-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`objetivo-fill${pct >= 100 ? ' is-completo' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <span className="inicio-metrica-nota">
        {activadosPeriodo === 0 ? 'Sin leads activados en el periodo' : `${ventasPeriodo} de ${activadosPeriodo} contactados se convirtieron en venta`}
      </span>
    </div>
  )
}

/** Fila de grupo (con subtotal, en negrita) y, debajo, sus filas hijas
 *  indentadas si hay un segundo nivel de agrupacion ("luego por"). */
function FragmentoGrupo({ grupo }: { grupo: FilaPrincipal }) {
  return (
    <>
      <FilaTablaGrupos fila={grupo} esPrincipal />
      {grupo.hijos.map((h) => (
        <FilaTablaGrupos key={h.id} fila={h} />
      ))}
    </>
  )
}

function FilaTablaGrupos({ fila, esPrincipal }: { fila: FilaDetalle; esPrincipal?: boolean }) {
  return (
    <tr className={esPrincipal ? 'fila-grupo-principal' : 'fila-grupo-hija'}>
      <td className={esPrincipal ? 'cell-strong' : undefined}>{fila.nombre}</td>
      <td className="grupo-total-cifra">{fila.total}</td>
      {FASES_ACTIVAS.map((f) => (
        <td key={f} className="col-fase">
          {fila.porFase[f] ?? ''}
        </td>
      ))}
      <td className={`col-fase${fila.perdidos > 0 ? ' col-fase-perdido' : ''}`}>{fila.perdidos || ''}</td>
    </tr>
  )
}
