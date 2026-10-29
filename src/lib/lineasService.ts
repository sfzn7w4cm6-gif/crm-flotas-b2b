import { createRecord, deleteRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import type { LineaOportunidad, Modelo } from './types'

export async function fetchLineas(leadId: string): Promise<LineaOportunidad[]> {
  return listRecords<LineaOportunidad>(Tables.LineaOportunidad, {
    select: 'fl_lineaoportunidadid,fl_titulo,fl_cantidad,_fl_lead_value,_fl_modelo_value',
    filter: `_fl_lead_value eq ${leadId}`,
    orderby: 'createdon asc',
  })
}

export async function crearLinea(leadId: string, modelo: Modelo, cantidad: number): Promise<void> {
  await createRecord(Tables.LineaOportunidad, {
    fl_titulo: `${modelo.fl_nombre} x${cantidad}`,
    fl_cantidad: cantidad,
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
    'fl_modelo@odata.bind': `/${Tables.Modelo}(${modelo.fl_modeloid})`,
  })
}

export async function borrarLinea(lineaId: string): Promise<void> {
  await deleteRecord(Tables.LineaOportunidad, lineaId)
}

/**
 * Las listas, el embudo y los KPIs leen "Modelos de interés" y "Nº vehículos a renovar/ampliar"
 * del lead. Con líneas, esos dos campos pasan a ser su resumen y se recalculan tras cada cambio.
 */
export async function guardarResumenLineas(leadId: string, lineas: LineaOportunidad[], modelos: Modelo[]): Promise<void> {
  const nombre = new Map(modelos.map((m) => [m.fl_modeloid, m.fl_nombre]))
  await updateRecord(Tables.Lead, leadId, {
    fl_modelosinteres: lineas.map((l) => nombre.get(l._fl_modelo_value) ?? l.fl_titulo).join(', '),
    fl_numvehiculosrenovarampliar: lineas.reduce((acc, l) => acc + l.fl_cantidad, 0),
  })
}
