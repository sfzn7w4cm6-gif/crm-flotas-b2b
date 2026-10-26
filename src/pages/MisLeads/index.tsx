import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { FaseBadge } from '../../components/StatusBadge'
import { fetchMisLeads } from '../../lib/leadsService'
import { FaseLabel, ModoFinanciacionLabel } from '../../lib/types'
import type { Lead } from '../../lib/types'
import { descargarExcel } from '../../lib/excelExport'

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
  { key: 'numero', label: 'Nº', sortable: true, render: (l) => l.fl_numero, valor: (l) => l.fl_numero, exportar: (l) => l.fl_numero },
  { key: 'empresa', label: 'Empresa', sortable: true, render: (l) => l.fl_razonsocial, valor: (l) => l.fl_razonsocial.toLowerCase(), exportar: (l) => l.fl_razonsocial },
  { key: 'sector', label: 'Sector', sortable: true, render: (l) => l.fl_actividadeconomica, valor: (l) => l.fl_actividadeconomica.toLowerCase(), exportar: (l) => l.fl_actividadeconomica },
  { key: 'decisor', label: 'Decisor', sortable: false, render: (l) => l.fl_nombreresponsable, valor: (l) => l.fl_nombreresponsable, exportar: (l) => l.fl_nombreresponsable },
  { key: 'telefono', label: 'Teléfono', sortable: false, render: (l) => l.fl_telefonocorporativo, valor: (l) => l.fl_telefonocorporativo, exportar: (l) => l.fl_telefonocorporativo },
  { key: 'fase', label: 'Fase', sortable: true, render: (l) => <FaseBadge fase={l.fl_faseactual} size="sm" />, valor: (l) => l.fl_faseactual, exportar: (l) => FaseLabel[l.fl_faseactual] },
  { key: 'vehiculos', label: 'Nº veh.', sortable: true, render: (l) => l.fl_numvehiculosrenovarampliar, valor: (l) => l.fl_numvehiculosrenovarampliar, exportar: (l) => l.fl_numvehiculosrenovarampliar },
  { key: 'financiacion', label: 'Financiación', sortable: false, render: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual], valor: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual], exportar: (l) => ModoFinanciacionLabel[l.fl_modofinanciacionactual] },
  { key: 'fechaAlta', label: 'Fecha alta', sortable: true, render: (l) => l.fl_fechaprimercontacto, valor: (l) => l.fl_fechaprimercontacto, exportar: (l) => l.fl_fechaprimercontacto },
  { key: 'proximaAccion', label: 'Próxima acción', sortable: false, render: (l) => l.fl_proximaaccion, valor: (l) => l.fl_proximaaccion, exportar: (l) => l.fl_proximaaccion },
  { key: 'fechaLimite', label: 'Fecha límite', sortable: true, render: (l) => l.fl_fechaproximaaccion, valor: (l) => l.fl_fechaproximaaccion, exportar: (l) => l.fl_fechaproximaaccion },
  { key: 'notas', label: 'Notas', sortable: false, render: (l) => l.fl_observaciones, valor: (l) => l.fl_observaciones, exportar: (l) => l.fl_observaciones },
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

  useEffect(() => {
    fetchMisLeads()
      .then(setLeads)
      .finally(() => setCargando(false))
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return leads
    return leads.filter((l) => l.fl_razonsocial.toLowerCase().includes(q))
  }, [leads, busqueda])

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
          <input placeholder="Buscar por empresa…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
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

        <div className="view-editor">
          <button type="button" className="btn-secondary" onClick={() => setEditandoVista((v) => !v)}>
            <Icon name="settings" size={15} />
            Editar vista
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
              </div>
            </>
          )}
        </div>
      </div>

      {!cargando && leads.length > 0 && (
        <p className="table-hint">
          <span className="drag-handle" aria-hidden="true" /> Arrastra una cabecera por el icono de puntos para cambiar el orden, o usa "Editar vista" para mostrar u ocultar columnas.
        </p>
      )}

      {cargando && <p className="wizard-loading">Cargando…</p>}

      {!cargando && ordenados.length === 0 && (
        <div className="empty-state">
          <Icon name="car" size={28} />
          <p>Todavía no tienes leads{busqueda ? ' que coincidan con la búsqueda' : ''}.</p>
          {!busqueda && (
            <Link to="/nuevo-lead" className="btn-primary">
              Crear el primero
            </Link>
          )}
        </div>
      )}

      {!cargando && ordenados.length > 0 && (
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
