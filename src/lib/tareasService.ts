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

/** Todas las filas de objetivo (la general y las de cada sede). El objetivo del
 *  concesionario entero ya no se guarda aparte: se calcula sumando sus sedes
 *  (ver objetivoDeRed), así que una fila con concesionario pero sin sede queda
 *  sin efecto si queda alguna suelta de antes de este cambio. */
export async function fetchObjetivos(): Promise<Objetivo[]> {
  return listRecords<Objetivo>(Tables.Objetivo, { select: 'fl_objetivoid,fl_nombre,fl_leadsmes,_fl_concesionario_value,_fl_ubicacion_value' })
}

/** El objetivo que aplica a una sede: el suyo propio si tiene, si no el general. */
export function objetivoDeSede(filas: Objetivo[], ubicacionId: string): number | undefined {
  const general = filas.find((f) => !f._fl_concesionario_value && !f._fl_ubicacion_value)?.fl_leadsmes
  const propio = filas.find((f) => f._fl_ubicacion_value === ubicacionId)?.fl_leadsmes
  return propio ?? general
}

/** Objetivo de un grupo de sedes (toda la red, un concesionario o lo que se filtre): la suma
 *  del objetivo efectivo de cada una de esas sedes. */
export function objetivoDeRed(filas: Objetivo[], sedes: { fl_ubicacionid: string }[]): number | null {
  let total = 0
  let alguno = false
  for (const s of sedes) {
    const v = objetivoDeSede(filas, s.fl_ubicacionid)
    if (v != null) {
      total += v
      alguno = true
    }
  }
  return alguno ? total : null
}

/** Crea o actualiza el objetivo de leads al mes: el general (ubicacionId nulo) o
 *  el de una sede concreta. Si ya existe una fila para ese destino, la actualiza;
 *  si no, la crea. */
export async function guardarObjetivo(filas: Objetivo[], concesionarioId: string | null, nombre: string, leadsMes: number, ubicacionId: string | null): Promise<void> {
  const existente = ubicacionId ? filas.find((f) => f._fl_ubicacion_value === ubicacionId) : filas.find((f) => !f._fl_concesionario_value && !f._fl_ubicacion_value)
  if (existente) {
    await updateRecord(Tables.Objetivo, existente.fl_objetivoid, { fl_leadsmes: leadsMes })
    return
  }
  await createRecord(Tables.Objetivo, {
    fl_nombre: nombre,
    fl_leadsmes: leadsMes,
    ...(concesionarioId ? { 'fl_concesionario@odata.bind': `/${Tables.Concesionario}(${concesionarioId})` } : {}),
    ...(ubicacionId ? { 'fl_ubicacion@odata.bind': `/${Tables.Ubicacion}(${ubicacionId})` } : {}),
  })
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
