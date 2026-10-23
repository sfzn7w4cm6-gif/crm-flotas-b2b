import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { fetchDirectorio, type NodoDirectorio } from '../../lib/usuariosService'
import { RolAppLabel } from '../../lib/types'
import type { UsuarioApp } from '../../lib/types'
import './Info.css'

export function Info() {
  const [arbol, setArbol] = useState<NodoDirectorio[]>([])
  const [equipoVentas, setEquipoVentas] = useState<UsuarioApp[]>([])
  const [cargando, setCargando] = useState(true)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDirectorio().then(({ arbol, equipoVentas }) => {
      setArbol(arbol)
      setEquipoVentas(equipoVentas)
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

  if (cargando) return <p className="wizard-loading">Cargando…</p>

  return (
    <div>
      <div className="page-header">
        <h1>Info · Estructura de la red</h1>
      </div>

      <div className="directorio-tree">
        {arbol.map((nodo) => (
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

      {equipoVentas.length > 0 && (
        <div className="detalle-seccion" style={{ marginTop: 20 }}>
          <div className="detalle-seccion-header">
            <h2>Equipo de Ventas / Administración</h2>
          </div>
          <ul className="directorio-usuarios">
            {equipoVentas.map((us) => (
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
