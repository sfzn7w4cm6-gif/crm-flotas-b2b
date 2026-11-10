import { FASES_ACTIVAS, Fase } from './types'
import type { Lead, LineaOportunidad } from './types'
import type { ActualizarLeadInput } from './leadsService'

// Qué campos de la ficha (secciones 3-5 del Excel) pide cada fase al cambiar a ella.
// Son acumulativos: al pasar a Propuesta también se piden los de Cualificación que falten.
// Los obligatorios impiden cambiar de fase; el resto se puede dejar para más tarde.
// Todos siguen editables siempre desde la ficha. Para cambiar qué pide cada fase, solo
// hay que tocar REQUISITOS.

/**
 * 'modelos': modelos de interés y unidades. 'descuentos': descuento del concesionario de cada
 * modelo (la oferta). 'cierre': unidades y descuentos finales de cada modelo al cerrar.
 */
export type CampoFase = keyof ActualizarLeadInput | 'modelos' | 'descuentos' | 'cierre'

export type TipoCampo = 'texto' | 'textoLargo' | 'numero' | 'euros' | 'porcentaje' | 'fecha' | 'financiacion' | 'plazo' | 'modelos' | 'descuentos' | 'cierre'

export const CAMPOS: Partial<Record<CampoFase, { label: string; tipo: TipoCampo; seccion: string; leadField?: keyof Lead }>> = {
  numVehiculosActuales: { label: 'Nº vehículos actuales', tipo: 'numero', seccion: 'Situación actual de flota', leadField: 'fl_numvehiculosactuales' },
  marcasActuales: { label: 'Marcas actuales', tipo: 'texto', seccion: 'Situación actual de flota', leadField: 'fl_marcasactuales' },
  actividadEconomica: { label: 'Actividad económica (sector)', tipo: 'texto', seccion: 'Situación actual de flota', leadField: 'fl_actividadeconomica' },
  modoFinanciacionActual: { label: 'Modo de financiación actual', tipo: 'financiacion', seccion: 'Situación actual de flota', leadField: 'fl_modofinanciacionactual' },
  vencimientoContratosActuales: { label: 'Vencimiento contratos actuales', tipo: 'fecha', seccion: 'Situación actual de flota', leadField: 'fl_vencimientocontratosactuales' },
  modelos: { label: 'Modelos de interés', tipo: 'modelos', seccion: 'Necesidad y oportunidad' },
  plazoEstimadoDecision: { label: 'Plazo estimado de decisión', tipo: 'plazo', seccion: 'Necesidad y oportunidad', leadField: 'fl_plazoestimadodecision' },
  competidoresDetectados: { label: 'Competidores detectados', tipo: 'texto', seccion: 'Necesidad y oportunidad', leadField: 'fl_competidoresdetectados' },
  requisitos: { label: 'Requisitos (etiquetas, tecnología, política de flotas)', tipo: 'textoLargo', seccion: 'Necesidad y oportunidad', leadField: 'fl_requisitos' },
  ultimaAccionRealizada: { label: 'Última acción realizada', tipo: 'textoLargo', seccion: 'Histórico y seguimiento', leadField: 'fl_ultimaaccionrealizada' },
  proximaAccion: { label: 'Próxima acción', tipo: 'texto', seccion: 'Histórico y seguimiento', leadField: 'fl_proximaaccion' },
  fechaProximaAccion: { label: 'Fecha próxima acción', tipo: 'fecha', seccion: 'Histórico y seguimiento', leadField: 'fl_fechaproximaaccion' },
  observaciones: { label: 'Observaciones / notas clave', tipo: 'textoLargo', seccion: 'Histórico y seguimiento', leadField: 'fl_observaciones' },
  descuentos: { label: 'Descuento por modelo', tipo: 'descuentos', seccion: 'Oferta' },
  ofertaCondiciones: { label: 'Condiciones de la oferta', tipo: 'textoLargo', seccion: 'Oferta', leadField: 'fl_ofertacondiciones' },
  cierre: { label: 'Unidades y descuento por modelo', tipo: 'cierre', seccion: 'Cierre de la operación' },
}

interface Requisito {
  campo: CampoFase
  obligatorio: boolean
}

const opcional = (campo: CampoFase): Requisito => ({ campo, obligatorio: false })
const obligatorio = (campo: CampoFase): Requisito => ({ campo, obligatorio: true })

const REQUISITOS: Partial<Record<Fase, Requisito[]>> = {
  [Fase.PrimerContacto]: [opcional('ultimaAccionRealizada'), opcional('proximaAccion'), opcional('fechaProximaAccion')],
  [Fase.Cualificacion]: [
    obligatorio('numVehiculosActuales'),
    opcional('marcasActuales'),
    opcional('actividadEconomica'),
    obligatorio('modoFinanciacionActual'),
    obligatorio('vencimientoContratosActuales'),
    obligatorio('modelos'),
    obligatorio('plazoEstimadoDecision'),
    opcional('competidoresDetectados'),
    opcional('requisitos'),
    opcional('ultimaAccionRealizada'),
    obligatorio('proximaAccion'),
    obligatorio('fechaProximaAccion'),
    opcional('observaciones'),
  ],
  // La oferta va por modelo: hacen falta los modelos (Cualificación) antes de poner descuentos.
  [Fase.Propuesta]: [obligatorio('descuentos'), opcional('ofertaCondiciones')],
  // Al cerrar se confirman las unidades realmente vendidas de cada modelo y su descuento final.
  [Fase.Cierre]: [obligatorio('cierre')],
}

// Siempre que la oportunidad siga abierta se ofrece actualizar el siguiente paso.
const SIGUIENTE_PASO: CampoFase[] = ['ultimaAccionRealizada', 'proximaAccion', 'fechaProximaAccion']

/** Requisitos acumulados hasta esa fase (incluida), sin repetir; obligatorio si alguna fase lo exige. */
export function requisitosHasta(fase: Fase): Requisito[] {
  if (fase === Fase.Perdido) return []
  const hasta = FASES_ACTIVAS.slice(0, FASES_ACTIVAS.indexOf(fase) + 1)
  const porCampo = new Map<CampoFase, boolean>()
  for (const f of hasta) {
    for (const r of REQUISITOS[f] ?? []) porCampo.set(r.campo, (porCampo.get(r.campo) ?? false) || r.obligatorio)
  }
  // En Cierre, la tabla de cierre ya incluye modelos y descuentos: no se piden dos veces.
  if (porCampo.has('cierre')) {
    porCampo.delete('modelos')
    porCampo.delete('descuentos')
  }
  return [...porCampo].map(([campo, oblig]) => ({ campo, obligatorio: oblig }))
}

export interface Contexto {
  lead: Lead
  /** Nº de líneas de modelo; los leads antiguos con texto en "Modelos de interés" cuentan como rellenos. */
  numLineas: number
  /** Las líneas, si se conocen: para saber si cada modelo tiene ya su descuento. */
  lineas?: LineaOportunidad[]
}

export function estaVacio(campo: CampoFase, ctx: Contexto): boolean {
  if (campo === 'modelos') return ctx.numLineas === 0 && !ctx.lead.fl_modelosinteres
  if (campo === 'descuentos' || campo === 'cierre') {
    if (ctx.lineas) return ctx.lineas.length === 0 || ctx.lineas.some((l) => l.fl_descuentoconcesionario == null)
    return ctx.numLineas === 0 || ctx.lead.fl_descuentoconcesionario == null
  }
  const f = CAMPOS[campo]?.leadField
  const v = f ? ctx.lead[f] : undefined
  return v === null || v === undefined || v === ''
}

/** Lo que falta de la fase actual, para el aviso de la ficha. */
export function faltantes(fase: Fase, ctx: Contexto): { obligatorios: CampoFase[]; opcionales: CampoFase[] } {
  const reqs = requisitosHasta(fase).filter((r) => estaVacio(r.campo, ctx))
  return {
    obligatorios: reqs.filter((r) => r.obligatorio).map((r) => r.campo),
    opcionales: reqs.filter((r) => !r.obligatorio).map((r) => r.campo),
  }
}

/**
 * Campos que se muestran al cambiar a una fase (o al completar la actual): los que faltan de
 * esa fase y las anteriores, los propios de la fase destino aunque ya tengan valor (para poder
 * revisarlos, p. ej. la oferta) y el siguiente paso si la oportunidad sigue abierta.
 */
export function camposDelDialogo(fase: Fase, ctx: Contexto): Requisito[] {
  if (fase === Fase.Perdido) return []
  const reqs = requisitosHasta(fase)
  const propios = new Set((REQUISITOS[fase] ?? []).map((r) => r.campo))
  const abierta = fase !== Fase.Cierre && fase !== Fase.Entrega
  const visibles = reqs.filter((r) => propios.has(r.campo) || estaVacio(r.campo, ctx))
  // Con la oferta a la vista hacen falta los modelos en la misma ventana, para poder añadirlos.
  if (visibles.some((r) => r.campo === 'descuentos') && !visibles.some((r) => r.campo === 'modelos' || r.campo === 'cierre')) {
    visibles.push(reqs.find((r) => r.campo === 'modelos') ?? opcional('modelos'))
  }
  if (abierta) {
    for (const c of SIGUIENTE_PASO) if (!visibles.some((r) => r.campo === c)) visibles.push(reqs.find((r) => r.campo === c) ?? opcional(c))
  }
  const orden = Object.keys(CAMPOS) as CampoFase[]
  return visibles.sort((a, b) => orden.indexOf(a.campo) - orden.indexOf(b.campo))
}
