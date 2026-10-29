import { createRecord, deleteRecord, listRecords, Tables } from './dataverseClient'
import { subirAdjuntos } from './adjuntosService'
import type { Nota, UsuarioApp } from './types'

const NOTA_SELECT = 'fl_notaid,fl_texto,createdon,_fl_lead_value,_fl_tarea_value,_fl_autor_value'

/** Todas las notas de la oportunidad: las generales y las de sus tareas (_fl_tarea_value). */
export async function fetchNotas(leadId: string): Promise<Nota[]> {
  return listRecords<Nota>(Tables.Nota, {
    select: NOTA_SELECT,
    filter: `_fl_lead_value eq ${leadId}`,
    orderby: 'createdon desc',
  })
}

/** Texto de todas las notas visibles, para que el buscador de las listas también encuentre en ellas. */
export async function fetchTextosNotas(): Promise<Pick<Nota, 'fl_texto' | '_fl_lead_value'>[]> {
  return listRecords<Nota>(Tables.Nota, { select: 'fl_texto,_fl_lead_value' })
}

/** Crea la nota y devuelve su id (para colgarle los adjuntos). Con tareaId, es una nota de esa tarea. */
export async function crearNota(leadId: string, texto: string, autor: UsuarioApp, tareaId?: string): Promise<string> {
  return createRecord(Tables.Nota, {
    // El título es solo para verla en Dataverse; la app muestra el texto completo.
    fl_titulo: texto.length > 100 ? `${texto.slice(0, 97)}…` : texto || 'Adjunto',
    fl_texto: texto,
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
    'fl_autor@odata.bind': `/${Tables.UsuarioApp}(${autor.fl_usuarioappid})`,
    ...(tareaId ? { 'fl_tarea@odata.bind': `/${Tables.Tarea}(${tareaId})` } : {}),
  })
}

export async function borrarNota(notaId: string): Promise<void> {
  await deleteRecord(Tables.Nota, notaId)
}

export function autorNota(n: Nota): string {
  return n['_fl_autor_value@OData.Community.Display.V1.FormattedValue'] ?? ''
}

/** Nota con sus archivos: primero la nota y después los adjuntos colgados de ella. */
export async function crearNotaConAdjuntos(leadId: string, texto: string, archivos: File[], autor: UsuarioApp, tareaId?: string): Promise<string> {
  const id = await crearNota(leadId, texto, autor, tareaId)
  if (archivos.length) await subirAdjuntos({ tipo: 'nota', id }, archivos)
  return id
}
