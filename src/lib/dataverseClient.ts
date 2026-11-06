import { getContext } from '@microsoft/power-apps/app'
import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'

export const dv = getClient(dataSourcesInfo)

// Nombre logico de la fuente de datos registrada por 'pac code add-data-source'
// (un unico conector Dataverse multi-tabla; la tabla concreta se indica en cada
// llamada via el parametro 'entityName'). Mismo patron que PeopleFlow.
const DATASOURCE = 'commondataserviceforapps'

// El org de Dataverse al que la app pide los datos NO se deduce solo porque el
// conector sea "Microsoft Dataverse": hay que decirselo en cada llamada via el
// parametro 'organization' (probado el 06/11/2026: la variante sin organizacion,
// "ListRecords" a secas, falla con "Invalid organization URL 'null' provided" —
// esta conexion no tiene ninguna organizacion por defecto, asi que la variante
// "...WithOrganization" es obligatoria, no opcional). Se resuelve en tiempo real
// con getContext().app (dataverseOrgUrl, si el host ya lo da) y, si no, por el
// id del entorno — asi funciona igual publicada en cualquier entorno sin tocar
// nada al compilar.
const ORGANIZACION_POR_ENTORNO: Record<string, string> = {
  '192d0a93-f34e-e64a-a9c3-6558e2f66156': 'https://org642a1b00.crm4.dynamics.com', // desarrollo
  '6adf3534-66c7-e4a1-95c7-045d1b228f44': 'https://org9d11094c.crm4.dynamics.com', // produccion
}

let organizacionPromise: Promise<string> | null = null
function resolverOrganizacion(): Promise<string> {
  if (!organizacionPromise) {
    organizacionPromise = getContext().then((ctx) => {
      const org = ctx.app.dataverseOrgUrl || ORGANIZACION_POR_ENTORNO[ctx.app.environmentId]
      if (!org) throw new Error(`No se reconoce el entorno de Power Platform (${ctx.app.environmentId}): falta su Dataverse en ORGANIZACION_POR_ENTORNO.`)
      return org.replace(/\/+$/, '')
    })
  }
  return organizacionPromise
}

/** Texto para la pantalla de error: a que Dataverse se llama y con que identidad. */
export async function diagnosticoConexion(): Promise<string> {
  try {
    const ctx = await getContext()
    const org = await resolverOrganizacion().catch(() => '(sin resolver)')
    let orgsConexion: string
    try {
      const r = await dv.executeAsync<Record<string, unknown>, unknown>({
        connectorOperation: { tableName: DATASOURCE, operationName: 'GetOrganizations', parameters: {} },
      })
      orgsConexion = r.success ? JSON.stringify(r.data).slice(0, 600) : `error: ${describeError(r.error)}`
    } catch (e) {
      orgsConexion = `excepción: ${e instanceof Error ? e.message : String(e)}`
    }
    return [
      `Entornos que ve la conexión: ${orgsConexion}`,
      `Dataverse usado: ${org}`,
      `dataverseOrgUrl del host: ${ctx.app.dataverseOrgUrl || '(vacío)'}`,
      `Entorno: ${ctx.app.environmentId}`,
      `Usuario: ${ctx.user.userPrincipalName || '(vacío)'}`,
      `systemUserId: ${ctx.user.systemUserId || '(vacío)'}`,
      `objectId: ${ctx.user.objectId || '(vacío)'}`,
      `tenantId: ${ctx.user.tenantId || '(vacío)'}`,
    ].join('\n')
  } catch (e) {
    return `Sin diagnóstico: ${e instanceof Error ? e.message : String(e)}`
  }
}

// Nombres de coleccion OData (logicalname + "s") de las tablas de CRM Flotas B2B.
export const Tables = {
  Concesionario: 'fl_concesionarios',
  Ubicacion: 'fl_ubicacions',
  UsuarioApp: 'fl_usuarioapps',
  Lead: 'fl_leads',
  FaseHistorico: 'fl_fasehistoricos',
  Tarea: 'fl_tareas',
  Objetivo: 'fl_objetivos',
  Zona: 'fl_zonas',
  Modelo: 'fl_modelos',
  Empresa: 'fl_empresas',
  LineaOportunidad: 'fl_lineaoportunidads',
  Nota: 'fl_notas',
  Adjunto: 'annotations',
  Asignacion: 'fl_asignacions',
  Notificacion: 'fl_notificacions',
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

// Tablas dadas de alta como origen nativo de Dataverse ('pac code add-data-source -a dataverse'):
// van directas al Dataverse del entorno con la identidad del usuario, sin pasar por el
// conector. El conector rechaza a los invitados B2B con 0x80072560 aunque esten bien dados de alta.
function esNativa(entityName: string): boolean {
  const info = (dataSourcesInfo as Record<string, { dataSourceType?: string }>)[entityName]
  return info?.dataSourceType === 'Dataverse'
}

function lista(valor?: string): string[] | undefined {
  return valor ? valor.split(',').map((s) => s.trim()).filter(Boolean) : undefined
}

/** Lista filas de una tabla (entityName = coleccion OData, ej. 'fl_leads'). */
export async function listRecords<T>(entityName: string, options: ListOptions = {}): Promise<T[]> {
  if (esNativa(entityName) && !options.expand) {
    const r = await dv.retrieveMultipleRecordsAsync<T>(entityName, {
      select: lista(options.select),
      filter: options.filter,
      orderBy: lista(options.orderby),
      top: options.top,
    })
    if (!r.success) throw new Error(describeError(r.error))
    return r.data ?? []
  }
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, EntityItemList>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'ListRecordsWithOrganization',
      parameters: {
        organization,
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
  if (esNativa(entityName)) {
    const r = await dv.retrieveRecordAsync<T>(entityName, id, { select: lista(select) })
    if (!r.success) {
      if (isNotFound(r.error)) return null
      throw new Error(describeError(r.error))
    }
    return r.data ?? null
  }
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, Record<string, unknown>>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'GetItemWithOrganization',
      parameters: {
        organization,
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
  if (esNativa(entityName)) {
    const r = await dv.createRecordAsync<Record<string, unknown>, Record<string, unknown>>(entityName, item)
    if (!r.success) throw new Error(describeError(r.error))
    const pk = (dataSourcesInfo as Record<string, { primaryKey?: string }>)[entityName]?.primaryKey ?? ''
    const id = (r.data?.[pk] as string | undefined) ?? findGuidLike(r.data)
    if (!id) throw new Error(`No se pudo determinar el id de la fila creada en ${entityName}.`)
    return id
  }
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, Record<string, unknown>>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'CreateRecordWithOrganization',
      parameters: {
        organization,
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
  if (esNativa(entityName)) {
    const r = await dv.updateRecordAsync<Record<string, unknown>, unknown>(entityName, id, item)
    if (!r.success) throw new Error(describeError(r.error))
    return
  }
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'UpdateRecordWithOrganization',
      parameters: {
        organization,
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
  if (esNativa(entityName)) {
    const r = await dv.deleteRecordAsync(entityName, id)
    if (!r.success) throw new Error(describeError(r.error))
    return
  }
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'DeleteRecordWithOrganization',
      parameters: { organization, entityName, recordId: id },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
}

/**
 * Relaciona dos filas por una relación N:N o 1:N (ej. un usuario como miembro de un equipo:
 * relateRecords('teams', equipoId, 'teammembership_association', 'systemusers', usuarioId)).
 */
export async function relateRecords(
  entityName: string,
  id: string,
  relacion: string,
  destinoEntity: string,
  destinoId: string,
): Promise<void> {
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'AssociateEntitiesWithOrganization',
      parameters: {
        organization,
        entityName,
        recordId: id,
        associationEntityRelationship: relacion,
        item: { '@odata.id': `${organization}/api/data/v9.2/${destinoEntity}(${destinoId})` },
      },
    },
  })
  if (!result.success) {
    throw new Error(describeError(result.error))
  }
}

/** Deshace una relación hecha con relateRecords. */
export async function unrelateRecords(
  entityName: string,
  id: string,
  relacion: string,
  destinoEntity: string,
  destinoId: string,
): Promise<void> {
  const organization = await resolverOrganizacion()
  const result = await dv.executeAsync<Record<string, unknown>, unknown>({
    connectorOperation: {
      tableName: DATASOURCE,
      operationName: 'DisassociateEntitiesWithOrganization',
      parameters: {
        organization,
        entityName,
        recordId: id,
        associationEntityRelationship: relacion,
        $id: `${organization}/api/data/v9.2/${destinoEntity}(${destinoId})`,
      },
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
