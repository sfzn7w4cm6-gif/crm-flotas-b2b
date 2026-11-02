import { Fase } from './types'
import type { Lead } from './types'

// Descuento de la oferta en dos partes que se suman: primero el del concesionario (lo pone el
// comercial) y después el de ventas. Mientras falta el de ventas la oportunidad queda en naranja
// y ventas la ve como pendiente. Si el comercial cambia el suyo, el de ventas se borra para que
// lo revise (lo hace actualizarLead).

// Con la venta cerrada o la oportunidad perdida ya no se pide el descuento de ventas.
const FASES_SIN_PENDIENTE: Fase[] = [Fase.Cierre, Fase.Entrega, Fase.Perdido]

export function descuentoPendiente(l: Lead): boolean {
  return l.fl_descuentoconcesionario != null && l.fl_descuentoventas == null && !FASES_SIN_PENDIENTE.includes(l.fl_faseactual)
}

/** Suma de los dos descuentos; null si no hay ninguno. */
export function descuentoTotal(l: Lead): number | null {
  if (l.fl_descuentoconcesionario == null && l.fl_descuentoventas == null) return null
  return (l.fl_descuentoconcesionario ?? 0) + (l.fl_descuentoventas ?? 0)
}

export function formatoPorcentaje(n: number | null | undefined): string {
  return n == null ? '' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`
}
