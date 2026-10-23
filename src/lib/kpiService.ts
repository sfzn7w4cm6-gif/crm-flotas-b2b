import { FASES_ACTIVAS, Fase, FaseLabel } from './types'
import type { Concesionario, FaseHistorico, Lead } from './types'

export const DIAS_ESTANCADO = 21

export interface ConteoFase {
  fase: Fase
  label: string
  cantidad: number
}

/** Nº de leads actualmente en cada fase activa (embudo). */
export function embudoPorFase(leads: Lead[]): ConteoFase[] {
  return FASES_ACTIVAS.map((fase) => ({
    fase,
    label: FaseLabel[fase],
    cantidad: leads.filter((l) => l.fl_faseactual === fase).length,
  }))
}

export interface ConversionFase {
  desde: Fase
  hasta: Fase
  label: string
  porcentaje: number
}

/** Tasa de conversion N->N+1: de los leads que alguna vez pasaron por la fase N,
 *  que porcentaje tiene tambien una fila de historico en la fase N+1. */
export function tasasConversion(historico: FaseHistorico[]): ConversionFase[] {
  const resultado: ConversionFase[] = []
  for (let i = 0; i < FASES_ACTIVAS.length - 1; i++) {
    const desde = FASES_ACTIVAS[i]
    const hasta = FASES_ACTIVAS[i + 1]
    const leadsEnDesde = new Set(historico.filter((h) => h.fl_fase === desde).map((h) => h._fl_lead_value))
    const leadsEnHasta = new Set(historico.filter((h) => h.fl_fase === hasta).map((h) => h._fl_lead_value))
    const numerador = [...leadsEnDesde].filter((id) => leadsEnHasta.has(id)).length
    const porcentaje = leadsEnDesde.size > 0 ? Math.round((numerador / leadsEnDesde.size) * 100) : 0
    resultado.push({ desde, hasta, label: `${FaseLabel[desde]} → ${FaseLabel[hasta]}`, porcentaje })
  }
  return resultado
}

export interface DiasPorFase {
  fase: Fase
  label: string
  diasMedio: number
}

/** Dias medios en cada fase, usando solo filas de historico ya cerradas. */
export function tiempoMedioPorFase(historico: FaseHistorico[]): DiasPorFase[] {
  return FASES_ACTIVAS.map((fase) => {
    const cerradas = historico.filter((h) => h.fl_fase === fase && !h.fl_esactual && h.fl_diasenfase !== undefined)
    const diasMedio = cerradas.length
      ? Math.round(cerradas.reduce((acc, h) => acc + (h.fl_diasenfase ?? 0), 0) / cerradas.length)
      : 0
    return { fase, label: FaseLabel[fase], diasMedio }
  })
}

export interface LeadsPorConcesionario {
  nombre: string
  cantidad: number
}

export function leadsPorConcesionario(leads: Lead[], concesionarios: Concesionario[]): LeadsPorConcesionario[] {
  const porId = new Map(concesionarios.map((c) => [c.fl_concesionarioid, c.fl_nombre]))
  const conteo = new Map<string, number>()
  for (const l of leads) {
    const nombre = porId.get(l._fl_concesionario_value) ?? 'Sin asignar'
    conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1)
  }
  return [...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad)
}

export interface LeadEnRiesgo {
  lead: Lead
  diasEnFaseActual: number
}

/** Leads cuya fase actual lleva abierta mas de DIAS_ESTANCADO dias. */
export function leadsEnRiesgo(leads: Lead[], historico: FaseHistorico[]): LeadEnRiesgo[] {
  const abiertosPorLead = new Map(
    historico.filter((h) => h.fl_esactual).map((h) => [h._fl_lead_value, h]),
  )
  const ahora = Date.now()
  const riesgo: LeadEnRiesgo[] = []
  for (const l of leads) {
    if (l.fl_faseactual === Fase.Perdido) continue
    const abierto = abiertosPorLead.get(l.fl_leadid)
    if (!abierto) continue
    const dias = Math.floor((ahora - new Date(abierto.fl_fechainicio).getTime()) / (1000 * 60 * 60 * 24))
    if (dias > DIAS_ESTANCADO) riesgo.push({ lead: l, diasEnFaseActual: dias })
  }
  return riesgo.sort((a, b) => b.diasEnFaseActual - a.diasEnFaseActual)
}

export interface StatsResumen {
  leadsNuevos: number
  reunionesDiagnostico: number
  propuestasEnviadas: number
  cierres: number
  tasaCierre: number
  tasaPerdida: number
  seguimientosCompletados: number
  unidadesEntregadas: number
  nuevosClientesEmpresa: number
  renovacionesGestionadas: number
}

function leadsQueAlcanzaronFase(historico: FaseHistorico[], fase: Fase): Set<string> {
  return new Set(historico.filter((h) => h.fl_fase === fase).map((h) => h._fl_lead_value))
}

/** Replica las 8 metricas de la hoja "KPI Dashboard" del Excel original:
 *  leads nuevos, reuniones de diagnostico, propuestas enviadas, pedidos
 *  cerrados, seguimientos completados, unidades entregadas, tasa de cierre,
 *  nuevos clientes empresa y renovaciones gestionadas (mas la tasa de
 *  perdida, que no estaba en el Excel pero es la contraparte natural de la
 *  tasa de cierre con el estado "Perdido" que se añadio a esta version). */
export function statsResumen(leads: Lead[], historico: FaseHistorico[]): StatsResumen {
  const total = leads.length
  const reuniones = leadsQueAlcanzaronFase(historico, Fase.Cualificacion).size
  const propuestas = leadsQueAlcanzaronFase(historico, Fase.Propuesta).size
  const cierres = leadsQueAlcanzaronFase(historico, Fase.Cierre).size
  const perdidos = leadsQueAlcanzaronFase(historico, Fase.Perdido).size

  const leadsIds = new Set(leads.map((l) => l.fl_leadid))
  const historicoDeEstosLeads = historico.filter((h) => leadsIds.has(h._fl_lead_value))
  const seguimientosCompletados = historicoDeEstosLeads.filter((h) => !h.fl_esactual).length

  const idsEntregados = leadsQueAlcanzaronFase(historico, Fase.Entrega)
  const idsFidelizados = leadsQueAlcanzaronFase(historico, Fase.Fidelizacion)
  const unidadesEntregadas = leads
    .filter((l) => idsEntregados.has(l.fl_leadid) || idsFidelizados.has(l.fl_leadid))
    .reduce((acc, l) => acc + (l.fl_numvehiculosrenovarampliar || 0), 0)

  const idsCerrados = leadsQueAlcanzaronFase(historico, Fase.Cierre)
  const nuevosClientesEmpresa = new Set(
    leads.filter((l) => idsCerrados.has(l.fl_leadid)).map((l) => l.fl_razonsocial),
  ).size

  const renovacionesGestionadas = idsFidelizados.size

  return {
    leadsNuevos: total,
    reunionesDiagnostico: reuniones,
    propuestasEnviadas: propuestas,
    cierres,
    tasaCierre: total > 0 ? Math.round((cierres / total) * 100) : 0,
    tasaPerdida: total > 0 ? Math.round((perdidos / total) * 100) : 0,
    seguimientosCompletados,
    unidadesEntregadas,
    nuevosClientesEmpresa,
    renovacionesGestionadas,
  }
}

export type Periodo = 30 | 90 | 0 // 0 = todo

/** Filtra por fl_fechaprimercontacto (fecha de negocio), no por "createdon"
 *  (fecha tecnica de alta del registro en Dataverse) — con datos de
 *  demostracion creados todos el mismo dia, "createdon" no distingue nada
 *  entre periodos aunque el primer contacto real sea de hace meses. */
export function filtrarPorPeriodo(leads: Lead[], periodo: Periodo): Lead[] {
  if (periodo === 0) return leads
  const limite = Date.now() - periodo * 24 * 60 * 60 * 1000
  return leads.filter((l) => new Date(l.fl_fechaprimercontacto).getTime() >= limite)
}
