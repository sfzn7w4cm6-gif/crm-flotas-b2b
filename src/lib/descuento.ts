import { Fase } from './types'
import type { Lead, LineaOportunidad } from './types'

// Descuento de la oferta en dos partes que se suman: el del concesionario (lo pone el comercial)
// y el de marca (lo pone ventas). Se ponen por modelo, en cada línea de la oportunidad; el lead
// guarda su resumen ponderado por unidades (resumenDescuentos) para listas, avisos y KPIs.
// Mientras falta el de marca la oportunidad queda en naranja y ventas la ve como pendiente.
// Si el comercial cambia el suyo, el de marca de ese modelo se borra para que ventas lo revise.
//
// Excepción: las oportunidades de "Sin concesionario" las negocia directamente gente de EBRO,
// que pone los dos descuentos. Ahí no hay nada pendiente ni se avisa a nadie.

// Con la venta cerrada o la oportunidad perdida ya no se pide el descuento de ventas.
const FASES_SIN_PENDIENTE: Fase[] = [Fase.Cierre, Fase.Entrega, Fase.Perdido]

// Ids del concesionario "Sin concesionario" en este entorno; los registra leadsService al leer.
const sinConcesionario = new Set<string>()

export function registrarSinConcesionario(ids: string[]): void {
  for (const id of ids) sinConcesionario.add(id)
}

/** El concesionario es "Sin concesionario": lo negocia EBRO directamente. */
export function esSinConcesionario(concesionarioId: string | null | undefined): boolean {
  return !!concesionarioId && sinConcesionario.has(concesionarioId)
}

export function descuentoPendiente(l: Lead): boolean {
  if (esSinConcesionario(l._fl_concesionario_value)) return false
  return l.fl_descuentoconcesionario != null && l.fl_descuentoventas == null && !FASES_SIN_PENDIENTE.includes(l.fl_faseactual)
}

/** Suma de los dos descuentos; null si no hay ninguno. */
export function descuentoTotal(l: Pick<Lead, 'fl_descuentoconcesionario' | 'fl_descuentoventas'>): number | null {
  if (l.fl_descuentoconcesionario == null && l.fl_descuentoventas == null) return null
  return (l.fl_descuentoconcesionario ?? 0) + (l.fl_descuentoventas ?? 0)
}

function mediaPonderada(lineas: LineaOportunidad[], valor: (l: LineaOportunidad) => number | null | undefined): number | null {
  let suma = 0
  let unidades = 0
  for (const l of lineas) {
    const v = valor(l)
    if (v == null) continue
    suma += v * l.fl_cantidad
    unidades += l.fl_cantidad
  }
  return unidades === 0 ? null : Math.round((suma / unidades) * 100) / 100
}

/**
 * Resumen de la oferta para guardar en el lead: media de cada descuento ponderada por unidades.
 * El de marca queda vacío (pendiente) mientras algún modelo con descuento del concesionario no
 * tenga todavía el suyo.
 */
export function resumenDescuentos(lineas: LineaOportunidad[]): { concesionario: number | null; ventas: number | null } {
  const concesionario = mediaPonderada(lineas, (l) => l.fl_descuentoconcesionario)
  const faltaMarca = lineas.some((l) => l.fl_descuentoconcesionario != null && l.fl_descuentoventas == null)
  return { concesionario, ventas: faltaMarca ? null : mediaPonderada(lineas, (l) => l.fl_descuentoventas) }
}

/** Descuento total medio de la oferta (ponderado por unidades); null si ningún modelo tiene. */
export function descuentoTotalLineas(lineas: LineaOportunidad[]): number | null {
  const conAlguno = lineas.filter((l) => l.fl_descuentoconcesionario != null || l.fl_descuentoventas != null)
  return mediaPonderada(conAlguno, (l) => (l.fl_descuentoconcesionario ?? 0) + (l.fl_descuentoventas ?? 0))
}

export function formatoPorcentaje(n: number | null | undefined): string {
  return n == null ? '' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`
}
