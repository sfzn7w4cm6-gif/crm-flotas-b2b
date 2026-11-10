import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { fetchConcesionarios, fetchUbicaciones, fetchUsuariosApp } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import { fetchObjetivos, guardarObjetivo, objetivoDeRed, objetivoDeSede } from '../../lib/tareasService'
import { coincideBusqueda } from '../../lib/filtrosLeads'
import { normalizarTexto } from '../../lib/formato'
import { fetchAsignaciones, cubreSede } from '../../lib/asignacionesService'
import { RolApp } from '../../lib/types'
import type { Asignacion, Concesionario, Objetivo, Ubicacion, UsuarioApp, Zona } from '../../lib/types'
import './Configuracion.css'

const GENERAL = '__general__'

interface FilaConfig {
  id: string // concesionarioId, ubicacionId o GENERAL
  nombre: string
  tipo: 'general' | 'concesionario' | 'sede'
  /** Solo en las de sede: su concesionario padre (para guardar y para heredar). */
  concesionarioId?: string
  zonaIds: string[]
  zonas: string[]
  comerciales: string[]
  valorActual: number | undefined
  /** Lo que heredaría si no tiene propio (del concesionario o, si tampoco, del general). */
  heredaDe: number | undefined
}

interface CambioRevisado {
  fila: FilaConfig
  nuevo: number
}
interface RevisionImport {
  cambios: CambioRevisado[]
  noResueltos: string[]
}

export function Configuracion() {
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([])
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [cargando, setCargando] = useState(true)

  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [zonasSel, setZonasSel] = useState<string[]>([])
  const [concSel, setConcSel] = useState<string[]>([])
  const [sedesSel, setSedesSel] = useState<string[]>([])
  const [comercialesSel, setComercialesSel] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const [valores, setValores] = useState<Map<string, string>>(new Map())
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [guardado, setGuardado] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const [exportando, setExportando] = useState(false)
  const [revisionImport, setRevisionImport] = useState<RevisionImport | null>(null)
  const [aplicandoImport, setAplicandoImport] = useState(false)
  const [errorImport, setErrorImport] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cargar = () => {
    Promise.all([fetchConcesionarios(), fetchUbicaciones(), fetchZonas(), fetchUsuariosApp(), fetchObjetivos(), fetchAsignaciones().catch(() => [])]).then(([c, u, z, us, o, a]) => {
      setConcesionarios(c)
      setUbicaciones(u)
      setZonas(z)
      setUsuarios(us)
      setObjetivos(o)
      setAsignaciones(a)
      setCargando(false)
    })
  }

  useEffect(cargar, [])

  const nombreZona = useMemo(() => new Map(zonas.map((z) => [z.fl_zonaid, z.fl_nombre])), [zonas])

  // Comerciales de cada sede: los que la llevan por sus asignaciones (el concesionario entero o
  // esa sede). Los usuarios antiguos sin asignaciones cuentan por su sede principal.
  const comercialesPorSede = useMemo(() => {
    const m = new Map<string, UsuarioApp[]>()
    for (const u of ubicaciones) m.set(u.fl_ubicacionid, [])
    for (const us of usuarios) {
      if (us.fl_rol !== RolApp.Concesionario) continue
      const suyas = asignaciones.filter((a) => a._fl_usuarioapp_value === us.fl_usuarioappid)
      for (const u of ubicaciones) {
        const lleva = suyas.length ? suyas.some((a) => cubreSede(a, u)) : us._fl_ubicacion_value === u.fl_ubicacionid
        if (lleva) m.get(u.fl_ubicacionid)!.push(us)
      }
    }
    return m
  }, [ubicaciones, usuarios, asignaciones])

  // Zonas y comerciales de cada concesionario: se resuelven a traves de sus sedes,
  // la zona vive en fl_ubicacion, no en el concesionario (un concesionario puede
  // tener sedes en varias zonas, ej. M Automocion en Barcelona y en Madrid).
  const datosDeConcesionario = useMemo(() => {
    const m = new Map<string, { zonas: Set<string>; comerciales: Set<string> }>()
    for (const c of concesionarios) m.set(c.fl_concesionarioid, { zonas: new Set(), comerciales: new Set() })
    for (const u of ubicaciones) {
      const fila = m.get(u._fl_concesionario_value)
      if (!fila) continue
      if (u._fl_zona_value) fila.zonas.add(u._fl_zona_value)
      for (const us of comercialesPorSede.get(u.fl_ubicacionid) ?? []) fila.comerciales.add(us.fl_nombre)
    }
    return m
  }, [concesionarios, ubicaciones, comercialesPorSede])

  // Filtros en cascada (zona, concesionario, sede, comercial): cada uno solo ofrece lo que
  // encaja con lo elegido en los demás. Todos se resuelven sobre las sedes.
  type Dim = 'zona' | 'concesionario' | 'sede' | 'comercial'
  const sedeCumple = (u: Ubicacion, salvo?: Dim) => {
    if (salvo !== 'zona' && zonasSel.length && !zonasSel.includes(u._fl_zona_value ?? '')) return false
    if (salvo !== 'concesionario' && concSel.length && !concSel.includes(u._fl_concesionario_value)) return false
    if (salvo !== 'sede' && sedesSel.length && !sedesSel.includes(u.fl_ubicacionid)) return false
    if (salvo !== 'comercial' && comercialesSel.length && !(comercialesPorSede.get(u.fl_ubicacionid) ?? []).some((us) => comercialesSel.includes(us.fl_usuarioappid))) return false
    return true
  }
  const conSeleccion = <T extends { value: string }>(opciones: T[], sel: string[], todas: T[]) => [
    ...opciones,
    ...todas.filter((o) => sel.includes(o.value) && !opciones.some((x) => x.value === o.value)),
  ]
  const porNombre = <T extends { label: string }>(a: T, b: T) => a.label.localeCompare(b.label, 'es')
  const opcionesZona = useMemo(() => {
    const ids = new Set(ubicaciones.filter((u) => sedeCumple(u, 'zona')).map((u) => u._fl_zona_value))
    const todas = zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))
    return conSeleccion(todas.filter((o) => ids.has(o.value)), zonasSel, todas)
  }, [ubicaciones, zonas, zonasSel, concSel, sedesSel, comercialesSel, comercialesPorSede])
  const opcionesConcesionario = useMemo(() => {
    const ids = new Set(ubicaciones.filter((u) => sedeCumple(u, 'concesionario')).map((u) => u._fl_concesionario_value))
    const todas = concesionarios.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre })).sort(porNombre)
    return conSeleccion(todas.filter((o) => ids.has(o.value)), concSel, todas)
  }, [ubicaciones, concesionarios, zonasSel, concSel, sedesSel, comercialesSel, comercialesPorSede])
  const opcionesSede = useMemo(() => {
    const todas = ubicaciones.map((u) => ({ value: u.fl_ubicacionid, label: u.fl_nombre })).sort(porNombre)
    const ids = new Set(ubicaciones.filter((u) => sedeCumple(u, 'sede')).map((u) => u.fl_ubicacionid))
    return conSeleccion(todas.filter((o) => ids.has(o.value)), sedesSel, todas)
  }, [ubicaciones, zonasSel, concSel, sedesSel, comercialesSel, comercialesPorSede])
  const opcionesComercial = useMemo(() => {
    const ids = new Set<string>()
    for (const u of ubicaciones) if (sedeCumple(u, 'comercial')) for (const us of comercialesPorSede.get(u.fl_ubicacionid) ?? []) ids.add(us.fl_usuarioappid)
    const todas = usuarios.filter((us) => us.fl_rol === RolApp.Concesionario).map((us) => ({ value: us.fl_usuarioappid, label: us.fl_nombre })).sort(porNombre)
    return conSeleccion(todas.filter((o) => ids.has(o.value)), comercialesSel, todas)
  }, [ubicaciones, usuarios, zonasSel, concSel, sedesSel, comercialesSel, comercialesPorSede])

  const hayFiltros = zonasSel.length + concSel.length + sedesSel.length + comercialesSel.length > 0
  // Con filtro de sede o de comercial se despliegan solas las sedes que encajan.
  const filtraSedes = sedesSel.length + comercialesSel.length > 0
  const sedesVisibles = useMemo(() => new Set(ubicaciones.filter((u) => sedeCumple(u)).map((u) => u.fl_ubicacionid)), [ubicaciones, zonasSel, concSel, sedesSel, comercialesSel, comercialesPorSede])

  const objetivoGeneral = useMemo(() => objetivos.find((o) => !o._fl_concesionario_value && !o._fl_ubicacion_value), [objetivos])

  // Sedes de cada concesionario, para la fila desplegable: su propio objetivo si tiene,
  // o lo que heredaría del general si no, para mostrarlo de pista.
  const sedesPorConcesionario = useMemo(() => {
    const m = new Map<string, FilaConfig[]>()
    for (const u of ubicaciones) {
      const propio = objetivos.find((o) => o._fl_ubicacion_value === u.fl_ubicacionid)
      const fila: FilaConfig = {
        id: u.fl_ubicacionid,
        nombre: u.fl_nombre,
        tipo: 'sede',
        concesionarioId: u._fl_concesionario_value,
        zonaIds: u._fl_zona_value ? [u._fl_zona_value] : [],
        zonas: u._fl_zona_value ? [nombreZona.get(u._fl_zona_value) ?? ''].filter(Boolean) : [],
        comerciales: (comercialesPorSede.get(u.fl_ubicacionid) ?? []).map((us) => us.fl_nombre),
        valorActual: propio?.fl_leadsmes,
        heredaDe: objetivoDeSede(objetivos, u.fl_ubicacionid),
      }
      m.set(u._fl_concesionario_value, [...(m.get(u._fl_concesionario_value) ?? []), fila])
    }
    for (const lista of m.values()) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return m
  }, [ubicaciones, objetivos, comercialesPorSede, nombreZona])

  const filas = useMemo<FilaConfig[]>(() => {
    const general: FilaConfig = {
      id: GENERAL,
      nombre: 'General (por defecto)',
      tipo: 'general',
      zonaIds: [],
      zonas: [],
      comerciales: [],
      valorActual: objetivoGeneral?.fl_leadsmes,
      heredaDe: undefined,
    }
    // El concesionario ya no tiene objetivo propio: muestra la suma de sus sedes, sin editar.
    const deConcesionarios: FilaConfig[] = concesionarios.map((c) => {
      const datos = datosDeConcesionario.get(c.fl_concesionarioid)
      const zonaIds = [...(datos?.zonas ?? [])]
      const sedes = sedesPorConcesionario.get(c.fl_concesionarioid) ?? []
      return {
        id: c.fl_concesionarioid,
        nombre: c.fl_nombre,
        tipo: 'concesionario',
        zonaIds,
        zonas: zonaIds.map((zid) => nombreZona.get(zid) ?? '').filter(Boolean),
        comerciales: [...(datos?.comerciales ?? [])].sort((a, b) => a.localeCompare(b, 'es')),
        valorActual: objetivoDeRed(objetivos, sedes.map((s) => ({ fl_ubicacionid: s.id }))) ?? undefined,
        heredaDe: undefined,
      }
    })
    return [general, ...deConcesionarios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))]
  }, [concesionarios, objetivos, datosDeConcesionario, nombreZona, objetivoGeneral, sedesPorConcesionario])

  // Indice de busqueda: nombre del concesionario, sus zonas y sus comerciales.
  const indice = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) m.set(f.id, normalizarTexto([f.nombre, ...f.zonas, ...f.comerciales].join(' ')))
    return m
  }, [filas])

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim()
    return filas.filter((f) => {
      if (f.tipo === 'general') return !hayFiltros
      if (hayFiltros && !(sedesPorConcesionario.get(f.id) ?? []).some((s) => sedesVisibles.has(s.id))) return false
      if (q && !coincideBusqueda(indice.get(f.id) ?? '', q)) return false
      return true
    })
  }, [filas, hayFiltros, sedesPorConcesionario, sedesVisibles, busqueda, indice])

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
      const concesionarioId = fila.tipo === 'sede' ? (fila.concesionarioId ?? null) : null
      await guardarObjetivo(objetivos, concesionarioId, fila.tipo === 'general' ? 'General' : fila.nombre, n, fila.tipo === 'sede' ? fila.id : null)
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

  // Lista plana para exportar/importar en Excel: una fila por sede, con su nombre tal cual (ya
  // lleva el del grupo, p. ej. "Syrsa-Huelva"), como en la plantilla de EBRO. El general no va
  // en el Excel (se cambia en pantalla) ni "Sin concesionario", que no tiene objetivo.
  const filasExportables = useMemo<FilaConfig[]>(() => {
    const sedes: FilaConfig[] = []
    for (const c of [...concesionarios].sort((a, b) => a.fl_nombre.localeCompare(b.fl_nombre, 'es'))) {
      if (normalizarTexto(c.fl_nombre) === normalizarTexto('Sin concesionario')) continue
      sedes.push(...(sedesPorConcesionario.get(c.fl_concesionarioid) ?? []))
    }
    return sedes
  }, [concesionarios, sedesPorConcesionario])

  const exportar = async () => {
    setExportando(true)
    try {
      const { exportarObjetivosExcel } = await import('../../lib/objetivosExcel')
      await exportarObjetivosExcel(filasExportables.map((f) => ({ nombre: f.nombre, valorActual: f.valorActual })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el Excel.')
    } finally {
      setExportando(false)
    }
  }

  const elegirArchivo = () => fileInputRef.current?.click()

  const archivoElegido = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErrorImport(null)
    try {
      const { importarObjetivosExcel } = await import('../../lib/objetivosExcel')
      const cambiosLeidos = await importarObjetivosExcel(file)
      // Por nombre de sede; también vale el formato anterior "CONCESIONARIO - Sede".
      const clave = (s: string) => normalizarTexto(s).replace(/[^a-z0-9]/g, '')
      const porNombre = new Map(filasExportables.map((f) => [clave(f.nombre), f]))
      const nombreConc = new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre]))
      for (const f of filasExportables) porNombre.set(clave(`${nombreConc.get(f.concesionarioId ?? '') ?? ''} - ${f.nombre}`), f)
      const cambios: CambioRevisado[] = []
      const noResueltos: string[] = []
      for (const c of cambiosLeidos) {
        const fila = porNombre.get(clave(c.nombre))
        if (!fila) {
          noResueltos.push(c.nombre)
          continue
        }
        if (fila.valorActual === c.nuevo) continue // sin cambios reales, no hace falta tocarlo
        cambios.push({ fila, nuevo: c.nuevo })
      }
      if (cambios.length === 0 && noResueltos.length === 0) {
        setErrorImport('No hay ningún cambio en el archivo: todos los objetivos estaban vacíos o igual que el valor actual.')
        return
      }
      setRevisionImport({ cambios, noResueltos })
    } catch (e) {
      setErrorImport(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }

  const aplicarImport = async () => {
    if (!revisionImport) return
    setAplicandoImport(true)
    try {
      for (const c of revisionImport.cambios) {
        const concesionarioId = c.fila.tipo === 'sede' ? (c.fila.concesionarioId ?? null) : null
        await guardarObjetivo(objetivos, concesionarioId, c.fila.tipo === 'general' ? 'General' : c.fila.nombre, c.nuevo, c.fila.tipo === 'sede' ? c.fila.id : null)
      }
      const nuevos = await fetchObjetivos()
      setObjetivos(nuevos)
      setRevisionImport(null)
    } catch (e) {
      setErrorImport(e instanceof Error ? e.message : 'No se pudieron aplicar todos los cambios.')
    } finally {
      setAplicandoImport(false)
    }
  }

  const toggleExpandir = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const filaRow = (fila: FilaConfig, opts?: { indentado?: boolean; conExpandir?: boolean }) => {
    const valor = valorDe(fila)
    const n = Number(valor)
    const valido = valor !== '' && !Number.isNaN(n)
    const sucio = esSucio(fila)
    const expandido = expandidos.has(fila.id)
    return (
      <tr key={fila.id} className={fila.tipo === 'general' ? 'config-fila-general' : opts?.indentado ? 'config-fila-sede' : undefined}>
        <td className="cell-strong">
          {opts?.conExpandir && (
            <button type="button" className="config-expandir" onClick={() => toggleExpandir(fila.id)} aria-label={expandido ? 'Ocultar sedes' : 'Ver sedes'}>
              <Icon name="chevronRight" size={13} className={expandido ? 'is-abierto' : undefined} />
            </button>
          )}
          {fila.tipo === 'general' && <Icon name="target" size={14} />} {fila.nombre}
        </td>
        <td>
          {fila.tipo === 'general' ? (
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
          {fila.tipo === 'concesionario' ? (
            <div className="config-input-wrap">
              <strong>{fila.valorActual ?? 0}</strong>
              <span className="flow-meta">oportunidades (suma de sedes)</span>
            </div>
          ) : (
            <>
              <div className="config-input-wrap">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="config-input"
                  value={valor}
                  placeholder={fila.tipo === 'sede' && fila.heredaDe != null ? String(fila.heredaDe) : '—'}
                  onChange={(e) => cambiarValor(fila.id, e.target.value)}
                />
                <span className="flow-meta">oportunidades</span>
              </div>
              {fila.tipo === 'sede' && fila.valorActual == null && (
                <p className="config-hereda">Hereda del general{fila.heredaDe != null ? ` (${fila.heredaDe})` : ''}</p>
              )}
            </>
          )}
        </td>
        <td className="flow-meta">{fila.tipo === 'concesionario' ? (fila.valorActual != null ? `${fila.valorActual * 3} · ${fila.valorActual * 12}` : '—') : valido ? `${n * 3} · ${n * 12}` : '—'}</td>
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
  }

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>
          <Icon name="settings" size={20} /> Configuración
        </h1>
        <div className="config-excel-acciones">
          <input ref={fileInputRef} type="file" accept=".xlsx" className="config-excel-input" onChange={archivoElegido} />
          <button type="button" className="btn-secondary btn-compacto" onClick={elegirArchivo}>
            <Icon name="file" size={14} /> Importar
          </button>
          <button type="button" className="btn-secondary btn-compacto" onClick={exportar} disabled={exportando}>
            <Icon name="download" size={14} /> {exportando ? 'Generando…' : 'Exportar a Excel'}
          </button>
        </div>
      </div>
      <p className="config-subtitulo">
        Objetivo de oportunidades nuevas al mes <strong>por sede</strong>: despliega un concesionario (flecha a la izquierda) para ponerle su número a cada
        una de sus sedes. Si una sede no tiene objetivo propio, usa el <strong>general</strong>. La fila del concesionario no se edita: muestra la suma de
        sus sedes. El mismo número se multiplica automáticamente para el trimestre (×3) y el año (×12). Para cambiar varias sedes a la vez, importa la
        plantilla de EBRO (columna DEALER con la sede y OBJETIVO con el número), o exporta a Excel, cambia los números y vuelve a importarlo.
      </p>

      {error && <p className="config-error">{error}</p>}
      {errorImport && (
        <p className="config-error">
          {errorImport} <button type="button" className="btn-link" onClick={() => setErrorImport(null)}>Cerrar</button>
        </p>
      )}

      {revisionImport && (
        <div className="config-revision-fondo" role="presentation" onClick={() => !aplicandoImport && setRevisionImport(null)}>
          <div className="config-revision" role="dialog" aria-label="Revisar cambios importados" onClick={(e) => e.stopPropagation()}>
            <h2>Revisar cambios del Excel</h2>
            {revisionImport.cambios.length === 0 ? (
              <p className="flow-meta">Ninguna fila coincide con una sede de la app.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Concesionario / Sede</th>
                    <th>Actual</th>
                    <th>Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionImport.cambios.map((c) => (
                    <tr key={c.fila.id}>
                      <td className="cell-strong">{c.fila.nombre}</td>
                      <td>{c.fila.valorActual ?? '—'}</td>
                      <td>
                        <strong>{c.nuevo}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {revisionImport.noResueltos.length > 0 && (
              <p className="config-error">

                Estas sedes del Excel no existen en la app y no se importarán (revisa que el nombre sea igual que en la app):{' '}
                {revisionImport.noResueltos.join(', ')}
              </p>
            )}
            <div className="bloque-datos-acciones">
              <button type="button" className="btn-link" onClick={() => setRevisionImport(null)} disabled={aplicandoImport}>
                Cancelar
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={aplicarImport} disabled={aplicandoImport || revisionImport.cambios.length === 0}>
                {aplicandoImport ? 'Aplicando…' : `Aplicar ${revisionImport.cambios.length} cambio${revisionImport.cambios.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar concesionario, zona o comercial…" />
          <FiltroMulti etiqueta="Zona" opciones={opcionesZona} value={zonasSel} onChange={setZonasSel} />
          <FiltroMulti etiqueta="Concesionario" opciones={opcionesConcesionario} value={concSel} onChange={setConcSel} />
          <FiltroMulti etiqueta="Sede" opciones={opcionesSede} value={sedesSel} onChange={setSedesSel} />
          <FiltroMulti etiqueta="Comercial" opciones={opcionesComercial} value={comercialesSel} onChange={setComercialesSel} />
          {(hayFiltros || busqueda.trim() !== '') && (
            <button
              type="button"
              className="lista-limpiar"
              onClick={() => {
                setZonasSel([])
                setConcSel([])
                setSedesSel([])
                setComercialesSel([])
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
            {filasFiltradas.flatMap((fila) => {
              const todasSedes = fila.tipo === 'concesionario' ? sedesPorConcesionario.get(fila.id) ?? [] : []
              const filasSede = hayFiltros ? todasSedes.filter((s) => sedesVisibles.has(s.id)) : todasSedes
              const filasFila = [filaRow(fila, { conExpandir: filasSede.length > 0 })]
              if (expandidos.has(fila.id) || filtraSedes) filasFila.push(...filasSede.map((s) => filaRow(s, { indentado: true })))
              return filasFila
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
