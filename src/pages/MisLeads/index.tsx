import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { descuentoPendiente } from '../../lib/descuento'
import '../../components/AvisoDescuentos.css'
import { TablaDesplazable } from '../../components/TablaDesplazable'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../context/AuthContext'
import { Buscador, FiltroMulti, FiltroSimple } from '../../components/filtros/Filtros'
import { fetchMisLeads } from '../../lib/leadsService'
import { fetchMiHistorico } from '../../lib/actividadService'
import { fetchModelos } from '../../lib/catalogosService'
import { coincideBusqueda, coincideModelo, fetchTextosExtra, textoBusqueda } from '../../lib/filtrosLeads'
import { parseFecha } from '../../lib/formato'
import { Fase } from '../../lib/types'
import type { Lead, Modelo } from '../../lib/types'
import { descargarExcel } from '../../lib/excelExport'
import { CambioFaseDialog } from '../DetalleLead/CambioFaseDialog'
import { ConfigTarjetas, VistaPipeline } from './VistaPipeline'
import { guardarCamposTarjeta, leerCamposTarjeta, type CampoTarjeta } from './camposTarjeta'
import { fasesDeUrl, OPCIONES_FASE } from './opcionesFase'
import { COLUMNAS as TODAS, type ColKey, type CtxColumnas } from './columnasLeads'
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

type SortDir = 'asc' | 'desc'

// El concesionario es siempre el propio: esa columna solo está en Seguimiento.
// La columna de concesionario y sede solo hace falta a quien lleva más de una sede.
const UNA_SEDE = TODAS.filter((c) => c.key !== 'concesionario')
const COLUMNAS_POR_DEFECTO: ColKey[] = ['numero', 'empresa', 'fase', 'vehiculos', 'descuento', 'proximaAccion', 'fechaProximaAccion']

export function MisLeads() {
  const [params] = useSearchParams()
  const { sedes, concesionarios } = useAuth()
  const variasSedes = sedes.length > 1
  const COLUMNAS = variasSedes ? TODAS : UNA_SEDE
  const ctx: CtxColumnas = useMemo(
    () => ({
      nombreConcesionario: new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])),
      nombreUbicacion: new Map(sedes.map((s) => [s.fl_ubicacionid, s.fl_nombre])),
    }),
    [concesionarios, sedes],
  )
  const [leads, setLeads] = useState<Lead[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [extras, setExtras] = useState<Map<string, string>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [sortBy, setSortBy] = useState<ColKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(() => COLUMNAS.map((c) => c.key))
  const [draggedKey, setDraggedKey] = useState<ColKey | null>(null)
  const [dragOverKey, setDragOverKey] = useState<ColKey | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColKey>>(
    () => new Set<ColKey>(variasSedes ? [...COLUMNAS_POR_DEFECTO, 'concesionario'] : COLUMNAS_POR_DEFECTO),
  )
  const [editandoVista, setEditandoVista] = useState(false)
  const [vista, setVistaState] = useState<Vista>(leerVista)
  const [campos, setCamposState] = useState<CampoTarjeta[]>(leerCamposTarjeta)
  const [fases, setFases] = useState<Fase[]>(() => fasesDeUrl(params))
  const [modelosSel, setModelosSel] = useState<string[]>([])
  const [empresasSel, setEmpresasSel] = useState<string[]>([])
  const [sedesSel, setSedesSel] = useState<string[]>([])
  const [alta, setAlta] = useState<FiltroAlta>('todas')
  const [accion, setAccion] = useState<FiltroAccion>('todas')
  const [enFaseDesde, setEnFaseDesde] = useState<Map<string, Date>>(new Map())
  const [ahora] = useState(() => Date.now())
  // Tarjeta soltada en otra columna: se abre la ventana de cambio de fase.
  const [moviendo, setMoviendo] = useState<{ lead: Lead; fase: Fase } | null>(null)

  const cargar = () => {
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
  }

  useEffect(() => {
    cargar()
    fetchModelos()
      .then(setModelos)
      .catch(() => undefined)
    fetchTextosExtra()
      .then(setExtras)
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

  const opcionesEmpresa = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) if (l._fl_empresa_value) m.set(l._fl_empresa_value, l.fl_razonsocial)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label }))
  }, [leads])

  const indice = useMemo(() => new Map(leads.map((l) => [l.fl_leadid, textoBusqueda(l, [extras.get(l.fl_leadid)])])), [leads, extras])

  const filtrados = useMemo(() => {
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
    const mods = modelos.filter((m) => modelosSel.includes(m.fl_modeloid))
    return leads.filter((l) => {
      if (busqueda.trim() && !coincideBusqueda(indice.get(l.fl_leadid) ?? '', busqueda)) return false
      if (fases.length && !fases.includes(l.fl_faseactual)) return false
      if (empresasSel.length && !(l._fl_empresa_value && empresasSel.includes(l._fl_empresa_value))) return false
      if (sedesSel.length && !sedesSel.includes(l._fl_ubicacion_value)) return false
      if (mods.length && !coincideModelo(l, mods)) return false
      if (desdeAlta) {
        const f = parseFecha(l.fl_fechaprimercontacto)
        if (!f || f < desdeAlta) return false
      }
      if (accion !== 'todas') {
        const abierto = l.fl_faseactual !== Fase.Perdido
        const f = parseFecha(l.fl_fechaproximaaccion)?.getTime() ?? null
        if (accion === 'sinFecha' && (f !== null || !abierto)) return false
        if (accion === 'vencida' && !(abierto && f !== null && f < inicioHoy)) return false
        if (accion === 'semana' && !(abierto && f !== null && f >= inicioHoy && f < inicioHoy + 7 * 86400000)) return false
      }
      return true
    })
  }, [leads, indice, modelos, busqueda, fases, empresasSel, sedesSel, modelosSel, alta, accion, ahora])

  const hayFiltros =
    busqueda.trim() !== '' ||
    fases.length > 0 ||
    empresasSel.length > 0 ||
    sedesSel.length > 0 ||
    modelosSel.length > 0 ||
    alta !== 'todas' ||
    accion !== 'todas'
  const limpiarFiltros = () => {
    setBusqueda('')
    setFases([])
    setEmpresasSel([])
    setSedesSel([])
    setModelosSel([])
    setAlta('todas')
    setAccion('todas')
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
  }, [filtrados, sortBy, sortDir, COLUMNAS, ctx])

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

  const mover = (lead: Lead, fase: Fase) => setMoviendo({ lead, fase })

  const columnasOrdenadas = columnOrder.map((key) => COLUMNAS.find((c) => c.key === key)!).filter((c) => c && visibleColumns.has(c.key))

  return (
    <div>
      <div className="page-header">
        <h1>Mis oportunidades</h1>
        <Link to="/nuevo-lead" className="btn-primary">
          <Icon name="add" size={16} />
          Nuevo lead
        </Link>
      </div>

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} />
          {variasSedes && (
            <FiltroMulti
              etiqueta="Sede"
              opciones={sedes.map((x) => ({ value: x.fl_ubicacionid, label: x.fl_nombre }))}
              value={sedesSel}
              onChange={setSedesSel}
            />
          )}
          <FiltroMulti etiqueta="Fase" opciones={OPCIONES_FASE} value={fases} onChange={setFases} />
          <FiltroMulti etiqueta="Modelo" opciones={modelos.map((m) => ({ value: m.fl_modeloid, label: m.fl_nombre }))} value={modelosSel} onChange={setModelosSel} />
          {opcionesEmpresa.length > 1 && <FiltroMulti etiqueta="Empresa" opciones={opcionesEmpresa} value={empresasSel} onChange={setEmpresasSel} />}
          <FiltroSimple
            opciones={Object.entries(FILTRO_ALTA).map(([value, label]) => ({ value: value as FiltroAlta, label }))}
            value={alta}
            porDefecto="todas"
            onChange={setAlta}
          />
          <FiltroSimple
            opciones={Object.entries(FILTRO_ACCION).map(([value, label]) => ({ value: value as FiltroAccion, label }))}
            value={accion}
            porDefecto="todas"
            onChange={setAccion}
          />
          {hayFiltros && (
            <button type="button" className="lista-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="lista-acciones">
          <span className="lista-cuenta">{hayFiltros ? `${filtrados.length} de ${leads.length} oportunidades` : `${leads.length} oportunidades`}</span>

          <div className="vista-toggle" role="group" aria-label="Tipo de vista">
            <button type="button" className={vista === 'tabla' ? 'is-activo' : ''} onClick={() => setVista('tabla')}>
              <Icon name="list" size={14} /> Tabla
            </button>
            <button type="button" className={vista === 'pipeline' ? 'is-activo' : ''} onClick={() => setVista('pipeline')}>
              <Icon name="dashboard" size={14} /> Pipeline
            </button>
          </div>

          {vista === 'pipeline' ? (
            <ConfigTarjetas campos={campos} onChange={setCampos} />
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
                'Mis oportunidades',
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
          <Icon name="car" size={28} />
          <p>{hayFiltros ? 'Ninguna oportunidad coincide con los filtros.' : 'Todavía no tienes oportunidades.'}</p>
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
        <VistaPipeline leads={ordenados} enFaseDesde={enFaseDesde} ahora={ahora} soloFases={fases} campos={campos} onMover={mover} />
      )}

      {!cargando && ordenados.length > 0 && vista === 'tabla' && (
        <TablaDesplazable>
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
                <tr key={l.fl_leadid} className={`row-clickable${descuentoPendiente(l) ? ' is-pendiente-descuento' : ''}`} onClick={() => (window.location.hash = `#/lead/${l.fl_leadid}`)}>
                  {columnasOrdenadas.map((col, i) => (
                    <td key={col.key} className={i === 0 ? 'cell-strong' : undefined}>
                      {col.render(l, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDesplazable>
      )}

      {moviendo && (
        <CambioFaseDialog
          lead={moviendo.lead}
          soloCompletar={false}
          faseInicial={moviendo.fase}
          onCerrar={() => {
            // Los modelos se guardan al añadirlos aunque se cancele: se recarga para verlos.
            setMoviendo(null)
            cargar()
          }}
          onHecho={() => {
            setMoviendo(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}
