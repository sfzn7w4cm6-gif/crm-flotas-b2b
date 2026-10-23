import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'

export const dv = getClient(dataSourcesInfo)

// Nombre logico de la fuente de datos registrada por 'pac code add-data-source'
// (un unico conector Dataverse multi-tabla; la tabla concreta se indica en cada
// llamada via el parametro 'entityName'). Mismo patron que PeopleFlow.
const DATASOURCE = 'commondataserviceforapps'
const ORGANIZATION = 'https://org642a1b00.crm4.dynamics.com'

// Nombres de coleccion OData (logicalname + "s") de las 5 tablas de CRM Flotas B2B.
export const Tables = {
  Concesionario: 'fl_concesionarios',
  Ubicacion: 'fl_ubicacions',
  UsuarioApp: 'fl_usuarioapps',
  Lead: 'fl_leads',
  FaseHistorico: 'fl_fasehistoricos',
} as const

interface EntityItem {
  dynamicProperties?: Record<string, unknown>
}
interface EntityItemList {
  value?: EntityItem[]
  '@odata.nextLink'?: string
}

export interface ListOptions {
  select?: string
  filter?: string
  orderby?: string
  expand?: string
  top?: number
}

function unwrap<T>(items: EntityItem[] | undefined): T[] {
  return (items ?? []).map((i) => ({ ...(i as unknown as Record<string, unknown>), ...(i.dynamicProperties ?? {}) }) as T)
}

/** Lista filas de una tabla (entityName = coleccion OData, ej. 'fl_leads'). */
export async function listRecords<T>(entityName: string, options: ListOptions = {}): Promise<T[]> {
  const result = await dv.executeAsync<Record<string, unknown>, EntityItemList>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'ListRecordsWithOrganization',
      parameters: {
        organization: ORGANIZATION,
        entityName,
        prefer: 'odata.include-annotations="*"',
        accept: 'application/json',
        $select: options.select,
        $filter: options.filter,
        $orderby: options.orderby,
        $expand: options.expand,
        $top: options.top,
      },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
  return unwrap<T>(result.data?.value)
}

/** Obtiene una fila por id. Devuelve null si no existe. */
export async function getRecord<T>(entityName: string, id: string, select?: string): Promise<T | null> {
  const result = await dv.executeAsync<Record<string, unknown>, Record<string, unknown>>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'GetItemWithOrganization',
      parameters: {
        organization: ORGANIZATION,
        entityName,
        recordId: id,
        prefer: 'odata.include-annotations="*"',
        accept: 'application/json',
        $select: select,
      },
    },
  })
  if (!result.success) {
    if (isNotFound(result.error)) return null
    throw new Error(describeError(result.error))
  }
  return (result.data ?? null) as T | null
}

/** Crea una fila. Devuelve el id de la fila creada. */
export async function createRecord(entityName: string, item: Record<string, unknown>): Promise<string> {
  const result = await dv.executeAsync<Record<string, unknown>, Record<string, unknown>>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'CreateRecordWithOrganization',
      parameters: {
        organization: ORGANIZATION,
        entityName,
        prefer: 'return=representation',
        accept: 'application/json',
        item,
      },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
  const data = result.data as Record<string, unknown> | undefined
  const idKey = Object.keys(data ?? {}).find((k) => k.endsWith('id') && k === `${entityIdKeyGuess(entityName)}`)
  const id = (data && (data[idKey ?? ''] as string)) ?? (data?.['id'] as string) ?? findGuidLike(data)
  if (!id) throw new Error(`No se pudo determinar el id de la fila creada en ${entityName}.`)
  return id
}

/** Actualiza (merge) una fila existente. */
export async function updateRecord(
  entityName: string,
  id: string,
  item: Record<string, unknown>,
): Promise<void> {
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'UpdateRecordWithOrganization',
      parameters: {
        organization: ORGANIZATION,
        entityName,
        recordId: id,
        prefer: 'return=representation',
        accept: 'application/json',
        item,
      },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
}

/** Elimina una fila. */
export async function deleteRecord(entityName: string, id: string): Promise<void> {
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'DeleteRecordWithOrganization',
      parameters: { organization: ORGANIZATION, entityName, recordId: id },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
}

function entityIdKeyGuess(entityName: string): string {
  return `${entityName.replace(/s$/, '')}id`
}

function findGuidLike(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined
  const guidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith('id') && typeof v === 'string' && guidRe.test(v)) return v
  }
  return undefined
}

function describeError(error: unknown): string {
  const e = error as { message?: string; status?: number } | undefined
  return e?.message ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}` : 'Error desconocido en Dataverse.'
}

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number } | undefined
  return e?.status === 404
}
