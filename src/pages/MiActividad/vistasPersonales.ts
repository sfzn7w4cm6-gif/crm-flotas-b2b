import type { Fase } from '../../lib/types'

export type DimensionTabla = 'zona' | 'concesionario' | 'ubicacion' | 'modelo'

export const NOMBRE_DIMENSION: Record<DimensionTabla, string> = { zona: 'Zona', concesionario: 'Concesionario', ubicacion: 'Sede', modelo: 'Modelo' }

/** Vista de la tabla de oportunidades que se arma cada usuario. */
export interface VistaPersonal {
  id: string
  nombre: string
  principal: DimensionTabla
  hijo?: DimensionTabla
  /** Fases que salen como columna, en el orden del proceso. */
  fases: Fase[]
  perdidos: boolean
  /** Vacío = todas. */
  zonas: string[]
  concesionarios: string[]
}

// Se guardan en este navegador: si se borran los datos del navegador, se pierden.
const CLAVE = 'ebrobusiness.vistasInicio'

export function leerVistas(): VistaPersonal[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function guardarVistas(vistas: VistaPersonal[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(vistas))
  } catch {
    // Sin almacenamiento (ventana privada, etc.): la vista dura hasta recargar.
  }
}
