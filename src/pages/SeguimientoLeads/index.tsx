import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TablaDesplazable } from '../../components/TablaDesplazable'
import { Icon } from '../../components/Icon'
import { AvisoDescuentos, FiltroDescuentoPendiente } from '../../components/AvisoDescuentos'
import { descuentoPendiente } from '../../lib/descuento'
import { dentroDePeriodos } from '../../lib/actividadService'
import type { PeriodoMulti } from '../../lib/actividadService'
import { PeriodoFiltro } from '../MiActividad/PeriodoFiltro'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { fetchTodosLosLeads } from '../../lib/leadsService'
import { fetchMiHistorico } from '../../lib/actividadService'
import { fetchModelos } from '../../lib/catalogosService'
import { coincideBusqueda, coincideModelo, fetchTextosExtra, textoBusqueda } from '../../lib/filtrosLeads'
import { fetchConcesionarios, fetchUbicaciones } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import type { Concesionario, Fase, Lead, Modelo, Ubicacion, Zona } from '../../lib/types'
import { descargarExcel } from '../../lib/excelExport'
import { ConfigTarjetas, VistaPipeline } from '../MisLeads/VistaPipeline'
import { guardarCamposTarjeta, leerCamposTarjeta, type CampoTarjeta } from '../MisLeads/camposTarjeta'
import { fasesDeUrl, OPCIONES_FASE } from '../MisLeads/opcionesFase'
import { COLUMNAS, type ColKey } from '../MisLeads/columnasLeads'
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

type SortDir = 'asc' | 'desc'

const ORDEN_INICIAL: ColKey[] = COLUMNAS.map((c) => c.key)
const COLUMNAS_VISIBLES_POR_DEFECTO: ColKey[] = ['numero', 'empresa', 'concesionario', 'comercial', 'fase', 'vehiculos', 'descuento', 'proximaAccion', 'fechaProximaAccion']

export function SeguimientoLeads() {
  const [params] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [extras, setExtras] = useState<Map<string, string>>(new Map())
  const [enFaseDesde, setEnFaseDesde] = useState<Map<string, Date>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [ahora] = useState(() => Date.now())

  const [zonasSel, setZonasSel] = useState<string[]>([])
  const [concesionariosSel, setConcesionariosSel] = useState<string[]>([])
  const [ubicacionesSel, setUbicacionesSel] = useState<string[]>([])
  const [fases, setFases] = useState<Fase[]>(() => fasesDeUrl(params))
  const [modelosSel, setModelosSel] = useState<string[]>([])
  const [empresasSel, setEmpresasSel] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  // Desde el aviso de Inicio se llega con ?descuento=pendiente.
  const [soloSinDescuento, setSoloSinDescuento] = useState(() => params.get('descuento') === 'pendiente')
  // Vacío = "Todo" (sin filtrar), a diferencia de Inicio: esta pantalla no tenía antes filtro de periodo.
  const [periodo, setPeriodo] = useState<PeriodoMulti>([])
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
    Promise.all([fetchTodosLosLeads(), fetchConcesionarios(), fetchUbicaciones(), fetchZonas()]).then(([l, c, u, z]) => {
      setLeads(l)
      setConcesionarios(c)
      setUbicaciones(u)
      setZonas(z)
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

  const ubicacionesDeZona = useMemo(
    () => (zonasSel.length ? ubicaciones.filter((u) => u._fl_zona_value && zonasSel.includes(u._fl_zona_value)) : ubicaciones),
    [ubicaciones, zonasSel],
  )
  const ubicacionIdsDeZona = useMemo(() => new Set(ubicacionesDeZona.map((u) => u.fl_ubicacionid)), [ubicacionesDeZona])
  const concesionarioIdsDeZona = useMemo(() => new Set(ubicacionesDeZona.map((u) => u._fl_concesionario_value)), [ubicacionesDeZona])
  const concesionariosDeZona = useMemo(
    () => (zonasSel.length ? concesionarios.filter((c) => concesionarioIdsDeZona.has(c.fl_concesionarioid)) : concesionarios),
    [concesionarios, zonasSel, concesionarioIdsDeZona],
  )
  const ubicacionesDelConcesionario = useMemo(
    () => (concesionariosSel.length ? ubicacionesDeZona.filter((u) => concesionariosSel.includes(u._fl_concesionario_value)) : ubicacionesDeZona),
    [ubicacionesDeZona, concesionariosSel],
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
      if (zonasSel.length && !ubicacionIdsDeZona.has(l._fl_ubicacion_value)) return false
      if (concesionariosSel.length && !concesionariosSel.includes(l._fl_concesionario_value)) return false
      if (ubicacionesSel.length && !ubicacionesSel.includes(l._fl_ubicacion_value)) return false
      if (fases.length && !fases.includes(l.fl_faseactual)) return false
      if (empresasSel.length && !(l._fl_empresa_value && empresasSel.includes(l._fl_empresa_value))) return false
      if (mods.length && !coincideModelo(l, mods)) return false
      if (soloSinDescuento && !descuentoPendiente(l)) return false
      if (periodo.length && !dentroDePeriodos(l.fl_fechaprimercontacto ? new Date(l.fl_fechaprimercontacto) : new Date(l.createdon), periodo)) return false
      if (busqueda.trim() && !coincideBusqueda(indice.get(l.fl_leadid) ?? '', busqueda)) return false
      return true
    })
  }, [leads, indice, modelos, zonasSel, ubicacionIdsDeZona, concesionariosSel, ubicacionesSel, fases, empresasSel, modelosSel, busqueda, soloSinDescuento, periodo])

  const hayFiltros =
    busqueda.trim() !== '' ||
    soloSinDescuento ||
    periodo.length > 0 ||
    zonasSel.length + concesionariosSel.length + ubicacionesSel.length + fases.length + modelosSel.length + empresasSel.length > 0
  const limpiarFiltros = () => {
    setBusqueda('')
    setZonasSel([])
    setConcesionariosSel([])
    setUbicacionesSel([])
    setFases([])
    setModelosSel([])
    setEmpresasSel([])
    setSoloSinDescuento(false)
    setPeriodo([])
  }
  const sinDescuento = useMemo(() => leads.filter(descuentoPendiente).length, [leads])
  const primerAnio = useMemo(() => {
    const anios = leads.filter((l) => l.fl_fechaprimercontacto).map((l) => new Date(l.fl_fechaprimercontacto).getFullYear())
    return anios.length ? Math.min(new Date().getFullYear() - 1, ...anios) : new Date().getFullYear() - 1
  }, [leads])

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
        <h1>Seguimiento de oportunidades</h1>
      </div>

      <AvisoDescuentos n={sinDescuento} onVer={soloSinDescuento ? undefined : () => setSoloSinDescuento(true)} />

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} />
          <FiltroMulti
            etiqueta="Zona"
            opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))}
            value={zonasSel}
            onChange={(v) => {
              setZonasSel(v)
              setConcesionariosSel([])
              setUbicacionesSel([])
              setEmpresasSel([])
            }}
          />
          <FiltroMulti
            etiqueta="Concesionario"
            opciones={concesionariosDeZona.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
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
          <FiltroDescuentoPendiente activo={soloSinDescuento} onChange={setSoloSinDescuento} />
          <PeriodoFiltro value={periodo} onChange={setPeriodo} primerAnio={primerAnio} etiqueta="Periodo" />
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
                'Seguimiento de oportunidades',
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
          <p>No hay oportunidades que coincidan con estos filtros.</p>
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
    </div>
  )
}
