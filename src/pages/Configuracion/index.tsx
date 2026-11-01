import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { fetchConcesionarios, fetchUbicaciones, fetchUsuariosApp } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import { fetchObjetivos, guardarObjetivo } from '../../lib/tareasService'
import { coincideBusqueda } from '../../lib/filtrosLeads'
import { normalizarTexto } from '../../lib/formato'
import type { Concesionario, Objetivo, Ubicacion, UsuarioApp, Zona } from '../../lib/types'
import './Configuracion.css'

const GENERAL = '__general__'

interface FilaConfig {
  id: string // concesionarioId o GENERAL
  nombre: string
  esGeneral: boolean
  zonaIds: string[]
  zonas: string[]
  comerciales: string[]
  objetivoId: string | undefined
  valorActual: number | undefined
  /** El general, para mostrar "hereda X" en las filas que no tienen propio. */
  heredaDe: number | undefined
}

export function Configuracion() {
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([])
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [cargando, setCargando] = useState(true)

  const [zonasSel, setZonasSel] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  const [valores, setValores] = useState<Map<string, string>>(new Map())
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [guardado, setGuardado] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    Promise.all([fetchConcesionarios(), fetchUbicaciones(), fetchZonas(), fetchUsuariosApp(), fetchObjetivos()]).then(([c, u, z, us, o]) => {
      setConcesionarios(c)
      setUbicaciones(u)
      setZonas(z)
      setUsuarios(us)
      setObjetivos(o)
      setCargando(false)
    })
  }

  useEffect(cargar, [])

  const nombreZona = useMemo(() => new Map(zonas.map((z) => [z.fl_zonaid, z.fl_nombre])), [zonas])

  // Zonas y comerciales de cada concesionario: se resuelven a traves de sus sedes,
  // la zona vive en fl_ubicacion, no en el concesionario (un concesionario puede
  // tener sedes en varias zonas, ej. M Automocion en Barcelona y en Madrid).
  const datosDeConcesionario = useMemo(() => {
    const m = new Map<string, { zonas: Set<string>; comerciales: string[] }>()
    for (const c of concesionarios) m.set(c.fl_concesionarioid, { zonas: new Set(), comerciales: [] })
    for (const u of ubicaciones) {
      const fila = m.get(u._fl_concesionario_value)
      if (!fila) continue
      if (u._fl_zona_value) fila.zonas.add(u._fl_zona_value)
    }
    const ubicacionConcesionario = new Map(ubicaciones.map((u) => [u.fl_ubicacionid, u._fl_concesionario_value]))
    for (const us of usuarios) {
      if (!us._fl_ubicacion_value) continue
      const concId = ubicacionConcesionario.get(us._fl_ubicacion_value)
      const fila = concId ? m.get(concId) : undefined
      if (fila) fila.comerciales.push(us.fl_nombre)
    }
    return m
  }, [concesionarios, ubicaciones, usuarios])

  const objetivoGeneral = useMemo(() => objetivos.find((o) => !o._fl_concesionario_value), [objetivos])

  const filas = useMemo<FilaConfig[]>(() => {
    const general: FilaConfig = {
      id: GENERAL,
      nombre: 'General (por defecto)',
      esGeneral: true,
      zonaIds: [],
      zonas: [],
      comerciales: [],
      objetivoId: objetivoGeneral?.fl_objetivoid,
      valorActual: objetivoGeneral?.fl_leadsmes,
      heredaDe: undefined,
    }
    const deConcesionarios: FilaConfig[] = concesionarios.map((c) => {
      const propio = objetivos.find((o) => o._fl_concesionario_value === c.fl_concesionarioid)
      const datos = datosDeConcesionario.get(c.fl_concesionarioid)
      const zonaIds = [...(datos?.zonas ?? [])]
      return {
        id: c.fl_concesionarioid,
        nombre: c.fl_nombre,
        esGeneral: false,
        zonaIds,
        zonas: zonaIds.map((zid) => nombreZona.get(zid) ?? '').filter(Boolean),
        comerciales: datos?.comerciales ?? [],
        objetivoId: propio?.fl_objetivoid,
        valorActual: propio?.fl_leadsmes,
        heredaDe: objetivoGeneral?.fl_leadsmes,
      }
    })
    return [general, ...deConcesionarios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))]
  }, [concesionarios, objetivos, datosDeConcesionario, nombreZona, objetivoGeneral])

  // Indice de busqueda: nombre del concesionario, sus zonas y sus comerciales.
  const indice = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) m.set(f.id, normalizarTexto([f.nombre, ...f.zonas, ...f.comerciales].join(' ')))
    return m
  }, [filas])

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim()
    return filas.filter((f) => {
      if (!f.esGeneral && zonasSel.length && !f.zonaIds.some((z) => zonasSel.includes(z))) return false
      if (q && !coincideBusqueda(indice.get(f.id) ?? '', q)) return false
      return true
    })
  }, [filas, zonasSel, busqueda, indice])

  const valorDe = (fila: FilaConfig): string => {
    if (valores.has(fila.id)) return valores.get(fila.id)!
    return fila.valorActual != null ? String(fila.valorActual) : ''
  }
  const esSucio = (fila: FilaConfig): boolean => {
    const editado = valores.get(fila.id)
    if (editado === undefined) return false
    const original = fila.valorActual != null ? String(fila.valorActual) : ''
    return editado !== original
  }

  const cambiarValor = (id: string, valor: string) => {
    setValores((prev) => new Map(prev).set(id, valor.replace(/[^\d]/g, '')))
    setGuardado((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const guardar = async (fila: FilaConfig) => {
    const texto = valorDe(fila)
    const n = Number(texto)
    if (texto === '' || Number.isNaN(n) || n < 0) {
      setError('Pon un número válido de oportunidades (0 o más).')
      return
    }
    setError(null)
    setGuardando((prev) => new Set(prev).add(fila.id))
    try {
      await guardarObjetivo(objetivos, fila.esGeneral ? null : fila.id, fila.esGeneral ? 'General' : fila.nombre, n)
      const nuevos = await fetchObjetivos()
      setObjetivos(nuevos)
      setValores((prev) => {
        const next = new Map(prev)
        next.delete(fila.id)
        return next
      })
      setGuardado((prev) => new Set(prev).add(fila.id))
      setTimeout(() => setGuardado((prev) => {
        const next = new Set(prev)
        next.delete(fila.id)
        return next
      }), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el objetivo.')
    } finally {
      setGuardando((prev) => {
        const next = new Set(prev)
        next.delete(fila.id)
        return next
      })
    }
  }

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>
          <Icon name="settings" size={20} /> Configuración
        </h1>
      </div>
      <p className="config-subtitulo">
        Objetivo de oportunidades nuevas al mes por concesionario. Si uno no tiene objetivo propio, se usa el <strong>general</strong>. El mismo número
        se multiplica automáticamente para el trimestre (×3) y el año (×12).
      </p>

      {error && <p className="config-error">{error}</p>}

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar concesionario, zona o comercial…" />
          <FiltroMulti etiqueta="Zona" opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))} value={zonasSel} onChange={setZonasSel} />
          {(zonasSel.length > 0 || busqueda.trim() !== '') && (
            <button
              type="button"
              className="lista-limpiar"
              onClick={() => {
                setZonasSel([])
                setBusqueda('')
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <span className="lista-cuenta">{filasFiltradas.length} de {filas.length}</span>
      </div>

      <div className="table-wrap">
        <table className="data-table config-tabla">
          <thead>
            <tr>
              <th>Concesionario</th>
              <th>Zona</th>
              <th>Comerciales</th>
              <th>Objetivo / mes</th>
              <th>Trimestre · Año</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((fila) => {
              const valor = valorDe(fila)
              const n = Number(valor)
              const valido = valor !== '' && !Number.isNaN(n)
              const sucio = esSucio(fila)
              return (
                <tr key={fila.id} className={fila.esGeneral ? 'config-fila-general' : undefined}>
                  <td className="cell-strong">
                    {fila.esGeneral && <Icon name="target" size={14} />} {fila.nombre}
                  </td>
                  <td>
                    {fila.esGeneral ? (
                      <span className="flow-meta">Toda la red</span>
                    ) : fila.zonas.length > 0 ? (
                      fila.zonas.join(', ')
                    ) : (
                      <span className="flow-meta">—</span>
                    )}
                  </td>
                  <td>
                    {fila.comerciales.length === 0 ? (
                      <span className="flow-meta">Sin asignar</span>
                    ) : (
                      <span title={fila.comerciales.join(', ')}>
                        {fila.comerciales.slice(0, 2).join(', ')}
                        {fila.comerciales.length > 2 && ` +${fila.comerciales.length - 2}`}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="config-input-wrap">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="config-input"
                        value={valor}
                        placeholder={!fila.esGeneral && fila.heredaDe != null ? String(fila.heredaDe) : '—'}
                        onChange={(e) => cambiarValor(fila.id, e.target.value)}
                      />
                      <span className="flow-meta">oportunidades</span>
                    </div>
                    {!fila.esGeneral && fila.valorActual == null && (
                      <p className="config-hereda">Hereda del general{fila.heredaDe != null ? ` (${fila.heredaDe})` : ''}</p>
                    )}
                  </td>
                  <td className="flow-meta">{valido ? `${n * 3} · ${n * 12}` : '—'}</td>
                  <td>
                    {guardando.has(fila.id) ? (
                      <span className="flow-meta">Guardando…</span>
                    ) : guardado.has(fila.id) ? (
                      <span className="config-guardado">
                        <Icon name="check" size={14} /> Guardado
                      </span>
                    ) : sucio ? (
                      <button type="button" className="btn-mini" onClick={() => guardar(fila)}>
                        <Icon name="check" size={14} />
                        Guardar
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filasFiltradas.length === 0 && (
          <div className="empty-state">
            <Icon name="filter" size={26} />
            <p>No hay concesionarios que coincidan con estos filtros.</p>
          </div>
        )}
      </div>
    </div>
  )
}
