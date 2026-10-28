import { listRecords, Tables } from './dataverseClient'
import type { Modelo, Zona } from './types'

/** Las zonas comerciales (Zona 1..7) con su area manager, en orden. */
export async function fetchZonas(): Promise<Zona[]> {
  return listRecords<Zona>(Tables.Zona, {
    select: 'fl_zonaid,fl_nombre,fl_numero,fl_areamanager',
    orderby: 'fl_numero asc',
  })
}

/** Modelos activos para los desplegables, en el orden del catalogo. */
export async function fetchModelos(): Promise<Modelo[]> {
  return listRecords<Modelo>(Tables.Modelo, {
    select: 'fl_modeloid,fl_nombre,fl_familia,fl_motorizacion,fl_acabado,fl_orden,fl_activo',
    filter: 'fl_activo eq true',
    orderby: 'fl_orden asc',
  })
}
