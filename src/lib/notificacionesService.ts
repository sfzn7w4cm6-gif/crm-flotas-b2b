import { createRecord, deleteRecord, listRecords, Tables } from './dataverseClient'
import { descuentoPendiente } from './descuento'
import { normalizarCif } from './empresasService'
import { condicionesPorRevisar } from './leadsService'
import { TipoNotificacion } from './types'
import type { Empresa, Lead, Notificacion } from './types'

// Campanita del equipo de ventas: oportunidades pendientes de % de marca, condiciones nuevas
// del concesionario por revisar y empresas contactadas por mas de un concesionario a la vez. Una vez creada, una notificacion
// nunca se borra sola (queda como historico abajo de la lista si el caso se resuelve);
// solo desaparece si alguien pulsa "Quitar" (eliminarNotificacion).

const NOTIF_SELECT = 'fl_notificacionid,fl_titulo,fl_tipo,fl_cif,_fl_lead_value,_fl_empresa_value,createdon'

export async function fetchNotificaciones(): Promise<Notificacion[]> {
  return listRecords<Notificacion>(Tables.Notificacion, { select: NOTIF_SELECT, orderby: 'createdon desc' })
}

export async function eliminarNotificacion(id: string): Promise<void> {
  await deleteRecord(Tables.Notificacion, id)
}

export interface GrupoEmpresaDuplicada {
  cif: string
  empresas: Empresa[]
}

/** Agrupa por CIF normalizado las empresas contactadas por mas de un concesionario a la vez
 *  (fl_empresa es "una por CIF dentro de cada concesionario": el mismo cliente real puede
 *  tener una fila de empresa distinta por cada concesionario que lo contacto). */
export function empresasDuplicadas(empresas: Empresa[]): GrupoEmpresaDuplicada[] {
  const porCif = new Map<string, Empresa[]>()
  for (const e of empresas) {
    if (!e.fl_cif) continue
    const cif = normalizarCif(e.fl_cif)
    const lista = porCif.get(cif) ?? []
    lista.push(e)
    porCif.set(cif, lista)
  }
  const resultado: GrupoEmpresaDuplicada[] = []
  for (const [cif, lista] of porCif) {
    if (new Set(lista.map((e) => e._fl_concesionario_value)).size > 1) resultado.push({ cif, empresas: lista })
  }
  return resultado
}

/** La otra empresa (de un concesionario distinto) con el mismo CIF, si la hay. */
export function otraEmpresaDuplicada(empresa: Pick<Empresa, 'fl_empresaid' | 'fl_cif' | '_fl_concesionario_value'>, todas: Empresa[]): Empresa | undefined {
  if (!empresa.fl_cif) return undefined
  const cif = normalizarCif(empresa.fl_cif)
  return todas.find((e) => e.fl_empresaid !== empresa.fl_empresaid && e._fl_concesionario_value !== empresa._fl_concesionario_value && e.fl_cif && normalizarCif(e.fl_cif) === cif)
}

/** Crea en Dataverse las notificaciones que todavia no existen para el estado actual.
 *  No borra ni actualiza las existentes. Se llama desde Inicio/Panel KPI (equipo de ventas
 *  o administrador), nunca desde la vista de concesionario, que no tiene permiso de escritura
 *  sobre esta tabla. */
export async function sincronizarNotificaciones(leads: Lead[], empresas: Empresa[], existentes: Notificacion[], nombreConcesionario: Map<string, string>): Promise<boolean> {
  const leadsConNotif = new Set(existentes.filter((n) => n.fl_tipo === TipoNotificacion.DescuentoPendiente && n._fl_lead_value).map((n) => n._fl_lead_value))
  const cifsConNotif = new Set(existentes.filter((n) => n.fl_tipo === TipoNotificacion.EmpresaDuplicada && n.fl_cif).map((n) => n.fl_cif))

  const tareas: Promise<unknown>[] = []

  for (const l of leads) {
    if (!descuentoPendiente(l) || leadsConNotif.has(l.fl_leadid)) continue
    tareas.push(
      createRecord(Tables.Notificacion, {
        fl_titulo: `Pendiente de % de marca: ${l.fl_razonsocial} (${l.fl_numero})`,
        fl_tipo: TipoNotificacion.DescuentoPendiente,
        'fl_lead@odata.bind': `/${Tables.Lead}(${l.fl_leadid})`,
      }),
    )
  }

  // Condiciones nuevas del concesionario: una notificación por cada vez que las cambia.
  for (const l of leads) {
    if (!condicionesPorRevisar(l)) continue
    const yaAvisado = existentes.some(
      (n) => n.fl_tipo === TipoNotificacion.CondicionesPorRevisar && n._fl_lead_value === l.fl_leadid && (n.createdon ?? '') >= (l.fl_fechacondiciones ?? ''),
    )
    if (yaAvisado) continue
    tareas.push(
      createRecord(Tables.Notificacion, {
        fl_titulo: `Condiciones pendientes de revisar: ${l.fl_razonsocial} (${l.fl_numero})`,
        fl_tipo: TipoNotificacion.CondicionesPorRevisar,
        'fl_lead@odata.bind': `/${Tables.Lead}(${l.fl_leadid})`,
      }),
    )
  }

  for (const grupo of empresasDuplicadas(empresas)) {
    if (cifsConNotif.has(grupo.cif)) continue
    const nombres = grupo.empresas.map((e) => nombreConcesionario.get(e._fl_concesionario_value) ?? 'un concesionario').join(' y ')
    tareas.push(
      createRecord(Tables.Notificacion, {
        fl_titulo: `Empresa duplicada: ${grupo.empresas[0].fl_razonsocial} — ${nombres}`,
        fl_tipo: TipoNotificacion.EmpresaDuplicada,
        fl_cif: grupo.cif,
        'fl_empresa@odata.bind': `/${Tables.Empresa}(${grupo.empresas[0].fl_empresaid})`,
      }),
    )
  }

  if (tareas.length === 0) return false
  await Promise.all(tareas)
  return true
}

/** Si el caso que dio pie a esta notificacion sigue pendiente ahora mismo — se usa solo
 *  para ordenar (pendientes primero), nunca para decidir si se borra. */
export function notificacionPendiente(n: Notificacion, leadIdsPendientes: Set<string>, cifsDuplicados: Set<string>, leadIdsCondiciones: Set<string> = new Set()): boolean {
  if (n.fl_tipo === TipoNotificacion.DescuentoPendiente) return !!n._fl_lead_value && leadIdsPendientes.has(n._fl_lead_value)
  if (n.fl_tipo === TipoNotificacion.CondicionesPorRevisar) return !!n._fl_lead_value && leadIdsCondiciones.has(n._fl_lead_value)
  if (n.fl_tipo === TipoNotificacion.EmpresaDuplicada) return !!n.fl_cif && cifsDuplicados.has(n.fl_cif)
  return false
}

/** A donde navega la campanita al pulsar una notificacion. */
export function enlaceNotificacion(n: Notificacion): string | undefined {
  if ((n.fl_tipo === TipoNotificacion.DescuentoPendiente || n.fl_tipo === TipoNotificacion.CondicionesPorRevisar) && n._fl_lead_value) return `#/lead/${n._fl_lead_value}`
  if (n.fl_tipo === TipoNotificacion.EmpresaDuplicada && n._fl_empresa_value) return `#/empresa/${n._fl_empresa_value}`
  return undefined
}
