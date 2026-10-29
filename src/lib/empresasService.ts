import { getRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import type { Empresa } from './types'

const EMPRESA_SELECT =
  'fl_empresaid,fl_razonsocial,fl_cif,fl_actividadeconomica,fl_nombreresponsable,fl_telefonocorporativo,fl_emailcorporativo,' +
  'fl_numvehiculosactuales,fl_marcasactuales,fl_modofinanciacionactual,fl_vencimientocontratosactuales,fl_estado,' +
  '_fl_concesionario_value,_fl_oportunidadabierta_value'

/** El CIF se guarda sin espacios, guiones ni puntos y en mayúsculas, para que "b-12.345.678" y "B12345678" sean la misma empresa. */
export function normalizarCif(cif: string): string {
  return cif.replace(/[\s.-]/g, '').toUpperCase()
}

/** La empresa con ese CIF en el concesionario indicado, o null si aún no existe. */
export async function buscarEmpresaPorCif(concesionarioId: string, cif: string): Promise<Empresa | null> {
  const filas = await listRecords<Empresa>(Tables.Empresa, {
    select: EMPRESA_SELECT,
    filter: `fl_cif eq '${normalizarCif(cif).replace(/'/g, "''")}' and _fl_concesionario_value eq ${concesionarioId}`,
    top: 1,
  })
  return filas[0] ?? null
}

/** Empresas de un concesionario, o de toda la red si no se indica (equipo de ventas). */
export async function fetchEmpresas(concesionarioId?: string): Promise<Empresa[]> {
  return listRecords<Empresa>(Tables.Empresa, {
    select: EMPRESA_SELECT,
    filter: concesionarioId ? `_fl_concesionario_value eq ${concesionarioId}` : undefined,
    orderby: 'fl_razonsocial asc',
  })
}

export async function fetchEmpresa(empresaId: string): Promise<Empresa | null> {
  return getRecord<Empresa>(Tables.Empresa, empresaId, EMPRESA_SELECT)
}

/** Empresas por id, en bloques para no pasarse de longitud en el filtro. */
export async function fetchEmpresasPorIds(ids: string[]): Promise<Map<string, Empresa>> {
  const unicos = [...new Set(ids.filter(Boolean))]
  const bloques: string[][] = []
  for (let i = 0; i < unicos.length; i += 40) bloques.push(unicos.slice(i, i + 40))
  const resultados = await Promise.all(
    bloques.map((b) =>
      listRecords<Empresa>(Tables.Empresa, {
        select: EMPRESA_SELECT,
        filter: b.map((id) => `fl_empresaid eq ${id}`).join(' or '),
      }),
    ),
  )
  return new Map(resultados.flat().map((e) => [e.fl_empresaid, e]))
}

/** Número de la oportunidad en curso de la empresa (ej. "L01043"), aunque sea de otro comercial. */
export function numeroOportunidadAbierta(empresa: Empresa): string | undefined {
  return empresa['_fl_oportunidadabierta_value@OData.Community.Display.V1.FormattedValue']
}

export interface ActualizarEmpresaInput {
  razonSocial?: string
  cif?: string
  nombreResponsable?: string
  telefonoCorporativo?: string
  emailCorporativo?: string
  numVehiculosActuales?: number
  marcasActuales?: string
  actividadEconomica?: string
  modoFinanciacionActual?: number
  vencimientoContratosActuales?: string
  estado?: number
}

const CAMPO_MAP: Record<keyof ActualizarEmpresaInput, string> = {
  razonSocial: 'fl_razonsocial',
  cif: 'fl_cif',
  nombreResponsable: 'fl_nombreresponsable',
  telefonoCorporativo: 'fl_telefonocorporativo',
  emailCorporativo: 'fl_emailcorporativo',
  numVehiculosActuales: 'fl_numvehiculosactuales',
  marcasActuales: 'fl_marcasactuales',
  actividadEconomica: 'fl_actividadeconomica',
  modoFinanciacionActual: 'fl_modofinanciacionactual',
  vencimientoContratosActuales: 'fl_vencimientocontratosactuales',
  estado: 'fl_estado',
}

export async function actualizarEmpresa(empresaId: string, input: ActualizarEmpresaInput): Promise<void> {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    fields[CAMPO_MAP[key as keyof ActualizarEmpresaInput]] = value
  }
  if (Object.keys(fields).length === 0) return
  await updateRecord(Tables.Empresa, empresaId, fields)
}

/** Marca (o desmarca, con null) la oportunidad en curso de la empresa. */
export async function marcarOportunidadAbierta(empresaId: string, leadId: string | null): Promise<void> {
  await updateRecord(Tables.Empresa, empresaId, {
    'fl_oportunidadabierta@odata.bind': leadId ? `/${Tables.Lead}(${leadId})` : null,
  })
}
