import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/Icon'
import { Buscador, FiltroMulti } from '../../components/filtros/Filtros'
import {
  fetchAsignaciones,
  guardarUsuario,
  type AccesoEditado,
} from '../../lib/asignacionesService'
import { fetchZonas } from '../../lib/catalogosService'
import { coincideBusqueda } from '../../lib/filtrosLeads'
import { normalizarTexto } from '../../lib/formato'
import { fetchConcesionarios, fetchUbicaciones, fetchUsuariosApp } from '../../lib/usuariosService'
import { RolApp, RolAppLabel } from '../../lib/types'
import type { Asignacion, Concesionario, Ubicacion, UsuarioApp, Zona } from '../../lib/types'
import { emailValido } from '../../lib/validators'
import './Usuarios.css'

/**
 * Administración: quién entra en la app y qué lleva cada uno (concesionarios enteros o sedes
 * sueltas). Los objetivos van por concesionario, en Configuración.
 */
export function Usuarios() {
  const { usuario: yo, reload } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioApp[]>([])
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [zonas, setZonas] = useState<Zona[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  // id del usuario abierto, 'nuevo' para dar de alta o null si no hay ninguno.
  const [abierto, setAbierto] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  const cargar = useCallback(
    () =>
      Promise.all([fetchUsuariosApp(), fetchAsignaciones(), fetchConcesionarios(), fetchUbicaciones(), fetchZonas()])
        .then(([us, as, cs, ubs, zs]) => {
          setUsuarios(us)
          setAsignaciones(as)
          setConcesionarios(cs)
          setUbicaciones(ubs)
          setZonas(zs)
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios.'))
        .finally(() => setCargando(false)),
    [],
  )
  useEffect(() => {
    Promise.resolve().then(cargar)
  }, [cargar])

  const nombreConc = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])
  const nombreSede = useMemo(() => new Map(ubicaciones.map((s) => [s.fl_ubicacionid, s.fl_nombre])), [ubicaciones])
  const asignacionesDe = useCallback((id: string) => asignaciones.filter((a) => a._fl_usuarioapp_value === id), [asignaciones])

  /** "M Automoción · Barcelona, Madrid" o "M Automoción (entero)", para la lista. */
  const resumen = useCallback(
    (id: string) => {
      const porConc = new Map<string, string[]>()
      for (const a of asignacionesDe(id)) {
        const lista = porConc.get(a._fl_concesionario_value) ?? []
        lista.push(a._fl_ubicacion_value ? (nombreSede.get(a._fl_ubicacion_value) ?? '') : 'entero')
        porConc.set(a._fl_concesionario_value, lista)
      }
      return [...porConc]
        .map(([c, sedes]) => (sedes.includes('entero') ? `${nombreConc.get(c)} (entero)` : `${nombreConc.get(c)} · ${sedes.length} ${sedes.length === 1 ? 'sede' : 'sedes'}`))
        .join(' · ')
    },
    [asignacionesDe, nombreConc, nombreSede],
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim()
    if (!q) return usuarios
    return usuarios.filter((u) => coincideBusqueda(normalizarTexto([u.fl_nombre, u.fl_correo, RolAppLabel[u.fl_rol], resumen(u.fl_usuarioappid)].join(' ')), q))
  }, [usuarios, busqueda, resumen])

  if (cargando) return <p className="wizard-loading">Cargando…</p>
  if (error) return <p className="wizard-error">{error}</p>

  const usuarioAbierto = abierto && abierto !== 'nuevo' ? (usuarios.find((u) => u.fl_usuarioappid === abierto) ?? null) : null

  return (
    <div className="usuarios">
      <div className="page-header">
        <h1>Usuarios y accesos</h1>
      </div>

      {avisos.length > 0 && (
        <div className="usuarios-avisos" role="status">
          {avisos.map((a) => (
            <p key={a}>{a}</p>
          ))}
          <button type="button" className="btn-link" onClick={() => setAvisos([])}>
            Entendido
          </button>
        </div>
      )}

      <div className="usuarios-layout">
        <aside className="usuarios-lista">
          <div className="usuarios-lista-barra">
            <Buscador value={busqueda} onChange={setBusqueda} placeholder="Buscar usuario o sede…" />
            <button type="button" className="btn-primary btn-compacto" onClick={() => setAbierto('nuevo')}>
              <Icon name="add" size={14} /> Nuevo
            </button>
          </div>
          <ul>
            {filtrados.map((u) => (
              <li key={u.fl_usuarioappid}>
                <button
                  type="button"
                  className={`usuarios-fila${abierto === u.fl_usuarioappid ? ' is-activo' : ''}${u.fl_activo ? '' : ' is-inactivo'}`}
                  onClick={() => setAbierto(u.fl_usuarioappid)}
                >
                  <span className="usuarios-fila-nombre">
                    {u.fl_nombre}
                    {!u.fl_activo && <span className="usuarios-etiqueta">Inactivo</span>}
                  </span>
                  <span className="usuarios-fila-meta">
                    {RolAppLabel[u.fl_rol]}
                    {u.fl_rol === RolApp.EquipoVentas ? ' · toda la red' : resumen(u.fl_usuarioappid) ? ` · ${resumen(u.fl_usuarioappid)}` : ' · sin sedes'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="usuarios-editor">
          {abierto ? (
            <EditorUsuario
              // Al cambiar de usuario se empieza de cero.
              key={abierto}
              usuario={usuarioAbierto}
              asignaciones={usuarioAbierto ? asignacionesDe(usuarioAbierto.fl_usuarioappid) : []}
              usuarios={usuarios}
              concesionarios={concesionarios}
              ubicaciones={ubicaciones}
              zonas={zonas}
              esYo={usuarioAbierto?.fl_usuarioappid === yo?.fl_usuarioappid}
              onGuardado={async (id, avs) => {
                setAvisos(avs)
                await cargar()
                setAbierto(id)
                // Si se cambia uno mismo, se recargan sus sedes en toda la app.
                if (id === yo?.fl_usuarioappid) reload()
              }}
            />
          ) : (
            <p className="usuarios-vacio">Elige un usuario de la lista o da de alta uno nuevo.</p>
          )}
        </section>
      </div>
    </div>
  )
}

const claveAcceso = (a: AccesoEditado) => `${a.concesionarioId}|${a.ubicacionId ?? ''}`

function EditorUsuario({
  usuario,
  asignaciones,
  usuarios,
  concesionarios,
  ubicaciones,
  zonas,
  esYo,
  onGuardado,
}: {
  usuario: UsuarioApp | null
  asignaciones: Asignacion[]
  usuarios: UsuarioApp[]
  concesionarios: Concesionario[]
  ubicaciones: Ubicacion[]
  zonas: Zona[]
  esYo: boolean
  onGuardado: (usuarioId: string, avisos: string[]) => Promise<void>
}) {
  const [nombre, setNombre] = useState(usuario?.fl_nombre ?? '')
  const [correo, setCorreo] = useState(usuario?.fl_correo ?? '')
  const [rol, setRol] = useState<RolApp>(usuario?.fl_rol ?? RolApp.Concesionario)
  const [telefono, setTelefono] = useState(usuario?.fl_telefono ?? '')
  const [activo, setActivo] = useState(usuario?.fl_activo ?? true)
  const [accesos, setAccesos] = useState<AccesoEditado[]>(() =>
    asignaciones.map((a) => ({ concesionarioId: a._fl_concesionario_value, ubicacionId: a._fl_ubicacion_value })),
  )
  const [buscar, setBuscar] = useState('')
  const [zonasSel, setZonasSel] = useState<string[]>([])
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(asignaciones.filter((a) => a._fl_ubicacion_value).map((a) => a._fl_concesionario_value)))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sedesDe = useMemo(() => {
    const m = new Map<string, Ubicacion[]>()
    for (const s of ubicaciones) m.set(s._fl_concesionario_value, [...(m.get(s._fl_concesionario_value) ?? []), s])
    return m
  }, [ubicaciones])
  const nombreConc = useMemo(() => new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre])), [concesionarios])
  const nombreSede = useMemo(() => new Map(ubicaciones.map((s) => [s.fl_ubicacionid, s.fl_nombre])), [ubicaciones])

  const entero = (c: string) => accesos.some((a) => a.concesionarioId === c && !a.ubicacionId)
  const tieneSede = (s: Ubicacion) => accesos.some((a) => a.ubicacionId === s.fl_ubicacionid)
  const marcadasEn = (c: string) => accesos.filter((a) => a.concesionarioId === c).length

  const alternarEntero = (c: string) =>
    setAccesos((prev) =>
      // Marcar el concesionario entero sustituye a sus sedes sueltas: ya van incluidas.
      entero(c) ? prev.filter((a) => a.concesionarioId !== c) : [...prev.filter((a) => a.concesionarioId !== c), { concesionarioId: c }],
    )
  const alternarSede = (s: Ubicacion) =>
    setAccesos((prev) =>
      tieneSede(s)
        ? prev.filter((a) => a.ubicacionId !== s.fl_ubicacionid)
        : [...prev, { concesionarioId: s._fl_concesionario_value, ubicacionId: s.fl_ubicacionid }],
    )
  const quitar = (a: AccesoEditado) => setAccesos((prev) => prev.filter((x) => claveAcceso(x) !== claveAcceso(a)))
  const alternarAbierto = (c: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  // Árbol filtrado por zona y por texto (nombre del concesionario o de alguna de sus sedes).
  const q = buscar.trim()
  const arbol = useMemo(
    () =>
      concesionarios
        .map((c) => {
          const sedes = (sedesDe.get(c.fl_concesionarioid) ?? []).filter((s) => !zonasSel.length || (s._fl_zona_value && zonasSel.includes(s._fl_zona_value)))
          const concCoincide = !q || coincideBusqueda(normalizarTexto(c.fl_nombre), q)
          const visibles = concCoincide ? sedes : sedes.filter((s) => coincideBusqueda(normalizarTexto(`${s.fl_nombre} ${s.fl_ciudad ?? ''}`), q))
          return { c, sedes: visibles, todas: sedesDe.get(c.fl_concesionarioid) ?? [] }
        })
        .filter((n) => n.sedes.length > 0),
    [concesionarios, sedesDe, zonasSel, q],
  )

  const rolSinSedes = rol === RolApp.EquipoVentas
  const correoRepetido = usuarios.some((u) => u.fl_usuarioappid !== usuario?.fl_usuarioappid && u.fl_correo.toLowerCase() === correo.trim().toLowerCase())
  const faltan = !nombre.trim()
    ? 'Falta el nombre.'
    : !emailValido(correo.trim())
      ? 'El correo no es válido.'
      : correoRepetido
        ? 'Ya hay un usuario con ese correo.'
        : rol === RolApp.Concesionario && accesos.length === 0
          ? 'Un comercial tiene que llevar al menos una sede o un concesionario.'
          : null

  const guardar = async () => {
    if (faltan) return
    setGuardando(true)
    setError(null)
    try {
      const { usuarioId, avisos } = await guardarUsuario(
        usuario,
        { nombre, correo, rol, telefono, activo },
        asignaciones,
        rolSinSedes ? [] : accesos,
        concesionarios,
        ubicaciones,
      )
      await onGuardado(usuarioId, avisos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario.')
      setGuardando(false)
    }
  }

  const accesosOrdenados = [...accesos].sort((a, b) =>
    `${nombreConc.get(a.concesionarioId)} ${a.ubicacionId ? nombreSede.get(a.ubicacionId) : ''}`.localeCompare(
      `${nombreConc.get(b.concesionarioId)} ${b.ubicacionId ? nombreSede.get(b.ubicacionId) : ''}`,
    ),
  )

  return (
    <div className="editor-usuario">
      <h2>{usuario ? usuario.fl_nombre : 'Nuevo usuario'}</h2>
      <p className="editor-cuenta">
        {usuario?._fl_systemuserid_value
          ? 'Tiene cuenta en el entorno: puede entrar en la app.'
          : 'Aún no tiene cuenta en el entorno. Pide que se la den y vuelve a guardar este usuario para que pueda ver las empresas de sus concesionarios.'}
      </p>

      <div className="editor-datos">
        <div className="field">
          <label htmlFor="u-nombre">Nombre</label>
          <input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="u-correo">Correo con el que entra</label>
          <input id="u-correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="u-rol">Tipo de usuario</label>
          <select id="u-rol" value={rol} disabled={esYo} onChange={(e) => setRol(Number(e.target.value) as RolApp)}>
            {Object.entries(RolAppLabel).map(([v, l]) => (
              <option key={v} value={v}>
                {v === String(RolApp.Concesionario) ? 'Comercial (concesionario)' : l}
              </option>
            ))}
          </select>
          {esYo && <span className="field-help">No puedes cambiar tu propio tipo de usuario.</span>}
        </div>
        <div className="field">
          <label htmlFor="u-tel">Teléfono</label>
          <input id="u-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <label className="editor-activo">
          <input type="checkbox" checked={activo} disabled={esYo} onChange={(e) => setActivo(e.target.checked)} />
          Activo (si no, no puede entrar)
        </label>
      </div>

      {rolSinSedes ? (
        <p className="editor-nota">El equipo de ventas ve toda la red: no lleva sedes.</p>
      ) : (
        <>
          <h3>Lo que lleva</h3>
          {accesosOrdenados.length === 0 ? (
            <p className="editor-nota">Aún nada. Márcalo abajo: un concesionario entero o sedes sueltas.</p>
          ) : (
            <table className="editor-accesos">
              <thead>
                <tr>
                  <th>Concesionario</th>
                  <th>Sede</th>
                  <th aria-label="Quitar" />
                </tr>
              </thead>
              <tbody>
                {accesosOrdenados.map((a) => (
                  <tr key={claveAcceso(a)}>
                    <td>{nombreConc.get(a.concesionarioId)}</td>
                    <td>{a.ubicacionId ? nombreSede.get(a.ubicacionId) : <em>Concesionario entero</em>}</td>
                    <td>
                      <button type="button" className="editor-quitar" onClick={() => quitar(a)} aria-label="Quitar">
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="editor-arbol-barra">
            <Buscador value={buscar} onChange={setBuscar} placeholder="Buscar concesionario o sede…" />
            <FiltroMulti etiqueta="Zona" opciones={zonas.map((z) => ({ value: z.fl_zonaid, label: z.fl_nombre }))} value={zonasSel} onChange={setZonasSel} />
          </div>
          <ul className="editor-arbol">
            {arbol.map(({ c, sedes, todas }) => {
              const id = c.fl_concesionarioid
              const esEntero = entero(id)
              const abierto = abiertos.has(id) || !!q
              const marcadas = marcadasEn(id)
              return (
                <li key={id}>
                  <div className="arbol-conc">
                    <button type="button" className="arbol-toggle" onClick={() => alternarAbierto(id)} aria-label={abierto ? 'Plegar' : 'Desplegar'}>
                      <Icon name={abierto ? 'chevronDown' : 'chevronRight'} size={14} />
                    </button>
                    <span className="arbol-nombre">{c.fl_nombre}</span>
                    <span className="arbol-cuenta">
                      {esEntero ? 'entero' : marcadas ? `${marcadas} de ${todas.length}` : `${todas.length} ${todas.length === 1 ? 'sede' : 'sedes'}`}
                    </span>
                    <label className="arbol-entero">
                      <input type="checkbox" checked={esEntero} onChange={() => alternarEntero(id)} />
                      Concesionario entero
                    </label>
                  </div>
                  {abierto && (
                    <ul className="arbol-sedes">
                      {sedes.map((s) => (
                        <li key={s.fl_ubicacionid}>
                          <label className={esEntero ? 'is-incluida' : ''}>
                            <input type="checkbox" checked={esEntero || tieneSede(s)} disabled={esEntero} onChange={() => alternarSede(s)} />
                            {s.fl_nombre}
                            {s.fl_ciudad && <span className="arbol-ciudad">{s.fl_ciudad}</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
            {arbol.length === 0 && <li className="editor-nota">Ningún concesionario ni sede coincide.</li>}
          </ul>
        </>
      )}

      <div className="editor-pie">
        {faltan && <span className="field-help">{faltan}</span>}
        {error && <span className="field-error">{error}</span>}
        <button type="button" className="btn-primary" disabled={!!faltan || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Dar de alta'}
        </button>
      </div>
    </div>
  )
}
