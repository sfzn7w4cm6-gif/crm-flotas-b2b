import { createRecord, getRecord, listRecords, Tables, updateRecord } from './dataverseClient'
import {
  actualizarEmpresa,
  buscarEmpresaPorCif,
  fetchEmpresa,
  fetchEmpresasPorIds,
  marcarOportunidadAbierta,
  normalizarCif,
  numeroOportunidadAbierta,
  type ActualizarEmpresaInput,
} from './empresasService'
import { EstadoEmpresa, Fase } from './types'
import type { Empresa, FaseHistorico, Lead, Ubicacion, UsuarioApp } from './types'

/** Una oportunidad está abierta mientras no ha llegado a Cierre ni se ha perdido. Solo puede haber una por empresa. */
export function esFaseAbierta(fase: Fase): boolean {
  return fase !== Fase.Perdido && fase <= Fase.Negociacion
}

/** La empresa ya tiene una oportunidad en curso: no se crea otra, se continúa esa. */
export class OportunidadDuplicadaError extends Error {
  leadId: string
  numero?: string
  constructor(empresa: Empresa) {
    const numero = numeroOportunidadAbierta(empresa)
    super(
      `${empresa.fl_razonsocial} ya tiene una oportunidad en curso${numero ? ` (${numero})` : ''}. ` +
        'Continúa esa oportunidad en lugar de crear otra.',
    )
    this.leadId = empresa._fl_oportunidadabierta_value ?? ''
    this.numero = numero
  }
}

export interface NuevaOportunidadInput {
  razonSocial: string
  cif: string
  nombreResponsable: string
  telefonoCorporativo: string
  emailCorporativo: string
  /** Comercial que llevará la oportunidad: el usuario conectado u otro que lleve la misma sede. */
  comercial: UsuarioApp
}

/**
 * Da de alta una oportunidad en fase Prospección. Si la empresa (por CIF) ya existe en el
 * concesionario se reutiliza y se actualizan sus contactos; si no, se crea. Si el comercial
 * elegido es otro, la oportunidad pasa a ser suya (y con ella su histórico, por cascada).
 */
export async function crearOportunidad(
  input: NuevaOportunidadInput,
  usuario: UsuarioApp,
  sede: Ubicacion,
  /** Equipo del concesionario de la sede: dueño de las empresas nuevas. */
  equipoId?: string,
): Promise<{ leadId: string; numero: string; asignadaA?: string }> {
  const concesionarioId = sede._fl_concesionario_value
  const cif = normalizarCif(input.cif)

  // Se vuelve a buscar justo antes de crear, por si un compañero la ha dado de alta mientras tanto.
  const existente = await buscarEmpresaPorCif(concesionarioId, cif)
  if (existente?._fl_oportunidadabierta_value) throw new OportunidadDuplicadaError(existente)

  let empresaId: string
  if (existente) {
    empresaId = existente.fl_empresaid
    await actualizarEmpresa(empresaId, {
      razonSocial: input.razonSocial,
      nombreResponsable: input.nombreResponsable,
      telefonoCorporativo: input.telefonoCorporativo,
      emailCorporativo: input.emailCorporativo,
    })
  } else {
    const empresa = {
      fl_razonsocial: input.razonSocial,
      fl_cif: cif,
      fl_nombreresponsable: input.nombreResponsable,
      fl_telefonocorporativo: input.telefonoCorporativo,
      fl_emailcorporativo: input.emailCorporativo,
      fl_estado: EstadoEmpresa.ClientePotencial,
      'fl_concesionario@odata.bind': `/${Tables.Concesionario}(${concesionarioId})`,
    }
    // La empresa es del equipo del concesionario, para que la vean todos sus comerciales y
    // ninguno de otro concesionario. Si no se puede, queda a nombre de quien la da de alta.
    empresaId = equipoId
      ? await createRecord(Tables.Empresa, { ...empresa, 'ownerid@odata.bind': `/teams(${equipoId})` }).catch(() =>
          createRecord(Tables.Empresa, empresa),
        )
      : await createRecord(Tables.Empresa, empresa)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const leadId = await createRecord(Tables.Lead, {
    // Razón social y CIF se copian en el lead porque las listas filtran y ordenan por ellos.
    fl_razonsocial: input.razonSocial,
    fl_cif: cif,
    fl_nombreresponsable: input.nombreResponsable,
    fl_telefonocorporativo: input.telefonoCorporativo,
    fl_emailcorporativo: input.emailCorporativo,
    fl_fechaprimercontacto: hoy,
    fl_faseactual: Fase.Prospeccion,
    fl_ultimaaccionrealizada: 'Alta de la oportunidad',
    fl_comercialresponsable: input.comercial.fl_nombre,
    'fl_empresa@odata.bind': `/${Tables.Empresa}(${empresaId})`,
    'fl_comercial@odata.bind': `/${Tables.UsuarioApp}(${input.comercial.fl_usuarioappid})`,
    'fl_ubicacion@odata.bind': `/${Tables.Ubicacion}(${sede.fl_ubicacionid})`,
    'fl_concesionario@odata.bind': `/${Tables.Concesionario}(${concesionarioId})`,
    'fl_creadopor@odata.bind': `/${Tables.UsuarioApp}(${usuario.fl_usuarioappid})`,
  })
  const lead = await getRecord<Pick<Lead, 'fl_numero'>>(Tables.Lead, leadId, 'fl_numero')

  await createRecord(Tables.FaseHistorico, {
    fl_titulo: `${lead?.fl_numero ?? leadId} — Prospección`,
    fl_fase: Fase.Prospeccion,
    fl_fechainicio: new Date().toISOString(),
    fl_esactual: true,
    'fl_lead@odata.bind': `/${Tables.Lead}(${leadId})`,
  })
  await marcarOportunidadAbierta(empresaId, leadId)

  // Lo ultimo: tras reasignarla, quien la creo deja de verla (seguridad Basic). Si el comercial
  // no tiene usuario vinculado, la oportunidad queda a nombre de quien la crea.
  let asignadaA: string | undefined
  const systemUserId = input.comercial._fl_systemuserid_value
  if (input.comercial.fl_usuarioappid !== usuario.fl_usuarioappid && systemUserId) {
    await updateRecord(Tables.Lead, leadId, { 'ownerid@odata.bind': `/systemusers(${systemUserId})` })
    asignadaA = input.comercial.fl_nombre
  }

  return { leadId, numero: lead?.fl_numero ?? '', asignadaA }
}

/** Cambia la fase de un lead, cerrando el historico abierto y abriendo uno nuevo. */
export async function cambiarFaseLead(
  leadId: string,
  numero: string,
  nuevaFase: Fase,
  motivoPerdida?: string,
  empresaId?: string,
): Promise<void> {
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
  if (empresaId) await sincronizarEmpresaConFase(empresaId, leadId, nuevaFase)
}

/** Mantiene en la empresa cuál es su oportunidad en curso y si ya es cliente. */
async function sincronizarEmpresaConFase(empresaId: string, leadId: string, fase: Fase): Promise<void> {
  const empresa = await fetchEmpresa(empresaId)
  if (!empresa) return
  const abierta = empresa._fl_oportunidadabierta_value
  if (esFaseAbierta(fase)) {
    if (!abierta) await marcarOportunidadAbierta(empresaId, leadId)
  } else if (abierta === leadId) {
    await marcarOportunidadAbierta(empresaId, null)
  }
  if ((fase === Fase.Cierre || fase === Fase.Entrega) && empresa.fl_estado !== EstadoEmpresa.Cliente) {
    await actualizarEmpresa(empresaId, { estado: EstadoEmpresa.Cliente })
  }
}

const FASE_TITULOS: Record<Fase, string> = {
  [Fase.Prospeccion]: 'Prospección',
  [Fase.PrimerContacto]: 'Primer Contacto',
  [Fase.Cualificacion]: 'Cualificación',
  [Fase.Propuesta]: 'Propuesta',
  [Fase.Negociacion]: 'Negociación',
  [Fase.Cierre]: 'Cierre',
  [Fase.Entrega]: 'Entrega',
  [Fase.Perdido]: 'Perdido',
}

const LEAD_SELECT =
  'fl_leadid,fl_numero,fl_razonsocial,fl_cif,fl_nombreresponsable,fl_telefonocorporativo,fl_emailcorporativo,' +
  'fl_numvehiculosactuales,fl_marcasactuales,fl_actividadeconomica,fl_modofinanciacionactual,fl_vencimientocontratosactuales,' +
  'fl_cuotasobjetivo,fl_modelosinteres,fl_numvehiculosrenovarampliar,fl_plazoestimadodecision,fl_competidoresdetectados,' +
  'fl_requisitos,fl_kmtiempo,fl_fechaprimercontacto,fl_faseactual,fl_ofertacondiciones,fl_descuentoconcesionario,fl_descuentoventas,fl_ultimaaccionrealizada,fl_proximaaccion,' +
  'fl_fechaproximaaccion,fl_comercialresponsable,fl_observaciones,fl_motivoperdida,createdon,' +
  '_fl_ubicacion_value,_fl_concesionario_value,_fl_creadopor_value,_ownerid_value,_fl_empresa_value,_fl_comercial_value'

/** Leads del concesionario conectado (la seguridad de fila ya restringe el resultado a los suyos). */
export async function fetchMisLeads(): Promise<Lead[]> {
  return conDatosDeEmpresa(await listRecords<Lead>(Tables.Lead, { select: LEAD_SELECT, orderby: 'createdon desc' }))
}

/** Oportunidades de una empresa que el usuario puede ver, de la más reciente a la más antigua. */
export async function fetchOportunidadesDeEmpresa(empresaId: string): Promise<Lead[]> {
  return conDatosDeEmpresa(
    await listRecords<Lead>(Tables.Lead, {
      select: LEAD_SELECT,
      filter: `_fl_empresa_value eq ${empresaId}`,
      orderby: 'createdon desc',
    }),
  )
}

/**
 * Los datos de empresa y contactos (secciones 1 y 2) se guardan en fl_empresa. Se copian sobre cada lead
 * al leerlo para que listas, KPIs y exportaciones sigan usando los mismos campos de siempre.
 */
async function conDatosDeEmpresa(leads: Lead[]): Promise<Lead[]> {
  const empresas = await fetchEmpresasPorIds(leads.map((l) => l._fl_empresa_value ?? ''))
  return leads.map((l) => {
    const e = l._fl_empresa_value ? empresas.get(l._fl_empresa_value) : undefined
    if (!e) return l
    return {
      ...l,
      fl_razonsocial: e.fl_razonsocial,
      fl_cif: e.fl_cif,
      fl_nombreresponsable: e.fl_nombreresponsable ?? '',
      fl_telefonocorporativo: e.fl_telefonocorporativo ?? '',
      fl_emailcorporativo: e.fl_emailcorporativo ?? '',
    }
  })
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
  return conDatosDeEmpresa(
    await listRecords<Lead>(Tables.Lead, {
      select: LEAD_SELECT,
      filter: partes.length ? partes.join(' and ') : undefined,
      orderby: 'createdon desc',
    }),
  )
}

export async function fetchLead(leadId: string): Promise<Lead | null> {
  const lead = await getRecord<Lead>(Tables.Lead, leadId, LEAD_SELECT)
  return lead ? (await conDatosDeEmpresa([lead]))[0] : null
}

export async function fetchHistoricoDeFase(leadId: string): Promise<FaseHistorico[]> {
  return listRecords<FaseHistorico>(Tables.FaseHistorico, {
    filter: `_fl_lead_value eq ${leadId}`,
    orderby: 'fl_fechainicio asc',
  })
}

export interface ActualizarLeadInput {
  razonSocial?: string
  cif?: string
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
  descuentoConcesionario?: number | null
  descuentoVentas?: number | null
  motivoPerdida?: string
}

const CAMPO_MAP: Record<keyof ActualizarLeadInput, string> = {
  razonSocial: 'fl_razonsocial',
  cif: 'fl_cif',
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
  descuentoConcesionario: 'fl_descuentoconcesionario',
  descuentoVentas: 'fl_descuentoventas',
  motivoPerdida: 'fl_motivoperdida',
}

// Campos que pertenecen a la empresa (sección 2, contactos). Desde la sección 3 todo es de la oportunidad.
const CAMPOS_EMPRESA = new Set<keyof ActualizarLeadInput>(['nombreResponsable', 'telefonoCorporativo', 'emailCorporativo'])
// Razón social y CIF son de la empresa, pero el lead guarda una copia porque las listas filtran por ellos.
const CAMPOS_EMPRESA_Y_LEAD = new Set<keyof ActualizarLeadInput>(['razonSocial', 'cif'])

/** Guarda la edición del detalle: los datos de empresa en su empresa (si la tiene) y el resto en el lead. */
export async function actualizarLead(leadId: string, input: ActualizarLeadInput, empresaId?: string): Promise<void> {
  const fields: Record<string, unknown> = {}
  const empresa: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    const k = key as keyof ActualizarLeadInput
    const v = k === 'cif' ? normalizarCif(String(value)) : value
    if (empresaId && (CAMPOS_EMPRESA.has(k) || CAMPOS_EMPRESA_Y_LEAD.has(k))) empresa[k] = v
    if (!empresaId || !CAMPOS_EMPRESA.has(k)) fields[CAMPO_MAP[k]] = v
  }
  // Si cambia el descuento del concesionario, el de ventas se borra para que ventas lo revise
  // (salvo que se guarden los dos a la vez, como hace el administrador).
  if (input.descuentoConcesionario !== undefined && input.descuentoVentas === undefined) fields.fl_descuentoventas = null
  if (empresaId) await actualizarEmpresa(empresaId, empresa as ActualizarEmpresaInput)
  if (Object.keys(fields).length === 0) return
  await updateRecord(Tables.Lead, leadId, fields)
}

/** Otra empresa del mismo concesionario con ese CIF, si la hay (el CIF identifica a la empresa). */
export async function cifEnOtraEmpresa(concesionarioId: string, cif: string, empresaId?: string): Promise<Empresa | null> {
  const otra = await buscarEmpresaPorCif(concesionarioId, cif)
  return otra && otra.fl_empresaid !== empresaId ? otra : null
}

/**
 * Cambia el comercial de la oportunidad. Si tiene usuario vinculado, la oportunidad pasa a ser suya
 * (y con ella su histórico, tareas, notas y adjuntos, por cascada); quien la cede deja de verla.
 */
export async function cambiarComercial(lead: Lead, comercial: UsuarioApp): Promise<{ reasignada: boolean }> {
  await updateRecord(Tables.Lead, lead.fl_leadid, {
    fl_comercialresponsable: comercial.fl_nombre,
    'fl_comercial@odata.bind': `/${Tables.UsuarioApp}(${comercial.fl_usuarioappid})`,
  })
  const systemUserId = comercial._fl_systemuserid_value
  if (!systemUserId || systemUserId === lead._ownerid_value) return { reasignada: false }
  await updateRecord(Tables.Lead, lead.fl_leadid, { 'ownerid@odata.bind': `/systemusers(${systemUserId})` })
  return { reasignada: true }
}
