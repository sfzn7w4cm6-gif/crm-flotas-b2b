import { createRecord, deleteRecord, getRecord, listRecords, Tables } from './dataverseClient'
import type { Adjunto } from './types'

// Adjuntos de tareas y notas, guardados como notas nativas de Dataverse (annotation).
// Ver scripts/dataverse/22-adjuntos-enlace-notas-tarea.ps1.

/** Límite por archivo: el tamaño máximo de subida por defecto de Dataverse. */
export const MAX_ADJUNTO_MB = 5

export type DuenoAdjunto = { tipo: 'tarea' | 'nota'; id: string }

const ENLACE: Record<DuenoAdjunto['tipo'], { lookup: string; tabla: string }> = {
  tarea: { lookup: 'objectid_fl_tarea', tabla: Tables.Tarea },
  nota: { lookup: 'objectid_fl_nota', tabla: Tables.Nota },
}

const ADJUNTO_SELECT = 'annotationid,filename,filesize,mimetype,createdon,_objectid_value,_ownerid_value'

/** Adjuntos de varias tareas o notas a la vez, agrupados por su dueño. */
export async function fetchAdjuntos(ids: string[]): Promise<Map<string, Adjunto[]>> {
  const unicos = [...new Set(ids.filter(Boolean))]
  const bloques: string[][] = []
  for (let i = 0; i < unicos.length; i += 40) bloques.push(unicos.slice(i, i + 40))
  const filas = (
    await Promise.all(
      bloques.map((b) =>
        listRecords<Adjunto>(Tables.Adjunto, {
          select: ADJUNTO_SELECT,
          filter: `isdocument eq true and (${b.map((id) => `_objectid_value eq ${id}`).join(' or ')})`,
          orderby: 'createdon asc',
        }),
      ),
    )
  ).flat()
  const m = new Map<string, Adjunto[]>()
  for (const a of filas) m.set(a._objectid_value, [...(m.get(a._objectid_value) ?? []), a])
  return m
}

function leerBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(new Error(`No se pudo leer ${archivo.name}.`))
    r.readAsDataURL(archivo)
  })
}

export function validarAdjunto(archivo: File): string | null {
  return archivo.size > MAX_ADJUNTO_MB * 1024 * 1024 ? `${archivo.name} pesa más de ${MAX_ADJUNTO_MB} MB.` : null
}

export async function subirAdjuntos(dueno: DuenoAdjunto, archivos: File[]): Promise<void> {
  const { lookup, tabla } = ENLACE[dueno.tipo]
  for (const archivo of archivos) {
    await createRecord(Tables.Adjunto, {
      subject: archivo.name,
      filename: archivo.name,
      mimetype: archivo.type || 'application/octet-stream',
      documentbody: await leerBase64(archivo),
      [`${lookup}@odata.bind`]: `/${tabla}(${dueno.id})`,
    })
  }
}

/** Descarga el archivo: el contenido solo se pide aquí, no al listar. */
export async function descargarAdjunto(a: Adjunto): Promise<void> {
  const fila = await getRecord<{ documentbody?: string }>(Tables.Adjunto, a.annotationid, 'documentbody')
  if (!fila?.documentbody) throw new Error('El archivo está vacío o ya no existe.')
  const bytes = Uint8Array.from(atob(fila.documentbody), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: a.mimetype || 'application/octet-stream' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = a.filename
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function borrarAdjunto(id: string): Promise<void> {
  await deleteRecord(Tables.Adjunto, id)
}

export function tamanoArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
