import { FASES_ACTIVAS, Fase } from './types'
import type { Lead } from './types'
import type { ActualizarLeadInput } from './leadsService'

// Qué campos de la ficha (secciones 3-5 del Excel) pide cada fase al cambiar a ella.
// Son acumulativos: al pasar a Propuesta también se piden los de Cualificación que falten.
// Los obligatorios impiden cambiar de fase; el resto se puede dejar para más tarde.
// Todos siguen editables siempre desde la ficha. Para cambiar qué pide cada fase, solo
// hay que tocar REQUISITOS.

export type CampoFase = keyof ActualizarLeadInput | 'modelos'

export type TipoCampo = 'texto' | 'textoLargo' | 'numero' | 'euros' | 'fecha' | 'financiacion' | 'plazo' | 'modelos'

export const CAMPOS: Partial<Record<CampoFase, { label: string; tipo: TipoCampo; seccion: string; leadField?: keyof Lead }>> = {
  numVehiculosActuales: { label: 'Nº vehículos actuales', tipo: 'numero', seccion: 'Situación actual de flota', leadField: 'fl_numvehiculosactuales' },
  marcasActuales: { label: 'Marcas actuales', tipo: 'texto', seccion: 'Situación actual de flota', leadField: 'fl_marcasactuales' },
  actividadEconomica: { label: 'Actividad económica (sector)', tipo: 'texto', seccion: 'Situación actual de flota', leadField: 'fl_actividadeconomica' },
  modoFinanciacionActual: { label: 'Modo de financiación actual', tipo: 'financiacion', seccion: 'Situación actual de flota', leadField: 'fl_modofinanciacionactual' },
  vencimientoContratosActuales: { label: 'Vencimiento contratos actuales', tipo: 'fecha', seccion: 'Situación actual de flota', leadField: 'fl_vencimientocontratosactuales' },
  modelos: { label: 'Modelos de interés', tipo: 'modelos', seccion: 'Necesidad y oportunidad' },
  cuotasObjetivo: { label: 'Cuotas objetivo (€)', tipo: 'euros', seccion: 'Necesidad y oportunidad', leadField: 'fl_cuotasobjetivo' },
  plazoEstimadoDecision: { label: 'Plazo estimado de decisión', tipo: 'plazo', seccion: 'Necesidad y oportunidad', leadField: 'fl_plazoestimadodecision' },
  competidoresDetectados: { label: 'Competidores detectados', tipo: 'texto', seccion: 'Necesidad y oportunidad', leadField: 'fl_competidoresdetectados' },
  requisitos: { label: 'Requisitos (etiquetas, tecnología, política de flotas)', tipo: 'textoLargo', seccion: 'Necesidad y oportunidad', leadField: 'fl_requisitos' },
  kmTiempo: { label: 'Km / tiempo', tipo: 'texto', seccion: 'Necesidad y oportunidad', leadField: 'fl_kmtiempo' },
  ultimaAccionRealizada: { label: 'Última acción realizada', tipo: 'textoLargo', seccion: 'Histórico y seguimiento', leadField: 'fl_ultimaaccionrealizada' },
  proximaAccion: { label: 'Próxima acción', tipo: 'texto', seccion: 'Histórico y seguimiento', leadField: 'fl_proximaaccion' },
  fechaProximaAccion: { label: 'Fecha próxima acción', tipo: 'fecha', seccion: 'Histórico y seguimiento', leadField: 'fl_fechaproximaaccion' },
  observaciones: { label: 'Observaciones / notas clave', tipo: 'textoLargo', seccion: 'Histórico y seguimiento', leadField: 'fl_observaciones' },
  ofertaCondiciones: { label: 'Oferta (Descuento/Condiciones)', tipo: 'textoLargo', seccion: 'Oferta', leadField: 'fl_ofertacondiciones' },
  importeVenta: { label: 'Importe de la venta (€)', tipo: 'euros', seccion: 'Venta' },
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
    opcional('cuotasObjetivo'),
    obligatorio('plazoEstimadoDecision'),
    opcional('competidoresDetectados'),
    opcional('requisitos'),
    opcional('kmTiempo'),
    opcional('ultimaAccionRealizada'),
    obligatorio('proximaAccion'),
    obligatorio('fechaProximaAccion'),
    opcional('observaciones'),
  ],
  [Fase.Propuesta]: [obligatorio('ofertaCondiciones')],
  [Fase.Cierre]: [obligatorio('importeVenta')],
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
  return [...porCampo].map(([campo, oblig]) => ({ campo, obligatorio: oblig }))
}

export interface Contexto {
  lead: Lead
  /** Nº de líneas de modelo; los leads antiguos con texto en "Modelos de interés" cuentan como rellenos. */
  numLineas: number
  importe: number | null | undefined
}

export function estaVacio(campo: CampoFase, ctx: Contexto): boolean {
  if (campo === 'modelos') return ctx.numLineas === 0 && !ctx.lead.fl_modelosinteres
  // undefined = la columna de importe no existe en el entorno: no se puede pedir.
  if (campo === 'importeVenta') return ctx.importe === null
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
  if (abierta) {
    for (const c of SIGUIENTE_PASO) if (!visibles.some((r) => r.campo === c)) visibles.push(reqs.find((r) => r.campo === c) ?? opcional(c))
  }
  const orden = Object.keys(CAMPOS) as CampoFase[]
  return visibles.filter((r) => !(r.campo === 'importeVenta' && ctx.importe === undefined)).sort((a, b) => orden.indexOf(a.campo) - orden.indexOf(b.campo))
}
