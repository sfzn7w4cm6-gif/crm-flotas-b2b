import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import type { IContext } from '@microsoft/power-apps/app'
import { listRecords, Tables } from '../lib/dataverseClient'
import { fetchAsignaciones, sedesDeAsignaciones } from '../lib/asignacionesService'
import type { Asignacion, UsuarioApp, Ubicacion, Concesionario } from '../lib/types'
import { RolApp } from '../lib/types'

const VIEW_AS_KEY = 'crmflotas.viewAsRole'

interface AuthState {
  loading: boolean
  error: string | null
  appContext: IContext | null
  usuario: UsuarioApp | null
  /** Sede principal: la que sale por defecto al dar de alta. */
  ubicacion: Ubicacion | null
  /** Concesionario de la sede principal. */
  concesionario: Concesionario | null
  /** Lo que lleva el usuario (concesionarios enteros o sedes sueltas). */
  asignaciones: Asignacion[]
  /** Todas las sedes que lleva, y sus concesionarios. */
  sedes: Ubicacion[]
  concesionarios: Concesionario[]
  rol: RolApp | null
  viewAsRole: RolApp | null
  effectiveRol: RolApp | null
  isAdmin: boolean
  setViewAsRole: (role: RolApp | null) => void
  reload: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appContext, setAppContext] = useState<IContext | null>(null)
  const [usuario, setUsuario] = useState<UsuarioApp | null>(null)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [concesionario, setConcesionario] = useState<Concesionario | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [sedes, setSedes] = useState<Ubicacion[]>([])
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [viewAsRole, setViewAsRoleState] = useState<RolApp | null>(
    () => {
      const raw = sessionStorage.getItem(VIEW_AS_KEY)
      return raw ? (Number(raw) as RolApp) : null
    },
  )
  const [reloadTick, setReloadTick] = useState(0)

  const setViewAsRole = (role: RolApp | null) => {
    setViewAsRoleState(role)
    if (role !== null) sessionStorage.setItem(VIEW_AS_KEY, String(role))
    else sessionStorage.removeItem(VIEW_AS_KEY)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const ctx = await getContext()
        if (cancelled) return
        setAppContext(ctx)

        const correo = ctx.user.userPrincipalName
        if (!correo) {
          setError('No se pudo determinar tu correo de usuario conectado.')
          setLoading(false)
          return
        }

        const usuarios = await listRecords<UsuarioApp>(Tables.UsuarioApp, {
          filter: `fl_correo eq '${correo}'`,
          top: 1,
        })
        if (cancelled) return
        if (usuarios.length === 0) {
          setError(
            `Tu usuario (${correo}) no está registrado en Ebro Business. Contacta a un administrador para que te dé de alta.`,
          )
          setLoading(false)
          return
        }
        const u = usuarios[0]
        setUsuario(u)

        // Sedes que lleva: las de sus asignaciones. Sin asignaciones (usuarios antiguos), su sede principal.
        const asigs = await fetchAsignaciones(u.fl_usuarioappid)
        if (cancelled) return
        let principal: Ubicacion | null = null
        if (u._fl_ubicacion_value) {
          principal = (await listRecords<Ubicacion>(Tables.Ubicacion, { filter: `fl_ubicacionid eq ${u._fl_ubicacion_value}`, top: 1 }))[0] ?? null
          if (cancelled) return
        }
        const concIds = [...new Set([...asigs.map((a) => a._fl_concesionario_value), ...(principal ? [principal._fl_concesionario_value] : [])])]
        const [ubis, concs] = concIds.length
          ? await Promise.all([
              listRecords<Ubicacion>(Tables.Ubicacion, {
                filter: `fl_activo eq true and (${concIds.map((id) => `_fl_concesionario_value eq ${id}`).join(' or ')})`,
                orderby: 'fl_nombre asc',
              }),
              listRecords<Concesionario>(Tables.Concesionario, {
                filter: concIds.map((id) => `fl_concesionarioid eq ${id}`).join(' or '),
                orderby: 'fl_nombre asc',
              }),
            ])
          : [[], []]
        if (cancelled) return
        const suyas = asigs.length ? sedesDeAsignaciones(asigs, ubis) : principal ? [principal] : []
        const sedePrincipal = suyas.find((x) => x.fl_ubicacionid === principal?.fl_ubicacionid) ?? suyas[0] ?? null
        setAsignaciones(asigs)
        setSedes(suyas)
        setConcesionarios(concs.filter((c) => suyas.some((x) => x._fl_concesionario_value === c.fl_concesionarioid)))
        setUbicacion(sedePrincipal)
        setConcesionario(concs.find((c) => c.fl_concesionarioid === sedePrincipal?._fl_concesionario_value) ?? null)

        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error desconocido al cargar tu perfil.')
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadTick])

  const rol = usuario?.fl_rol ?? null
  const isAdmin = rol === RolApp.Administrador
  const effectiveRol = useMemo(() => {
    if (isAdmin && viewAsRole !== null) return viewAsRole
    return rol
  }, [isAdmin, viewAsRole, rol])

  const value: AuthState = {
    loading,
    error,
    appContext,
    usuario,
    ubicacion,
    concesionario,
    asignaciones,
    sedes,
    concesionarios,
    rol,
    viewAsRole,
    effectiveRol,
    isAdmin,
    setViewAsRole,
    reload: () => setReloadTick((t) => t + 1),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
