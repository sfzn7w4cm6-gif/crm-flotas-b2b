import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import { fetchDirectorio, type NodoDirectorio } from '../../lib/usuariosService'
import { fetchZonas } from '../../lib/catalogosService'
import { coincideBusqueda } from '../../lib/filtrosLeads'
import { normalizarTexto } from '../../lib/formato'
import { RolAppLabel } from '../../lib/types'
import type { UsuarioApp, Zona } from '../../lib/types'
import './Info.css'

export function Info() {
  const [arbol, setArbol] = useState<NodoDirectorio[]>([])
  const [equipoVentas, setEquipoVentas] = useState<UsuarioApp[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [cargando, setCargando] = useState(true)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const [zonasSel, setZonasSel] = useState<string[]>([])
  const [concesionariosSel, setConcesionariosSel] = useState<string[]>([])
  const [ubicacionesSel, setUbicacionesSel] = useState<string[]>([])
  const [comercialesSel, setComercialesSel] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    Promise.all([fetchDirectorio(), fetchZonas()]).then(([{ arbol, equipoVentas }, zonasData]) => {
      setArbol(arbol)
      setEquipoVentas(equipoVentas)
      setZonas(zonasData)
      setAbiertos(new Set(arbol.map((n) => n.concesionario.fl_concesionarioid)))
      setCargando(false)
    })
  }, [])

  const toggle = (id: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const todasLasUbicaciones = useMemo(() => arbol.flatMap((n) => n.ubicaciones.map((u) => u.ubicacion)), [arbol])
  const todosLosUsuarios = useMemo(
    () => [...arbol.flatMap((n) => n.ubicaciones.flatMap((u) => u.usuarios)), ...equipoVentas],
    [arbol, equipoVentas],
  )

  const ubicacionesDeZona = useMemo(
    () => (zonasSel.length ? todasLasUbicaciones.filter((u) => u._fl_zona_value && zonasSel.includes(u._fl_zona_value)) : todasLasUbicaciones),
    [todasLasUbicaciones, zonasSel],
  )
  const concesionarioIdsDeZona = useMemo(() => new Set(ubicacionesDeZona.map((u) => u._fl_concesionario_value)), [ubicacionesDeZona])
  const concesionariosDisponibles = useMemo(
    () => (zonasSel.length ? arbol.map((n) => n.concesionario).filter((c) => concesionarioIdsDeZona.has(c.fl_concesionarioid)) : arbol.map((n) => n.concesionario)),
    [arbol, zonasSel, concesionarioIdsDeZona],
  )
  const ubicacionesDisponibles = useMemo(
    () => (concesionariosSel.length ? ubicacionesDeZona.filter((u) => concesionariosSel.includes(u._fl_concesionario_value)) : ubicacionesDeZona),
    [ubicacionesDeZona, concesionariosSel],
  )
  const opcionesComercial = useMemo(
    () =>
      [...todosLosUsuarios]
        .sort((a, b) => a.fl_nombre.localeCompare(b.fl_nombre, 'es'))
        .map((u) => ({ value: u.fl_usuarioappid, label: u.fl_nombre })),
    [todosLosUsuarios],
  )

  // Nombre de concesionario/ubicacion de cada sede, para que el buscador tambien encuentre por ahi.
  const infoDeUbicacion = useMemo(() => {
    const m = new Map<string, { concesionario: string; ubicacion: string }>()
    for (const n of arbol) for (const u of n.ubicaciones) m.set(u.ubicacion.fl_ubicacionid, { concesionario: n.concesionario.fl_nombre, ubicacion: u.ubicacion.fl_nombre })
    return m
  }, [arbol])

  // Todo lo que se ve de una persona (nombre, correo, concesionario, sede), normalizado para buscar.
  const indice = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of todosLosUsuarios) {
      const loc = u._fl_ubicacion_value ? infoDeUbicacion.get(u._fl_ubicacion_value) : undefined
      m.set(u.fl_usuarioappid, normalizarTexto([u.fl_nombre, u.fl_correo, loc?.concesionario, loc?.ubicacion].filter(Boolean).join(' ')))
    }
    return m
  }, [todosLosUsuarios, infoDeUbicacion])

  const estructuraFiltroActivo = Boolean(zonasSel.length || concesionariosSel.length || ubicacionesSel.length)
  const personaFiltroActivo = Boolean(comercialesSel.length || busqueda.trim())
  const hayFiltros = estructuraFiltroActivo || personaFiltroActivo

  const arbolFiltrado = useMemo(() => {
    const q = busqueda.trim()
    return arbol
      .filter((n) => !concesionariosSel.length || concesionariosSel.includes(n.concesionario.fl_concesionarioid))
      .filter((n) => !zonasSel.length || n.ubicaciones.some((u) => u.ubicacion._fl_zona_value && zonasSel.includes(u.ubicacion._fl_zona_value)))
      .map((n) => ({
        ...n,
        ubicaciones: n.ubicaciones
          .filter((u) => !zonasSel.length || (u.ubicacion._fl_zona_value && zonasSel.includes(u.ubicacion._fl_zona_value)))
          .filter((u) => !ubicacionesSel.length || ubicacionesSel.includes(u.ubicacion.fl_ubicacionid))
          .map((u) => ({
            ...u,
            usuarios: u.usuarios.filter(
              (us) =>
                (!comercialesSel.length || comercialesSel.includes(us.fl_usuarioappid)) &&
                (!q || coincideBusqueda(indice.get(us.fl_usuarioappid) ?? '', q)),
            ),
          }))
          .filter((u) => !personaFiltroActivo || u.usuarios.length > 0),
      }))
      .filter((n) => n.ubicaciones.length > 0 || !(estructuraFiltroActivo || personaFiltroActivo))
  }, [arbol, zonasSel, concesionariosSel, ubicacionesSel, comercialesSel, busqueda, indice, estructuraFiltroActivo, personaFiltroActivo])

  const equipoVentasFiltrado = useMemo(() => {
    if (estructuraFiltroActivo) return []
    const q = busqueda.trim()
    return equipoVentas.filter(
      (us) =>
        (!comercialesSel.length || comercialesSel.includes(us.fl_usuarioappid)) &&
        (!q || coincideBusqueda(indice.get(us.fl_usuarioappid) ?? '', q)),
    )
  }, [equipoVentas, estructuraFiltroActivo, comercialesSel, busqueda, indice])

  const limpiarFiltros = () => {
    setZonasSel([])
    setConcesionariosSel([])
    setUbicacionesSel([])
    setComercialesSel([])
    setBusqueda('')
  }

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>Info · Estructura de la red</h1>
      </div>

      <div className="lista-barra">
        <div className="lista-filtros">
          <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar en todo (nombre, correo, concesionario…)" />
          <FiltroMulti
            etiqueta="Zona"
            opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))}
            value={zonasSel}
            onChange={(v) => {
              setZonasSel(v)
              setConcesionariosSel([])
              setUbicacionesSel([])
            }}
          />
          <FiltroMulti
            etiqueta="Concesionario"
            opciones={concesionariosDisponibles.map((c) => ({ value: c.fl_concesionarioid, label: c.fl_nombre }))}
            value={concesionariosSel}
            onChange={(v) => {
              setConcesionariosSel(v)
              setUbicacionesSel([])
            }}
          />
          <FiltroMulti
            etiqueta="Ubicación"
            opciones={ubicacionesDisponibles.map((u) => ({ value: u.fl_ubicacionid, label: u.fl_nombre }))}
            value={ubicacionesSel}
            onChange={setUbicacionesSel}
          />
          <FiltroMulti etiqueta="Comercial" opciones={opcionesComercial} value={comercialesSel} onChange={setComercialesSel} />
          {hayFiltros && (
            <button type="button" className="lista-limpiar" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {arbolFiltrado.length === 0 && equipoVentasFiltrado.length === 0 && (
        <div className="empty-state">
          <Icon name="filter" size={26} />
          <p>No hay nadie que coincida con estos filtros.</p>
        </div>
      )}

      <div className="directorio-tree">
        {arbolFiltrado.map((nodo) => (
          <div key={nodo.concesionario.fl_concesionarioid} className="directorio-concesionario">
            <button type="button" className="directorio-toggle" onClick={() => toggle(nodo.concesionario.fl_concesionarioid)}>
              <Icon name={abiertos.has(nodo.concesionario.fl_concesionarioid) ? 'chevronDown' : 'chevronRight'} size={14} />
              <Icon name="building" size={16} />
              <span className="directorio-nombre">{nodo.concesionario.fl_nombre}</span>
              <span className="directorio-count">{nodo.ubicaciones.length} ubicaciones</span>
            </button>

            {abiertos.has(nodo.concesionario.fl_concesionarioid) && (
              <div className="directorio-ubicaciones">
                {nodo.ubicaciones.map((u) => (
                  <div key={u.ubicacion.fl_ubicacionid} className="directorio-ubicacion">
                    <div className="directorio-ubicacion-header">
                      <Icon name="car" size={14} />
                      <span>{u.ubicacion.fl_nombre}</span>
                      {u.ubicacion.fl_ciudad && <span className="flow-meta">{u.ubicacion.fl_ciudad}</span>}
                      {u.ubicacion.fl_areamanager && <span className="flow-meta">· {u.ubicacion.fl_areamanager}</span>}
                    </div>
                    {u.usuarios.length === 0 ? (
                      <p className="directorio-sin-usuarios">Sin usuario asignado</p>
                    ) : (
                      <ul className="directorio-usuarios">
                        {u.usuarios.map((us) => (
                          <li key={us.fl_usuarioappid}>
                            <Icon name="user" size={13} />
                            {us.fl_nombre} <span className="flow-meta">{us.fl_correo}</span>
                            {!us.fl_activo && <span className="riesgo-badge">Inactivo</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {equipoVentasFiltrado.length > 0 && (
        <div className="detalle-seccion" style={{ marginTop: 20 }}>
          <div className="detalle-seccion-header">
            <h2>Equipo de Ventas / Administración</h2>
          </div>
          <ul className="directorio-usuarios">
            {equipoVentasFiltrado.map((us) => (
              <li key={us.fl_usuarioappid}>
                <Icon name="user" size={13} />
                {us.fl_nombre} <span className="flow-meta">{us.fl_correo} · {RolAppLabel[us.fl_rol]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
