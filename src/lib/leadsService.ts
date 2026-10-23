import { createRecord, getRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import { Fase } from './types'
import type { FaseHistorico, Lead, UsuarioApp } from './types'

export interface NuevoLeadInput {
  razonSocial: string
  cif: string
  nombreResponsable: string
  telefonoCorporativo: string
  emailCorporativo: string
  numVehiculosActuales: number
  marcasActuales: string
  actividadEconomica: string
  modoFinanciacionActual: number
  vencimientoContratosActuales: string
  cuotasObjetivo: number
  modelosInteres: string
  numVehiculosRenovarAmpliar: number
  plazoEstimadoDecision: number
  competidoresDetectados: string
  requisitos: string
  kmTiempo: string
  proximaAccion: string
  fechaProximaAccion: string
  observaciones: string
  ofertaCondiciones?: string
}

/** Crea el lead (fase inicial = Prospeccion) y abre su primera fila de historico de fase. */
export async function crearLeadBase(input: NuevoLeadInput, usuario: UsuarioApp): Promise<{ leadId: string; numero: string }> {
  if (!usuario._fl_ubicacion_value) {
    throw new Error('Tu perfil no tiene una ubicación asignada; no puedes crear leads.')
  }
  const ubicacion = await getRecord<{ _fl_concesionario_value: string }>(
    Tables.Ubicacion,
    usuario._fl_ubicacion_value,
    '_fl_concesionario_value',
  )
  if (!ubicacion) throw new Error('No se pudo resolver tu ubicación.')

  const hoy = new Date().toISOString().slice(0, 10)
  const fields: Record<string, unknown> = {
    fl_razonsocial: input.razonSocial,
    fl_cif: input.cif,
    fl_nombreresponsable: input.nombreResponsable,
    fl_telefonocorporativo: input.telefonoCorporativo,
    fl_emailcorporativo: input.emailCorporativo,
    fl_numvehiculosactuales: input.numVehiculosActuales,
    fl_marcasactuales: input.marcasActuales,
    fl_actividadeconomica: input.actividadEconomica,
    fl_modofinanciacionactual: input.modoFinanciacionActual,
    fl_vencimientocontratosactuales: input.vencimientoContratosActuales,
    fl_cuotasobjetivo: input.cuotasObjetivo,
    fl_modelosinteres: input.modelosInteres,
    fl_numvehiculosrenovarampliar: input.numVehiculosRenovarAmpliar,
    fl_plazoestimadodecision: input.plazoEstimadoDecision,
    fl_competidoresdetectados: input.competidoresDetectados,
    fl_requisitos: input.requisitos,
    fl_kmtiempo: input.kmTiempo,
    fl_fechaprimercontacto: hoy,
    fl_faseactual: Fase.Prospeccion,
    fl_ultimaaccionrealizada: 'Alta del lead',
    fl_proximaaccion: input.proximaAccion,
    fl_fechaproximaaccion: input.fechaProximaAccion,
    fl_comercialresponsable: usuario.fl_nombre,
    fl_observaciones: input.observaciones,
    fl_ofertacondiciones: input.ofertaCondiciones ?? '',
    'fl_ubicacion@odata.bind': `/${Tables.Ubicacion}(${usuario._fl_ubicacion_value})`,
    'fl_concesionario@odata.bind': `/${Tables.Concesionario}(${ubicacion._fl_concesionario_value})`,
    'fl_creadopor@odata.bind': `/${Tables.UsuarioApp}(${usuario.fl_usuarioappid})`,
  }
  const leadId = await createRecord(Tables.Lead, fields)
  const lead = await getRecord<Pick<Lead, 'fl_numero'>>(Tables.Lead, leadId, 'fl_numero')

  await createRecord(Tables.FaseHistorico, {
    fl_titulo: `${lead?.fl_numero ?? leadId} — Prospección`,
    fl_fase: Fase.Prospeccion,
    fl_fechainicio: new Date().toISOString(),
    fl_esactual: true,
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
  })

  return { leadId, numero: lead?.fl_numero ?? '' }
}

/** Cambia la fase de un lead, cerrando el historico abierto y abriendo uno nuevo. */
export async function cambiarFaseLead(leadId: string, numero: string, nuevaFase: Fase, motivoPerdida?: string): Promise<void> {
  const abiertos = await listRecords<FaseHistorico>(Tables.FaseHistorico, {
    filter: `_fl_lead_value eq ${leadId} and fl_esactual eq true`,
    top: 1,
  })
  const ahora = new Date()

  if (abiertos.length > 0) {
    const abierto = abiertos[0]
    const inicio = new Date(abierto.fl_fechainicio)
    const dias = Math.max(0, Math.round((ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)))
    await updateRecord(Tables.FaseHistorico, abierto.fl_fasehistoricoid, {
      fl_fechafin: ahora.toISOString(),
      fl_esactual: false,
      fl_diasenfase: dias,
    })
  }

  await createRecord(Tables.FaseHistorico, {
    fl_titulo: `${numero} — ${FASE_TITULOS[nuevaFase]}`,
    fl_fase: nuevaFase,
    fl_fechainicio: ahora.toISOString(),
    fl_esactual: true,
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
  })

  const updateFields: Record<string, unknown> = { fl_faseactual: nuevaFase }
  if (nuevaFase === Fase.Perdido) {
    updateFields.fl_motivoperdida = motivoPerdida ?? ''
  }
  await updateRecord(Tables.Lead, leadId, updateFields)
}

const FASE_TITULOS: Record<Fase, string> = {
  [Fase.Prospeccion]: 'Prospección',
  [Fase.PrimerContacto]: 'Primer Contacto',
  [Fase.Cualificacion]: 'Cualificación',
  [Fase.Propuesta]: 'Propuesta',
  [Fase.Negociacion]: 'Negociación',
  [Fase.Cierre]: 'Cierre',
  [Fase.Entrega]: 'Entrega',
  [Fase.Fidelizacion]: 'Fidelización',
  [Fase.Perdido]: 'Perdido',
}

const LEAD_SELECT =
  'fl_leadid,fl_numero,fl_razonsocial,fl_cif,fl_nombreresponsable,fl_telefonocorporativo,fl_emailcorporativo,' +
  'fl_numvehiculosactuales,fl_marcasactuales,fl_actividadeconomica,fl_modofinanciacionactual,fl_vencimientocontratosactuales,' +
  'fl_cuotasobjetivo,fl_modelosinteres,fl_numvehiculosrenovarampliar,fl_plazoestimadodecision,fl_competidoresdetectados,' +
  'fl_requisitos,fl_kmtiempo,fl_fechaprimercontacto,fl_faseactual,fl_ofertacondiciones,fl_ultimaaccionrealizada,fl_proximaaccion,' +
  'fl_fechaproximaaccion,fl_comercialresponsable,fl_observaciones,fl_motivoperdida,createdon,' +
  '_fl_ubicacion_value,_fl_concesionario_value,_fl_creadopor_value,_ownerid_value'

/** Leads del concesionario conectado (la seguridad de fila ya restringe el resultado a los suyos). */
export async function fetchMisLeads(): Promise<Lead[]> {
  return listRecords<Lead>(Tables.Lead, { select: LEAD_SELECT, orderby: 'createdon desc' })
}

export interface FiltrosLeads {
  concesionarioId?: string
  ubicacionId?: string
  fase?: Fase
  texto?: string
}

/** Todos los leads de la red (equipo de ventas), con filtros opcionales. */
export async function fetchTodosLosLeads(filtros: FiltrosLeads = {}): Promise<Lead[]> {
  const partes: string[] = []
  if (filtros.concesionarioId) partes.push(`_fl_concesionario_value eq ${filtros.concesionarioId}`)
  if (filtros.ubicacionId) partes.push(`_fl_ubicacion_value eq ${filtros.ubicacionId}`)
  if (filtros.fase !== undefined) partes.push(`fl_faseactual eq ${filtros.fase}`)
  if (filtros.texto) partes.push(`contains(fl_razonsocial, '${filtros.texto.replace(/'/g, "''")}')`)
  return listRecords<Lead>(Tables.Lead, {
    select: LEAD_SELECT,
    filter: partes.length ? partes.join(' and ') : undefined,
    orderby: 'createdon desc',
  })
}

export async function fetchLead(leadId: string): Promise<Lead | null> {
  return getRecord<Lead>(Tables.Lead, leadId, LEAD_SELECT)
}

export async function fetchHistoricoDeFase(leadId: string): Promise<FaseHistorico[]> {
  return listRecords<FaseHistorico>(Tables.FaseHistorico, {
    filter: `_fl_lead_value eq ${leadId}`,
    orderby: 'fl_fechainicio asc',
  })
}

export interface ActualizarLeadInput {
  nombreResponsable?: string
  telefonoCorporativo?: string
  emailCorporativo?: string
  numVehiculosActuales?: number
  marcasActuales?: string
  actividadEconomica?: string
  modoFinanciacionActual?: number
  vencimientoContratosActuales?: string
  cuotasObjetivo?: number
  modelosInteres?: string
  numVehiculosRenovarAmpliar?: number
  plazoEstimadoDecision?: number
  competidoresDetectados?: string
  requisitos?: string
  kmTiempo?: string
  ultimaAccionRealizada?: string
  proximaAccion?: string
  fechaProximaAccion?: string
  observaciones?: string
  ofertaCondiciones?: string
}

const CAMPO_MAP: Record<keyof ActualizarLeadInput, string> = {
  nombreResponsable: 'fl_nombreresponsable',
  telefonoCorporativo: 'fl_telefonocorporativo',
  emailCorporativo: 'fl_emailcorporativo',
  numVehiculosActuales: 'fl_numvehiculosactuales',
  marcasActuales: 'fl_marcasactuales',
  actividadEconomica: 'fl_actividadeconomica',
  modoFinanciacionActual: 'fl_modofinanciacionactual',
  vencimientoContratosActuales: 'fl_vencimientocontratosactuales',
  cuotasObjetivo: 'fl_cuotasobjetivo',
  modelosInteres: 'fl_modelosinteres',
  numVehiculosRenovarAmpliar: 'fl_numvehiculosrenovarampliar',
  plazoEstimadoDecision: 'fl_plazoestimadodecision',
  competidoresDetectados: 'fl_competidoresdetectados',
  requisitos: 'fl_requisitos',
  kmTiempo: 'fl_kmtiempo',
  ultimaAccionRealizada: 'fl_ultimaaccionrealizada',
  proximaAccion: 'fl_proximaaccion',
  fechaProximaAccion: 'fl_fechaproximaaccion',
  observaciones: 'fl_observaciones',
  ofertaCondiciones: 'fl_ofertacondiciones',
}

export async function actualizarLead(leadId: string, input: ActualizarLeadInput): Promise<void> {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    fields[CAMPO_MAP[key as keyof ActualizarLeadInput]] = value
  }
  if (Object.keys(fields).length === 0) return
  await updateRecord(Tables.Lead, leadId, fields)
}
