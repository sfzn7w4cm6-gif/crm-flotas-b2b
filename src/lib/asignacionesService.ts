import { createRecord, deleteRecord, listRecords, relateRecords, Tables, unrelateRecords, updateRecord } from './dataverseClient'
import { RolApp } from './types'
import type { Asignacion, Concesionario, Ubicacion, UsuarioApp } from './types'

// Qué sedes lleva cada usuario (fl_asignacion). Una asignación sin sede es el concesionario
// entero, incluidas las sedes que se abran después. El objetivo va por concesionario
// (fl_objetivo, pantalla Configuración), no aquí.

const ASIGNACION_SELECT = 'fl_asignacionid,fl_nombre,_fl_usuarioapp_value,_fl_concesionario_value,_fl_ubicacion_value'
const USUARIO_SELECT = 'fl_usuarioappid,fl_nombre,fl_correo,fl_rol,fl_telefono,fl_activo,_fl_ubicacion_value,_fl_systemuserid_value'

/** Asignaciones de un usuario, o de todos si no se indica. */
export async function fetchAsignaciones(usuarioId?: string): Promise<Asignacion[]> {
  return listRecords<Asignacion>(Tables.Asignacion, {
    select: ASIGNACION_SELECT,
    filter: usuarioId ? `_fl_usuarioapp_value eq ${usuarioId}` : undefined,
  })
}

export function cubreSede(a: Asignacion, sede: Ubicacion): boolean {
  return a._fl_ubicacion_value ? a._fl_ubicacion_value === sede.fl_ubicacionid : a._fl_concesionario_value === sede._fl_concesionario_value
}

/** Las sedes que cubren unas asignaciones, sin repetir y por nombre. */
export function sedesDeAsignaciones(asignaciones: Asignacion[], ubicaciones: Ubicacion[]): Ubicacion[] {
  return ubicaciones.filter((s) => asignaciones.some((a) => cubreSede(a, s))).sort((a, b) => a.fl_nombre.localeCompare(b.fl_nombre))
}

/** Usuarios activos que llevan esa sede (o su concesionario entero): los que pueden llevar sus oportunidades. */
export async function fetchComercialesDeSede(ubicacionId: string, concesionarioId: string): Promise<UsuarioApp[]> {
  const asignaciones = await listRecords<Asignacion>(Tables.Asignacion, {
    select: ASIGNACION_SELECT,
    filter: `_fl_ubicacion_value eq ${ubicacionId} or (_fl_concesionario_value eq ${concesionarioId} and _fl_ubicacion_value eq null)`,
  })
  const ids = [...new Set(asignaciones.map((a) => a._fl_usuarioapp_value))]
  if (!ids.length) return []
  return listRecords<UsuarioApp>(Tables.UsuarioApp, {
    select: USUARIO_SELECT,
    filter: `fl_activo eq true and (${ids.map((id) => `fl_usuarioappid eq ${id}`).join(' or ')})`,
    orderby: 'fl_nombre asc',
  })
}

// ---------------------------------------------------------------- administración de usuarios

/** Una fila de acceso tal como se edita en la pantalla: concesionario entero (sin sede) o una sede. */
export interface AccesoEditado {
  concesionarioId: string
  ubicacionId?: string
}

const claveAcceso = (concesionarioId: string, ubicacionId?: string) => `${concesionarioId}|${ubicacionId ?? ''}`

export interface DatosUsuario {
  nombre: string
  correo: string
  rol: RolApp
  telefono?: string
  activo: boolean
}

const ROL_SEGURIDAD: Record<RolApp, string> = {
  [RolApp.Concesionario]: 'CRM Flotas B2B - Concesionario',
  [RolApp.EquipoVentas]: 'CRM Flotas B2B - Equipo de Ventas',
  [RolApp.Administrador]: 'CRM Flotas B2B - Administrador',
}

/** La cuenta del entorno con ese correo, si ya la tiene (la crea Microsoft al darle acceso al entorno). */
export async function buscarCuentaEntorno(correo: string): Promise<string | null> {
  const c = correo.trim().replace(/'/g, "''")
  const filas = await listRecords<{ systemuserid: string }>('systemusers', {
    select: 'systemuserid',
    filter: `isdisabled eq false and (internalemailaddress eq '${c}' or domainname eq '${c}')`,
    top: 1,
  })
  return filas[0]?.systemuserid ?? null
}

/** Deja a la cuenta con el rol de seguridad de la app que le toca, y sin los otros de la app. */
async function ajustarRolSeguridad(systemUserId: string, rol: RolApp): Promise<void> {
  const roles = await listRecords<{ roleid: string; name: string; _businessunitid_value: string }>('roles', {
    select: 'roleid,name,_businessunitid_value',
    filter: "startswith(name,'CRM Flotas B2B - ')",
  })
  const deLaCuenta = await listRecords<{ systemuserid: string; systemuserroles_association?: { roleid: string }[] }>('systemusers', {
    select: 'systemuserid',
    filter: `systemuserid eq ${systemUserId}`,
    expand: 'systemuserroles_association($select=roleid)',
  })
  const tiene = new Set((deLaCuenta[0]?.systemuserroles_association ?? []).map((r) => r.roleid))
  for (const r of roles) {
    const toca = r.name === ROL_SEGURIDAD[rol]
    if (toca && !tiene.has(r.roleid)) await relateRecords('systemusers', systemUserId, 'systemuserroles_association', 'roles', r.roleid)
    if (!toca && tiene.has(r.roleid)) await unrelateRecords('systemusers', systemUserId, 'systemuserroles_association', 'roles', r.roleid)
  }
}

/**
 * Guarda un usuario y sus accesos: crea, cambia o borra sus asignaciones, lo mete o lo saca de los
 * equipos de los concesionarios (para que vea sus empresas) y le pone el rol de seguridad. Lo que
 * no se pueda completar (por ejemplo, si aún no tiene cuenta en el entorno) vuelve como aviso.
 */
export async function guardarUsuario(
  existente: UsuarioApp | null,
  datos: DatosUsuario,
  asignacionesActuales: Asignacion[],
  accesos: AccesoEditado[],
  concesionarios: Concesionario[],
  ubicaciones: Ubicacion[],
): Promise<{ usuarioId: string; avisos: string[] }> {
  const avisos: string[] = []
  const nombreConc = new Map(concesionarios.map((c) => [c.fl_concesionarioid, c]))
  const nombreSede = new Map(ubicaciones.map((s) => [s.fl_ubicacionid, s]))

  // Cuenta del entorno: se vuelve a buscar por si se la han dado después de crear el usuario.
  let systemUserId = existente?._fl_systemuserid_value ?? null
  if (!systemUserId || existente?.fl_correo !== datos.correo) {
    systemUserId = await buscarCuentaEntorno(datos.correo).catch(() => null)
  }

  // La sede principal (la que sale por defecto en el alta) tiene que ser una de las suyas.
  const sedes = ubicaciones.filter((s) =>
    accesos.some((a) => (a.ubicacionId ? a.ubicacionId === s.fl_ubicacionid : a.concesionarioId === s._fl_concesionario_value)),
  )
  const principalActual = existente?._fl_ubicacion_value
  const principal = sedes.some((s) => s.fl_ubicacionid === principalActual) ? principalActual : sedes[0]?.fl_ubicacionid

  const campos: Record<string, unknown> = {
    fl_nombre: datos.nombre.trim(),
    fl_correo: datos.correo.trim(),
    fl_rol: datos.rol,
    fl_telefono: datos.telefono?.trim() || null,
    fl_activo: datos.activo,
    'fl_ubicacion@odata.bind': principal ? `/${Tables.Ubicacion}(${principal})` : null,
    'fl_systemuserid@odata.bind': systemUserId ? `/systemusers(${systemUserId})` : null,
  }
  let usuarioId: string
  if (existente) {
    usuarioId = existente.fl_usuarioappid
    await updateRecord(Tables.UsuarioApp, usuarioId, campos)
  } else {
    // Al crear no se manda un enlace vacío: Dataverse no admite desvincular lo que aún no existe.
    for (const k of Object.keys(campos)) if (campos[k] === null) delete campos[k]
    usuarioId = await createRecord(Tables.UsuarioApp, campos)
  }

  // Asignaciones: se comparan por concesionario + sede.
  const actuales = new Map(asignacionesActuales.map((a) => [claveAcceso(a._fl_concesionario_value, a._fl_ubicacion_value), a]))
  const nuevas = new Map(accesos.map((a) => [claveAcceso(a.concesionarioId, a.ubicacionId), a]))
  for (const [clave, a] of actuales) {
    if (!nuevas.has(clave)) await deleteRecord(Tables.Asignacion, a.fl_asignacionid)
  }
  for (const [clave, a] of nuevas) {
    if (actuales.has(clave)) continue
    const conc = nombreConc.get(a.concesionarioId)?.fl_nombre ?? ''
    const sede = a.ubicacionId ? nombreSede.get(a.ubicacionId)?.fl_nombre : 'Concesionario entero'
    await createRecord(Tables.Asignacion, {
      fl_nombre: `${datos.nombre.trim()} - ${conc} - ${sede}`,
      'fl_usuarioapp@odata.bind': `/${Tables.UsuarioApp}(${usuarioId})`,
      'fl_concesionario@odata.bind': `/${Tables.Concesionario}(${a.concesionarioId})`,
      ...(a.ubicacionId ? { 'fl_ubicacion@odata.bind': `/${Tables.Ubicacion}(${a.ubicacionId})` } : {}),
    })
  }

  if (!systemUserId) {
    avisos.push(
      `${datos.nombre} aún no tiene cuenta en el entorno: sus accesos quedan guardados y se completarán ` +
        'la próxima vez que guardes este usuario después de que se la den.',
    )
    return { usuarioId, avisos }
  }

  // Equipos: miembro de los de los concesionarios donde tiene alguna sede (si está activo). Se
  // vuelve a añadir aunque ya lo fuera, para que guardar otra vez arregle lo que faltase.
  const antes = new Set(asignacionesActuales.map((a) => a._fl_concesionario_value))
  const despues = new Set(datos.activo ? accesos.map((a) => a.concesionarioId) : [])
  for (const c of concesionarios) {
    const equipo = c._fl_equipo_value
    if (!equipo) continue
    const id = c.fl_concesionarioid
    try {
      if (despues.has(id)) await relateRecords('teams', equipo, 'teammembership_association', 'systemusers', systemUserId)
      else if (antes.has(id)) await unrelateRecords('teams', equipo, 'teammembership_association', 'systemusers', systemUserId)
    } catch (e) {
      // Si ya era miembro (o ya no lo era) no hay nada que hacer.
      const m = e instanceof Error ? e.message : ''
      if (!/duplicate|already|ya existe|does not exist|no existe/i.test(m)) avisos.push(`No se pudo actualizar su acceso a las empresas de ${c.fl_nombre}: ${m}`)
    }
  }

  // Las cuentas de administración se gestionan a mano: pueden tener varios roles a propósito.
  if (datos.rol !== RolApp.Administrador) {
    try {
      await ajustarRolSeguridad(systemUserId, datos.rol)
    } catch (e) {
      avisos.push(`No se pudo ajustar su rol de seguridad: ${e instanceof Error ? e.message : 'error desconocido'}`)
    }
  }

  return { usuarioId, avisos }
}
