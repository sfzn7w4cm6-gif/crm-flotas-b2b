import { createRecord, deleteRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import { resumenDescuentos } from './descuento'
import type { LineaOportunidad, Modelo } from './types'

export async function fetchLineas(leadId: string): Promise<LineaOportunidad[]> {
  return listRecords<LineaOportunidad>(Tables.LineaOportunidad, {
    select: 'fl_lineaoportunidadid,fl_titulo,fl_cantidad,fl_descuentoconcesionario,fl_descuentoventas,_fl_lead_value,_fl_modelo_value',
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
 * Las listas, el embudo y los KPIs leen "Modelos de interés", "Nº vehículos a renovar/ampliar"
 * y los dos descuentos del lead. Con líneas, esos campos pasan a ser su resumen y se recalculan
 * tras cada cambio.
 */
export async function guardarResumenLineas(leadId: string, lineas: LineaOportunidad[], modelos: Modelo[]): Promise<void> {
  const nombre = new Map(modelos.map((m) => [m.fl_modeloid, m.fl_nombre]))
  const campos: Record<string, unknown> = {
    fl_modelosinteres: lineas.map((l) => nombre.get(l._fl_modelo_value) ?? l.fl_titulo).join(', '),
    fl_numvehiculosrenovarampliar: lineas.reduce((acc, l) => acc + l.fl_cantidad, 0),
  }
  // Solo si algún modelo tiene ya descuento: así no se pisa el descuento global de las ofertas antiguas.
  if (lineas.some((l) => l.fl_descuentoconcesionario != null || l.fl_descuentoventas != null)) {
    const r = resumenDescuentos(lineas)
    campos.fl_descuentoconcesionario = r.concesionario
    campos.fl_descuentoventas = r.ventas
  }
  await updateRecord(Tables.Lead, leadId, campos)
}

export interface CambioLinea {
  lineaId: string
  cantidad?: number
  descuentoConcesionario?: number | null
  descuentoVentas?: number | null
}

/**
 * Guarda unidades y descuentos de cada modelo y recalcula el resumen del lead. Si cambia el
 * descuento del concesionario de un modelo sin tocar el de marca, el de marca se borra para que
 * ventas lo revise (salvo en "Sin concesionario", donde los pone la misma persona).
 */
export async function guardarCambiosLineas(
  leadId: string,
  cambios: CambioLinea[],
  modelos: Modelo[],
  opciones: { borrarMarcaSiCambia: boolean },
): Promise<LineaOportunidad[]> {
  for (const c of cambios) {
    const campos: Record<string, unknown> = {}
    if (c.cantidad !== undefined) campos.fl_cantidad = c.cantidad
    if (c.descuentoConcesionario !== undefined) campos.fl_descuentoconcesionario = c.descuentoConcesionario
    if (c.descuentoVentas !== undefined) campos.fl_descuentoventas = c.descuentoVentas
    else if (c.descuentoConcesionario !== undefined && opciones.borrarMarcaSiCambia) campos.fl_descuentoventas = null
    if (Object.keys(campos).length) await updateRecord(Tables.LineaOportunidad, c.lineaId, campos)
  }
  const lineas = await fetchLineas(leadId)
  await guardarResumenLineas(leadId, lineas, modelos)
  return lineas
}
