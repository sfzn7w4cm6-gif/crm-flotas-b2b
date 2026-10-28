import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FaseBadge, FaseSelect } from '../../components/StatusBadge'
import { fetchMisLeads } from '../../lib/leadsService'
import { fetchMiHistorico } from '../../lib/actividadService'
import { Fase, FaseLabel, ModoFinanciacionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'
import { descargarExcel } from '../../lib/excelExport'
import { VistaPipeline } from './VistaPipeline'
import './MisLeads.css'

type Vista = 'tabla' | 'pipeline'
const VISTA_KEY = 'crmflotas.misleads.vista'

const FILTRO_ALTA = {
  todas: 'Cualquier fecha de alta',
  mes: 'Alta este mes',
  trimestre: 'Alta últimos 3 meses',
  anio: 'Alta este año',
} as const
type FiltroAlta = keyof typeof FILTRO_ALTA
const FILTRO_ACCION = {
  todas: 'Cualquier próxima acción',
  vencida: 'Acción vencida',
  semana: 'Acción en 7 días',
  sinFecha: 'Sin próxima acción',
} as const
type FiltroAccion = keyof typeof FILTRO_ACCION

function leerVista(): Vista {
  try {
    return localStorage.getItem(VISTA_KEY) === 'pipeline' ? 'pipeline' : 'tabla'
  } catch {
    return 'tabla'
  }
}

/** Separa "S700, S800" en modelos sueltos, en mayusculas. */
function modelosDe(l: Lead): string[] {
  return (l.fl_modelosinteres ?? '')
    .split(/[,;/]+/)
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean)
}

type ColKey =
  | 'numero'
  | 'empresa'
  | 'sector'
  | 'decisor'
  | 'telefono'
  | 'fase'
  | 'vehiculos'
  | 'financiacion'
  | 'fechaAlta'
  | 'proximaAccion'
  | 'fechaLimite'
  | 'notas'

type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: ColKey
  label: string
  sortable: boolean
  render: (l: Lead) => ReactNode
  valor: (l: Lead) => string | number
  /** Texto para exportar a Excel: a diferencia de 'valor' (clave de orden,
   *  a veces en minusculas), conserva mayusculas/formato de visualizacion. */
  exportar: (l: Lead) => string | number
}

const COLUMNAS: ColumnDef[] = [
  {
    key: 'numero',
    label: 'Nº',
    sortable: true,
    render: (l) => l.fl_numero,
    valor: (l) => l.fl_numero,
    exportar: (l) => l.fl_numero,
  },
  {
    key: 'empresa',
    label: 'Empresa',
    sortable: true,
    render: (l) => l.fl_razonsocial,
    valor: (l) => l.fl_razonsocial.toLowerCase(),
    exportar: (l) => l.fl_razonsocial,
  },
  {
    key: 'sector',
    label: 'Sector',
    sortable: true,
    render: (l) => l.fl_actividadeconomica,
    valor: (l) => l.fl_actividadeconomica.toLowerCase(),
    exportar: (l) => l.fl_actividadeconomica,
  },
  {
    key: 'decisor',
    label: 'Decisor',
    sortable: false,
    render: (l) => l.fl_nombreresponsable,
    valor: (l) => l.fl_nombreresponsable,
    exportar: (l) => l.fl_nombreresponsable,
  },
  {
    key: 'telefono',
    label: 'Teléfono',
    sortable: false,
    render: (l) => l.fl_telefonocorporativo,
    valor: (l) => l.fl_telefonocorporativo,
    exportar: (l) => l.fl_telefonocorporativo,
  },
  {
    key: 'fase',
    label: 'Fase',
    sortable: true,
    render: (l) => <FaseBadge fase={l.fl_faseactual} size="sm" />,
    valor: (l) => l.fl_faseactual,
    exportar: (l) => FaseLabel[l.fl_faseactual],
  },
  {
    key: 'vehiculos',
    label: 'Nº veh.',
    sortable: true,
    render: (l) => l.fl_numvehiculosrenovarampliar,
    valor: (l) => l.fl_numvehiculosrenovarampliar,
    exportar: (l) => l.fl_numvehiculosrenovarampliar,
  },
  {
    key: 'financiacion',
    label: 'Financiación',
    sortable: false,
    render: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual],
    valor: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual],
    exportar: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual],
  },
  {
    key: 'fechaAlta',
    label: 'Fecha alta',
    sortable: true,
    render: (l) => l.fl_fechaprimercontacto,
    valor: (l) => l.fl_fechaprimercontacto,
    exportar: (l) => l.fl_fechaprimercontacto,
  },
  {
    key: 'proximaAccion',
    label: 'Próxima acción',
    sortable: false,
    render: (l) => l.fl_proximaaccion,
    valor: (l) => l.fl_proximaaccion,
    exportar: (l) => l.fl_proximaaccion,
  },
  {
    key: 'fechaLimite',
    label: 'Fecha límite',
    sortable: true,
    render: (l) => l.fl_fechaproximaaccion,
    valor: (l) => l.fl_fechaproximaaccion,
    exportar: (l) => l.fl_fechaproximaaccion,
  },
  {
    key: 'notas',
    label: 'Notas',
    sortable: false,
    render: (l) => l.fl_observaciones,
    valor: (l) => l.fl_observaciones,
    exportar: (l) => l.fl_observaciones,
  },
]
const ORDEN_INICIAL: ColKey[] = COLUMNAS.map((c) => c.key)
const COLUMNAS_POR_DEFECTO: ColKey[] = ['numero', 'empresa', 'fase', 'vehiculos', 'proximaAccion', 'fechaLimite']

export function MisLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(ORDEN_INICIAL)
  const [draggedKey, setDraggedKey] = useState<ColKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColKey>>(new Set(COLUMNAS_POR_DEFECTO))
  const [editandoVista, setEditandoVista] = useState(false)
  const [vista, setVistaState] = useState<Vista>(leerVista)
  const [fase, setFase] = useState<Fase | ''>('')
  const [modelo, setModelo] = useState('')
  const [alta, setAlta] = useState<FiltroAlta>('todas')
  const [accion, setAccion] = useState<FiltroAccion>('todas')
  const [enFaseDesde, setEnFaseDesde] = useState<Map<string, Date>>(new Map())
  const [ahora] = useState(() => Date.now())

  useEffect(() => {
    fetchMisLeads()
      .then(setLeads)
      .finally(() => setCargando(false))
    // Fecha de entrada en la fase actual = el inicio mas reciente del historico de cada lead.
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

  const modelos = useMemo(() => [...new Set(leads.flatMap(modelosDe))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [leads])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const hoy = new Date(ahora)
    const desdeAlta =
      alta === 'mes'
        ? new Date(hoy.getFullYear(), hoy.getMonth(), 1)
        : alta === 'trimestre'
          ? new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1)
          : alta === 'anio'
            ? new Date(hoy.getFullYear(), 0, 1)
            : null
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
    return leads.filter((l) => {
      if (q) {
        const texto = [l.fl_razonsocial, l.fl_cif, l.fl_nombreresponsable, l.fl_numero].join(' ').toLowerCase()
        if (!texto.includes(q)) return false
      }
      if (fase !== '' && l.fl_faseactual !== fase) return false
      if (modelo && !modelosDe(l).includes(modelo)) return false
      if (desdeAlta && !(l.fl_fechaprimercontacto && new Date(l.fl_fechaprimercontacto) >= desdeAlta)) return false
      if (accion !== 'todas') {
        const abierto = l.fl_faseactual !== Fase.Perdido
        const f = l.fl_fechaproximaaccion ? new Date(l.fl_fechaproximaaccion).getTime() : null
        if (accion === 'sinFecha' && (f !== null || !abierto)) return false
        if (accion === 'vencida' && !(abierto && f !== null && f < inicioHoy)) return false
        if (accion === 'semana' && !(abierto && f !== null && f >= inicioHoy && f < inicioHoy + 7 * 86400000)) return false
      }
      return true
    })
  }, [leads, busqueda, fase, modelo, alta, accion, ahora])

  const hayFiltros = busqueda.trim() !== '' || fase !== '' || modelo !== '' || alta !== 'todas' || accion !== 'todas'
  const limpiarFiltros = () => {
    setBusqueda('')
    setFase('')
    setModelo('')
    setAlta('todas')
    setAccion('todas')
  }

  const ordenados = useMemo(() => {
    if (!sortBy) return filtrados
    const col = COLUMNAS.find((c) => c.key === sortBy)!
    const copia = [...filtrados]
    copia.sort((a, b) => {
      const va = col.valor(a)
      const vb = col.valor(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copia
  }, [filtrados, sortBy, sortDir])

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
        <h1>Mis leads</h1>
        <Link to="/nuevo-lead" className="btn-primary">
          <Icon name="add" size={16} />
          Nuevo lead
        </Link>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input placeholder="Buscar empresa, CIF o contacto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        <FaseSelect value={fase} onChange={setFase} />

        {modelos.length > 0 && (
          <select className="filter-select" value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo">
            <option value="">Todos los modelos</option>
            {modelos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        <select className="filter-select" value={alta} onChange={(e) => setAlta(e.target.value as FiltroAlta)} aria-label="Fecha de alta">
          {Object.entries(FILTRO_ALTA).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={accion}
          onChange={(e) => setAccion(e.target.value as FiltroAccion)}
          aria-label="Próxima acción"
        >
          {Object.entries(FILTRO_ACCION).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        {hayFiltros && (
          <button type="button" className="btn-link" onClick={limpiarFiltros}>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="toolbar misleads-acciones">
        <span className="misleads-cuenta">{hayFiltros ? `${filtrados.length} de ${leads.length} leads` : `${leads.length} leads`}</span>

        <div className="vista-toggle" role="group" aria-label="Tipo de vista">
          <button
            type="button"
            className={vista === 'pipeline' ? 'is-activo' : ''}
            onClick={() => setVista('pipeline')}
            title="Vista pipeline"
          >
            <Icon name="dashboard" size={15} /> Pipeline
          </button>
          <button type="button" className={vista === 'tabla' ? 'is-activo' : ''} onClick={() => setVista('tabla')} title="Vista tabla">
            <Icon name="list" size={15} /> Tabla
          </button>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            descargarExcel(
              'Mis leads',
              columnasOrdenadas.map((c) => c.label),
              ordenados.map((l) => columnasOrdenadas.map((c) => c.exportar(l))),
            )
          }
        >
          <Icon name="download" size={15} />
          Descargar Excel
        </button>

        {vista === 'tabla' && (
          <div className="view-editor">
            <button type="button" className="btn-secondary" onClick={() => setEditandoVista((v) => !v)}>
              <Icon name="settings" size={15} />
              Editar vista
            </button>
            {editandoVista && (
              <>
                <button
                  type="button"
                  className="view-editor-backdrop"
                  aria-label="Cerrar editor de vista"
                  onClick={() => setEditandoVista(false)}
                />
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
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!cargando && leads.length > 0 && vista === 'tabla' && (
        <p className="table-hint">
          <span className="drag-handle" aria-hidden="true" /> Arrastra una cabecera por el icono de puntos para cambiar el orden, o usa
          "Editar vista" para mostrar u ocultar columnas.
        </p>
      )}

      {cargando && <p className="wizard-loading">Cargando…</p>}

      {!cargando && ordenados.length === 0 && (
        <div className="empty-state">
          <Icon name="car" size={28} />
          <p>{hayFiltros ? 'Ningún lead coincide con los filtros.' : 'Todavía no tienes leads.'}</p>
          {hayFiltros ? (
            <button type="button" className="btn-secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          ) : (
            <Link to="/nuevo-lead" className="btn-primary">
              Crear el primero
            </Link>
          )}
        </div>
      )}

      {!cargando && ordenados.length > 0 && vista === 'pipeline' && (
        <VistaPipeline leads={ordenados} enFaseDesde={enFaseDesde} ahora={ahora} soloFase={fase === '' ? undefined : fase} />
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
                      {col.render(l)}
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
