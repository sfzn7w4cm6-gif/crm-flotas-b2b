import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FaseBadge } from '../../components/StatusBadge'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { fetchTodosLosLeads } from '../../lib/leadsService'
import { fetchMiHistorico } from '../../lib/actividadService'
import { fetchModelos } from '../../lib/catalogosService'
import { coincideBusqueda, coincideModelo, fetchTextosExtra, textoBusqueda } from '../../lib/filtrosLeads'
import { fechaCorta } from '../../lib/formato'
import { fetchConcesionarios, fetchUbicaciones } from '../../lib/usuariosService'
import { FaseLabel, ModoFinanciacionLabel } from '../../lib/types'
import type { Concesionario, Fase, Lead, Modelo, Ubicacion } from '../../lib/types'
import { descargarExcel } from '../../lib/excelExport'
import { EnlaceEmpresa } from '../../components/EnlaceEmpresa'
import { ConfigTarjetas, VistaPipeline } from '../MisLeads/VistaPipeline'
import { guardarCamposTarjeta, leerCamposTarjeta, type CampoTarjeta } from '../MisLeads/camposTarjeta'
import { fasesDeUrl, OPCIONES_FASE } from '../MisLeads/opcionesFase'
import '../MisLeads/MisLeads.css'

type Vista = 'tabla' | 'pipeline'
const VISTA_KEY = 'crmflotas.seguimiento.vista'

function leerVista(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === 'pipeline' ? 'pipeline' : 'tabla'
  } catch {
    return 'tabla'
  }
}

type ColKey =
  | 'numero'
  | 'empresa'
  | 'sector'
  | 'decisor'
  | 'telefono'
  | 'fase'
  | 'modelos'
  | 'vehiculos'
  | 'financiacion'
  | 'fechaAlta'
  | 'proximaAccion'
  | 'fechaLimite'
  | 'comercial'
  | 'concesionario'
  | 'notas'

type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: ColKey
  label: string
  sortable: boolean
  render: (l: Lead, ctx: { nombreConcesionario: Map<string, string>; nombreUbicacion: Map<string, string> }) => ReactNode
  valor: (l: Lead, ctx: { nombreConcesionario: Map<string, string>; nombreUbicacion: Map<string, string> }) => string | number
  /** Texto para exportar a Excel: a diferencia de 'valor' (clave de orden,
   *  a veces en minusculas), conserva mayusculas/formato de visualizacion. */
  exportar: (l: Lead, ctx: { nombreConcesionario: Map<string, string>; nombreUbicacion: Map<string, string> }) => string | number
}

const COLUMNAS: ColumnDef[] = [
  { key: 'numero', label: 'Nº', sortable: true, render: (l) => l.fl_numero, valor: (l) => l.fl_numero, exportar: (l) => l.fl_numero },
  { key: 'empresa', label: 'Empresa', sortable: true, render: (l) => <EnlaceEmpresa lead={l} />, valor: (l) => l.fl_razonsocial.toLowerCase(), exportar: (l) => l.fl_razonsocial },
  { key: 'sector', label: 'Sector', sortable: true, render: (l) => l.fl_actividadeconomica, valor: (l) => l.fl_actividadeconomica.toLowerCase(), exportar: (l) => l.fl_actividadeconomica },
  { key: 'decisor', label: 'Decisor', sortable: false, render: (l) => l.fl_nombreresponsable, valor: (l) => l.fl_nombreresponsable, exportar: (l) => l.fl_nombreresponsable },
  { key: 'telefono', label: 'Teléfono', sortable: false, render: (l) => l.fl_telefonocorporativo, valor: (l) => l.fl_telefonocorporativo, exportar: (l) => l.fl_telefonocorporativo },
  { key: 'fase', label: 'Fase', sortable: true, render: (l) => <FaseBadge fase={l.fl_faseactual} size="sm" />, valor: (l) => l.fl_faseactual, exportar: (l) => FaseLabel[l.fl_faseactual] },
  { key: 'modelos', label: 'Modelos', sortable: false, render: (l) => l.fl_modelosinteres, valor: (l) => l.fl_modelosinteres, exportar: (l) => l.fl_modelosinteres },
  { key: 'vehiculos', label: 'Nº veh.', sortable: true, render: (l) => l.fl_numvehiculosrenovarampliar, valor: (l) => l.fl_numvehiculosrenovarampliar, exportar: (l) => l.fl_numvehiculosrenovarampliar },
  { key: 'financiacion', label: 'Financiación', sortable: false, render: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual], valor: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual], exportar: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual] },
  { key: 'fechaAlta', label: 'Fecha alta', sortable: true, render: (l) => fechaCorta(l.fl_fechaprimercontacto), valor: (l) => l.fl_fechaprimercontacto ?? '', exportar: (l) => fechaCorta(l.fl_fechaprimercontacto) },
  { key: 'proximaAccion', label: 'Próxima acción', sortable: false, render: (l) => l.fl_proximaaccion, valor: (l) => l.fl_proximaaccion, exportar: (l) => l.fl_proximaaccion },
  { key: 'fechaLimite', label: 'Fecha límite', sortable: true, render: (l) => fechaCorta(l.fl_fechaproximaaccion), valor: (l) => l.fl_fechaproximaaccion ?? '', exportar: (l) => fechaCorta(l.fl_fechaproximaaccion) },
  { key: 'comercial', label: 'Comercial', sortable: false, render: (l) => l.fl_comercialresponsable, valor: (l) => l.fl_comercialresponsable, exportar: (l) => l.fl_comercialresponsable },
  {
    key: 'concesionario',
    label: 'Concesionario',
    sortable: true,
    render: (l, ctx) => `${ctx.nombreConcesionario.get(l._fl_concesionario_value) ?? ''} · ${ctx.nombreUbicacion.get(l._fl_ubicacion_value) ?? ''}`,
    valor: (l, ctx) => `${ctx.nombreConcesionario.get(l._fl_concesionario_value) ?? ''} ${ctx.nombreUbicacion.get(l._fl_ubicacion_value) ?? ''}`.toLowerCase(),
    exportar: (l, ctx) => `${ctx.nombreConcesionario.get(l._fl_concesionario_value) ?? ''} · ${ctx.nombreUbicacion.get(l._fl_ubicacion_value) ?? ''}`,
  },
  { key: 'notas', label: 'Notas', sortable: false, render: (l) => l.fl_observaciones, valor: (l) => l.fl_observaciones, exportar: (l) => l.fl_observaciones },
]
const ORDEN_INICIAL: ColKey[] = COLUMNAS.map((c) => c.key)
// "Notas" es texto libre y suele ser largo: se deja disponible en el editor
// de vista pero oculta por defecto para no ensanchar la tabla de inicio.
const COLUMNAS_VISIBLES_POR_DEFECTO: ColKey[] = ORDEN_INICIAL.filter((k) => k !== 'notas' && k !== 'modelos')

export function SeguimientoLeads() {
  const [params] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [extras, setExtras] = useState<Map<string, string>>(new Map())
  const [enFaseDesde, setEnFaseDesde] = useState<Map<string, Date>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [ahora] = useState(() => Date.now())

  const [concesionariosSel, setConcesionariosSel] = useState<string[]>([])
  const [ubicacionesSel, setUbicacionesSel] = useState<string[]>([])
  const [fases, setFases] = useState<Fase[]>(() => fasesDeUrl(params))
  const [modelosSel, setModelosSel] = useState<string[]>([])
  const [empresasSel, setEmpresasSel] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(ORDEN_INICIAL)
  const [draggedKey, setDraggedKey] = useState<ColKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColKey>>(new Set(COLUMNAS_VISIBLES_POR_DEFECTO))
  const [editandoVista, setEditandoVista] = useState(false)
  const [vista, setVistaState] = useState<Vista>(leerVista)
  const [campos, setCamposState] = useState<CampoTarjeta[]>(leerCamposTarjeta)

  useEffect(() => {
    Promise.all([fetchTodosLosLeads(), fetchConcesionarios(), fetchUbicaciones()]).then(([l, c, u]) => {
      setLeads(l)
      setConcesionarios(c)
      setUbicaciones(u)
      setCargando(false)
    })
    fetchModelos()
      .then(setModelos)
      .catch(() => undefined)
    fetchTextosExtra()
      .then(setExtras)
      .catch(() => undefined)
    fetchMiHistorico()
      .then((h) => {
        const m = new Map<string, Date>()
        for (const fila of h) {
          const f = new Date(fila.fl_fechainicio)
          const previa = m.get(fila._fl_lead_value)
          if (!previa || f > previa) m.set(fila._fl_lead_value, f)
        }
        setEnFaseDesde(m)
      })
      .catch(() => undefined)
  }, [])

  const setVista = (v: Vista) => {
    setVistaState(v)
    try {
      localStorage.setItem(VISTA_KEY, v)
    } catch {
      /* sin almacenamiento: solo dura esta sesion */
    }
  }
  const setCampos = (c: CampoTarjeta[]) => {
    setCamposState(c)
    guardarCamposTarjeta(c)
  }

  const ubicacionesDelConcesionario = useMemo(
    () => (concesionariosSel.length ? ubicaciones.filter((u) => concesionariosSel.includes(u._fl_concesionario_value)) : ubicaciones),
    [ubicaciones, concesionariosSel],
  )

  const nombreConcesionario = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])
  const nombreUbicacion = useMemo(() => new Map(ubicaciones.map((u) => [u.fl_ubicacionid, u.fl_nombre])), [ubicaciones])
  const ctx = useMemo(() => ({ nombreConcesionario, nombreUbicacion }), [nombreConcesionario, nombreUbicacion])

  const opcionesEmpresa = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads)
      if (l._fl_empresa_value && (concesionariosSel.length === 0 || concesionariosSel.includes(l._fl_concesionario_value))) m.set(l._fl_empresa_value, l.fl_razonsocial)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }))
  }, [leads, concesionariosSel])

  // Busca en todos los campos, en el concesionario y la sede, y en las tareas y notas.
  const indice = useMemo(
    () =>
      new Map(
        leads.map((l) => [
          l.fl_leadid,
          textoBusqueda(l, [extras.get(l.fl_leadid), nombreConcesionario.get(l._fl_concesionario_value), nombreUbicacion.get(l._fl_ubicacion_value)]),
        ]),
      ),
    [leads, extras, nombreConcesionario, nombreUbicacion],
  )

  const filtrados = useMemo(() => {
    const mods = modelos.filter((m) => modelosSel.includes(m.fl_modeloid))
    return leads.filter((l) => {
      if (concesionariosSel.length && !concesionariosSel.includes(l._fl_concesionario_value)) return false
      if (ubicacionesSel.length && !ubicacionesSel.includes(l._fl_ubicacion_value)) return false
      if (fases.length && !fases.includes(l.fl_faseactual)) return false
      if (empresasSel.length && !(l._fl_empresa_value && empresasSel.includes(l._fl_empresa_value))) return false
      if (mods.length && !coincideModelo(l, mods)) return false
      if (busqueda.trim() && !coincideBusqueda(indice.get(l.fl_leadid) ?? '', busqueda)) return false
      return true
    })
  }, [leads, indice, modelos, concesionariosSel, ubicacionesSel, fases, empresasSel, modelosSel, busqueda])

  const hayFiltros =
    busqueda.trim() !== '' || concesionariosSel.length + ubicacionesSel.length + fases.length + modelosSel.length + empresasSel.length > 0
  const limpiarFiltros = () => {
    setBusqueda('')
    setConcesionariosSel([])
    setUbicacionesSel([])
    setFases([])
    setModelosSel([])
    setEmpresasSel([])
  }

  const ordenados = useMemo(() => {
    if (!sortBy) return filtrados
    const col = COLUMNAS.find((c) => c.key === sortBy)!
    const copia = [...filtrados]
    copia.sort((a, b) => {
      const va = col.valor(a, ctx)
      const vb = col.valor(b, ctx)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copia
  }, [filtrados, sortBy, sortDir, ctx])

  const toggleSort = (key: ColKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  const onDrop = (targetKey: ColKey) => {
    if (!draggedKey || draggedKey === targetKey) {
      setDraggedKey(null)
      setDragOverKey(null)
      return
    }
    setColumnOrder((prev) => {
      const next = [...prev]
      const from = next.indexOf(draggedKey)
      const to = next.indexOf(targetKey)
      next.splice(from, 1)
      next.splice(to, 0, draggedKey)
      return next
    })
    setDraggedKey(null)
    setDragOverKey(null)
  }

  const toggleColumnVisible = (key: ColKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size === 1) return prev // siempre debe quedar al menos una columna visible
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const columnasOrdenadas = columnOrder.map((key) => COLUMNAS.find((c) => c.key === key)!).filter((c) => c && visibleColumns.has(c.key))

  return (
    <div>
      <div className="page-header">
        <h1>Seguimiento de leads</h1>
      </div>

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} />
          <FiltroMulti
            etiqueta="Concesionario"
            opciones={concesionarios.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
            value={concesionariosSel}
            onChange={(v) => {
              setConcesionariosSel(v)
              setUbicacionesSel([])
              setEmpresasSel([])
            }}
          />
          <FiltroMulti
            etiqueta="Sede"
            opciones={ubicacionesDelConcesionario.map((u) => ({ value: u.fl_ubicacionid, label: u.fl_nombre }))}
            value={ubicacionesSel}
            onChange={setUbicacionesSel}
          />
          <FiltroMulti etiqueta="Fase" opciones={OPCIONES_FASE} value={fases} onChange={setFases} />
          <FiltroMulti etiqueta="Modelo" opciones={modelos.map((m) => ({ value: m.fl_modeloid, label: m.fl_nombre }))} value={modelosSel} onChange={setModelosSel} />
          <FiltroMulti etiqueta="Empresa" opciones={opcionesEmpresa} value={empresasSel} onChange={setEmpresasSel} />
          {hayFiltros && (
            <button type="button" className="lista-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="lista-acciones">
          <span className="lista-cuenta">{hayFiltros ? `${filtrados.length} de ${leads.length} leads` : `${leads.length} leads`}</span>

          <div className="vista-toggle" role="group" aria-label="Tipo de vista">
            <button type="button" className={vista === 'tabla' ? 'is-activo' : ''} onClick={() => setVista('tabla')}>
              <Icon name="list" size={14} /> Tabla
            </button>
            <button type="button" className={vista === 'pipeline' ? 'is-activo' : ''} onClick={() => setVista('pipeline')}>
              <Icon name="dashboard" size={14} /> Pipeline
            </button>
          </div>

          {vista === 'pipeline' ? (
            <ConfigTarjetas campos={campos} onChange={setCampos} conConcesionario />
          ) : (
            <div className="view-editor">
              <button type="button" className="btn-mini" onClick={() => setEditandoVista((v) => !v)} aria-expanded={editandoVista}>
                <Icon name="sliders" size={14} />
                Columnas
              </button>
              {editandoVista && (
                <>
                  <button type="button" className="view-editor-backdrop" aria-label="Cerrar editor de vista" onClick={() => setEditandoVista(false)} />
                  <div className="view-editor-panel">
                    <p className="view-editor-title">Columnas visibles</p>
                    {columnOrder.map((key) => {
                      const col = COLUMNAS.find((c) => c.key === key)!
                      return (
                        <label key={key} className="view-editor-item">
                          <input
                            type="checkbox"
                            checked={visibleColumns.has(key)}
                            onChange={() => toggleColumnVisible(key)}
                            disabled={visibleColumns.has(key) && visibleColumns.size === 1}
                          />
                          {col.label}
                        </label>
                      )
                    })}
                    <p className="view-editor-pista">Arrastra las cabeceras de la tabla para cambiar su orden.</p>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn-mini"
            title="Descargar en Excel lo que se ve en la lista"
            onClick={() =>
              descargarExcel(
                'Seguimiento de leads',
                columnasOrdenadas.map((c) => c.label),
                ordenados.map((l) => columnasOrdenadas.map((c) => c.exportar(l, ctx))),
              )
            }
          >
            <Icon name="download" size={14} />
            Excel
          </button>
        </div>
      </div>

      {cargando && <p className="wizard-loading">Cargando…</p>}

      {!cargando && ordenados.length === 0 && (
        <div className="empty-state">
          <Icon name="filter" size={26} />
          <p>No hay leads que coincidan con estos filtros.</p>
        </div>
      )}

      {!cargando && ordenados.length > 0 && vista === 'pipeline' && (
        <VistaPipeline
          leads={ordenados}
          enFaseDesde={enFaseDesde}
          ahora={ahora}
          soloFases={fases}
          campos={campos}
          nombreConcesionario={(l) => `${nombreConcesionario.get(l._fl_concesionario_value) ?? ''} · ${nombreUbicacion.get(l._fl_ubicacion_value) ?? ''}`}
        />
      )}

      {!cargando && ordenados.length > 0 && vista === 'tabla' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columnasOrdenadas.map((col) => (
                  <th
                    key={col.key}
                    draggable
                    title="Arrastra para cambiar el orden"
                    onDragStart={() => setDraggedKey(col.key)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragOverKey !== col.key) setDragOverKey(col.key)
                    }}
                    onDrop={() => onDrop(col.key)}
                    onDragEnd={() => {
                      setDraggedKey(null)
                      setDragOverKey(null)
                    }}
                    className={`th-draggable ${dragOverKey === col.key && draggedKey !== col.key ? 'is-drop-target' : ''} ${draggedKey === col.key ? 'is-dragging' : ''}`}
                  >
                    <span className="drag-handle" aria-hidden="true" />
                    {col.sortable ? (
                      <button
                        type="button"
                        className={`th-sort ${sortBy === col.key ? 'is-active' : ''} ${sortBy === col.key && sortDir === 'desc' ? 'is-desc' : ''}`}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        <span className="th-sort-icon">
                          <Icon name="chevronDown" size={12} />
                        </span>
                      </button>
                    ) : (
                      <span className="th-label">{col.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.map((l) => (
                <tr key={l.fl_leadid} className="row-clickable" onClick={() => (window.location.hash = `#/lead/${l.fl_leadid}`)}>
                  {columnasOrdenadas.map((col, i) => (
                    <td key={col.key} className={i === 0 ? 'cell-strong' : undefined}>
                      {col.render(l, ctx)}
                    </td>
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
