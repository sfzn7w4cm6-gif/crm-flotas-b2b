import { fechaCorta, normalizarTexto } from './formato'
import { fetchTextosNotas } from './notasService'
import { fetchMisTareas } from './tareasService'
import { FaseLabel, ModoFinanciacionLabel, PlazoDecisionLabel } from './types'
import type { Lead, Modelo } from './types'

// Busqueda y filtros comunes a Mis leads (concesionario) y Seguimiento (equipo de ventas).

/**
 * Texto de tareas y notas por lead, para que el buscador también encuentre en ellas.
 * Si alguna de las dos tablas no existe en el entorno, se busca sin ella.
 */
export async function fetchTextosExtra(): Promise<Map<string, string>> {
  const [tareas, notas] = await Promise.all([fetchMisTareas().catch(() => []), fetchTextosNotas().catch(() => [])])
  const m = new Map<string, string[]>()
  const add = (leadId: string, ...textos: (string | undefined)[]) => m.set(leadId, [...(m.get(leadId) ?? []), ...textos.filter((t): t is string => !!t)])
  for (const t of tareas) add(t._fl_lead_value, t.fl_titulo, t.fl_notas, t.fl_resultado)
  for (const n of notas) add(n._fl_lead_value, n.fl_texto)
  return new Map([...m].map(([id, textos]) => [id, textos.join(' ')]))
}

/** Todo lo que se ve de un lead, en un solo texto normalizado, para buscar en cualquier campo. */
export function textoBusqueda(l: Lead, extra: (string | undefined)[] = []): string {
  return normalizarTexto(
    [
      l.fl_numero,
      l.fl_razonsocial,
      l.fl_cif,
      l.fl_nombreresponsable,
      l.fl_telefonocorporativo,
      l.fl_emailcorporativo,
      l.fl_actividadeconomica,
      l.fl_marcasactuales,
      l.fl_modelosinteres,
      ModoFinanciacionLabel[l.fl_modofinanciacionactual],
      PlazoDecisionLabel[l.fl_plazoestimadodecision],
      l.fl_competidoresdetectados,
      l.fl_requisitos,
      l.fl_kmtiempo,
      FaseLabel[l.fl_faseactual],
      l.fl_ofertacondiciones,
      l.fl_ultimaaccionrealizada,
      l.fl_proximaaccion,
      l.fl_comercialresponsable,
      l.fl_observaciones,
      l.fl_motivoperdida,
      fechaCorta(l.fl_fechaprimercontacto),
      fechaCorta(l.fl_fechaproximaaccion),
      ...extra,
    ]
      .filter(Boolean)
      .join(' · '),
  )
}

/** Cada palabra buscada tiene que aparecer en algún campo ("entrega s700" = las dos). */
export function coincideBusqueda(texto: string, busqueda: string): boolean {
  const palabras = normalizarTexto(busqueda).split(/\s+/).filter(Boolean)
  return palabras.every((p) => texto.includes(p))
}

/**
 * Modelos de interés del lead: el resumen de sus líneas ("S700 HEV LUXURY, S800 PHEV PREMIUM").
 * Los leads antiguos solo tienen la familia ("S700"): cuentan como interesados en todos sus modelos.
 */
export function coincideModelo(l: Lead, modelos: Modelo[]): boolean {
  const partes = (l.fl_modelosinteres ?? '')
    .split(/[,;/]+/)
    .map((m) => normalizarTexto(m.trim()))
    .filter(Boolean)
  return modelos.some((m) => {
    const nombre = normalizarTexto(m.fl_nombre)
    const familia = normalizarTexto(m.fl_familia ?? '')
    return partes.some((p) => p === nombre || (familia !== '' && p === familia))
  })
}
