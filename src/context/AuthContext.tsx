import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import type { IContext } from '@microsoft/power-apps/app'
import { listRecords, Tables } from '../lib/dataverseClient'
import type { UsuarioApp, Ubicacion, Concesionario } from '../lib/types'
import { RolApp } from '../lib/types'

const VIEW_AS_KEY = 'crmflotas.viewAsRole'

interface AuthState {
  loading: boolean
  error: string | null
  appContext: IContext | null
  usuario: UsuarioApp | null
  ubicacion: Ubicacion | null
  concesionario: Concesionario | null
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
            `Tu usuario (${correo}) no está registrado en CRM Flotas B2B. Contacta a un administrador para que te dé de alta.`,
          )
          setLoading(false)
          return
        }
        const u = usuarios[0]
        setUsuario(u)

        if (u._fl_ubicacion_value) {
          const ubicaciones = await listRecords<Ubicacion>(Tables.Ubicacion, {
            filter: `fl_ubicacionid eq ${u._fl_ubicacion_value}`,
            top: 1,
          })
          if (cancelled) return
          const ubi = ubicaciones[0] ?? null
          setUbicacion(ubi)
          if (ubi) {
            const concesionarios = await listRecords<Concesionario>(Tables.Concesionario, {
              filter: `fl_concesionarioid eq ${ubi._fl_concesionario_value}`,
              top: 1,
            })
            if (cancelled) return
            setConcesionario(concesionarios[0] ?? null)
          }
        }

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
