import { createRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import { EstadoTarea } from './types'
import type { Objetivo, Tarea, TipoTarea } from './types'

const TAREA_SELECT = 'fl_tareaid,fl_titulo,fl_tipo,fl_fecha,fl_estado,fl_notas,fl_resultado,fl_enlace,createdon,_fl_lead_value'

/** Tareas del usuario conectado (la seguridad Basic ya limita a las suyas; el equipo de ventas ve todas). */
export async function fetchMisTareas(): Promise<Tarea[]> {
  return listRecords<Tarea>(Tables.Tarea, { select: TAREA_SELECT, orderby: 'fl_fecha asc' })
}

export async function fetchTareasDeLead(leadId: string): Promise<Tarea[]> {
  return listRecords<Tarea>(Tables.Tarea, {
    select: TAREA_SELECT,
    filter: `_fl_lead_value eq ${leadId}`,
    orderby: 'fl_fecha asc',
  })
}

export interface NuevaTareaInput {
  titulo: string
  tipo: TipoTarea
  fecha: string // ISO
  notas?: string
  enlace?: string
  adjuntos?: File[]
}

/** Crea la tarea y devuelve su id. Los adjuntos los sube quien llama (ver adjuntosService). */
export async function crearTarea(leadId: string, input: NuevaTareaInput): Promise<string> {
  return createRecord(Tables.Tarea, {
    fl_titulo: input.titulo,
    fl_tipo: input.tipo,
    fl_fecha: input.fecha,
    fl_estado: EstadoTarea.Pendiente,
    fl_notas: input.notas ?? '',
    fl_enlace: input.enlace ?? '',
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
  })
}

export async function cambiarEstadoTarea(tareaId: string, estado: EstadoTarea): Promise<void> {
  await updateRecord(Tables.Tarea, tareaId, { fl_estado: estado })
}

/** Cómo fue la tarea; vacío para borrarlo. */
export async function guardarResultadoTarea(tareaId: string, resultado: string): Promise<void> {
  await updateRecord(Tables.Tarea, tareaId, { fl_resultado: resultado })
}

export function tareaAbierta(t: Tarea): boolean {
  return t.fl_estado === EstadoTarea.Pendiente || t.fl_estado === EstadoTarea.EnCurso
}

/** Todas las filas de objetivo (la general y las de cada concesionario). */
export async function fetchObjetivos(): Promise<Objetivo[]> {
  return listRecords<Objetivo>(Tables.Objetivo, { select: 'fl_objetivoid,fl_nombre,fl_leadsmes,_fl_concesionario_value' })
}

/** Objetivo de la red: la suma del de cada concesionario (el suyo propio o, si no tiene, el general). */
export function objetivoDeRed(filas: Objetivo[], concesionarioIds: string[]): number | null {
  const general = filas.find((f) => !f._fl_concesionario_value)?.fl_leadsmes
  let total = 0
  let alguno = false
  for (const id of concesionarioIds) {
    const v = filas.find((f) => f._fl_concesionario_value === id)?.fl_leadsmes ?? general
    if (v != null) {
      total += v
      alguno = true
    }
  }
  return alguno ? total : null
}

/** Objetivo de leads al mes: el propio del concesionario si existe, si no el
 *  general (fila sin concesionario). null si no hay ninguno definido. */
export async function fetchObjetivoLeadsMes(concesionarioId?: string): Promise<number | null> {
  const filas = await listRecords<Objetivo>(Tables.Objetivo, {
    select: 'fl_objetivoid,fl_nombre,fl_leadsmes,_fl_concesionario_value',
  })
  const propio = concesionarioId ? filas.find((f) => f._fl_concesionario_value === concesionarioId) : undefined
  const general = filas.find((f) => !f._fl_concesionario_value)
  return (propio ?? general)?.fl_leadsmes ?? null
}

/** Importe de venta por lead. Se pide aparte de LEAD_SELECT para que el resto
 *  de pantallas no falle si la columna aun no existe en el entorno: en ese
 *  caso devuelve null. */
export async function fetchImportesVenta(leadId?: string): Promise<Map<string, number> | null> {
  try {
    const filas = await listRecords<{ fl_leadid: string; fl_importeventa?: number }>(Tables.Lead, {
      select: 'fl_leadid,fl_importeventa',
      filter: leadId ? `fl_leadid eq ${leadId}` : 'fl_importeventa ne null',
    })
    return new Map(filas.filter((f) => f.fl_importeventa != null).map((f) => [f.fl_leadid, Number(f.fl_importeventa)]))
  } catch {
    return null
  }
}

export async function guardarImporteVenta(leadId: string, importe: number | null): Promise<void> {
  await updateRecord(Tables.Lead, leadId, { fl_importeventa: importe })
}

export function inicioDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function formatoFechaTarea(iso: string): string {
  const d = new Date(iso)
  const hoy = inicioDia(new Date())
  const dia = inicioDia(d)
  const diff = Math.round((dia.getTime() - hoy.getTime()) / 86400000)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (diff === 0) return `Hoy, ${hora}`
  if (diff === 1) return `Mañana, ${hora}`
  if (diff === -1) return `Ayer, ${hora}`
  return `${d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}, ${hora}`
}

export function tareaVencida(t: Tarea): boolean {
  return (
    (t.fl_estado === EstadoTarea.Pendiente || t.fl_estado === EstadoTarea.EnCurso) &&
    new Date(t.fl_fecha).getTime() < Date.now()
  )
}
