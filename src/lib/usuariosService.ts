import { listRecords, Tables } from './dataverseClient'
import type { Concesionario, Ubicacion, UsuarioApp } from './types'

export async function fetchConcesionarios(): Promise<Concesionario[]> {
  return listRecords<Concesionario>(Tables.Concesionario, {
    select: 'fl_concesionarioid,fl_nombre,fl_cif,fl_activo',
    filter: 'fl_activo eq true',
    orderby: 'fl_nombre asc',
  })
}

export async function fetchUbicaciones(): Promise<Ubicacion[]> {
  return listRecords<Ubicacion>(Tables.Ubicacion, {
    select: 'fl_ubicacionid,fl_nombre,fl_ciudad,fl_direccion,fl_areamanager,fl_activo,_fl_concesionario_value',
    filter: 'fl_activo eq true',
    orderby: 'fl_nombre asc',
  })
}

export async function fetchUsuariosApp(): Promise<UsuarioApp[]> {
  return listRecords<UsuarioApp>(Tables.UsuarioApp, {
    select: 'fl_usuarioappid,fl_nombre,fl_correo,fl_rol,fl_telefono,fl_activo,_fl_ubicacion_value',
    orderby: 'fl_nombre asc',
  })
}

/** Usuarios activos asignados a una sede: los comerciales que pueden llevar sus oportunidades. */
export async function fetchComercialesDeUbicacion(ubicacionId: string): Promise<UsuarioApp[]> {
  return listRecords<UsuarioApp>(Tables.UsuarioApp, {
    select: 'fl_usuarioappid,fl_nombre,fl_correo,fl_rol,fl_activo,_fl_ubicacion_value,_fl_systemuserid_value',
    filter: `_fl_ubicacion_value eq ${ubicacionId} and fl_activo eq true`,
    orderby: 'fl_nombre asc',
  })
}

export interface NodoDirectorio {
  concesionario: Concesionario
  ubicaciones: {
    ubicacion: Ubicacion
    usuarios: UsuarioApp[]
  }[]
}

/** Arbol Concesionario -> Ubicaciones -> Usuarios asignados, para la pantalla Info. */
export async function fetchDirectorio(): Promise<{ arbol: NodoDirectorio[]; equipoVentas: UsuarioApp[] }> {
  const [concesionarios, ubicaciones, usuarios] = await Promise.all([
    fetchConcesionarios(),
    fetchUbicaciones(),
    fetchUsuariosApp(),
  ])

  const arbol: NodoDirectorio[] = concesionarios.map((c) => ({
    concesionario: c,
    ubicaciones: ubicaciones
      .filter((u) => u._fl_concesionario_value === c.fl_concesionarioid)
      .map((u) => ({
        ubicacion: u,
        usuarios: usuarios.filter((us) => us._fl_ubicacion_value === u.fl_ubicacionid),
      })),
  }))

  const equipoVentas = usuarios.filter((u) => !u._fl_ubicacion_value)

  return { arbol, equipoVentas }
}
