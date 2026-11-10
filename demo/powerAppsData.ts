// Sustituye a '@microsoft/power-apps/data' en el modo demo: responde desde la base en memoria.
import { actualizar, borrar, crear, listar, obtener } from './store'

type Info = Record<string, { primaryKey?: string }>
type Resultado<T> = { success: boolean; data?: T; error?: { message: string; status?: number } }

const pausa = () => new Promise((r) => setTimeout(r, 120))
const ok = async <T,>(data: T): Promise<Resultado<T>> => {
  await pausa()
  return { success: true, data }
}

export function getClient(dataSourcesInfo: Info) {
  const pks: Record<string, string> = {}
  for (const [k, v] of Object.entries(dataSourcesInfo)) if (v.primaryKey) pks[k] = v.primaryKey

  return {
    retrieveMultipleRecordsAsync: (tabla: string, op: { filter?: string; orderBy?: string[]; top?: number } = {}) =>
      ok(listar(tabla, op)),
    retrieveRecordAsync: async (tabla: string, id: string) => {
      const f = obtener(tabla, id, pks)
      await pausa()
      return f ? { success: true, data: f } : { success: false, error: { message: 'No encontrado', status: 404 } }
    },
    createRecordAsync: (tabla: string, item: Record<string, unknown>) => ok(crear(tabla, item, pks)),
    updateRecordAsync: (tabla: string, id: string, cambios: Record<string, unknown>) => ok(actualizar(tabla, id, cambios, pks)),
    deleteRecordAsync: async (tabla: string, id: string) => {
      borrar(tabla, id, pks)
      return ok(undefined)
    },
    // Operaciones del conector (systemusers, roles, equipos…): en la demo no hay nada que leer ni hacer.
    executeAsync: async (op: { connectorOperation?: { operationName?: string; parameters?: { entityName?: string; $filter?: string; $top?: number } } }) => {
      const c = op.connectorOperation
      if (c?.operationName?.startsWith('ListRecords') && c.parameters?.entityName?.startsWith('fl_')) {
        return ok({ value: listar(c.parameters.entityName, { filter: c.parameters.$filter, top: c.parameters.$top }) })
      }
      return ok({ value: [] })
    },
  }
}
