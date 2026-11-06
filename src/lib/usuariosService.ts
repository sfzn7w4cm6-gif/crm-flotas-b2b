import { listRecords, Tables } from './dataverseClient'
import { cubreSede, fetchAsignaciones } from './asignacionesService'
import type { Concesionario, Ubicacion, UsuarioApp } from './types'

export async function fetchConcesionarios(): Promise<Concesionario[]> {
  return listRecords<Concesionario>(Tables.Concesionario, {
    select: 'fl_concesionarioid,fl_nombre,fl_activo,_fl_equipo_value',
    filter: 'fl_activo eq true',
    orderby: 'fl_nombre asc',
  })
}

export async function fetchUbicaciones(): Promise<Ubicacion[]> {
  return listRecords<Ubicacion>(Tables.Ubicacion, {
    select: 'fl_ubicacionid,fl_nombre,fl_ciudad,fl_direccion,fl_areamanager,fl_activo,_fl_concesionario_value,_fl_zona_value',
    filter: 'fl_activo eq true',
    orderby: 'fl_nombre asc',
  })
}

export async function fetchUsuariosApp(): Promise<UsuarioApp[]> {
  return listRecords<UsuarioApp>(Tables.UsuarioApp, {
    select: 'fl_usuarioappid,fl_nombre,fl_correo,fl_rol,fl_telefono,fl_activo,_fl_ubicacion_value,_fl_systemuserid_value',
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

/** Arbol Concesionario -> Ubicaciones -> Usuarios que las llevan, para la pantalla Info. */
export async function fetchDirectorio(): Promise<{ arbol: NodoDirectorio[]; equipoVentas: UsuarioApp[] }> {
  const [concesionarios, ubicaciones, usuarios, asignaciones] = await Promise.all([
    fetchConcesionarios(),
    fetchUbicaciones(),
    fetchUsuariosApp(),
    fetchAsignaciones(),
  ])

  const arbol: NodoDirectorio[] = concesionarios.map((c) => ({
    concesionario: c,
    ubicaciones: ubicaciones
      .filter((u) => u._fl_concesionario_value === c.fl_concesionarioid)
      .map((u) => ({
        ubicacion: u,
        // Un usuario sale en cada sede que lleva (o en todas las de su concesionario entero).
        usuarios: usuarios.filter((us) =>
          asignaciones.some((a) => a._fl_usuarioapp_value === us.fl_usuarioappid && cubreSede(a, u)),
        ),
      })),
  }))

  const equipoVentas = usuarios.filter((u) => !asignaciones.some((a) => a._fl_usuarioapp_value === u.fl_usuarioappid))

  return { arbol, equipoVentas }
}
