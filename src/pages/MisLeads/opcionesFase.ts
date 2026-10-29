import { FASE_COLORS } from '../../components/StatusBadge'
import { FASES_ACTIVAS, Fase, FaseLabel } from '../../lib/types'

// Opciones del filtro de fase (con el punto de color de cada una), comunes a Mis leads y Seguimiento.

export const OPCIONES_FASE = [...FASES_ACTIVAS, Fase.Perdido].map((f) => ({ value: f, label: FaseLabel[f], dot: FASE_COLORS[f].dot }))

/** Fases que llegan en el enlace (?fase=101000003), p. ej. desde el gráfico de Inicio. */
export function fasesDeUrl(params: URLSearchParams): Fase[] {
  const validas = new Set<number>(OPCIONES_FASE.map((o) => o.value))
  return params
    .getAll('fase')
    .map(Number)
    .filter((f): f is Fase => validas.has(f))
}
